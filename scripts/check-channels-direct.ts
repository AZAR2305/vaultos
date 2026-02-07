/**
 * Direct Yellow Network Channel Check
 * 
 * Uses nitrolite SDK directly to check channel status
 * Bypasses wrapper layer to avoid type conflicts
 */

import {
    createGetChannelsMessage,
    createGetLedgerBalancesMessage,
    createECDSAMessageSigner,
    createEIP712AuthMessageSigner,
    createAuthRequestMessage,
    createAuthVerifyMessageFromChallenge,
} from '@erc7824/nitrolite';
import { createPublicClient, createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import WebSocket from 'ws';
import { ethers } from 'ethers';
import 'dotenv/config';

const CLEARNODE_URL = 'wss://clearnet-sandbox.yellow.com/ws';
const CUSTODY_ADDRESS = '0x019B65A265EB3363822f2752141b3dF16131b262' as `0x${string}`;

async function main() {
    console.log('\n🔍 Yellow Network Channel Status (Direct SDK)\n');
    console.log('='.repeat(70));

    if (!process.env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY not found in environment');
    }

    // Setup wallet
    const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
    console.log(`📍 Wallet: ${account.address}\n`);

    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http()
    });

    const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http()
    });

    // Generate session key
    const sessionWallet = ethers.Wallet.createRandom();
    const sessionPrivateKey = sessionWallet.privateKey as `0x${string}`;
    console.log(`🔑 Session Key: ${sessionWallet.address}\n`);

    // Create ECDSA message signer for session key (no NitroliteClient needed)
    const sessionSigner = createECDSAMessageSigner(sessionPrivateKey);

    // Cache auth parameters to use consistently (CRITICAL: prevents timestamp mismatch)
    const authParams = {
        address: account.address,
        session_key: sessionWallet.address,
        application: 'Yellow',
        expires_at: BigInt(Math.floor(Date.now() / 1000) + 7200),
        scope: 'console',
        allowances: [{
            asset: 'ytest.usd',
            amount: '1000000000'
        }],
    };

    // Connect WebSocket
    const ws = new WebSocket(CLEARNODE_URL);
    let authSuccess = false;

    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Connection timeout'));
        }, 30000);

        ws.on('open', async () => {
            console.log('🌐 WebSocket connected');
            
            try {
                // Step 1: Send auth_request using cached params
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
                console.log('📨 Received message:', JSON.stringify(message, null, 2).substring(0, 500));
                
                // Handle auth challenge
                if (message.res && message.res[1] === 'auth_challenge') {
                    console.log('🔐 Received auth_challenge');
                    
                    // Extract challenge from response structure
                    const challengeData = message.res[2];
                    const challenge = challengeData.challenge_message || challengeData.challenge || challengeData;
                    console.log('   Challenge:', challenge);
                    
                    // Create EIP-712 signer using cached auth params (CRITICAL: must match auth_request!)
                    const eip712Signer = createEIP712AuthMessageSigner(
                        walletClient,
                        {
                            session_key: authParams.session_key,
                            allowances: authParams.allowances,
                            expires_at: authParams.expires_at.toString(),  // Use cached value
                            scope: authParams.scope,
                        },
                        {
                            name: authParams.application,  // Must match auth_request
                        }
                    );
                    
                    // Sign and send verification using SDK function
                    const authVerifyMsg = await createAuthVerifyMessageFromChallenge(
                        eip712Signer,
                        challenge  // Use extracted challenge
                    );
                    
                    ws.send(authVerifyMsg);
                    console.log('📤 Sent auth_verify\n');
                }
                // Handle auth success (auth_verify response)
                else if (message.res && message.res[1] === 'auth_verify') {
                    const verifyData = message.res[2];
                    if (verifyData && verifyData.address) {
                        console.log('✅ Authentication successful\n');
                        console.log('   Address:', verifyData.address);
                        console.log('   JWT Token:', verifyData.jwt_token?.substring(0, 50) + '...\n');
                        authSuccess = true;
                        clearTimeout(timeout);
                        resolve();
                    } else {
                        clearTimeout(timeout);
                        reject(new Error('Auth verify failed: ' + JSON.stringify(verifyData)));
                    }
                }
                // Handle channels response
                else if (message.res && message.res[1] === 'channels') {
                    console.log('📊 Channel Information:\n');
                    const channelsData = message.res[2];
                    const channels = channelsData?.channels || [];
                    
                    if (!channels || channels.length === 0) {
                        console.log('⚠️  No channels found!\n');
                        console.log('🔴 BLOCKER: App sessions require funded channels\n');
                        console.log('To create app sessions, you need:');
                        console.log('  1. Visit: https://apps.yellow.com');
                        console.log('  2. Create a channel for your wallet');
                        console.log('  3. Fund it with ytest.usd');
                        console.log('  4. Then app session creation will work\n');
                        console.log('📝 Note: You have 49 ytest.usd in your ledger balance');
                        console.log('   but it needs to be deposited into a channel first!\n');
                    } else {
                        console.log(`✅ Found ${channels.length} channel(s):\n`);
                        channels.forEach((ch: any, i: number) => {
                            console.log(`Channel ${i + 1}:`);
                            console.log(`  ├─ ID: ${ch.channel_id}`);
                            console.log(`  ├─ Status: ${ch.status}`);
                            console.log(`  ├─ Token: ${ch.token}`);
                            console.log(`  ├─ Chain: ${ch.chain_id}`);
                            console.log(`  ├─ Participant: ${ch.participant}`);
                            console.log(`  └─ Version: ${ch.version}\n`);
                        });
                    }
                    
                    ws.close();
                }
                // Handle balance updates
                else if (message.res && message.res[1] === 'bu') {
                    const balanceData = message.res[2];
                    const balances = balanceData?.balance_updates || [];
                    console.log('💰 Ledger Balances:\n');
                    balances.forEach((bal: any) => {
                        console.log(`   ${bal.asset}: ${bal.amount} (${parseInt(bal.amount) / 1000000} USDC)\n`);
                    });
                }
                // Handle auth failure
                else if (message.res && message.res[1] === 'auth_failure') {
                    clearTimeout(timeout);
                    reject(new Error(`Authentication failed: ${JSON.stringify(message.res[2])}`));
                }
            } catch (error: any) {
                console.error('Error handling message:', error.message);
                clearTimeout(timeout);
                reject(error);
            }
        });

        ws.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });

        ws.on('close', () => {
            console.log('\n✓ Check complete');
        });
    });
}

main().catch(error => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
});
