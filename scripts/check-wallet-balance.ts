/**
 * Check wallet balances on Base Sepolia
 * Verifies ETH and ytest.USD token balances
 */

import { createPublicClient, http, formatEther } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import 'dotenv/config';

const YTEST_USD_TOKEN = '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb';

async function main() {
    if (!process.env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY not found in .env');
    }

    const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
    
    console.log('\n💳 Wallet Balance Check\n');
    console.log('='.repeat(70));
    console.log(`📍 Wallet: ${account.address}`);
    console.log(`🌐 Network: Base Sepolia\n`);

    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http('https://sepolia.base.org'),
    });

    try {
        // Check ETH balance
        console.log('⏳ Checking Base Sepolia ETH balance...');
        const ethBalance = await publicClient.getBalance({
            address: account.address,
        });
        const ethFormatted = formatEther(ethBalance);
        
        console.log(`💰 ETH Balance: ${ethFormatted} ETH`);
        if (BigInt(ethBalance) > 0n) {
            console.log('   ✅ Have ETH for gas fees\n');
        } else {
            console.log('   ❌ Need ETH for gas fees\n');
        }

        // Check ytest.USD token balance
        console.log('⏳ Checking ytest.USD token balance...');
        const tokenBalance = await publicClient.readContract({
            address: YTEST_USD_TOKEN,
            abi: [
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
            ],
            functionName: 'balanceOf',
            args: [account.address],
        });

        const decimals = await publicClient.readContract({
            address: YTEST_USD_TOKEN,
            abi: [
                {
                    name: 'decimals',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [],
                    outputs: [{ type: 'uint8' }],
                },
            ],
            functionName: 'decimals',
        });

        const tokenFormatted = Number(tokenBalance) / (10 ** Number(decimals));
        
        console.log(`💵 ytest.USD Balance: ${tokenFormatted} USDC (${tokenBalance.toString()} units)`);
        if (BigInt(tokenBalance) >= 20_000000n) {
            console.log('   ✅ Have enough tokens for channel (need 20 USDC)\n');
        } else {
            console.log('   ❌ Need more tokens (have ${tokenFormatted}, need 20 USDC)\n');
        }

        // Summary
        console.log('='.repeat(70));
        
        const hasETH = BigInt(ethBalance) > 0n;
        const hasTokens = BigInt(tokenBalance) >= 20_000000n;
        
        if (hasETH && hasTokens) {
            console.log('\n✅ READY TO CREATE CHANNEL!');
            console.log('\nNext step:');
            console.log('   npm run test:yellow\n');
        } else {
            console.log('\n⚠️  NEED MORE TOKENS\n');
            if (!hasETH) {
                console.log('❌ Missing Base Sepolia ETH:');
                console.log('   Visit: https://www.alchemy.com/faucets/base-sepolia\n');
            }
            if (!hasTokens) {
                console.log('❌ Missing ytest.USD tokens:');
                console.log('   curl -X POST https://clearnet-sandbox.yellow.com/faucet/requestTokens \\');
                console.log('     -H "Content-Type: application/json" \\');
                console.log(`     -d '{"userAddress":"${account.address}"}'`);
                console.log('');
            }
        }

    } catch (error: any) {
        console.error('❌ Error checking balances:', error.message);
        console.log('\n💡 Make sure Base Sepolia RPC is accessible');
    }
}

main().catch(console.error);
