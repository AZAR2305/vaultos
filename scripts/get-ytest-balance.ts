/**
 * Check Yellow Network testnet balance and get faucet instructions
 * This script helps you understand your current Yellow ledger balance
 * and provides instructions for getting ytest.USD
 */

import { createEnhancedYellowClient } from '../src/yellow/enhanced-yellow-client';
import { privateKeyToAccount } from 'viem/accounts';

async function checkYellowBalance() {
  console.log('🔍 Checking Yellow Network Testnet Balance...\n');

  // Your wallet private key
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  
  if (!PRIVATE_KEY) {
    console.error('❌ Error: PRIVATE_KEY not set in environment');
    console.log('\n💡 Run: $env:PRIVATE_KEY="0x..."');
    return;
  }

  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  console.log(`📍 Wallet Address: ${account.address}\n`);

  try {
    // Connect to Yellow Network sandbox
    const client = createEnhancedYellowClient();
    await client.connect();
    console.log('✅ Connected to Yellow Network Sandbox\n');

    // Get network configuration
    console.log('📋 Network Configuration:');
    const config = await client.getConfig();
    console.log(`  Chain ID: ${config.chain_id}`);
    console.log(`  Network: ${config.network_name || 'Yellow Testnet'}`);
    console.log(`  State Channel Contract: ${config.state_channel_addr}`);
    console.log('');

    // Get available assets
    console.log('💰 Available Assets on Yellow Network:');
    const assets = await client.getAssets();
    assets.forEach(asset => {
      console.log(`  - ${asset.asset_code} (${asset.name})`);
      console.log(`    Decimals: ${asset.decimals}`);
      console.log(`    Contract: ${asset.contract_addr || 'Native'}`);
    });
    console.log('');

    // Check your channels
    console.log('🔗 Your Channels:');
    const channels = await client.getChannels({
      address: account.address
    });
    
    if (channels.length === 0) {
      console.log('  ⚠️  No channels found. You need to create a channel first.');
      console.log('');
    } else {
      channels.forEach((channel, idx) => {
        console.log(`  Channel ${idx + 1}:`);
        console.log(`    ID: ${channel.channel_id.slice(0, 10)}...`);
        console.log(`    Status: ${channel.status}`);
        console.log(`    Your Balance: ${channel.balance} (across all assets)`);
      });
      console.log('');
    }

    // Try to get ledger balances (requires authentication)
    console.log('💵 Yellow Ledger Balances:');
    try {
      await client.authenticate(account);
      const balances = await client.getLedgerBalances();
      
      if (balances.length === 0) {
        console.log('  ⚠️  No balances found on Yellow ledger');
        console.log('  You need to deposit assets into a Yellow channel');
        console.log('');
      } else {
        balances.forEach(balance => {
          console.log(`  ${balance.asset}: ${balance.balance}`);
        });
        console.log('');
      }
    } catch (error: any) {
      console.log(`  ⚠️  Could not fetch balances: ${error.message}`);
      console.log('  (This is normal if you haven\'t authenticated yet)');
      console.log('');
    }

    // Show instructions
    console.log('═══════════════════════════════════════════════════════');
    console.log('📖 HOW TO GET ytest.USD');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('🎯 Method 1: Get On-Chain USDC First (RECOMMENDED)');
    console.log('');
    console.log('Step 1: Get testnet USDC on Base Sepolia');
    console.log('  → Visit: https://faucet.circle.com/');
    console.log(`  → Request USDC for: ${account.address}`);
    console.log('  → Network: Base Sepolia (Chain ID: 84532)');
    console.log('  → You should receive ~10-100 USDC');
    console.log('');
    console.log('Step 2: Deposit USDC into Yellow Network');
    console.log('  → Run: npm run test:enhanced');
    console.log('  → This will:');
    console.log('    1. Create a Yellow channel');
    console.log('    2. Deposit your on-chain USDC');
    console.log('    3. Give you ytest.USD balance on Yellow ledger');
    console.log('');
    console.log('Step 3: Verify your balance');
    console.log('  → Run: npm run check:balance');
    console.log('  → You should see your ytest.USD balance');
    console.log('');

    console.log('─────────────────────────────────────────────────────\n');

    console.log('🏢 Method 2: Yellow Canarynet Direct Faucet (If Available)');
    console.log('');
    console.log('Step 1: Join the Yellow Canarynet');
    console.log('  → Visit: https://yellow.org/canarynet');
    console.log('  → Sign up for early access');
    console.log('');
    console.log('Step 2: Access the Dashboard');
    console.log('  → Log in to the Yellow dashboard');
    console.log('  → Look for a "Faucet" or "Get Test Tokens" option');
    console.log('  → Request ytest.USD directly');
    console.log('');
    console.log('Note: This method may require Canarynet access approval');
    console.log('');

    console.log('─────────────────────────────────────────────────────\n');

    console.log('💡 Current Status:');
    if (channels.length === 0) {
      console.log('  1. ❌ No Yellow channels created');
      console.log('  2. ❌ No ytest.USD balance');
      console.log('  → Next: Get on-chain USDC and create a channel');
    } else {
      console.log('  1. ✅ Yellow channel exists');
      console.log('  2. ❓ Check balance with authentication');
      console.log('  → Next: Run test:enhanced to verify deposits');
    }
    console.log('');

    await client.disconnect();

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('  1. Check your internet connection');
    console.log('  2. Verify Yellow sandbox is online: wss://clearnet-sandbox.yellow.com/ws');
    console.log('  3. Try again in a few moments');
  }
}

// Run the check
checkYellowBalance()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
