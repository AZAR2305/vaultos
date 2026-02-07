/**
 * Transfer ytest.usd to second wallet for prediction market demo
 */

import { EnhancedYellowClient } from '../src/yellow/enhanced-yellow-client';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import 'dotenv/config';

async function main() {
    console.log('\n💸 Transfer ytest.usd for Prediction Market Demo\n');
    console.log('='.repeat(70));

    // Main wallet (has 49 ytest.usd)
    const mainPrivateKey = process.env.PRIVATE_KEY as `0x${string}`;
    if (!mainPrivateKey) {
        throw new Error('PRIVATE_KEY not found in environment');
    }

    const mainWallet = privateKeyToAccount(mainPrivateKey);
    const secondWallet = privateKeyToAccount('0xda0070b15b47038798ed1a39d087439b65f67cce33d02c7334cefef28cd205dc' as `0x${string}`);

    console.log('Main Wallet:', mainWallet.address);
    console.log('Second Wallet:', secondWallet.address);
    console.log('');

    // Initialize client with main wallet
    const client = new EnhancedYellowClient({
        privateKey: mainPrivateKey,
        wsUrl: 'wss://clearnet-sandbox.yellow.com/ws',
    });

    try {
        // Connect
        console.log('📡 Connecting to Yellow Network...');
        const session = await client.connect({
            scope: 'prediction-markets',
            allowances: [{
                asset: 'ytest.usd',
                amount: '10000000000',  // 10,000 USDC allowance
            }],
            expirationMinutes: 60 * 24 * 365,
        });
        console.log('✅ Connected');
        console.log(`   User: ${session.userAddress}`);
        console.log(`   Session: ${session.sessionAddress}\n`);

        // Check balance
        const balance = await client.getLedgerBalances();
        const ytestBalance = balance.balances.find(b => b.asset === 'ytest.usd');
        console.log('💰 Main wallet balance:', ytestBalance?.amount || '0', 'ytest.usd\n');

        // Transfer 20 ytest.usd to second wallet
        console.log('💸 Transferring 20 ytest.usd to second wallet...');
        const transferResult = await client.transfer({
            destination: secondWallet.address,
            allocations: [{
                asset: 'ytest.usd',
                amount: '20.0',  // 20 USDC
            }]
        });

        console.log('✅ Transfer successful!');
        console.log(`   Transaction ID: ${transferResult.id}`);
        console.log(`   To: ${secondWallet.address}`);
        console.log(`   Amount: 20.0 ytest.usd\n`);

        // Check updated balances
        await new Promise(resolve => setTimeout(resolve, 2000));  // Wait for balance update
        const newBalance = await client.getLedgerBalances();
        const newYtestBalance = newBalance.balances.find(b => b.asset === 'ytest.usd');
        console.log('💰 Main wallet new balance:', newYtestBalance?.amount || '0', 'ytest.usd');
        console.log('   (29 ytest.usd remaining for market creation)\n');

        console.log('✅ Demo wallets ready!');
        console.log('   Wallet 1:', mainWallet.address, '(~29 ytest.usd)');
        console.log('   Wallet 2:', secondWallet.address, '(20 ytest.usd)');
        console.log('\n🎯 Now run: npm run test:prediction\n');

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
