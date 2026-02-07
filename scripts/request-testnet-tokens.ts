/**
 * Request Testnet Tokens from Yellow Network Faucet
 * 
 * Automates the process of getting ytest.usd tokens for Base Sepolia
 */

import { privateKeyToAccount } from 'viem/accounts';
import 'dotenv/config';

const FAUCET_API = 'https://earn-ynetwork.yellownetwork.io/api/faucet';
const CHAIN_ID = 84532; // Base Sepolia

async function requestTokens() {
    console.log('\n💰 Yellow Network Testnet Token Request\n');
    console.log('='.repeat(70));

    if (!process.env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY not found in environment');
    }

    const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
    console.log(`📍 Wallet: ${account.address}\n`);

    try {
        console.log('🔄 Requesting tokens from faucet...\n');
        
        // Method 1: Direct API call (if faucet has public API)
        const response = await fetch(FAUCET_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                address: account.address,
                chain_id: CHAIN_ID,
                token: 'ytest.usd',
            }),
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Request successful!\n');
            console.log('Response:', JSON.stringify(data, null, 2));
            
            console.log('\n⏰ Wait 1-2 minutes for tokens to arrive\n');
            console.log('Then check your balance:');
            console.log('   npm run check:yellow\n');
        } else {
            throw new Error(`Faucet request failed: ${response.status} ${response.statusText}`);
        }
    } catch (error: any) {
        console.log('⚠️  Automated request failed\n');
        console.log(`Error: ${error.message}\n`);
        
        console.log('📝 Manual Alternative - Use PowerShell:\n');
        console.log('Copy and paste this command:\n');
        console.log('─'.repeat(70));
        
        // PowerShell command using Invoke-WebRequest
        const psCommand = `Invoke-WebRequest -Uri "https://earn-ynetwork.yellownetwork.io/api/faucet" \`
  -Method POST \`
  -ContentType "application/json" \`
  -Body '{"address":"${account.address}","chain_id":${CHAIN_ID},"token":"ytest.usd"}'`;
        
        console.log(psCommand);
        console.log('─'.repeat(70) + '\n');
        
        console.log('Or visit the web interface:\n');
        console.log(`🌐 https://earn-ynetwork.yellownetwork.io\n`);
        console.log('Steps:');
        console.log('  1. Connect wallet OR paste address: ' + account.address);
        console.log('  2. Select network: Base Sepolia');
        console.log('  3. Select token: ytest.usd');
        console.log('  4. Click "Request Tokens"\n');
        
        console.log('Alternative faucets for Base Sepolia ETH:');
        console.log('  🔗 https://www.alchemy.com/faucets/base-sepolia');
        console.log('  🔗 https://docs.base.org/tools/network-faucets\n');
    }
}

requestTokens().catch(error => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
});
