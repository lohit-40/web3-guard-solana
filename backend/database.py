import sqlite3
import json
import os
from dotenv import load_dotenv

load_dotenv(override=True)
DB_URL = os.getenv("DATABASE_URL")
DB_PATH = "cache.db"

def get_connection():
    if DB_URL:
        import psycopg2
        return psycopg2.connect(DB_URL)
    return sqlite3.connect(DB_PATH)

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # scan_cache
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS scan_cache (
            hash_key TEXT PRIMARY KEY,
            response_data TEXT
        )
    ''')
    
    # users
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            wallet_address TEXT PRIMARY KEY,
            first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            audit_count INTEGER DEFAULT 0
        )
    ''')
    
    # watchlist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS watchlist (
            contract_address TEXT PRIMARY KEY,
            added_by TEXT,
            last_scanned TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            risk_level TEXT,
            owner_wallet TEXT,
            source_code TEXT,
            check_interval TEXT DEFAULT '30m',
            risk_threshold TEXT DEFAULT 'HIGH',
            telegram_chat_id TEXT,
            discord_webhook TEXT,
            badge_nft_address TEXT
        )
    ''')
    # Use ALTER TABLE to add missing columns gracefully to existing SQLite/Postgres tables without dropping
    try:
        cursor.execute("ALTER TABLE watchlist ADD COLUMN owner_wallet TEXT")
        cursor.execute("ALTER TABLE watchlist ADD COLUMN source_code TEXT")
        cursor.execute("ALTER TABLE watchlist ADD COLUMN check_interval TEXT DEFAULT '30m'")
        cursor.execute("ALTER TABLE watchlist ADD COLUMN risk_threshold TEXT DEFAULT 'HIGH'")
        cursor.execute("ALTER TABLE watchlist ADD COLUMN telegram_chat_id TEXT")
        cursor.execute("ALTER TABLE watchlist ADD COLUMN discord_webhook TEXT")
        cursor.execute("ALTER TABLE watchlist ADD COLUMN badge_nft_address TEXT")
    except Exception:
        pass # Columns probably exist

    # monitoring_events
    if DB_URL:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS monitoring_events (
                id SERIAL PRIMARY KEY,
                contract_address TEXT,
                event_type TEXT,
                details TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                agent_type TEXT,
                risk_before TEXT,
                risk_after TEXT,
                vuln_count INTEGER DEFAULT 0,
                vuln_delta INTEGER DEFAULT 0,
                solana_proof_tx TEXT
            )
        ''')
    else:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS monitoring_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contract_address TEXT,
                event_type TEXT,
                details TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                agent_type TEXT,
                risk_before TEXT,
                risk_after TEXT,
                vuln_count INTEGER DEFAULT 0,
                vuln_delta INTEGER DEFAULT 0,
                solana_proof_tx TEXT
            )
        ''')
    
    try:
        cursor.execute("ALTER TABLE monitoring_events ADD COLUMN agent_type TEXT")
        cursor.execute("ALTER TABLE monitoring_events ADD COLUMN risk_before TEXT")
        cursor.execute("ALTER TABLE monitoring_events ADD COLUMN risk_after TEXT")
        cursor.execute("ALTER TABLE monitoring_events ADD COLUMN vuln_count INTEGER DEFAULT 0")
        cursor.execute("ALTER TABLE monitoring_events ADD COLUMN vuln_delta INTEGER DEFAULT 0")
        cursor.execute("ALTER TABLE monitoring_events ADD COLUMN solana_proof_tx TEXT")
    except Exception:
        pass

    # risk_history
    if DB_URL:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS risk_history (
                id SERIAL PRIMARY KEY,
                program_id TEXT NOT NULL,
                risk_score INTEGER,
                risk_level TEXT,
                vuln_count INTEGER,
                scan_type TEXT,
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    else:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS risk_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                program_id TEXT NOT NULL,
                risk_score INTEGER,
                risk_level TEXT,
                vuln_count INTEGER,
                scan_type TEXT,
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

    # agent_memory — per-program pattern learning
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS agent_memory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            program_id TEXT NOT NULL,
            pattern_type TEXT,
            first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            occurrence_count INTEGER DEFAULT 1,
            status TEXT DEFAULT \'active\'
        )
    ''')

    # threat_signatures — cross-protocol threat intelligence
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS threat_signatures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            signature_hash TEXT UNIQUE,
            vuln_type TEXT,
            description TEXT,
            detected_in_program TEXT,
            affected_programs TEXT,
            severity TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    conn.commit()
    conn.close()

