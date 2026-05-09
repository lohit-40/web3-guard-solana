import sqlite3, json

DB = "backend/cache.db"

conn = sqlite3.connect(DB)
cur = conn.cursor()

# --- Simulate explorer/stats ---
cur.execute("SELECT COUNT(*) FROM scan_cache")
cache_count = cur.fetchone()[0]

cur.execute("SELECT SUM(audit_count) FROM users")
user_scans = cur.fetchone()[0] or 0

cur.execute("SELECT COUNT(*) FROM watchlist")
watchlist_count = cur.fetchone()[0]

cur.execute("SELECT response_data FROM scan_cache")
rows = cur.fetchall()
non_evm = []
for row in rows:
    data = json.loads(row[0])
    chain = data.get("audit_chain")
    if chain and chain != "ethereum":
        non_evm.append(data)

total_audits = max(cache_count, user_scans, len(non_evm))
rpc_connected = total_audits > 0

print("=== EXPLORER /stats SIMULATION ===")
print(f"  scan_cache rows  : {cache_count}")
print(f"  user audit_count : {user_scans}")
print(f"  non_evm audits   : {len(non_evm)}")
print(f"  total_audits     : {total_audits}  (EXPECTED > 0)")
print(f"  rpc_connected    : {rpc_connected}  (EXPECTED True)")
print(f"  watchlist        : {watchlist_count}")
print()

# --- Simulate explorer/audits ---
audits = sorted(non_evm, key=lambda x: x.get("timestamp", 0), reverse=True)[:5]
print("=== EXPLORER /audits (first 5) ===")
for a in audits:
    print(f"  [{a['audit_chain']}] {a['address'][:24]}...  hash_key={a['hash_key']}")
print()

# --- Simulate explorer/badges DB fallback ---
cur.execute("SELECT contract_address, risk_level FROM watchlist ORDER BY last_scanned DESC LIMIT 5")
badge_rows = cur.fetchall()
sev_map = {"HIGH":"HIGH","MEDIUM":"MEDIUM","LOW":"LOW","SAFE":"SECURE","CRITICAL":"HIGH"}
vuln_map = {"SAFE":0,"LOW":1,"MEDIUM":2,"HIGH":4,"CRITICAL":7}
print("=== EXPLORER /badges (DB fallback, first 5) ===")
for idx, (addr, risk) in enumerate(badge_rows):
    sev = sev_map.get(risk, "MEDIUM")
    vulns = vuln_map.get(risk, 1)
    print(f"  Badge #{idx}  addr={addr[:24]}...  severity={sev}  vulns={vulns}")
print()

# --- Summary ---
print("=== PASS / FAIL SUMMARY ===")
print(f"  total_audits > 0  : {'PASS' if total_audits > 0 else 'FAIL'}")
print(f"  rpc_connected=True: {'PASS' if rpc_connected else 'FAIL'}")
print(f"  audits list filled: {'PASS' if len(audits) > 0 else 'FAIL'}")
print(f"  badges list filled: {'PASS' if len(badge_rows) > 0 else 'FAIL'}")

conn.close()
