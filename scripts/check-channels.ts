/**
 * Check channel status before app session creation
 */

import { createEnhancedYellowClient } from '../src/yellow/enhanced-yellow-client';
import 'dotenv/config';

async function main() {
    console.log('\n🔍 Checking Channel Requirements for App Sessions\n');
    console.log('='.repeat(70));

    const client = createEnhancedYellowClient();

    try {
        // Connect
        const session = await client.connect({
            allowanceAmount: '10000000000',
            expiresInSeconds: 7200,
            scope: 'prediction-markets',
            application: 'VaultOS Markets'
        });

        console.log('✅ Connected');
        console.log(`   User: ${session.userAddress}\n`);

        // Check channels
        console.log('📊 Checking existing channels...');
        const channels = await client.getChannels();
        
        if (channels.length === 0) {
            console.log('⚠️  No channels found!');
            console.log('\n💡 App sessions require a funded payment channel first.');
            console.log('   Yellow Network uses channels for off-chain interactions.\n');
            console.log('📝 To create an app session:');
            console.log('   1. Create a payment channel with the clearnode');
            console.log('   2. Fund the channel with ytest.usd');
            console.log('   3. Then create app sessions\n');
            console.log('🔧 Creating channel...');
            
            // Create channel
            const channelResult = await client.createChannel({
                counterparty: '0x1234...', // Clearnode address from config
                token: '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb',
                amount: '20000000',  // 20 USDC
                chainId: 84532,  // Base Sepolia
            });
            
            console.log('✅ Channel created:', channelResult);
        } else {
            console.log(`✅ Found ${channels.length} channel(s):`);
            channels.forEach((ch, i) => {
                console.log(`\n   Channel ${i + 1}:`);
                console.log(`   Status: ${ch.status}`);
                console.log(`   Token: ${ch.token}`);
                console.log(`   Amount: ${ch.expected_deposit}`);
            });
        }

        await client.disconnect();

    } catch (error: any) {
        console.error('\n❌ Error:', error.message);
        await client.disconnect();
        process.exit(1);
    }
}

main();
