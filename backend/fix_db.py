import random
import json
import time
import os

# Real Solana program addresses for demo
DEMO_PROGRAMS = [
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
    "JD3bq9hGdy38PuWQ4h2YJpELmHVGPPfFSuFkpzAd9zfu",
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bw",
    "So11111111111111111111111111111111111111112",
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
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
    [{"type": "Unchecked Account Data", "severity": "HIGH", "line_number": 61,
      "description": "Account data is read without verifying discriminator.",
      "remediation": "Use Anchor account type constraints to enforce discriminator checks."}],
    [{"type": "PDA Seed Collision", "severity": "MEDIUM", "line_number": 33,
      "description": "PDA seeds are not sufficiently unique.",
      "remediation": "Add a unique program-specific prefix to all PDA seed arrays."}],
]


def fix_database():
    """
    Idempotent seeder — safe to call on every startup.
    Uses get_connection() so it works with both SQLite (local) and
    Postgres (Cloud Run with DATABASE_URL env var).
    """
    try:
        from database import init_db, get_connection
        init_db()
    except Exception as e:
        print("Could not init db:", e)
        return

    try:
        conn = get_connection()
    except Exception as e:
        print("Could not open DB connection:", e)
        return

    cursor = conn.cursor()

    # Detect placeholder style (SQLite uses ? Postgres uses %s)
    try:
        from database import DB_URL
        ph = "%s" if DB_URL else "?"
        or_replace = "INSERT INTO" if DB_URL else "INSERT OR REPLACE INTO"
        or_ignore  = "INSERT INTO" if DB_URL else "INSERT OR IGNORE INTO"
        on_conflict_replace = " ON CONFLICT (wallet_address) DO UPDATE SET audit_count=EXCLUDED.audit_count" if DB_URL else ""
        on_conflict_ignore  = " ON CONFLICT (contract_address) DO NOTHING" if DB_URL else ""
        on_conflict_cache   = " ON CONFLICT (hash_key) DO UPDATE SET response_data=EXCLUDED.response_data" if DB_URL else ""
    except Exception:
        ph = "?"
        or_replace = "INSERT OR REPLACE INTO"
        or_ignore  = "INSERT OR IGNORE INTO"
        on_conflict_replace = ""
        on_conflict_ignore  = ""
        on_conflict_cache   = ""

    # -- 1. Seed users so total_audits > 0 ------------------------------------
    for wallet, count in [("0xSystem", 142), ("0xDemoUser1", 27), ("0xDemoUser2", 19)]:
        try:
            cursor.execute(
                f"{or_replace} users (wallet_address, audit_count) VALUES ({ph}, {ph}){on_conflict_replace}",
                (wallet, count)
            )
        except Exception as e:
            print(f"User seed error: {e}")

    # -- 2. Seed watchlist so watched_contracts > 0 ---------------------------
    for prog in DEMO_PROGRAMS:
        try:
            cursor.execute(
                f"{or_ignore} watchlist (contract_address, added_by, risk_level) VALUES ({ph}, {ph}, {ph}){on_conflict_ignore}",
                (prog, "System", random.choice(["LOW", "MEDIUM", "HIGH", "SAFE"]))
            )
        except Exception as e:
            print(f"Watchlist seed error: {e}")

    # -- 3. Seed scan_cache with stable Solana audit results ------------------
    #  Stable hash_key = demo_solana_NNN — idempotent across restarts.
    programs_x3 = (DEMO_PROGRAMS * 3)[:21]
    for i, program in enumerate(programs_x3):
        vulns = VULN_TEMPLATES[i % len(VULN_TEMPLATES)]
        if vulns:
            sevs = [v["severity"].upper() for v in vulns]
            risk = ("CRITICAL" if "CRITICAL" in sevs else
                    "HIGH"     if "HIGH"     in sevs else
                    "MEDIUM"   if "MEDIUM"   in sevs else "LOW")
        else:
            risk = "SAFE"

        hash_key = f"demo_solana_{i:03d}"
        ts = int(time.time()) - (i * 3600)

        response_data = json.dumps({
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
        })

        try:
            cursor.execute(
                f"{or_replace} scan_cache (hash_key, response_data) VALUES ({ph}, {ph}){on_conflict_cache}",
                (hash_key, response_data)
            )
        except Exception as e:
            print(f"scan_cache seed error {hash_key}: {e}")

    # -- 4. Seed monitoring_events -------------------------------------------
    agent_events = [
        ("Scout",    "SCOUT_POLL",        "Txs seen: 14 | Anomaly: False"),
        ("Analyst",  "ANALYST_SCAN",      "AI scan complete. Risk: MEDIUM. Vulns: 1 (delta +1)"),
        ("Scout",    "WS_LIVE_EVENT",     "[WebSocket] tx=5vNkCaGT... err=None logs=3"),
        ("Reporter", "ALERT_SENT",        "Telegram alert dispatched for HIGH risk program"),
        ("Defender", "AUDIT_ATTESTATION", "On-chain proof anchored for TokenkegQfeZ..."),
        ("Scout",    "SCOUT_POLL",        "Txs seen: 31 | Anomaly: True — escalating to Analyst"),
        ("Analyst",  "ANALYST_SCAN",      "Critical reentrancy pattern detected. Risk: CRITICAL. Vulns: 3"),
    ]
    for idx, prog in enumerate(DEMO_PROGRAMS):
        agent_type, event_type, details = agent_events[idx % len(agent_events)]
        try:
            cursor.execute(
                f"""INSERT INTO monitoring_events
                   (contract_address, event_type, details, agent_type, risk_before, risk_after)
                   VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}){on_conflict_ignore}""",
                (prog, event_type, details, agent_type, "LOW", "MEDIUM")
            )
        except Exception:
            pass  # Duplicate events are fine to skip

    conn.commit()
    conn.close()
    print("[fix_db] Database seeded with demo Solana data!")


if __name__ == "__main__":
    fix_database()
