/**
 * Test Yellow Network Sandbox Integration
 * 
 * This script verifies connection to Yellow Network sandbox
 * and demonstrates the authentication flow.
 * 
 * Usage:
 *   1. Set PRIVATE_KEY and SEPOLIA_RPC_URL in .env
 *   2. Run: npx tsx scripts/test-yellow.ts
 *   3. Get test tokens: npm run faucet
 */

import { createYellowClient } from '../src/yellow/nitrolite';
import 'dotenv/config';

async function main() {
  console.log('🟡 Yellow Network Sandbox Test\n');

  // Create client
  const client = createYellowClient();

  try {
    // 1. Connect to Clearnode
    console.log('1️⃣ Connecting to Yellow Network Clearnode...');
    await client.connect();
    console.log('');

    // 2. Request test tokens (optional - comment out if already done)
    console.log('2️⃣ Requesting test tokens from faucet...');
    try {
      await client.requestTestTokens();
    } catch (err) {
      console.log('   ⚠️  Faucet request failed (may have already been used)');
    }
    console.log('');

    // 3. Create session and authenticate
    console.log('3️⃣ Creating session and authenticating...');
    const session = await client.createSession('1000000000'); // 1000 ytest.USD allowance
    console.log('');

    console.log('✅ Yellow Network Integration Working!');
    console.log('\n📊 Session Details:');
    console.log('   Session ID:', session.sessionId);
    console.log('   User Address:', session.userAddress);
    console.log('   Session Address:', session.sessionAddress);
    console.log('   Expires At:', new Date(Number(session.expiresAt) * 1000).toLocaleString());
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    client.disconnect();
  }
}

main();
