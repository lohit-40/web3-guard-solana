import { Keypair } from '@stellar/stellar-sdk';
import fs from 'fs';

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function main() {
    console.log("Generating 35 genuine Stellar Keypairs...");
    const wallets = [];

    for (let i = 0; i < 35; i++) {
        const pair = Keypair.random();
        const publicKey = pair.publicKey();
        const secret = pair.secret();
        
        console.log(`[${i+1}/35] Created: ${publicKey}`);
        wallets.push({ publicKey, secret });
    }

    console.log("Funding wallets via Friendbot (this ensures they exist on the testnet explorer)...");
    
    // We'll fund them sequentially to avoid rate limiting
    let successfulFunds = 0;
    for (let i = 0; i < wallets.length; i++) {
        const addr = wallets[i].publicKey;
        try {
            const response = await fetch(`https://friendbot.stellar.org?addr=${addr}`);
            if (response.ok) {
                console.log(`[${i+1}/35] Successfully funded: ${addr}`);
                successfulFunds++;
            } else {
                console.log(`[${i+1}/35] Friendbot rate-limit/error for: ${addr}`);
            }
        } catch (e) {
            console.log(`[${i+1}/35] Error hitting friendbot for: ${addr}`);
        }
        await delay(1000); // 1 sec delay to be polite to the friendbot API
    }

    // Write out the valid public keys
    const validPubKeys = wallets.map(w => w.publicKey);
    fs.writeFileSync('../backend/seeded_wallets.txt', validPubKeys.join('\n'));
    console.log("\nFinished. Saved directly to backend/seeded_wallets.txt");
    console.log(`Total Genuine Wallets Seeded & Funded: ${successfulFunds}`);
}

main().catch(console.error);
