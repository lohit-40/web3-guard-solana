import sqlite3
import random
import json
import time
import os

# Real-looking Solana program addresses for demo
DEMO_PROGRAMS = [
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
    "JD3bq9hGdy38PuWQ4h2YJpELmHVGPPfFSuFkpzAd9zfu",
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bw",
]

VULN_TEMPLATES = [
    [{"type": "Missing Signer Check", "severity": "HIGH", "line_number": 42,
      "description": "The instruction handler does not verify that the expected account signed the transaction.",
      "remediation": "Add `require!(ctx.accounts.authority.is_signer, ErrorCode::MissingSigner);`"}],
    [{"type": "Integer Overflow", "severity": "MEDIUM", "line_number": 87,
      "description": "Unchecked arithmetic on token amounts can overflow in release mode.",
      "remediation": "Use `checked_add`, `checked_mul` or the `#[account(constraint = ...)]` pattern."}],
    [{"type": "Missing Ownership Check", "severity": "CRITICAL", "line_number": 23,
      "description": "The program does not verify the account owner before executing privileged operations.",
      "remediation": "Verify `ctx.accounts.target.owner == expected_program_id` before processing."}],
    [],  # Clean contract — SAFE
    [{"type": "Duplicate Mutable Accounts", "severity": "LOW", "line_number": 105,
      "description": "Two mutable accounts point to the same account key, causing aliasing issues.",
      "remediation": "Add a constraint: `#[account(constraint = account_a.key() != account_b.key())]`"}],
]


def fix_database():
    try:
        from database import init_db
        init_db()
    except Exception as e:
        print("Could not init db:", e)

    conn = sqlite3.connect("cache.db")
    cursor = conn.cursor()

    # ── 1. Seed system user ──────────────────────────────────────────────────
    cursor.execute(
        "INSERT OR REPLACE INTO users (wallet_address, audit_count) VALUES ('0xSystem', 142)"
    )

    # ── 2. Seed watchlist so watched_contracts > 0 ───────────────────────────
    for prog in DEMO_PROGRAMS:
        cursor.execute(
            "INSERT OR IGNORE INTO watchlist (contract_address, added_by, risk_level) VALUES (?, ?, ?)",
            (prog, "System", random.choice(["LOW", "MEDIUM", "HIGH", "SAFE"]))
        )

    # ── 3. Seed scan_cache with Solana audit results ─────────────────────────
    cursor.execute("SELECT COUNT(*) FROM scan_cache")
    count = cursor.fetchone()[0]
    if count < 10:
        for i, program in enumerate(DEMO_PROGRAMS * 3):  # 15 records
            vulns = VULN_TEMPLATES[i % len(VULN_TEMPLATES)]
            if vulns:
                sevs = [v["severity"].upper() for v in vulns]
                risk = "CRITICAL" if "CRITICAL" in sevs else ("HIGH" if "HIGH" in sevs else ("MEDIUM" if "MEDIUM" in sevs else "LOW"))
            else:
                risk = "SAFE"

            # hash_key must be unique
            ts = int(time.time()) - (i * 3600)
            hash_key = f"demo_solana_{i}_{ts}"

            response_data = {
                "hash_key": hash_key,
                "address": program,
                "status": "Success",
                "vulnerabilities": vulns,
                "audit_tx_hash": None,
                "audit_chain": "solana",
                "solana_explorer_url": f"https://explorer.solana.com/address/{program}?cluster=devnet",
                "stellar_explorer_url": None,
                "soroban_contract_id": None,
                "soroban_proof_id": None,
                "timestamp": ts,
            }
            cursor.execute(
                "INSERT OR REPLACE INTO scan_cache (hash_key, response_data) VALUES (?, ?)",
                (hash_key, json.dumps(response_data))
            )

    # ── 4. Seed monitoring_events (agent activity feed) ──────────────────────
    cursor.execute("SELECT COUNT(*) FROM monitoring_events")
    evt_count = cursor.fetchone()[0]
    if evt_count < 5:
        agent_events = [
            ("Scout Agent",   "SCOUT_POLL",       "Txs seen: 14 | Anomaly: False"),
            ("Analyst Agent", "ANALYST_SCAN",      "AI scan complete. Risk: MEDIUM. Vulns: 1 (delta +1)"),
            ("Scout Agent",   "WS_LIVE_EVENT",     "[WebSocket] tx=5vNkCaGT... err=None logs=3"),
            ("Reporter Agent","ALERT_SENT",         "Telegram alert dispatched for HIGH risk program"),
            ("Defender Agent","AUDIT_ATTESTATION",  "On-chain proof anchored for TokenkegQfeZ..."),
        ]
        for prog in DEMO_PROGRAMS[:5]:
            agent_type, event_type, details = random.choice(agent_events)
            cursor.execute(
                """INSERT INTO monitoring_events
                   (contract_address, event_type, details, agent_type, risk_before, risk_after)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (prog, event_type, details, agent_type, "LOW", "MEDIUM")
            )

    conn.commit()
    conn.close()
    print("[fix_db] Database seeded with demo Solana data!")


if __name__ == "__main__":
    fix_database()
