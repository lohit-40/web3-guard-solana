import requests
import os
from dotenv import load_dotenv
load_dotenv()
key = os.getenv("ETHERSCAN_API_KEY")

print("--- 1. Testing Mainnet ---")
url1 = f"https://api.etherscan.io/v2/api?chainid=1&module=contract&action=getsourcecode&address=0x06012c8cf97BEaD5deAe237070F9587f8E7A266d&apikey={key}"
print(requests.get(url1).text)

print("\n--- 2. Testing Sepolia (Lowercased Address) ---")
url2 = f"https://api.etherscan.io/v2/api?chainid=11155111&module=contract&action=getsourcecode&address=0x908af78d028d8f481fa67e8eea424941e206&apikey={key}"
print(requests.get(url2).text)
