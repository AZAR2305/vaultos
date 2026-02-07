/**
 * Check Channel Status and Create Channels if Needed
 * 
 * Yellow Network requires funded payment channels before app sessions
 */

import { createEnhancedYellowClient } from '../src/yellow/enhanced-yellow-client';
import 'dotenv/config';

async function main() {
    console.log('\n🔍 Yellow Network Channel Setup\n');
    console.log('='.repeat(70));

    const client = createEnhancedYellowClient();

    try {
        // Connect and authenticate
        console.log('📡 Connecting to Yellow Network...');
        const session = await client.connect({
            allowanceAmount: '10000000000',
            expiresInSeconds: 7200,
            scope: 'prediction-markets',
            application: 'VaultOS Markets'
        });

        console.log('✅ Authenticated');
        console.log(`   User: ${session.userAddress}`);
        console.log(`   Session: ${session.sessionAddress}\n`);

        // Check current balance
        console.log('💰 Checking ledger balance...');
        const balance = await client.getLedgerBalances();
        const ytestBalance = balance.balances.find(b => b.asset === 'ytest.usd');
        console.log(`   Available: ${ytestBalance?.amount || '0'} ytest.usd\n`);

        // Check existing channels
        console.log('📊 Checking existing channels...');
        const channels = await client.getChannels();
        
        if (channels.length === 0) {
            console.log('⚠️  No channels found!\n');
            console.log('📝 Yellow Network Requirements:');
            console.log('   1. Channels must be created through apps.yellow.com');
            console.log('   2. OR use the Yellow Network console/dashboard');
            console.log('   3. Channels need to be funded before creating app sessions\n');
            
            console.log('🔗 Steps to create channels:');
            console.log('   1. Visit: https://apps.yellow.com');
            console.log('   2. Sign in with your wallet');
            console.log('   3. Create a new channel');
            console.log('   4. Fund it with ytest.usd');
            console.log('   5. Return here and run this check again\n');
            
            console.log('💡 Alternative: Yellow Network Sandbox may auto-create channels');
            console.log('   Check the sandbox dashboard for channel status\n');
        } else {
            console.log(`✅ Found ${channels.length} channel(s):\n`);
            
            channels.forEach((channel, i) => {
                console.log(`   Channel ${i + 1}:`);
                console.log(`   ├─ Channel ID: ${channel.channel_id}`);
                console.log(`   ├─ Status: ${channel.status}`);
                console.log(`   ├─ Token: ${channel.token}`);
                console.log(`   ├─ Chain ID: ${channel.chain_id}`);
                console.log(`   ├─ Expected Deposit: ${channel.expected_deposit}`);
                console.log(`   ├─ Actual Deposit: ${channel.actual_deposit}`);
                console.log(`   └─ Version: ${channel.version}\n`);
            });
            
            // Check if channels are properly funded
            const unfundedChannels = channels.filter(ch => 
                BigInt(ch.actual_deposit || '0') < BigInt(ch.expected_deposit || '0')
            );
            
            if (unfundedChannels.length > 0) {
                console.log('⚠️  Some channels are not fully funded:');
                unfundedChannels.forEach((ch, i) => {
                    console.log(`   Channel ${i + 1}: ${ch.actual_deposit}/${ch.expected_deposit}`);
                });
                console.log('\n💡 Fund channels through apps.yellow.com or the dashboard\n');
            } else {
                console.log('✅ All channels are properly funded!');
                console.log('   You can now create app sessions for prediction markets\n');
            }
        }

        // Summary
        console.log('📋 Summary:');
        console.log(`   Balance: ${ytestBalance?.amount || '0'} ytest.usd`);
        console.log(`   Channels: ${channels.length}`);
        console.log(`   Status: ${channels.length > 0 ? '✅ Ready for app sessions' : '⚠️  Need to create channels'}\n`);

        await client.disconnect();

    } catch (error: any) {
        console.error('\n❌ Error:', error.message);
        if (error.stack) {
            console.error('\nStack:', error.stack);
        }
        await client.disconnect();
        process.exit(1);
    }
}

main();
