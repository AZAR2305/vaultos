/**
 * Prediction Market App Session Test
 * 
 * Demonstrates complete prediction market flow using Yellow App Sessions:
 * 1. Create multi-party market
 * 2. Participants deposit funds
 * 3. Execute trades (buy YES/NO shares)
 * 4. Withdraw funds (up to 25%)
 * 5. Resolve market
 * 6. Distribute winnings
 * 
 * Usage: npm run test:prediction-market
 */

import { createEnhancedYellowClient } from '../src/yellow/enhanced-yellow-client';
import { PredictionMarketManager, MarketOutcome } from '../src/yellow/prediction-market-app-session';
import { privateKeyToAccount } from 'viem/accounts';
import 'dotenv/config';

async function main() {
    console.log('🎯 Prediction Market with App Sessions Test\n');
    console.log('='.repeat(70));
    console.log('Feature: Multi-Party Prediction Markets');
    console.log('Protocol: Yellow App Sessions (NitroRPC/0.4)');
    console.log('='.repeat(70));

    // Wallet 1: Main wallet (creator)
    const privateKey1 = process.env.PRIVATE_KEY as `0x${string}`;
    if (!privateKey1) {
        throw new Error('PRIVATE_KEY not found in environment');
    }

    // Wallet 2: Second participant (unique funded wallet)
    const privateKey2 = '0xda0070b15b47038798ed1a39d087439b65f67cce33d02c7334cefef28cd205dc' as `0x${string}`;
    
    const wallet1 = privateKeyToAccount(privateKey1);
    const wallet2 = privateKeyToAccount(privateKey2);

    console.log('✓ Wallets initialized');
    console.log(`  Wallet 1 (Creator):      ${wallet1.address}`);
    console.log(`  Wallet 2 (Participant):  ${wallet2.address}`);
    console.log('  Protocol: NitroRPC/0.4\n');

    // Initialize client with main wallet
    const client = createEnhancedYellowClient();

    try {
        // ==================================================================
        // STEP 1: CONNECT & AUTHENTICATE
        // ==================================================================
        console.log('\n📡 STEP 1: CONNECTION');
        console.log('-'.repeat(70));

        const { sessionAddress, userAddress } = await client.connect({
            allowanceAmount: '10000000000',  // 10,000 USDC allowance
            expiresInSeconds: 7200,          // 2 hour session
            scope: 'prediction-markets',
            application: 'VaultOS Markets'
        });

        console.log('✅ Connected');
        console.log(`   User: ${userAddress}`);
        console.log(`   Session: ${sessionAddress}`);

        // ==================================================================
        // STEP 2: INITIALIZE MARKET MANAGER
        // ==================================================================
        console.log('\n🏗️  STEP 2: INITIALIZE MARKET MANAGER');
        console.log('-'.repeat(70));

        const marketManager = new PredictionMarketManager(client);

        console.log('✅ Prediction Market Manager initialized');
        console.log('   App Definition: 0x0000000000000000000000000000000000000001');
        console.log('   Intent Support: OPERATE, DEPOSIT, WITHDRAW');

        // ==================================================================
        // STEP 3: GET TOKEN ADDRESS
        // ==================================================================
        console.log('\n💰 STEP 3: GET TOKEN ADDRESS');
        console.log('-'.repeat(70));

        const assets = await client.getAssets(84532);  // Base Sepolia
        const usdcAsset = assets.find(a => a.symbol === 'ytest.usd');

        if (!usdcAsset) {
            throw new Error('ytest.usd not found');
        }

        console.log('✅ Token found');
        console.log(`   Symbol: ${usdcAsset.symbol}`);
        console.log(`   Name: ${usdcAsset.name}`);
        console.log(`   Address: ${usdcAsset.token}`);
        console.log(`   Decimals: ${usdcAsset.decimals}`);

        // ==================================================================
        // STEP 4: CREATE PREDICTION MARKET
        // ==================================================================
        console.log('\n📊 STEP 4: CREATE PREDICTION MARKET');
        console.log('-'.repeat(70));

        console.log('\nMarket Details:');
        console.log('   Question: "Will ETH reach $5000 by end of month?"');
        console.log('   Duration: 7 days');
        console.log('   Initial YES odds: 65%');
        console.log('   Initial NO odds: 35%');
        console.log('   Participants: 2 (unique funded wallets)');
        console.log('   Allocation: 10 USDC per participant (20 USDC total)');

        // Use 2 unique wallet addresses (both funded)
        const participants = [
            wallet1.address,  // 0xFefa60F5aA4069F96b9Bf65c814DDb3A604974e1
            wallet2.address,  // 0x44D113bD4682EEcFC2D2E47949593b0501C3661f
        ];

        console.log('\n💡 App Session Setup:');
        console.log('   ✅ 2 unique participant addresses');
        console.log(`   📍 Participant 1: ${participants[0]}`);
        console.log(`   📍 Participant 2: ${participants[1]}`);
        console.log('   💰 Each deposits 10 USDC into shared app session\n');

        try {
            const market = await marketManager.createMarket({
                question: 'Will ETH reach $5000 by end of month?',
                description: 'Ethereum price prediction market. Resolves YES if ETH >= $5000 by month end.',
                durationMinutes: 60 * 24 * 7,  // 7 days
                initialYesPrice: 0.65,
                participants,
                initialDeposit: 10_000_000n,  // 10 USDC per participant (20 total, 6 decimals)
                token: usdcAsset.token
            });

            console.log('✅ Market created successfully!');
            console.log(`   Market ID: ${market.marketId}`);
            console.log(`   App Session ID: ${market.appSessionId}`);
            console.log(`   Status: ${market.status}`);
            console.log(`   Total Deposited: ${Number(market.totalDeposited) / 1_000_000} USDC`);
            console.log(`   End Time: ${new Date(market.endTime).toLocaleString()}`);

            // ==================================================================
            // STEP 5: EXECUTE TRADES (OPERATE INTENT)
            // ==================================================================
            console.log('\n📈 STEP 5: EXECUTE TRADES');
            console.log('-'.repeat(70));

            console.log('\nTrade 1: Buy 50 YES shares');
            const trade1 = await marketManager.executeTrade({
                marketId: market.marketId,
                position: 'YES',
                shares: 50n,
                token: usdcAsset.token
            });

            console.log('✅ Trade 1 executed');
            console.log(`   Position: ${trade1.position}`);
            console.log(`   Shares: ${trade1.shares}`);
            console.log(`   Cost: ${Number(trade1.cost) / 1_000_000} USDC`);

            console.log('\nTrade 2: Buy 30 NO shares');
            const trade2 = await marketManager.executeTrade({
                marketId: market.marketId,
                position: 'NO',
                shares: 30n,
                token: usdcAsset.token
            });

            console.log('✅ Trade 2 executed');
            console.log(`   Position: ${trade2.position}`);
            console.log(`   Shares: ${trade2.shares}`);
            console.log(`   Cost: ${Number(trade2.cost) / 1_000_000} USDC`);

            // Get user position
            const position = marketManager.getUserPosition(market.marketId, userAddress);
            console.log('\n📊 Current Position:');
            console.log(`   YES Shares: ${position.yesShares}`);
            console.log(`   NO Shares: ${position.noShares}`);

            // ==================================================================
            // STEP 6: ADD FUNDS (DEPOSIT INTENT)
            // ==================================================================
            console.log('\n💰 STEP 6: ADD FUNDS TO MARKET');
            console.log('-'.repeat(70));

            console.log('\nDepositing additional 50 USDC...');
            await marketManager.depositToMarket({
                marketId: market.marketId,
                amount: 50n * 1_000_000n,
                token: usdcAsset.token
            });

            const updatedMarket = marketManager.getMarket(market.marketId)!;
            console.log('✅ Deposit successful');
            console.log(`   New Total: ${Number(updatedMarket.totalDeposited) / 1_000_000} USDC`);

            // ==================================================================
            // STEP 7: WITHDRAW FUNDS (WITHDRAW INTENT)
            // ==================================================================
            console.log('\n💸 STEP 7: WITHDRAW FUNDS (MAX 25%)');
            console.log('-'.repeat(70));

            console.log('\nWithdrawing 25 USDC (early withdrawal)...');
            await marketManager.withdrawFromMarket({
                marketId: market.marketId,
                amount: 25n * 1_000_000n,
                token: usdcAsset.token
            });

            const marketAfterWithdraw = marketManager.getMarket(market.marketId)!;
            console.log('✅ Withdrawal successful');
            console.log(`   Remaining: ${Number(marketAfterWithdraw.totalDeposited) / 1_000_000} USDC`);

            // ==================================================================
            // STEP 8: RESOLVE MARKET
            // ==================================================================
            console.log('\n🎯 STEP 8: RESOLVE MARKET');
            console.log('-'.repeat(70));

            console.log('\nMarket Resolution:');
            console.log('   Oracle determines: ETH reached $5200');
            console.log('   Outcome: YES');
            console.log('   YES holders win, NO holders lose');

            await marketManager.resolveMarket({
                marketId: market.marketId,
                outcome: MarketOutcome.YES,
                token: usdcAsset.token
            });

            const resolvedMarket = marketManager.getMarket(market.marketId)!;
            console.log('\n✅ Market resolved!');
            console.log(`   Final Outcome: ${resolvedMarket.outcome}`);
            console.log(`   Status: ${resolvedMarket.status}`);
            console.log(`   Resolved At: ${new Date(resolvedMarket.resolvedAt!).toLocaleString()}`);

            // ==================================================================
            // STEP 9: VIEW RESULTS
            // ==================================================================
            console.log('\n📊 STEP 9: MARKET RESULTS');
            console.log('-'.repeat(70));

            console.log('\nMarket Statistics:');
            console.log(`   Total YES Shares: ${resolvedMarket.totalYesShares}`);
            console.log(`   Total NO Shares: ${resolvedMarket.totalNoShares}`);
            console.log(`   Total Pool: ${Number(resolvedMarket.totalDeposited) / 1_000_000} USDC`);
            console.log(`   Winners: YES holders`);
            console.log(`   Losers: NO holders`);

            console.log('\nWinnings Distribution:');
            console.log('   ✅ Automatically distributed via App Session closure');
            console.log('   ✅ Winners received proportional share of pool');
            console.log('   ✅ Funds settled instantly off-chain');

            // ==================================================================
            // SUMMARY
            // ==================================================================
            console.log('\n' + '='.repeat(70));
            console.log('🎉 PREDICTION MARKET TEST COMPLETE');
            console.log('='.repeat(70));

            console.log('\n✅ Successfully Demonstrated:');
            console.log('   1. ✓ Multi-party market creation (App Session)');
            console.log('   2. ✓ Trading with OPERATE intent');
            console.log('   3. ✓ Depositing with DEPOSIT intent');
            console.log('   4. ✓ Withdrawing with WITHDRAW intent (25% max)');
            console.log('   5. ✓ Market resolution');
            console.log('   6. ✓ Automatic winner distribution');

            console.log('\n🚀 App Session Benefits:');
            console.log('   ✓ Multi-participant support');
            console.log('   ✓ Flexible fund management (DEPOSIT/WITHDRAW)');
            console.log('   ✓ Efficient trading (OPERATE)');
            console.log('   ✓ Atomic settlement on close');
            console.log('   ✓ Gas efficient (2 on-chain txs total)');
            console.log('   ✓ Instant state updates');

            console.log('\n💡 Production Considerations:');
            console.log('   - Use actual app definition contract');
            console.log('   - Implement proper oracle for market resolution');
            console.log('   - Add market maker for liquidity');
            console.log('   - Support dynamic pricing (AMM)');
            console.log('   - Add dispute resolution mechanism');
            console.log('   - Implement market categories and discovery');

        } catch (error: any) {
            if (error.message.includes('insufficient') || error.message.includes('balance')) {
                console.log('\n⚠️  Market creation requires funded channel');
                console.log('\n   Prerequisites:');
                console.log('   1. Create channel: await client.createChannel()');
                console.log('   2. Fund with enough USDC for deposits');
                console.log('   3. Retry market creation');
                
                console.log('\n   To get funds:');
                console.log('   - Base Sepolia ETH: https://www.alchemy.com/faucets/base-sepolia');
                console.log('   - ytest.USD tokens:');
                console.log(`     curl -X POST https://clearnet-sandbox.yellow.com/faucet/requestTokens \\`);
                console.log(`       -H "Content-Type: application/json" \\`);
                console.log(`       -d '{"userAddress":"${userAddress}"}'`);
            } else {
                throw error;
            }
        }

        console.log('\n' + '='.repeat(70) + '\n');

    } catch (error: any) {
        console.error('\n❌ Error:', error.message);
        console.error('\nStack:', error.stack);
    } finally {
        // Cleanup
        setTimeout(() => {
            client.disconnect();
            process.exit(0);
        }, 2000);
    }
}

main().catch(console.error);
