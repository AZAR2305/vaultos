/**
 * Create Yellow Network Channel with Your 20 USDC
 * 
 * This script explicitly creates a channel with the Official USDC you got from Circle
 */

import { VaultOSYellowClient } from '../src/yellow/vaultos-yellow';
import 'dotenv/config';

async function main() {
    console.log('\n🏗️  Creating Yellow Network Channel\n');
    console.log('='.repeat(70));
    
    if (!process.env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY not found in .env');
    }

    const client = new VaultOSYellowClient(process.env.PRIVATE_KEY as `0x${string}`);

    try {
        // Step 1: Connect and authenticate
        console.log('\n📡 Step 1: Connecting to Yellow Network...');
        const { sessionAddress, userAddress } = await client.connect();
        
        console.log('✅ Connected Successfully');
        console.log(`   User: ${userAddress}`);
        console.log(`   Session: ${sessionAddress}\n`);

        // Step 2: Create funded channel
        console.log('🏗️  Step 2: Creating funded channel...');
        console.log('   This will:');
        console.log('   1. Approve 20 USDC to Custody contract');
        console.log('   2. Call depositAndCreateChannel(20 USDC)');
        console.log('   3. Create channel on Base Sepolia blockchain');
        console.log('   4. Takes ~2-3 minutes (2 transactions)\n');

        await client.createChannel();

        // Step 3: Verify channel created
        const channelId = client.getChannelId();
        
        if (channelId) {
            console.log('\n' + '='.repeat(70));
            console.log('✅ CHANNEL CREATED SUCCESSFULLY!\n');
            console.log(`   Channel ID: ${channelId}`);
            console.log('   Status: LIVE and funded');
            console.log('   Balance: 20 USDC');
            console.log('   Network: Base Sepolia');
            console.log('\n' + '='.repeat(70));
            
            console.log('\n🎉 Next Steps:');
            console.log('   1. Verify channel: npm run check:channels');
            console.log('   2. Test app session: npm run demo:session');
            console.log('   3. Start building prediction markets!\n');
        } else {
            console.log('\n⚠️  Channel creation initiated but ID not available yet');
            console.log('   Check channels list: npm run check:channels\n');
        }

    } catch (error: any) {
        console.error('\n❌ Error creating channel:', error.message);
        
        if (error.message.includes('insufficient')) {
            console.log('\n💡 Insufficient balance. Current balances:');
            console.log('   Run: npx tsx scripts/check-all-usdc.ts');
        } else if (error.message.includes('gas')) {
            console.log('\n💡 Not enough ETH for gas fees');
            console.log('   Get more: https://www.alchemy.com/faucets/base-sepolia');
        } else {
            console.log('\n💡 Unexpected error. Check:');
            console.log('   1. Base Sepolia RPC is accessible');
            console.log('   2. Wallet has 20+ USDC');
            console.log('   3. Wallet has 0.01+ ETH for gas');
        }
        
        throw error;
    } finally {
        console.log('\n👋 Disconnecting from Yellow Network...');
        client.disconnect();
    }
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
