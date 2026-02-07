/**
 * Check Yellow Network wallet balances
 * 
 * Checks:
 * - Base Sepolia ETH (for gas)
 * - ytest.USD tokens (for deposits)
 * - Contract deployment status
 * 
 * Usage: npm run check:balance
 */

import { createPublicClient, http, formatEther, formatUnits } from 'viem';
import { sepolia } from 'viem/chains';
import 'dotenv/config';

const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
  },
] as const;

async function main() {
  console.log('🔍 Checking Yellow Network Wallet Balances\n');
  console.log('='.repeat(60));

  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY not found in .env');
    process.exit(1);
  }

  // Derive wallet address from private key
  const { privateKeyToAccount } = await import('viem/accounts');
  const account = privateKeyToAccount(privateKey);
  const walletAddress = account.address;

  console.log(`\n📍 Wallet: ${walletAddress}\n`);

  const client = createPublicClient({
        chain: baseSepolia,
        transport: http('https://sepolia.base.org'),

  try {
    // Check Base Sepolia ETH balance
    console.log('⏳ Checking Base Sepolia ETH...');
    const ethBalance = await client.getBalance({ address: walletAddress });
    const ethFormatted = formatEther(ethBalance);
    
    console.log(`   Balance: ${ethFormatted} ETH`);
    
    if (BigInt(ethBalance) === 0n) {
      console.log('   Status: ❌ NO ETH - Cannot pay gas fees');
    } else if (BigInt(ethBalance) < 10000000000000000n) { // < 0.01 ETH
      console.log('   Status: ⚠️  LOW ETH - Need more for multiple transactions');
    } else {
      console.log('   Status: ✅ Sufficient ETH for transactions');
    }

    // Check ytest.USD balance
    console.log('\n⏳ Checking ytest.USD tokens...');
    const tokenAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
    
    const [balance, decimals] = await Promise.all([
      client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [walletAddress],
      }),
      client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }),
    ]);

    const tokenFormatted = formatUnits(balance as bigint, decimals as number);
    console.log(`   Balance: ${tokenFormatted} ytest.USD`);
    
    if (BigInt(balance as bigint) === 0n) {
      console.log('   Status: ❌ NO TOKENS - Need ytest.USD for channel deposit');
    } else if (BigInt(balance as bigint) < 100_000000n) { // < 100 USDC
      console.log('   Status: ⚠️  LOW TOKENS - May need more for testing');
    } else {
      console.log('   Status: ✅ Sufficient tokens for channel creation');
    }

    // Check custody contract
    console.log('\n⏳ Checking Yellow Network contracts...');
    const custodyAddress = '0x019B65A265EB3363822f2752141b3dF16131b262';
    const code = await client.getCode({ address: custodyAddress as `0x${string}` });
    
    if (code === '0x' || !code) {
      console.log('   Custody: ❌ NOT FOUND');
    } else {
      console.log('   Custody: ✅ Deployed at', custodyAddress);
      console.log('   Code: ✅', code.length, 'bytes');
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n📊 SUMMARY:\n');

    const hasETH = BigInt(ethBalance) > 10000000000000000n;
    const hasTokens = BigInt(balance as bigint) >= 100_000000n;
    const contractOK = code && code !== '0x';

    if (hasETH && hasTokens && contractOK) {
      console.log('✅ READY! You can create Yellow Network channels');
      console.log('   Run: npm run test:yellow\n');
    } else {
      console.log('⚠️  NOT READY - Need:\n');
      
      if (!hasETH) {
        console.log('   ❌ Base Sepolia ETH (for gas)');
        console.log('      Get from: https://www.alchemy.com/faucets/base-sepolia');
        console.log('      OR: https://bridge.base.org/deposit');
      }
      
      if (!hasTokens) {
        console.log('   ❌ ytest.USD tokens (for deposit)');
        console.log('      Run: Invoke-WebRequest -Uri "https://clearnet-sandbox.yellow.com/faucet/requestTokens" \\');
        console.log('              -Method POST -Headers @{"Content-Type"="application/json"} \\');
        console.log(`              -Body '{\"userAddress\":\"${walletAddress}\"}' | Select-Object -ExpandProperty Content`);
      }
      
      if (!contractOK) {
        console.log('   ❌ Yellow Network contracts not found');
        console.log('      Check if using correct network (Base Sepolia, Chain ID: 84532)');
      }
      
      console.log();
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
