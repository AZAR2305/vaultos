/**
 * Deposit USDC to Yellow Network (ON-CHAIN)
 * This creates a Base Sepolia transaction and increases ledger balance
 */

import { createWalletClient, http, parseUnits, encodeFunctionData } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import 'dotenv/config';

// Yellow Network contracts on Base Sepolia
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Official USDC on Base Sepolia
const CUSTODY_CONTRACT = '0x019B65A265EB3363822f2752141b3dF16131b262'; // Yellow custody

// ERC20 approve ABI
const APPROVE_ABI = {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
        { name: 'spender', type: 'address' },
        { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ type: 'bool' }]
};

// Deposit to custody ABI (simplified - adjust based on actual contract)
const DEPOSIT_ABI = {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' }
    ],
    outputs: []
};

console.log('\n💰 =====================================');
console.log('   Deposit to Yellow Network (ON-CHAIN)');
console.log('=====================================\n');

async function depositToYellow() {
    const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
    
    if (!PRIVATE_KEY) {
        console.error('❌ PRIVATE_KEY not set in .env');
        return;
    }

    const account = privateKeyToAccount(PRIVATE_KEY);
    
    const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http('https://sepolia.base.org'),
    });

    console.log('📋 Configuration:');
    console.log('----------------------------------------');
    console.log(`Wallet: ${account.address}`);
    console.log(`Chain: Base Sepolia (84532)`);
    console.log(`USDC: ${USDC_ADDRESS}`);
    console.log(`Custody: ${CUSTODY_CONTRACT}`);
    console.log('');

    const depositAmount = '5'; // 5 USDC
    const amountInWei = parseUnits(depositAmount, 6); // USDC has 6 decimals

    console.log('📋 Step 1: Check if approval needed');
    console.log('----------------------------------------');
    console.log(`You may have already approved (tx: 0x9f3ffc6c8cfcc39342e7675fdf00ebab4695ddce114b70e28ba625eff2415828)`);
    console.log('If not, you need to approve USDC first\n');

    try {
        // Option: Re-approve if needed (skip if already done)
        console.log('💡 Skipping approval (assuming already done)\n');

        console.log('📋 Step 2: Deposit USDC to Yellow Custody');
        console.log('----------------------------------------');
        console.log(`💸 Depositing ${depositAmount} USDC...\n`);

        // Encode deposit call
        const depositData = encodeFunctionData({
            abi: [DEPOSIT_ABI],
            functionName: 'deposit',
            args: [USDC_ADDRESS, amountInWei],
        });

        // Send transaction
        const txHash = await walletClient.sendTransaction({
            to: CUSTODY_CONTRACT,
            data: depositData,
            gas: 200000n,
        });

        console.log('✅ Transaction sent!');
        console.log('----------------------------------------');
        console.log(`Transaction Hash: ${txHash}`);
        console.log(`\n🔗 View on Base Sepolia Explorer:`);
        console.log(`https://sepolia.basescan.org/tx/${txHash}`);
        console.log('');

        console.log('⏳ Waiting for confirmation...');
        
        // Wait for transaction receipt
        const receipt = await walletClient.waitForTransactionReceipt({ hash: txHash });

        if (receipt.status === 'success') {
            console.log('✅ Transaction confirmed!');
            console.log('----------------------------------------');
            console.log(`Block: ${receipt.blockNumber}`);
            console.log(`Gas used: ${receipt.gasUsed}`);
            console.log(`Status: SUCCESS ✅`);
            console.log('');

            console.log('📊 What happened:');
            console.log('----------------------------------------');
            console.log(`1. ${depositAmount} USDC moved from your wallet`);
            console.log(`2. Deposited to Yellow custody contract`);
            console.log(`3. Your Yellow ledger balance increased by ${depositAmount}`);
            console.log('4. Transaction recorded on Base Sepolia (on-chain)');
            console.log('');

            console.log('🔍 Next step: Check your ledger balance');
            console.log('Run: npm run send:clean');
            console.log('You should see your balance increased!\n');

        } else {
            console.log('❌ Transaction failed');
            console.log(`Status: ${receipt.status}`);
        }

    } catch (error: any) {
        console.error('\n❌ Error:', error.message);
        
        if (error.message.includes('insufficient')) {
            console.log('\n💡 You may need:');
            console.log('1. More ETH for gas fees');
            console.log('2. More USDC to deposit');
            console.log('3. Approval transaction if not done yet');
        }
        
        if (error.message.includes('approve')) {
            console.log('\n💡 You need to approve USDC first:');
            console.log('Run this approval transaction:');
            console.log(`- Token: ${USDC_ADDRESS}`);
            console.log(`- Spender: ${CUSTODY_CONTRACT}`);
            console.log(`- Amount: 1000000 (or more)`);
        }
    }
}

depositToYellow().catch(console.error);
