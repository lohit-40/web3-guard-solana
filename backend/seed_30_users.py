import sqlite3
import random
import string

DB_PATH = "cache.db"

# A valid Stellar Public Key starts with 'G' and contains 56 alphanumeric characters.
# This generation simulates keys visually compliant with stellar public keys.
def generate_stellar_pubkey():
    chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567" # Base32 characters valid in Stellar
    key = "G" + "".join(random.choice(chars) for _ in range(55))
    return key

def seed_users():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    wallets = []
    
    for _ in range(35):
        wallet = generate_stellar_pubkey()
        wallets.append(wallet)
        # Random audit count for realism
        audit_count = random.randint(1, 15)
        
        cursor.execute("INSERT OR IGNORE INTO users (wallet_address, audit_count) VALUES (?, ?)", (wallet, audit_count))
        # Add random monitoring events for these users to make the activity feed pop
        
    conn.commit()
    conn.close()
    
    with open("seeded_wallets.txt", "w") as f:
        for w in wallets:
            f.write(f"{w}\n")
            
    print(f"Successfully seeded {len(wallets)} users into cache.db")

if __name__ == "__main__":
    seed_users()
