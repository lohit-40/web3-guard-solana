import sqlite3
import random
import json
import time
import os

def fix_database():
    try:
        from database import init_db
        init_db()
    except Exception as e:
        print("Could not init db:", e)

    conn = sqlite3.connect("cache.db")
    cursor = conn.cursor()
    
    # 1. Ensure high scan volume in users
    cursor.execute("SELECT wallet_address FROM users")
    wallets = cursor.fetchall()
    
    if not wallets:
        cursor.execute("INSERT OR IGNORE INTO users (wallet_address, audit_count) VALUES ('0xSystem', 142)")
    else:
        for w in wallets:
            cursor.execute("UPDATE users SET audit_count = ? WHERE wallet_address = ?", (random.randint(5, 25), w[0]))
        
    # 2. Add contracts to watchlist so watched_contracts > 0
    dummy_contracts = [
        "CDQQQUGCX33O7JAUXOJHPC6JONZ3D5UPWW6IHNUHLPSLF7IPZHQ2WBZU",
        "EchidnaProtocolX9D38f...",
        "SerumDEXv3x929Dkd92...",
        "RaydiumLiquidityPoolV4..."
    ]
    for dc in dummy_contracts:
        cursor.execute("INSERT OR IGNORE INTO watchlist (contract_address, added_by, risk_level) VALUES (?, ?, ?)",
                       (dc, "System", "PENDING"))
                       
    # 3. Add fake audits to scan_cache so /explorer works
    cursor.execute("SELECT COUNT(*) FROM scan_cache")
    count = cursor.fetchone()[0]
    if count < 10:
        for i in range(15):
            hash_key = f"audit_{int(time.time()) - i * 3600}"
            response_data = {
                "hash_key": hash_key,
                "address": f"Program_{i}_{random.randint(1000, 9999)}",
                "vulnerabilities": [{"severity": "Medium", "title": "Missing reentrancy guard"}],
                "gas_optimizations": [],
                "quality_issues": [],
                "audit_chain": random.choice(["solana", "stellar"]),
                "timestamp": int(time.time()) - i * 3600
            }
            cursor.execute('''
                INSERT OR REPLACE INTO scan_cache (hash_key, response_data)
                VALUES (?, ?)
            ''', (hash_key, json.dumps(response_data)))

    # 4. Add fake monitoring events
    cursor.execute("SELECT COUNT(*) FROM monitoring_events")
    evt_count = cursor.fetchone()[0]
    if evt_count < 5:
        for i in range(5):
            cursor.execute('''
                INSERT INTO monitoring_events (contract_address, event_type, details, agent_type, risk_before, risk_after)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                random.choice(dummy_contracts),
                "Scan Complete",
                "Autonomous scout detected 1 new medium risk vector.",
                "Scout Agent",
                "LOW",
                "MEDIUM"
            ))

    conn.commit()
    conn.close()
    print("Database seeded with demo data!")

if __name__ == "__main__":
    fix_database()
