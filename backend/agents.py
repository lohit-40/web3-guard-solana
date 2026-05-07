"""
Web3 Guard — Solana Agents v3  (REAL implementation)
─────────────────────────────────────────────────────
ScoutAgent:
  - poll_program: rolling Z-score anomaly detection (60-sample ring buffer)
  - subscribe_program: Helius logsSubscribe WS, ping_interval=60s, exponential backoff
  - add_subscription / start_all: dynamic per-program task management

AnalystAgent:
  - Gemini AI deep scan (unchanged — already real)

ReporterAgent:
  - Telegram + Discord alerts + Solana Memo proof-of-audit (unchanged — already real)

DefenderAgent:
  - approve_pause: checks BPFLoaderUpgradeable upgrade authority
    → if we ARE the authority: revoke it (real immutable kill-switch)
    → if NOT:                   on-chain audit attestation (honest branding)
"""

import os
import json
import asyncio
import aiohttp
import hashlib
import struct
import time
import statistics
from collections import deque
from typing import Dict, Any, List, Optional


# ─── SCOUT AGENT ─────────────────────────────────────────────────────────────

class ScoutAgent:
    """
    Monitors Solana programs for on-chain anomalies.
    - Polling: rolling Z-score over 60-sample ring buffer.
    - Real-time: Helius logsSubscribe WebSocket (ping keepalive + exponential backoff).
    - Dynamic: add_subscription() wires new programs without restart.
    """

    def __init__(self):
        helius_key = os.getenv("HELIUS_KEY", "")
        if helius_key and helius_key not in ("", "PASTE_YOUR_HELIUS_KEY_HERE"):
            self.rpc_url = f"https://mainnet.helius-rpc.com/?api-key={helius_key}"
            self.ws_url  = f"wss://mainnet.helius-rpc.com/?api-key={helius_key}"
            self._using_helius = True
        else:
            self.rpc_url = "https://api.devnet.solana.com"
            self.ws_url  = "wss://api.devnet.solana.com"
            self._using_helius = False

        # per-program ring buffers: stores last 60 tx-count samples (1 sample/min)
        self._baselines: Dict[str, deque] = {}
        # active WS asyncio tasks keyed by program_id
        self._subscriptions: Dict[str, asyncio.Task] = {}
        # set by start_all_subscriptions; handlers push events here
        self._event_queue: Optional[asyncio.Queue] = None

    # ── Anomaly Detection (Rolling Z-score) ──────────────────────────────────

    def _detect_anomaly(self, program_id: str, tx_count: int) -> tuple:
        """
        Returns (is_anomaly: bool, severity: str, sigma: float).
        Uses a 60-sample rolling Z-score baseline.
        Cold-start (<5 samples) uses a simple absolute threshold.
        """
        if program_id not in self._baselines:
            self._baselines[program_id] = deque(maxlen=60)

        buf = self._baselines[program_id]

        # ── Cold start: not enough history yet ──
        if len(buf) < 5:
            buf.append(tx_count)
            if tx_count > 30:
                return True, "HIGH", 0.0
            if tx_count > 15:
                return True, "MEDIUM", 0.0
            return False, "LOW", 0.0

        # ── Compute baseline BEFORE appending current value ──
        mean = statistics.mean(buf)
        std  = statistics.stdev(buf) if len(buf) > 1 else 0.0
        buf.append(tx_count)

        if std < 0.5:
            # Flat/quiet program — any spike of 3+ txs above mean is notable
            anomaly  = tx_count > mean + 3
            severity = "MEDIUM" if anomaly else "LOW"
            sigma    = 0.0
        else:
            sigma    = (tx_count - mean) / std
            anomaly  = sigma > 2.5
            if sigma >= 3.5:
                severity = "CRITICAL"
            elif sigma >= 3.0:
                severity = "HIGH"
            elif sigma >= 2.5:
                severity = "MEDIUM"
            else:
                severity = "LOW"

        return anomaly, severity, sigma

    # ── Polling Fallback ──────────────────────────────────────────────────────

    async def poll_program(self, program_id: str) -> Dict[str, Any]:
        """
        Fetches recent signatures and runs Z-score anomaly detection.
        Called every 60s by APScheduler as the polling fallback.
        """
        try:
            from solana.rpc.async_api import AsyncClient
            from solders.pubkey import Pubkey

            client = AsyncClient(self.rpc_url)
            pubkey = Pubkey.from_string(program_id)
            resp   = await client.get_signatures_for_address(pubkey, limit=25)
            await client.close()

            sigs      = resp.value if hasattr(resp, "value") and resp.value else []
            tx_count  = len(sigs)
            anomaly, severity, sigma = self._detect_anomaly(program_id, tx_count)

            return {
                "program_id":  program_id,
                "anomaly":     anomaly,
                "recent_txs":  tx_count,
                "severity":    severity,
                "sigma":       round(sigma, 2),
                "baseline_n":  len(self._baselines.get(program_id, [])),
                "timestamp":   int(time.time()),
                "latest_sig":  str(sigs[0].signature) if sigs else None,
                "source":      "helius_rpc" if self._using_helius else "devnet_rpc",
            }
        except Exception as e:
            return {
                "program_id": program_id,
                "anomaly":    False,
                "error":      str(e),
                "timestamp":  int(time.time()),
            }

    # ── WebSocket: single program subscription ────────────────────────────────

    async def subscribe_program(self, program_id: str, handler) -> None:
        """
        Opens a persistent logsSubscribe WebSocket for one program.
        - ping_interval=60s satisfies Helius 10-min inactivity timer.
        - Exponential backoff (1→2→4→…→60s) on disconnect.
        - Re-subscribes immediately after reconnect.
        """
        import websockets

        backoff = 1
        while True:
            try:
                async with websockets.connect(
                    self.ws_url,
                    ping_interval=60,
                    ping_timeout=20,
                ) as ws:
                    backoff = 1  # reset on successful connect

                    sub_msg = json.dumps({
                        "jsonrpc": "2.0",
                        "id": 1,
                        "method": "logsSubscribe",
                        "params": [
                            {"mentions": [program_id]},
                            {"commitment": "confirmed"},
                        ],
                    })
                    await ws.send(sub_msg)
                    print(f"[Scout WS] logsSubscribe live → {program_id[:8]}...")

                    async for raw in ws:
                        data = json.loads(raw)
                        # subscription confirmation — skip
                        if "result" in data and "params" not in data:
                            continue
                        # real log notification
                        if "params" in data:
                            result = data["params"].get("result", {})
                            await handler(result, program_id)

            except asyncio.CancelledError:
                print(f"[Scout WS] {program_id[:8]} cancelled — shutting down")
                return
            except Exception as e:
                print(f"[Scout WS] {program_id[:8]} disconnected ({e}), retry in {backoff}s")
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 60)

    # ── Dynamic subscription management ──────────────────────────────────────

    async def add_subscription(self, program_id: str) -> None:
        """Dynamically add a live WS subscription for a new watchlist program."""
        if program_id in self._subscriptions:
            return  # already subscribed
        if self._event_queue is None:
            return  # app not started yet; polling will cover it

        async def _handler(log_result: dict, pid: str):
            await self._event_queue.put({
                "program_id": pid,
                "log":        log_result,
                "ts":         int(time.time()),
            })

        task = asyncio.create_task(
            self.subscribe_program(program_id, _handler),
            name=f"ws-{program_id[:8]}",
        )
        self._subscriptions[program_id] = task
        print(f"[Scout WS] Dynamic subscription added: {program_id[:8]}")

    async def start_all_subscriptions(self, programs: List[str], event_queue: asyncio.Queue) -> None:
        """
        Called once at app startup.
        Fans out one persistent WS task per watchlisted program.
        """
        self._event_queue = event_queue
        for prog in programs:
            await self.add_subscription(prog)
        # Keep running until cancelled
        try:
            await asyncio.gather(*self._subscriptions.values())
        except asyncio.CancelledError:
            for task in self._subscriptions.values():
                task.cancel()
            raise

    async def cancel_all(self) -> None:
        """Gracefully cancel all WS subscription tasks (called on shutdown)."""
        for task in self._subscriptions.values():
            task.cancel()
        if self._subscriptions:
            await asyncio.gather(*self._subscriptions.values(), return_exceptions=True)
        self._subscriptions.clear()


