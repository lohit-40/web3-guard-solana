import requests
import json
import time

print("Testing Sepolia Contract Fetching...")

url = "http://127.0.0.1:8001/scan"
payload = {
    "contract_address": "0x908Af78d028d8f481FA67E8EEA424941e206",
    "chain_id": "11155111"
}

start = time.time()
try:
    print("Calling POST /scan...")
    res = requests.post(url, json=payload, timeout=30)
    print("Status:", res.status_code)
    print("Response:", res.text[:200])
except Exception as e:
    print("Error:", e)
finally:
    print(f"Time taken: {time.time() - start:.2f}s")
