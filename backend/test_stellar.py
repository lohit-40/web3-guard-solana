from stellar_sdk import Server, Keypair, TransactionBuilder, Network, SorobanServer, stellar_xdr
from stellar_sdk.soroban_rpc import SendTransactionStatus
from stellar_sdk import scval
import os
import requests
from dotenv import load_dotenv

load_dotenv()

SOROBAN_RPC = "https://soroban-testnet.stellar.org"
CONTRACT_ID = os.getenv("SOROBAN_CONTRACT_ID", "")
SECRET_KEY = os.getenv("STELLAR_SECRET_KEY", "")

print("Testing Soroban Contract Invocation")
print("CONTRACT_ID:", CONTRACT_ID)
if not CONTRACT_ID or not SECRET_KEY:
    print("Missing contract ID or secret key in .env")
    exit(1)

stellar_keypair = Keypair.from_secret(SECRET_KEY)
soroban_server = SorobanServer(SOROBAN_RPC)

print("Deployer Address:", stellar_keypair.public_key)
source_account = soroban_server.load_account(stellar_keypair.public_key)

args = [
    scval.to_string("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"), # audit_hash
    scval.to_string("SysContract1..."), # program_id
    scval.to_string("HIGH"),            # risk_level
    scval.to_uint32(2),                 # vuln_count
]

tx = (
    TransactionBuilder(
        source_account=source_account,
        network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
        base_fee=3000,
    )
    .append_invoke_contract_function_op(
        contract_id=CONTRACT_ID,
        function_name="store_proof",
        parameters=args,
    )
    .set_timeout(30)
    .build()
)

print("Preparing tx...")
tx = soroban_server.prepare_transaction(tx)
print("Signing tx...")
tx.sign(stellar_keypair)
print("Sending tx to Soroban...")
response = soroban_server.send_transaction(tx)

if response.status != SendTransactionStatus.ERROR:
    stellar_sig = response.hash
    print("SUCCESS! Hash:", stellar_sig)
    print("Explore: ", f"https://stellar.expert/explorer/testnet/tx/{stellar_sig}")
else:
    print("ERROR result:", response.error_result_xdr)