# ─── ANALYST AGENT ───────────────────────────────────────────────────────────

class AnalystAgent:
    """
    Deep AI security analysis via Gemini.
    Compares results against agent_memory to emit risk deltas.
    (unchanged — already fully real)
    """

    SOLANA_VULN_PROMPT = """
You are an elite Solana / Rust smart contract security auditor.
Analyse the following source code for ALL known Solana vulnerability classes:
  1. Missing signer checks
  2. Missing ownership checks
  3. Arbitrary CPI (cross-program invocation)
  4. Integer overflow/underflow (unchecked arithmetic in release mode)
  5. Account reinitialization attack vectors
  6. PDA seed collision
  7. Type confusion / type cosplay
  8. Duplicate mutable accounts
  9. Compute budget exhaustion
  10. Missing system account validation

Return ONLY a raw JSON array of vulnerability objects (no markdown blocks).
Each object: {{"type": str, "severity": "CRITICAL|HIGH|MEDIUM|LOW",
               "line_number": int|null, "description": str, "remediation": str}}
If code is clean return [].

Source Code:
{source_code}
"""

    def __init__(self):
        pass

    async def analyze(
        self,
        program_id:  str,
        source_code: str,
        prev_vulns:  Optional[List[Dict]] = None,
    ) -> Dict[str, Any]:
        from google import genai
        from pathlib import Path
        from dotenv import load_dotenv

        load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)
        raw_keys = os.getenv("GEMINI_API_KEY", "")
        keys = [k.strip() for k in raw_keys.split(",")
                if k.strip() and k.strip() != "PASTE_YOUR_GEMINI_KEY_HERE"]

        if not keys:
            return {"error": "GEMINI_API_KEY not configured", "program_id": program_id}

        prompt = self.SOLANA_VULN_PROMPT.format(source_code=source_code)
        vulns  = []

        MODELS = ["gemini-2.0-flash", "gemini-1.5-flash"]
        for key in keys:
            for model_name in MODELS:
                try:
                    client   = genai.Client(api_key=key)
                    response = client.models.generate_content(
                        model=model_name, contents=prompt
                    )
                    text = response.text.strip().lstrip("```json").lstrip("```").rstrip("```")
                    vulns = json.loads(text)
                    break  # success
                except Exception as e:
                    if "503" in str(e) or "NOT_FOUND" in str(e) or "UNAVAILABLE" in str(e):
                        continue  # try next model
                    if "429" in str(e) and key != keys[-1]:
                        break  # try next key
                    vulns = []
            else:
                continue  # inner loop didn't break — all models failed for this key
            break  # inner loop broke on success

        severities = [v.get("severity", "").upper() for v in vulns]
        if "CRITICAL" in severities:   risk = "CRITICAL"
        elif "HIGH" in severities:     risk = "HIGH"
        elif "MEDIUM" in severities:   risk = "MEDIUM"
        elif vulns:                    risk = "LOW"
        else:                          risk = "SAFE"

        prev_count = len(prev_vulns) if prev_vulns else 0
        curr_count = len(vulns)

        return {
            "program_id":      program_id,
            "vulnerabilities": vulns,
            "vuln_count":      curr_count,
            "vuln_delta":      curr_count - prev_count,
            "risk_level":      risk,
            "risk_score":      self._score(risk),
            "timestamp":       int(time.time()),
        }

    @staticmethod
    def _score(risk: str) -> int:
        return {"SAFE": 0, "LOW": 25, "MEDIUM": 50, "HIGH": 75, "CRITICAL": 100}.get(risk, 0)


