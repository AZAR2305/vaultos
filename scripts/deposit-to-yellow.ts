/**
 * Deposit funds to Yellow Network Ledger
 * 
 * Moves on-chain ytest.usd to Yellow Network's ledger system
 * Required before creating channels
 */

import {
    createAuthRequestMessage,
    createAuthVerifyMessageFromChallenge,
    createEIP712AuthMessageSigner,
} from '@erc7824/nitrolite';
import { createPublicClient, createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import WebSocket from 'ws';
import { ethers } from 'ethers';
import 'dotenv/config';

const CLEARNODE_URL = 'wss://clearnet-sandbox.yellow.com/ws';
const YTEST_USD_ADDRESS = '0x5fd84259d66cd46123540766be93defe96ffb8a7';
const CUSTODY_ADDRESS = '0x019B65A265EB3363822f2752141b3dF16131b262' as `0x${string}`;
const CHAIN_ID = 84532; // Base Sepolia

async function main() {
    console.log('\n💰 Yellow Network Ledger Deposit\n');
    console.log('='.repeat(70));

    if (!process.env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY not found in environment');
    }

    // Setup wallet
    const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http()
    });

    const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http()
    });

    console.log(`📍 Wallet: ${account.address}\n`);

    // Check on-chain balance first
    console.log('📊 Checking on-chain balance...\n');
    
    // ytest.usd ERC20 contract
    const abi = [
        'function balanceOf(address) view returns (uint256)',
        'function allowance(address owner, address spender) view returns (uint256)',
        'function approve(address spender, uint256 amount) returns (bool)',
    ];

    try {
        const balance = await publicClient.readContract({
            address: YTEST_USD_ADDRESS as `0x${string}`,
            abi,
            functionName: 'balanceOf',
            args: [account.address],
        }) as bigint;

        const balanceInUSDC = Number(balance) / 1_000_000;
        console.log(`💵 On-chain ytest.usd: ${balanceInUSDC} USDC (${balance} units)\n`);

        if (balance === 0n) {
            console.log('❌ No on-chain balance found!\n');
            console.log('🔗 Get ytest.usd from faucet:');
            console.log('   https://earn-ynetwork.yellownetwork.io\n');
            console.log('📝 Or check your balance at:');
            console.log('   https://sepolia.basescan.org/address/' + account.address + '\n');
            process.exit(1);
        }

        // Check allowance for Yellow Network custody contract
        const allowance = await publicClient.readContract({
            address: YTEST_USD_ADDRESS as `0x${string}`,
            abi,
            functionName: 'allowance',
            args: [account.address, CUSTODY_ADDRESS],
        }) as bigint;

        console.log(`🔐 Current Allowance: ${Number(allowance) / 1_000_000} USDC\n`);

        // If allowance is insufficient, approve
        if (allowance < balance) {
            console.log('📝 Approving Yellow Network custody contract...\n');
            
            const hash = await walletClient.writeContract({
                address: YTEST_USD_ADDRESS as `0x${string}`,
                abi,
                functionName: 'approve',
                args: [CUSTODY_ADDRESS, balance],
            });

            console.log(`   Transaction: ${hash}`);
            console.log('   Waiting for confirmation...\n');

            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            
            if (receipt.status === 'success') {
                console.log('   ✅ Approval confirmed!\n');
            } else {
                throw new Error('Approval failed');
            }
        } else {
            console.log('✅ Already approved\n');
        }

        // Now connect to Yellow Network and deposit
        console.log('🔐 Authenticating with Yellow Network...\n');

        const sessionWallet = ethers.Wallet.createRandom();
        console.log(`🔑 Session Key: ${sessionWallet.address}\n`);

        // Cache auth parameters for consistency
        const authParams = {
            address: account.address,
            session_key: sessionWallet.address,
            application: 'Yellow',
            expires_at: BigInt(Math.floor(Date.now() / 1000) + 7200),
            scope: 'console',
            allowances: [{
                asset: 'ytest.usd',
                amount: balance.toString(),
            }],
        };

        const ws = new WebSocket(CLEARNODE_URL);
        let authenticated = false;

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Operation timeout'));
            }, 60000);

            ws.on('open', async () => {
                console.log('🌐 Connected to Yellow Network\n');
                
                try {
                    const authMsg = await createAuthRequestMessage(authParams);
                    ws.send(authMsg);
                    console.log('📤 Sent auth_request\n');
                } catch (error: any) {
                    clearTimeout(timeout);
                    reject(error);
                }
            });

            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    
                    // Handle auth challenge
                    if (message.res && message.res[1] === 'auth_challenge') {
                        console.log('🔐 Received auth_challenge\n');
                        
                        const challengeData = message.res[2];
                        const challenge = challengeData.challenge_message || challengeData.challenge || challengeData;
                        
                        const eip712Signer = createEIP712AuthMessageSigner(
                            walletClient,
                            {
                                session_key: authParams.session_key,
                                allowances: authParams.allowances,
                                expires_at: authParams.expires_at.toString(),
                                scope: authParams.scope,
                            },
                            {
                                name: authParams.application,
                            }
                        );
                        
                        const authVerifyMsg = await createAuthVerifyMessageFromChallenge(
                            eip712Signer,
                            challenge
                        );
                        
                        ws.send(authVerifyMsg);
                        console.log('📤 Sent auth_verify\n');
                    }
                    // Handle auth success
                    else if (message.res && message.res[1] === 'auth_verify') {
                        const verifyData = message.res[2];
                        if (verifyData && verifyData.address) {
                            console.log('✅ Authenticated successfully\n');
                            authenticated = true;
                            
                            // Send deposit request
                            console.log('💰 Requesting deposit...\n');
                            console.log(`   Amount: ${Number(balance) / 1_000_000} USDC`);
                            console.log(`   Token: ytest.usd (${YTEST_USD_ADDRESS})`);
                            console.log(`   Chain: Base Sepolia (${CHAIN_ID})\n`);
                            
                            const depositMsg = JSON.stringify({
                                req: [
                                    Date.now(),
                                    'deposit',
                                    {
                                        chain_id: CHAIN_ID,
                                        token: YTEST_USD_ADDRESS,
                                        amount: balance.toString(),
                                    }
                                ],
                            });
                            
                            ws.send(depositMsg);
                            console.log('📤 Deposit request sent\n');
                        }
                    }
                    // Handle deposit response
                    else if (message.res && message.res[1] === 'deposit') {
                        const depositData = message.res[2];
                        console.log('📨 Deposit response:', JSON.stringify(depositData, null, 2));
                        
                        if (depositData && depositData.tx_hash) {
                            console.log('\n✅ DEPOSIT SUCCESSFUL!\n');
                            console.log('📋 Details:');
                            console.log(`   Transaction: ${depositData.tx_hash}`);
                            console.log(`   Amount: ${Number(balance) / 1_000_000} USDC\n`);
                            console.log('🔍 Verify on BaseScan:');
                            console.log(`   https://sepolia.basescan.org/tx/${depositData.tx_hash}\n`);
                            console.log('⏰ Wait 1-2 minutes for confirmation, then:');
                            console.log('   npm run check:channels  (check ledger balance)');
                            console.log('   npm run create:channel  (create payment channel)\n');
                        } else if (depositData && depositData.error) {
                            console.error('❌ Deposit failed:', depositData.error);
                        }
                        
                        clearTimeout(timeout);
                        ws.close();
                        resolve();
                    }
                    // Handle balance updates
                    else if (message.res && message.res[1] === 'bu') {
                        const balanceData = message.res[2];
                        const balances = balanceData?.balance_updates || [];
                        console.log('💰 Current Ledger Balance:');
                        balances.forEach((bal: any) => {
                            const amount = parseInt(bal.amount || '0') / 1_000_000;
                            console.log(`   ${bal.asset}: ${amount} USDC`);
                        });
                        console.log();
                    }
                    // Handle errors
                    else if (message.res && message.res[1] === 'error') {
                        const errorData = message.res[2];
                        console.error('❌ Error:', errorData.error || errorData);
                        clearTimeout(timeout);
                        reject(new Error(errorData.error || 'Operation failed'));
                    }
                } catch (error: any) {
                    console.error('Error handling message:', error.message);
                }
            });

            ws.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });

            ws.on('close', () => {
                if (!authenticated) {
                    clearTimeout(timeout);
                    reject(new Error('Connection closed before authentication'));
                }
            });
        });

        console.log('✓ Process complete\n');

    } catch (error: any) {
        console.error('\n❌ Error:', error.message);
        console.error('\n🔍 Troubleshooting:');
        console.error('   1. Check on-chain balance: https://sepolia.basescan.org/address/' + account.address);
        console.error('   2. Get ytest.usd: https://earn-ynetwork.yellownetwork.io');
        console.error('   3. Verify RPC: Base Sepolia network\n');
        process.exit(1);
    }
}

main().catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
});
