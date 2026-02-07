/**
 * Direct comparison test to debug authentication issue
 * Runs both implementations and compares the actual messages sent
 */

import { createVaultOSYellowClient } from '../src/yellow/vaultos-yellow';
import { createEnhancedYellowClient } from '../src/yellow/enhanced-yellow-client';
import 'dotenv/config';

async function testOriginal() {
    console.log('\n\n🔵 TESTING ORIGINAL (WORKING) CLIENT');
    console.log('='.repeat(60));
    
    const client = createVaultOSYellowClient();
    
    try {
        const { sessionAddress, userAddress } = await client.connect();
        console.log('✅ ORIGINAL: Authentication succeeded!');
        console.log('   User:', userAddress);
        console.log('   Session:', sessionAddress);
        
        client.disconnect();
        return true;
    } catch (error: any) {
        console.error('❌ ORIGINAL: Authentication failed:', error.message);
        client.disconnect();
        return false;
    }
}

async function testEnhanced() {
    console.log('\n\n🟠 TESTING ENHANCED CLIENT');
    console.log('='.repeat(60));
    
    const client = createEnhancedYellowClient();
    
    try {
        const { sessionAddress, userAddress } = await client.connect();
        console.log('✅ ENHANCED: Authentication succeeded!');
        console.log('   User:', userAddress);
        console.log('   Session:', sessionAddress);
        
        client.disconnect();
        return true;
    } catch (error: any) {
        console.error('❌ ENHANCED: Authentication failed:', error.message);
        client.disconnect();
        return false;
    }
}

async function main() {
    console.log('🔬 Yellow Network Authentication Debug Test\n');
    console.log('This test compares the original vs enhanced client');
    console.log('to identify why authentication is failing.\n');
    
    // Test original first (should work)
    const originalWorks = await testOriginal();
    
    // Wait a bit to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test enhanced (fails currently)
    const enhancedWorks = await testEnhanced();
    
    // Summary
    console.log('\n\n📊 RESULTS');
    console.log('='.repeat(60));
    console.log(`Original Client: ${originalWorks ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Enhanced Client: ${enhancedWorks ? '✅ PASS' : '❌ FAIL'}`);
    
    if (!enhancedWorks && originalWorks) {
        console.log('\n💡 DIAGNOSIS:');
        console.log('The original client works but enhanced doesn\'t.');
        console.log('Looking at the debug output above:');
        console.log('1. Check if auth_request format differs');
        console.log('2. Check if EIP-712 signature params match');
        console.log('3. Check if challenge response format matches');
        console.log('\nTip: Compare the 📨 Received messages to see differences!');
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
