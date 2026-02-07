/**
 * Check USDC balance with multiple token addresses
 * Base Sepolia has multiple USDC-like tokens
 */

import { createPublicClient, http, formatUnits } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import 'dotenv/config';

const USDC_ADDRESSES = {
    'ytest.USD (Yellow)': '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb',
    'Official USDC': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    'Circle USDC': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // This is Base mainnet
    'Base Sepolia Mock USDC': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
};

const ERC20_ABI = [
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ type: 'uint256' }],
    },
    {
        name: 'decimals',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint8' }],
    },
    {
        name: 'symbol',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'string' }],
    },
];

async function main() {
    if (!process.env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY not found in .env');
    }

    const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
    
    console.log('\n🔍 Comprehensive USDC Balance Check\n');
    console.log('='.repeat(70));
    console.log(`📍 Wallet: ${account.address}`);
    console.log(`🌐 Network: Base Sepolia\n`);

    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http('https://sepolia.base.org'),
    });

    console.log('💰 Checking all known USDC-like tokens:\n');

    for (const [name, address] of Object.entries(USDC_ADDRESSES)) {
        try {
            console.log(`⏳ ${name}: ${address}`);
            
            const [balance, decimals, symbol] = await Promise.all([
                publicClient.readContract({
                    address: address as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'balanceOf',
                    args: [account.address],
                }),
                publicClient.readContract({
                    address: address as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'decimals',
                }).catch(() => 6), // Default to 6 if fails
                publicClient.readContract({
                    address: address as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'symbol',
                }).catch(() => 'USDC'),
            ]);

            const formatted = formatUnits(balance as bigint, decimals as number);
            
            if ((balance as bigint) > 0n) {
                console.log(`   ✅ Balance: ${formatted} ${symbol}`);
                console.log(`   📊 Raw: ${balance.toString()} units\n`);
            } else {
                console.log(`   ⚪ Balance: 0 ${symbol}\n`);
            }
        } catch (error: any) {
            console.log(`   ❌ Error: ${error.message}\n`);
        }
    }

    console.log('='.repeat(70));
    console.log('\n💡 If you see 0 balance everywhere:');
    console.log('   1. Transaction might still be pending (wait 1-2 minutes)');
    console.log('   2. Check transaction on: https://sepolia.basescan.org/');
    console.log('   3. Verify you selected "Base Sepolia" on Circle faucet');
    console.log('   4. Try again: https://faucet.circle.com/\n');
}

main().catch(console.error);
