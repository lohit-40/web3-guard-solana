import os
from web3 import Web3
from dotenv import load_dotenv

load_dotenv('.env')
print("Checking tx...")
w3 = Web3(Web3.HTTPProvider(os.getenv('WEB3_RPC_URL')))
try:
    receipt = w3.eth.get_transaction_receipt('0x81dd46e59ae5fa0c836a40a0b12d11968163d35c4c461430bbc105b7cb747639')
    print("CONTRACT_ADDRESS:", receipt.contractAddress)
except Exception as e:
    print(e)