def record_user_activity(wallet_address: str):
    conn = get_connection()
    cursor = conn.cursor()
    if DB_URL:
        cursor.execute('''
            INSERT INTO users (wallet_address, audit_count) 
            VALUES (%s, 1) 
            ON CONFLICT (wallet_address) DO UPDATE 
            SET audit_count = users.audit_count + 1
        ''', (wallet_address,))
    else:
        cursor.execute("INSERT OR IGNORE INTO users (wallet_address) VALUES (?)", (wallet_address,))
        cursor.execute("UPDATE users SET audit_count = audit_count + 1 WHERE wallet_address = ?", (wallet_address,))
    conn.commit()
    conn.close()

def get_dashboard_metrics():
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM users")
    user_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM watchlist")
    watchlist_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT id, contract_address, event_type, details, timestamp FROM monitoring_events ORDER BY timestamp DESC LIMIT 10")
    recent_events = [
        {"id": r[0], "contract": r[1], "type": r[2], "details": r[3], "time": r[4]} 
        for r in cursor.fetchall()
    ]
    
    conn.close()
    return {
        "active_users": user_count,
        "watched_contracts": watchlist_count,
        "recent_events": recent_events
    }

def get_cached_scan(hash_key: str):
    conn = get_connection()
    cursor = conn.cursor()
    if DB_URL:
        cursor.execute("SELECT response_data FROM scan_cache WHERE hash_key=%s", (hash_key,))
    else:
        cursor.execute("SELECT response_data FROM scan_cache WHERE hash_key=?", (hash_key,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return json.loads(row[0])
    return None

def set_cached_scan(hash_key: str, response_data: dict):
    conn = get_connection()
    cursor = conn.cursor()
    if DB_URL:
        cursor.execute('''
            INSERT INTO scan_cache (hash_key, response_data)
            VALUES (%s, %s)
            ON CONFLICT (hash_key) DO UPDATE 
            SET response_data = EXCLUDED.response_data
        ''', (hash_key, json.dumps(response_data)))
    else:
        cursor.execute('''
            INSERT OR REPLACE INTO scan_cache (hash_key, response_data)
            VALUES (?, ?)
        ''', (hash_key, json.dumps(response_data)))
    conn.commit()
    conn.close()

def get_recent_non_evm_audits(limit: int = 20):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT response_data FROM scan_cache")
    rows = cursor.fetchall()
    conn.close()
    
    audits = []
    for row in rows:
        try:
            data = json.loads(row[0])
            chain = data.get("audit_chain")
            if chain and chain != "ethereum":
                audits.append({
                    "id": data.get("hash_key", "unknown")[:6],
                    "audited_contract": data.get("address", "Raw Source Code Provided"),
                    "report_hash": "0x" + data.get("hash_key", "0"*40)[:40],
                    "timestamp": data.get("timestamp", 0),
                    "audit_chain": chain,
                    "explorer_url": data.get("solana_explorer_url") or data.get("stellar_explorer_url")
                })
        except Exception:
            continue
            
    audits.sort(key=lambda x: x["timestamp"], reverse=True)
    return audits[:limit]

def add_to_watchlist(contract_address: str, added_by: str, risk_level: str):
    conn = get_connection()
    cursor = conn.cursor()
    if DB_URL:
        cursor.execute('''
            INSERT INTO watchlist (contract_address, added_by, risk_level)
            VALUES (%s, %s, %s)
            ON CONFLICT (contract_address) DO UPDATE 
            SET risk_level = EXCLUDED.risk_level, last_scanned = CURRENT_TIMESTAMP
        ''', (contract_address, added_by, risk_level))
    else:
        cursor.execute('''
            INSERT INTO watchlist (contract_address, added_by, risk_level)
            VALUES (?, ?, ?)
            ON CONFLICT (contract_address) DO UPDATE 
            SET risk_level = excluded.risk_level, last_scanned = CURRENT_TIMESTAMP
        ''', (contract_address, added_by, risk_level))
    conn.commit()
    conn.close()

def add_monitoring_event(contract_address: str, event_type: str, details: str, agent_type: str = "System", risk_before: str = None, risk_after: str = None, vuln_count: int = 0, vuln_delta: int = 0, solana_proof_tx: str = None):
    conn = get_connection()
    cursor = conn.cursor()
    if DB_URL:
        cursor.execute('''
            INSERT INTO monitoring_events (contract_address, event_type, details, agent_type, risk_before, risk_after, vuln_count, vuln_delta, solana_proof_tx)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (contract_address, event_type, details, agent_type, risk_before, risk_after, vuln_count, vuln_delta, solana_proof_tx))
    else:
        cursor.execute('''
            INSERT INTO monitoring_events (contract_address, event_type, details, agent_type, risk_before, risk_after, vuln_count, vuln_delta, solana_proof_tx)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (contract_address, event_type, details, agent_type, risk_before, risk_after, vuln_count, vuln_delta, solana_proof_tx))
    conn.commit()
    conn.close()


def record_risk_history(program_id: str, risk_score: int, risk_level: str, vuln_count: int, scan_type: str = "scheduled"):
    conn = get_connection()
    cursor = conn.cursor()
    if DB_URL:
        cursor.execute(
            "INSERT INTO risk_history (program_id, risk_score, risk_level, vuln_count, scan_type) VALUES (%s,%s,%s,%s,%s)",
            (program_id, risk_score, risk_level, vuln_count, scan_type)
        )
    else:
        cursor.execute(
            "INSERT INTO risk_history (program_id, risk_score, risk_level, vuln_count, scan_type) VALUES (?,?,?,?,?)",
            (program_id, risk_score, risk_level, vuln_count, scan_type)
        )
    conn.commit()
    conn.close()


def get_risk_history(program_id: str, days: int = 7) -> list:
    conn = get_connection()
    cursor = conn.cursor()
    if DB_URL:
        cursor.execute(
            "SELECT risk_score, risk_level, vuln_count, scan_type, recorded_at FROM risk_history WHERE program_id=%s ORDER BY recorded_at DESC LIMIT 50",
            (program_id,)
        )
    else:
        cursor.execute(
            "SELECT risk_score, risk_level, vuln_count, scan_type, recorded_at FROM risk_history WHERE program_id=? ORDER BY recorded_at DESC LIMIT 50",
            (program_id,)
        )
    rows = cursor.fetchall()
    conn.close()
    return [
        {"risk_score": r[0], "risk_level": r[1], "vuln_count": r[2],
         "scan_type": r[3], "recorded_at": r[4]}
        for r in rows
    ]


def get_monitor_events(limit: int = 50) -> list:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, contract_address, event_type, details, agent_type, risk_before, risk_after, vuln_count, solana_proof_tx, timestamp FROM monitoring_events ORDER BY timestamp DESC LIMIT ?",
        (limit,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": r[0], "contract": r[1], "type": r[2], "details": r[3],
            "agent_type": r[4], "risk_before": r[5], "risk_after": r[6],
            "vuln_count": r[7], "solana_proof_tx": r[8], "time": str(r[9]),
        }
        for r in rows
    ]


def upsert_agent_memory(program_id: str, pattern_type: str):
    conn = get_connection()
    cursor = conn.cursor()
    # Try update first, then insert
    cursor.execute(
        "SELECT id FROM agent_memory WHERE program_id=? AND pattern_type=?",
        (program_id, pattern_type)
    )
    row = cursor.fetchone()
    if row:
        cursor.execute(
            "UPDATE agent_memory SET occurrence_count=occurrence_count+1, last_seen=CURRENT_TIMESTAMP WHERE id=?",
            (row[0],)
        )
    else:
        cursor.execute(
            "INSERT INTO agent_memory (program_id, pattern_type) VALUES (?,?)",
            (program_id, pattern_type)
        )
    conn.commit()
    conn.close()


def insert_threat_signature(sig_hash: str, vuln_type: str, description: str, program_id: str, severity: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR IGNORE INTO threat_signatures (signature_hash, vuln_type, description, detected_in_program, severity) VALUES (?,?,?,?,?)",
        (sig_hash, vuln_type, description, program_id, severity)
    )
    conn.commit()
    conn.close()


def get_threat_feed(limit: int = 20) -> list:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT vuln_type, description, detected_in_program, severity, created_at FROM threat_signatures ORDER BY created_at DESC LIMIT ?",
        (limit,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [
        {"vuln_type": r[0], "description": r[1], "detected_in": r[2],
         "severity": r[3], "created_at": r[4]}
        for r in rows
    ]


init_db()