# ─── REPORTER AGENT ──────────────────────────────────────────────────────────

class ReporterAgent:
    """
    Sends structured alerts over Telegram and Discord.
    Anchors audit proofs on Solana Devnet via Memo program.
    (unchanged — already fully real)
    """

    def __init__(self):
        self.tg_token = os.getenv("TELEGRAM_BOT_TOKEN", "")

    async def send_telegram(self, chat_id: str, text: str) -> None:
        if not self.tg_token or self.tg_token == "PASTE_YOUR_TELEGRAM_BOT_TOKEN_HERE":
            print(f"[Reporter] Telegram not configured — would send to {chat_id}: {text[:60]}")
            return
        url     = f"https://api.telegram.org/bot{self.tg_token}/sendMessage"
        payload = {"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}
        async with aiohttp.ClientSession() as session:
            try:
                await session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=10))
            except Exception as e:
                print(f"[Reporter] Telegram error: {e}")

    async def send_alert(self, chat_id: str, report: Dict) -> None:
        emoji = {"CRITICAL": "🚨", "HIGH": "🔴", "MEDIUM": "🟡", "LOW": "🟢", "SAFE": "✅"}.get(
            report.get("risk_level", "LOW"), "⚠️"
        )
        prog      = report.get("program_id", "unknown")
        risk      = report.get("risk_level", "UNKNOWN")
        count     = report.get("vuln_count", 0)
        delta     = report.get("vuln_delta", 0)
        sigma     = report.get("sigma", 0.0)
        delta_str = f"+{delta}" if delta > 0 else str(delta)
        proof     = report.get("solana_proof_tx", "")
        proof_line = (
            f"\n🔗 *Proof:* [Solana Explorer]"
            f"(https://explorer.solana.com/tx/{proof}?cluster=devnet)"
            if proof else ""
        )
        msg = (
            f"{emoji} *Web3 Guard Alert*\n\n"
            f"*Program:* `{prog[:8]}...{prog[-6:]}`\n"
            f"*Risk Level:* `{risk}`\n"
            f"*Vulnerabilities:* {count}  _(delta: {delta_str})_\n"
            f"*Anomaly σ:* `{sigma:.2f}`"
            f"{proof_line}"
        )
        await self.send_telegram(chat_id, msg)

    async def send_discord(self, webhook_url: str, report: Dict) -> None:
        if not webhook_url:
            return
        COLOR = {
            "CRITICAL": 0xFF0000, "HIGH": 0xFF4500,
            "MEDIUM": 0xFFAA00, "LOW": 0x00CC66, "SAFE": 0x00FF88,
        }.get(report.get("risk_level", "LOW"), 0xAAAAAA)

        prog  = report.get("program_id", "unknown")
        risk  = report.get("risk_level", "UNKNOWN")
        count = report.get("vuln_count", 0)
        sigma = report.get("sigma", 0.0)
        proof = report.get("solana_proof_tx", "")

        fields = [
            {"name": "Risk Level",       "value": risk,          "inline": True},
            {"name": "Vulnerabilities",  "value": str(count),    "inline": True},
            {"name": "Anomaly σ",        "value": f"{sigma:.2f}","inline": True},
        ]
        if proof:
            fields.append({
                "name":   "On-Chain Proof",
                "value":  f"[{proof[:12]}...](https://explorer.solana.com/tx/{proof}?cluster=devnet)",
                "inline": False,
            })

        embed   = {"title": f"🚨 Security Alert — {prog[:12]}...", "color": COLOR, "fields": fields}
        payload = {"embeds": [embed]}
        async with aiohttp.ClientSession() as session:
            try:
                await session.post(webhook_url, json=payload, timeout=aiohttp.ClientTimeout(total=10))
            except Exception as e:
                print(f"[Reporter] Discord error: {e}")

    async def anchor_proof(self, program_id: str, report_hash: str) -> str:
        """Writes a Memo transaction to Solana Devnet anchoring the audit hash."""
        from dotenv import load_dotenv
        from pathlib import Path
        load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

        sol_key_hex = os.getenv("WALLET_PRIVATE_KEY", "")
        if not sol_key_hex or sol_key_hex == "PASTE_YOUR_64BYTE_HEX_PRIVATE_KEY_HERE":
            return "wallet_not_configured"

        try:
            from solders.keypair import Keypair
            from solders.pubkey import Pubkey
            from solders.transaction import Transaction
            from solders.message import Message
            from solders.instruction import Instruction, AccountMeta
            from solana.rpc.api import Client

            client    = Client("https://api.devnet.solana.com")
            key_bytes = bytes.fromhex(sol_key_hex)
            signer    = Keypair.from_seed(key_bytes[:32])

            MEMO_PROG = Pubkey.from_string("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr")
            memo_data = f"WG|{program_id[:8]}|{report_hash[:16]}".encode("utf-8")
            memo_ix   = Instruction(
                program_id=MEMO_PROG,
                accounts=[AccountMeta(pubkey=signer.pubkey(), is_signer=True, is_writable=False)],
                data=memo_data,
            )
            bh  = client.get_latest_blockhash().value.blockhash
            msg = Message.new_with_blockhash([memo_ix], signer.pubkey(), bh)
            tx  = Transaction.new_unsigned(msg)
            tx.sign([signer], bh)
            result = client.send_transaction(tx)
            return str(result.value)
        except Exception as e:
            print(f"[Reporter] Anchor error: {e}")
            return f"error_{str(e)[:20]}"


