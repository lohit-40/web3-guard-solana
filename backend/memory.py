import json
import os
import math
from pathlib import Path
from google import genai
from dotenv import load_dotenv

def _get_conn():
    from database import get_connection
    return get_connection()

def _init_rag_table():
    conn = _get_conn()
    cursor = conn.cursor()
    if os.getenv("DATABASE_URL"):
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS rag_memory (
                id SERIAL PRIMARY KEY,
                vuln_type TEXT,
                lesson TEXT,
                vector TEXT
            )
        ''')
    else:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS rag_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vuln_type TEXT,
                lesson TEXT,
                vector TEXT
            )
        ''')
    conn.commit()
    conn.close()

def _load_db() -> list:
    _init_rag_table()
    conn = _get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT vuln_type, lesson, vector FROM rag_memory")
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for row in rows:
        result.append({
            "vuln_type": row[0],
            "lesson": row[1],
            "vector": json.loads(row[2])
        })
    return result

def _save_to_db(vuln_type: str, lesson: str, vector: list):
    _init_rag_table()
    conn = _get_conn()
    cursor = conn.cursor()
    if os.getenv("DATABASE_URL"):
        cursor.execute("INSERT INTO rag_memory (vuln_type, lesson, vector) VALUES (%s, %s, %s)",
                       (vuln_type, lesson, json.dumps(vector)))
    else:
        cursor.execute("INSERT INTO rag_memory (vuln_type, lesson, vector) VALUES (?, ?, ?)",
                       (vuln_type, lesson, json.dumps(vector)))
    conn.commit()
    conn.close()

def _cosine_similarity(vec1: list, vec2: list) -> float:
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    magnitude1 = math.sqrt(sum(a * a for a in vec1))
    magnitude2 = math.sqrt(sum(b * b for b in vec2))
    if magnitude1 == 0 or magnitude2 == 0:
        return 0.0
    return dot_product / (magnitude1 * magnitude2)

def get_embedding(text: str) -> list:
    """Generates a vector embedding for the given text using Gemini."""
    load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)
    raw_keys = os.getenv("GEMINI_API_KEY", "")
    key = raw_keys.split(",")[0].strip() if raw_keys else ""
    
    if not key or key == "PASTE_YOUR_GEMINI_KEY_HERE":
        print("[Memory Engine] Warning: No valid GEMINI_API_KEY found.")
        return []
        
    client = genai.Client(api_key=key)
    # text-embedding-004 is Google's fast embedding model
    result = client.models.embed_content(
        model='gemini-embedding-001',
        contents=text,
    )
    return result.embeddings[0].values

def teach_memory(vulnerability_type: str, lesson_text: str) -> dict:
    """Manually feeds a verified vulnerability lesson into the agent's vector memory."""
    # We embed the vulnerability type to match against future code context
    vector = get_embedding(vulnerability_type + " " + lesson_text)
    if not vector:
        return {"error": "Failed to generate embedding (check API key)."}
    
    _save_to_db(vulnerability_type, lesson_text, vector)
    return {"status": "success", "message": f"Agent learned lesson about {vulnerability_type}."}

def search_memory(query_text: str, top_k: int = 1, threshold: float = 0.70) -> list:
    """Searches the memory DB for similar vulnerabilities based on the input code or query."""
    db = _load_db()
    if not db:
        return []
        
    query_vector = get_embedding(query_text)
    if not query_vector:
        return []
        
    results = []
    for item in db:
        sim = _cosine_similarity(query_vector, item["vector"])
        if sim >= threshold:
            results.append({"vuln_type": item["vuln_type"], "lesson": item["lesson"], "score": sim})
            
    # Sort by highest similarity
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:top_k]
