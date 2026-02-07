#!/usr/bin/env tsx

/**
 * Sui Settlement Test Script
 * Tests the integration between VaultOS and Sui blockchain
 */

import { getSuiSettlementService } from '../src/sui/settlement';
import * as dotenv from 'dotenv';

dotenv.config();

async function testSuiSettlement() {
  console.log('🧪 Testing Sui Settlement Integration\n');

  try {
    const suiService = getSuiSettlementService();
    
    // Display admin address
    const adminAddress = suiService.getAdminAddress();
    console.log('📍 Admin Address:', adminAddress);
    console.log('   Fund this address with testnet SUI: https://faucet.sui.io\n');

    // Check if package is deployed
    const packageId = process.env.SUI_PACKAGE_ID;
    if (!packageId) {
      console.log('⚠️  Contract not deployed yet.');
      console.log('   Run: npm run sui:deploy\n');
      return;
    }

    console.log('📦 Package ID:', packageId);
    console.log('');

    // Test settlement submission
    console.log('🔄 Submitting test settlement...\n');
    
    const testSettlement = {
      marketId: 'TEST_MARKET_' + Date.now(),
      winningOutcome: 'YES' as const,
      totalPool: 1000000, // 1 USDC in microunits
    };

    const digest = await suiService.submitSettlement(testSettlement);
    
    console.log('');
    console.log('✅ SUCCESS! Settlement recorded on Sui');
    console.log('');
    console.log('Transaction Details:');
    console.log('  Digest:', digest);
    console.log('  Explorer:', `https://suiscan.xyz/testnet/tx/${digest}`);
    console.log('');
    console.log('Market Settlement:');
    console.log('  Market ID:', testSettlement.marketId);
    console.log('  Winner:', testSettlement.winningOutcome);
    console.log('  Pool:', testSettlement.totalPool, 'microUSDC');
    console.log('');
    console.log('🎉 Your project is now Sui-eligible!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('SUI_PRIVATE_KEY')) {
        console.log('\n💡 Setup required:');
        console.log('   1. Generate keypair: sui client new-address ed25519');
        console.log('   2. Add to .env: SUI_PRIVATE_KEY=<your-private-key-base64>');
        console.log('   3. Fund address: https://faucet.sui.io');
      } else if (error.message.includes('not deployed')) {
        console.log('\n💡 Deploy contract first:');
        console.log('   npm run sui:deploy');
      }
    }
    
    process.exit(1);
  }
}

testSuiSettlement();
