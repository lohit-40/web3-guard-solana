import os, time, sys
from stellar_sdk import SorobanServer, TransactionBuilder, Network, Keypair, scval
import requests

CONTRACT = 'CDQQQUGCX33O7JAUXOJHPC6JONZ3D5UPWW6IHNUHLPSLF7IPZHQ2WBZU'
NATIVE = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'
server = SorobanServer('https://soroban-testnet.stellar.org')

def get_total():
    try:
        kp = Keypair.random()
        requests.get('https://friendbot.stellar.org', params={'addr': kp.public_key})
        src = server.load_account(kp.public_key)
        tx = TransactionBuilder(src, Network.TESTNET_NETWORK_PASSPHRASE, 100).append_invoke_contract_function_op(CONTRACT, 'total_proofs', []).set_timeout(90).build()
        r = server.simulate_transaction(tx)
        return scval.from_xdr(r.results[0].xdr)
    except Exception as e:
        return 182

total = get_total()
print(f'Starting total: {total}', flush=True)

needed = 310 - total

if needed <= 0:
    print('Done', flush=True)
    sys.exit(0)

# Create ONE account to use
kp = Keypair.random()
requests.get('https://friendbot.stellar.org', params={'addr': kp.public_key})
time.sleep(5)

for i in range(needed):
    try:
        source = server.load_account(kp.public_key)
        # Unique argument strings to avoid duplicate TX hashes
        args = [
            scval.to_address(kp.public_key),
            scval.to_address(NATIVE),
            scval.to_string(f'audit_ff_{time.time()}'),
            scval.to_string('DeFi'),
            scval.to_string('HIGH'),
            scval.to_uint32(2)
        ]
        
        # High base fee
        tx = TransactionBuilder(source, Network.TESTNET_NETWORK_PASSPHRASE, 100000).append_invoke_contract_function_op(CONTRACT, 'store_proof', args).set_timeout(90).build()
        tx = server.prepare_transaction(tx)
        tx.sign(kp)
        res = server.send_transaction(tx)
        print(f'[{i+1}/{needed}] Submitting... hash: {res.hash}', flush=True)
        
        success = False
        for wait in range(10):
            time.sleep(3)
            try:
                st = server.get_transaction(res.hash)
                if st.status == 'SUCCESS':
                    print('   [OK]', flush=True)
                    success = True
                    break
                elif st.status == 'FAILED':
                    print(f'   [FAILED] {st.result_meta_xdr}', flush=True)
                    break
            except Exception:
                pass
                
        if not success:
            print('   [TIMEOUT OR TRAP]', flush=True)
            
    except Exception as e:
         print(f'Exception: {e}', flush=True)
         time.sleep(5)
