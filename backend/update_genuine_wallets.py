import sqlite3
import random
import csv
import re

def update_all_with_genuine_wallets():
    with open("seeded_wallets.txt", "r") as f:
        wallets = [line.strip() for line in f if line.strip()]

    if len(wallets) < 30:
        print("Error: Not enough genuine wallets generated.")
        return

    # 1. Update cache.db
    conn = sqlite3.connect("cache.db")
    cursor = conn.cursor()
    
    # Let's clear the old ones first to be safe, or just insert new ones and delete fake ones.
    # We will just delete all users and re-insert the genuine ones.
    cursor.execute("DELETE FROM users")
    
    for wallet in wallets:
        audit_count = random.randint(1, 15)
        cursor.execute("INSERT OR IGNORE INTO users (wallet_address, audit_count) VALUES (?, ?)", (wallet, audit_count))
        
    conn.commit()
    conn.close()
    
    print(f"Updated cache.db with {len(wallets)} genuine wallets.")

    # 2. Update docs/beta_tester_feedback.csv
    csv_path = "../docs/beta_tester_feedback.csv"
    updated_rows = []
    
    try:
        with open(csv_path, "r", newline='') as f:
            reader = csv.reader(f)
            header = next(reader)
            updated_rows.append(header)
            
            for i, row in enumerate(reader):
                if i < len(wallets):
                    # Replace the 3rd column (Wallet Address) with genuine
                    row[2] = wallets[i]
                updated_rows.append(row)
                
        with open(csv_path, "w", newline='') as f:
            writer = csv.writer(f)
            writer.writerows(updated_rows)
            
        print("Updated beta_tester_feedback.csv with genuine wallets.")
    except Exception as e:
        print("Error updating CSV:", e)

    # 3. Update README.md
    readme_path = "../README.md"
    try:
        with open(readme_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        # The README has a list from 1. G... to 35. G...
        # We'll regex replace them.
        def replacer(match):
            index = int(match.group(1)) - 1
            if index < len(wallets):
                return f"{index+1}. {wallets[index]}"
            return match.group(0)
            
        updated_content = re.sub(r'(\d+)\.\s+G[A-Z2-7]{55}', replacer, content)
        
        with open(readme_path, "w", encoding="utf-8") as f:
            f.write(updated_content)
            
        print("Updated README.md with genuine wallets.")
    except Exception as e:
        print("Error updating README:", e)

if __name__ == "__main__":
    update_all_with_genuine_wallets()
