import requests
import time

BASE_URL = "http://127.0.0.1:8001"

print("--- Testing Backend Caching and Multi-Chain ---")

# 1. Test Ethereum Mainnet Scan (Cache Miss)
print("\n[1] Requesting Ethereum Mainnet Scan (WETH Contract)...")
start_time = time.time()
res1 = requests.post(f"{BASE_URL}/scan", json={
    "contract_address": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "chain_id": "1"
})
end_time = time.time()
print(f"Status: {res1.status_code}, Time taken: {end_time - start_time:.2f}s")
if res1.status_code == 200:
    print("Vulnerabilities found:", len(res1.json().get('vulnerabilities', [])))
else:
    print("Error:", res1.text)

# 2. Test Cache Hit (Exact same request)
print("\n[2] Requesting EXACT SAME Scan (Should hit SQLite Cache)...")
start_time = time.time()
res2 = requests.post(f"{BASE_URL}/scan", json={
    "contract_address": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "chain_id": "1"
})
end_time = time.time()
print(f"Status: {res2.status_code}, Time taken: {end_time - start_time:.2f}s")
if res2.status_code != 200:
    print("Error:", res2.text)

# 3. Test BSC Scan
print("\n[3] Requesting BSC Scan (PancakeSwap Router)...")
start_time = time.time()
res3 = requests.post(f"{BASE_URL}/scan", json={
    "contract_address": "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    "chain_id": "56"
})
end_time = time.time()
print(f"Status: {res3.status_code}, Time taken: {end_time - start_time:.2f}s")
if res3.status_code == 200:
    print("Vulnerabilities found:", len(res3.json().get('vulnerabilities', [])))
else:
    print("Error:", res3.text)
