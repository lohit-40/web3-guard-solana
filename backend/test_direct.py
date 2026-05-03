from main import fetch_contract_source, scan_for_vulnerabilities
import time
from web3 import Web3
import os
from dotenv import load_dotenv

load_dotenv()

print("--- Step 1: Etherscan API ---")
start = time.time()
try:
    code = fetch_contract_source("0x908Af78d028d8f481FA67E8EEA424941e206", "11155111")
    print(f"Success! {len(code)} bytes fetched. Time: {time.time()-start:.2f}s")
    if code.startswith("ERROR:"):
        print("Etherscan Error:", code)
except Exception as e:
    print("Failed during fetch:", e)

print("--- Step 2: Gemini Parsing ---")
start = time.time()
try:
    if code and not code.startswith("ERROR:"):
        vulns = scan_for_vulnerabilities(code)
        print(f"Success! {len(vulns)} vulns. Time: {time.time()-start:.2f}s")
except Exception as e:
    print("Failed during scan:", e)

print("--- Step 3: Web3 Provider ---")
start = time.time()
try:
    rpc = os.getenv("WEB3_RPC_URL")
    print("RPC URL:", rpc)
    w3 = Web3(Web3.HTTPProvider(rpc, request_kwargs={'timeout': 10}))
    print(f"Web3 Is Connected: {w3.is_connected()}")
    if w3.is_connected():
        print("Fetching Base Fee...")
        base_fee = w3.eth.get_block('pending').baseFeePerGas
        print("Base Fee:", base_fee)
except Exception as e:
    print("Failed during Web3:", e)