# ─── DEFENDER AGENT ──────────────────────────────────────────────────────────

class DefenderAgent:
    """
    Analyses vulnerability severity and—for CRITICAL findings—proposes a pause.

    approve_pause():
      1. If backend wallet IS the BPFLoaderUpgradeable upgrade authority
         of the target program → calls SetAuthority to revoke it (permanent
         immutable freeze — the real Solana kill switch).
      2. If NOT the upgrade authority → publishes an on-chain audit attestation
         via Memo and notifies the protocol team via Telegram/Discord.
         This is honest: Web3 Guard is a security auditor, not the program owner.
    """

    BPF_LOADER_ID = "BPFLoaderUpgradeab1e11111111111111111111111"

    def __init__(self):
        self.reporter   = ReporterAgent()
        self._pending: Dict[str, Dict] = {}

    def is_critical(self, vulns: List[Dict]) -> bool:
        return any(v.get("severity", "").upper() == "CRITICAL" for v in vulns)

    async def propose_pause(self, program_id: str, vulns: List[Dict], chat_id: str) -> Dict:
        pause_payload = {
            "program_id":    program_id,
            "action":        "PAUSE",
            "method":        "bpf_authority_revoke_or_audit_attestation",
            "justification": f"{len(vulns)} CRITICAL vulnerability/ies detected by Analyst Agent",
            "timestamp":     int(time.time()),
            "status":        "AWAITING_OWNER_APPROVAL",
            "pending_tx_id": "WG_PENDING_" + hashlib.sha256(program_id.encode()).hexdigest()[:16],
        }
        self._pending[program_id] = pause_payload

        msg = (
            "🛡️ *Defender Agent — Pause Proposal*\n\n"
            f"CRITICAL vulnerabilities detected in:\n`{program_id}`\n\n"
            f"*Vulnerabilities:* {len(vulns)}\n\n"
            "Reply `/approve` to execute emergency response.\n"
            "Reply `/dismiss` to acknowledge and continue monitoring."
        )
        if chat_id:
            await self.reporter.send_telegram(chat_id, msg)
        return pause_payload

    async def approve_pause(self, program_id: str, chat_id: str) -> str:
        payload = self._pending.pop(program_id, None)
        if not payload:
            return "no_pending_proposal"

        from dotenv import load_dotenv
        from pathlib import Path
        load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

        sol_key_hex = os.getenv("WALLET_PRIVATE_KEY", "")
        if not sol_key_hex or sol_key_hex == "PASTE_YOUR_64BYTE_HEX_PRIVATE_KEY_HERE":
            if chat_id:
                await self.reporter.send_telegram(chat_id, "❌ *Error:* Backend wallet not configured.")
            return "wallet_not_configured"

        try:
            from solders.keypair import Keypair
            from solders.pubkey import Pubkey
            from solders.transaction import Transaction
            from solders.message import Message
            from solders.instruction import Instruction, AccountMeta
            from solana.rpc.api import Client

            client    = Client("https://api.devnet.solana.com")
            key_bytes = bytes.fromhex(sol_key_hex)
            signer    = Keypair.from_seed(key_bytes[:32])

            BPF_LOADER     = Pubkey.from_string(self.BPF_LOADER_ID)
            program_pubkey = Pubkey.from_string(program_id)

            # ── Derive ProgramData address ──
            program_data_addr, _ = Pubkey.find_program_address(
                [bytes(program_pubkey)], BPF_LOADER
            )

            # ── Check if we are the upgrade authority ──
            is_upgrade_authority = False
            try:
                info = client.get_account_info(program_data_addr)
                if info.value and info.value.data and len(info.value.data) > 41:
                    raw = info.value.data
                    # BPFLoaderUpgradeable ProgramData layout:
                    # bytes 0–7: last_update_slot (u64)
                    # byte 8: Option<Pubkey> tag (1 = Some)
                    # bytes 9–40: upgrade authority pubkey (32 bytes)
                    if raw[8] == 1:
                        authority_bytes  = raw[9:41]
                        authority_pubkey = Pubkey.from_bytes(authority_bytes)
                        is_upgrade_authority = (authority_pubkey == signer.pubkey())
            except Exception as e:
                print(f"[Defender] Authority check error: {e}")

            if is_upgrade_authority:
                # ── REAL KILL SWITCH: Revoke upgrade authority → program becomes immutable ──
                # SetAuthority instruction discriminant = 4
                # Authority type 0 = UpgradeAuthority
                # Omitting the new_authority account = revoke (set to None)
                ix_data = struct.pack("<II", 4, 0)  # SetAuthority, UpgradeAuthority
                keys = [
                    AccountMeta(pubkey=program_data_addr,  is_signer=False, is_writable=True),
                    AccountMeta(pubkey=signer.pubkey(),    is_signer=True,  is_writable=False),
                    # No new authority account → revoke
                ]
                ix  = Instruction(program_id=BPF_LOADER, accounts=keys, data=ix_data)
                bh  = client.get_latest_blockhash().value.blockhash
                msg = Message.new_with_blockhash([ix], signer.pubkey(), bh)
                tx  = Transaction.new_unsigned(msg)
                tx.sign([signer], bh)

                result       = client.send_transaction(tx)
                actual_tx_id = str(result.value)
                kill_type    = "UPGRADE_AUTHORITY_REVOKED"

                confirm = (
                    "🔴 *Emergency Program Freeze Executed*\n\n"
                    f"Program: `{program_id[:12]}...`\n"
                    f"*Action:* Upgrade authority permanently revoked\n"
                    f"*Result:* Program is now immutable — no further upgrades possible\n"
                    f"*TX:* `{actual_tx_id}`\n\n"
                    "_Verify on Solana Explorer (devnet)_"
                )

            else:
                # ── HONEST FALLBACK: On-chain audit attestation via Memo ──
                MEMO_PROG = Pubkey.from_string("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr")
                memo_data = f"WG_AUDIT_ALERT|{program_id[:16]}|CRITICAL_VULNS".encode("utf-8")
                memo_ix   = Instruction(
                    program_id=MEMO_PROG,
                    accounts=[AccountMeta(pubkey=signer.pubkey(), is_signer=True, is_writable=False)],
                    data=memo_data,
                )
                bh  = client.get_latest_blockhash().value.blockhash
                msg = Message.new_with_blockhash([memo_ix], signer.pubkey(), bh)
                tx  = Transaction.new_unsigned(msg)
                tx.sign([signer], bh)

                result       = client.send_transaction(tx)
                actual_tx_id = str(result.value)
                kill_type    = "AUDIT_ATTESTATION"

                confirm = (
                    "📋 *Security Audit Attestation Published*\n\n"
                    f"Program: `{program_id[:12]}...`\n"
                    f"*Action:* Critical vulnerability report anchored on-chain\n"
                    f"*TX:* `{actual_tx_id}`\n\n"
                    "_Web3 Guard is not the upgrade authority of this program.\n"
                    "The protocol team must take emergency action._"
                )

            payload["status"]           = "APPROVED_AND_EXECUTED"
            payload["executed_tx"]      = actual_tx_id
            payload["kill_switch_type"] = kill_type

            if chat_id:
                await self.reporter.send_telegram(chat_id, confirm)
            return actual_tx_id

        except Exception as e:
            print(f"[Defender] Execute error: {e}")
            if chat_id:
                await self.reporter.send_telegram(chat_id, f"❌ *Error Executing:* {str(e)[:80]}")
            return "execution_failed"
