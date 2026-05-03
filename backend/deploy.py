import os
import json
from web3 import Web3
from dotenv import load_dotenv

load_dotenv('.env', override=True)
w3 = Web3(Web3.HTTPProvider(os.getenv('WEB3_RPC_URL')))

# Double check connection
if not w3.is_connected():
    print("FATAL ERROR: Could not connect to Web3 Provider. Check Alchemy URL.")
    exit(1)

account = w3.eth.account.from_key(os.getenv('WALLET_PRIVATE_KEY'))
balance = w3.eth.get_balance(account.address)

if balance == 0:
    print(f"FATAL ERROR: Your wallet {account.address} has exactly 0 Sepolia ETH.")
    print("Please get free Sepolia ETH from Alchemy Faucet (https://sepoliafaucet.com) to deploy contracts.")
    exit(1)

print(f"Wallet balance: {w3.from_wei(balance, 'ether')} ETH")

with open('ProofOfAudit.json') as f:
    data = json.load(f)
    ProofOfAudit = w3.eth.contract(abi=data['abi'], bytecode=data['bytecode'])

# Aggressive Legacy Deployment to force mining
try:
    transaction = ProofOfAudit.constructor().build_transaction({
        'chainId': w3.eth.chain_id,
        'from': account.address,
        'nonce': w3.eth.get_transaction_count(account.address),
        'gasPrice': w3.to_wei(60, 'gwei'),
        'gas': 3000000,
    })

    signed = w3.eth.account.sign_transaction(transaction, private_key=account.key)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"Sent Tx: {w3.to_hex(tx_hash)}")
    print("Waiting for receipt. This should be very fast...")
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    print(f"\n[SUCCESS] DEPLOYED!")
    print(f"Contract Address: {receipt.contractAddress}")
except Exception as e:
    print(f"ERROR DURNING DEPLOYMENT: {e}")
