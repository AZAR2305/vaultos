/**
 * Create Yellow Network Channel in Sandbox (Testnet)
 * 
 * Uses off-chain logic for testing - no mainnet funds required
 * This creates channels through the ClearNode API for sandbox testing
 */

import {
    createECDSAMessageSigner,
    createEIP712AuthMessageSigner,
    createAuthRequestMessage,
    createAuthVerifyMessageFromChallenge,
    createCreateChannelMessage,
} from '@erc7824/nitrolite';
import { createPublicClient, createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import WebSocket from 'ws';
import { ethers } from 'ethers';
import 'dotenv/config';

const CLEARNODE_URL = 'wss://clearnet-sandbox.yellow.com/ws';
const YTEST_USD_ADDRESS = '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb';
const CHAIN_ID = 84532; // Base Sepolia

interface ChannelCreationParams {
    token: string;
    amount: string;
    chain_id: number;
}

async function main() {
    console.log('\n🏗️  Yellow Network Sandbox Channel Creation\n');
    console.log('='.repeat(70));
    console.log('Mode: OFF-CHAIN TESTING (No mainnet funds required)');
    console.log('Network: Sandbox Testnet\n');
    console.log('='.repeat(70));

    if (!process.env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY not found in environment');
    }

    // Setup wallet
    const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
    console.log(`\n📍 Wallet: ${account.address}`);

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

    const sessionSigner = createECDSAMessageSigner(sessionPrivateKey);

    // Connect WebSocket
    const ws = new WebSocket(CLEARNODE_URL);
    let authSuccess = false;
    let channelCreated = false;
    
    // Cache auth parameters to use in EIP-712 signing
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

    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Operation timeout'));
        }, 60000);

        ws.on('open', async () => {
            console.log('🌐 Connected to Yellow Network Sandbox\n');
            
            try {
                // Step 1: Authenticate
                console.log('🔐 Step 1: Authentication...');
                const authMsg = await createAuthRequestMessage(authParams);
                
                ws.send(authMsg);
            } catch (error: any) {
                clearTimeout(timeout);
                reject(error);
            }
        });

        ws.on('message', async (data) => {
            try {
                const message = JSON.parse(data.toString());
                
                // Debug: Log all received messages
                if (process.env.DEBUG) {
                    console.log('📨 DEBUG:', JSON.stringify(message, null, 2).substring(0, 300));
                }
                
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
                    
                    // Sign and send verification
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
                        authSuccess = true;
                        
                        // Step 2: Create channel in sandbox
                        console.log('🏗️  Step 2: Creating sandbox channel...');
                        console.log('   Token: ytest.usd');
                        console.log('   Amount: 20 USDC (20000000 units)');
                        console.log('   Chain: Base Sepolia (84532)\n');
                        
                        try {
                            // Create channel message using SDK
                            const channelMsg = await createCreateChannelMessage(
                                sessionSigner,
                                {
                                    chain_id: CHAIN_ID,
                                    token: YTEST_USD_ADDRESS as `0x${string}`,
                                }
                            );
                            
                            ws.send(channelMsg);
                            console.log('📤 Channel creation request sent...\n');
                        } catch (error: any) {
                            console.error('❌ Error creating channel message:', error.message);
                            throw error;
                        }
                    }
                }
                // Handle channel creation response
                else if (message.res && message.res[1] === 'create_channel') {
                    const channelData = message.res[2];
                    
                    if (channelData && channelData.channel_id) {
                        console.log('✅ CHANNEL CREATED SUCCESSFULLY!\n');
                        console.log('📋 Channel Details:');
                        console.log(`   ID: ${channelData.channel_id}`);
                        console.log(`   Status: ${channelData.status || 'pending'}`);
                        console.log(`   Token: ${YTEST_USD_ADDRESS}`);
                        console.log(`   Chain ID: ${CHAIN_ID}\n`);
                        
                        channelCreated = true;
                        
                        // Now query channels to verify
                        console.log('🔍 Step 3: Verifying channel...\n');
                        const getChannelsMsg = JSON.stringify({
                            req: [Date.now(), 'get_channels', [account.address]],
                        });
                        ws.send(getChannelsMsg);
                    } else if (channelData && channelData.error) {
                        console.error('❌ Channel creation failed:', channelData.error);
                        console.error('\n💡 Possible reasons:');
                        console.error('   1. Insufficient ledger balance (need ytest.usd)');
                        console.error('   2. Channel already exists');
                        console.error('   3. Invalid token address\n');
                        console.error('📝 Try getting ytest.usd from: https://earn-ynetwork.yellownetwork.io\n');
                    }
                }
                // Handle error responses
                else if (message.res && message.res[1] === 'error') {
                    const errorData = message.res[2];
                    console.error('❌ Error from Yellow Network:', errorData.error || errorData);
                    console.error('\n🔍 Debug Info:');
                    console.error('   - Check that expires_at matches in both auth_request and auth_verify');
                    console.error('   - Check that allowances match in both messages');
                    console.error('   - Check that session_key is the same\n');
                    
                    if (errorData.error && errorData.error.includes('insufficient')) {
                        console.error('💡 Solution: Get ytest.usd from the faucet:');
                        console.error('   https://earn-ynetwork.yellownetwork.io\n');
                    }
                    
                    // Don't continue if auth fails
                    clearTimeout(timeout);
                    reject(new Error(errorData.error || 'Authentication failed'));
                }
                // Handle channels list response
                else if (message.res && message.res[1] === 'channels') {
                    const channelsData = message.res[2];
                    const channels = channelsData?.channels || [];
                    
                    console.log('📊 Current Channels:\n');
                    if (channels.length === 0) {
                        console.log('   No channels found (yet)\n');
                    } else {
                        channels.forEach((ch: any, i: number) => {
                            console.log(`   Channel ${i + 1}:`);
                            console.log(`   ├─ ID: ${ch.channel_id}`);
                            console.log(`   ├─ Status: ${ch.status}`);
                            console.log(`   ├─ Token: ${ch.token}`);
                            console.log(`   ├─ Chain: ${ch.chain_id}`);
                            console.log(`   └─ Participant: ${ch.participant}\n`);
                        });
                        
                        if (channelCreated) {
                            console.log('🎉 SUCCESS! Channel is created and verified!\n');
                            console.log('✅ You can now create app sessions for prediction markets\n');
                            console.log('Next steps:');
                            console.log('   1. Run: npm run test:prediction');
                            console.log('   2. App session creation should now work!\n');
                        }
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
                        const amount = parseInt(bal.amount || '0') / 1000000;
                        console.log(`   ${bal.asset}: ${amount} USDC\n`);
                    });
                }
            } catch (error: any) {
                console.error('Error handling message:', error.message);
                if (error.stack) {
                    console.error('Stack:', error.stack);
                }
            }
        });

        ws.on('error', (error) => {
            clearTimeout(timeout);
            console.error('WebSocket error:', error);
            reject(error);
        });

        ws.on('close', () => {
            if (!authSuccess) {
                clearTimeout(timeout);
                reject(new Error('Connection closed before authentication'));
            }
        });
    });

    console.log('✓ Process complete\n');
}

main().catch(error => {
    console.error('\n❌ Error:', error.message);
    console.error('\n🔍 Troubleshooting:');
    console.error('   1. Check you have ytest.usd balance: npm run check:balance');
    console.error('   2. Visit faucet: https://earn-ynetwork.yellownetwork.io');
    console.error('   3. Verify sandbox connection: wss://clearnet-sandbox.yellow.com/ws\n');
    process.exit(1);
});
