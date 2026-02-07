/**
 * Create Yellow Network State Channel - Production Ready
 * 
 * This script properly creates a state channel using Yellow Network's SDK
 * Following the official documentation and working examples from the community
 * 
 * Requirements:
 * 1. PRIVATE_KEY in .env with funded wallet
 * 2. ytest.usd tokens in your wallet (get from faucet)
 * 3. Base Sepolia testnet
 */

import {
    createECDSAMessageSigner,
    createEIP712AuthMessageSigner,
    createAuthRequestMessage,
    createAuthVerifyMessageFromChallenge,
    createCreateChannelMessage,
    createGetChannelsMessage,
} from '@erc7824/nitrolite';
import { createPublicClient, createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import WebSocket from 'ws';
import 'dotenv/config';

// Yellow Network Sandbox Configuration
const CLEARNODE_URL = 'wss://clearnet-sandbox.yellow.com/ws';
const YTEST_USD_TOKEN = '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb';
const CHAIN_ID = 84532; // Base Sepolia

interface ChannelInfo {
    channel_id: string;
    status: string;
    token: string;
    chain_id: number;
    participant: string;
}

async function main() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║     Yellow Network State Channel Creation (Sandbox)           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Validate environment
    if (!process.env.PRIVATE_KEY) {
        throw new Error('❌ PRIVATE_KEY not found in .env file');
    }

    // Setup wallet (User EOA)
    const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
    console.log('👤 User Address:', account.address);

    const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http('https://sepolia.base.org')
    });

    // Generate ephemeral session key
    const sessionPrivateKey = generatePrivateKey();
    const sessionAccount = privateKeyToAccount(sessionPrivateKey);
    const sessionSigner = createECDSAMessageSigner(sessionPrivateKey);

    console.log('🔑 Session Key:', sessionAccount.address);
    console.log('🌐 Network: Base Sepolia (ChainId: 84532)');
    console.log('🪙  Token: ytest.usd\n');

    // Channel creation state
    let authenticated = false;
    let channelCreated = false;
    let existingChannel: ChannelInfo | null = null;

    // Authentication parameters (MUST BE CONSISTENT!)
    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 7200); // 2 hours from now
    const authParams = {
        address: account.address,
        session_key: sessionAccount.address,
        application: 'Yellow',  // CRITICAL: Must match EIP-712 domain
        expires_at: expiresAt,
        scope: 'console',
        allowances: [{
            asset: 'ytest.usd',
            amount: '1000000000'  // 1000 USDC allowance
        }],
    };

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Connect to Yellow Network
    const ws = new WebSocket(CLEARNODE_URL);

    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('⏱️  Operation timeout (60 seconds)'));
        }, 60000);

        ws.on('open', async () => {
            console.log('✅ Connected to Yellow Network Sandbox\n');
            console.log('📤 STEP 1: Sending authentication request...\n');

            try {
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

                // Debug logging (if enabled)
                if (process.env.DEBUG === 'true') {
                    console.log('📨 [DEBUG] Message:', JSON.stringify(message, null, 2));
                }

                const messageType = message.res?.[1];
                const messageData = message.res?.[2];

                switch (messageType) {
                    case 'auth_challenge':
                        console.log('🔐 STEP 2: Received auth challenge\n');
                        await handleAuthChallenge(message, ws, walletClient, authParams, sessionSigner);
                        break;

                    case 'auth_verify':
                        if (messageData?.address) {
                            console.log('✅ STEP 3: Authentication successful!\n');
                            authenticated = true;

                            // Request existing channels list
                            console.log('📋 STEP 4: Checking for existing channels...\n');
                            const getChannelsMsg = await createGetChannelsMessage(
                                sessionSigner,
                                account.address,
                                Date.now()
                            );
                            ws.send(getChannelsMsg);
                        }
                        break;

                    case 'channels':
                        const channels = messageData?.channels || [];
                        
                        if (channels.length > 0) {
                            console.log('📊 Found existing channels:\n');
                            channels.forEach((ch: ChannelInfo, i: number) => {
                                console.log(`   ${i + 1}. Channel ID: ${ch.channel_id}`);
                                console.log(`      Status: ${ch.status}`);
                                console.log(`      Token: ${ch.token}`);
                                console.log(`      Chain: ${ch.chain_id}\n`);
                                
                                if (ch.status === 'open' && !existingChannel) {
                                    existingChannel = ch;
                                }
                            });

                            if (existingChannel) {
                                console.log('✅ Active channel found! No need to create a new one.\n');
                                console.log('═'.repeat(64));
                                console.log('🎉 SUCCESS - Channel Ready for Trading!');
                                console.log('═'.repeat(64));
                                console.log(`\n📋 Channel Details:`);
                                console.log(`   ID: ${existingChannel.channel_id}`);
                                console.log(`   Status: ${existingChannel.status}`);
                                console.log(`   Token: ytest.usd`);
                                console.log(`   Chain: Base Sepolia\n`);
                                console.log('✅ You can now:');
                                console.log('   • Execute off-chain transfers');
                                console.log('   • Create app sessions for prediction markets');
                                console.log('   • Trade with zero gas fees\n');
                                
                                clearTimeout(timeout);
                                ws.close();
                                resolve();
                                return;
                            }
                        } else {
                            console.log('📝 No existing channels found\n');
                        }

                        // Create new channel
                        console.log('🏗️  STEP 5: Creating new state channel...\n');
                        console.log('   Configuration:');
                        console.log(`   • Token: ${YTEST_USD_TOKEN}`);
                        console.log(`   • Chain ID: ${CHAIN_ID}`);
                        console.log(`   • Network: Base Sepolia\n`);

                        try {
                            const channelMsg = await createCreateChannelMessage(
                                sessionSigner,
                                {
                                    chain_id: CHAIN_ID,
                                    token: YTEST_USD_TOKEN as `0x${string}`,
                                }
                            );
                            ws.send(channelMsg);
                            console.log('📤 Channel creation message sent\n');
                        } catch (error: any) {
                            console.error('❌ Failed to create channel message:', error.message);
                            throw error;
                        }
                        break;

                    case 'create_channel':
                        if (messageData?.channel_id) {
                            channelCreated = true;
                            
                            console.log('═'.repeat(64));
                            console.log('🎉 STATE CHANNEL CREATED SUCCESSFULLY!');
                            console.log('═'.repeat(64));
                            console.log(`\n📋 Channel Details:`);
                            console.log(`   ID: ${messageData.channel_id}`);
                            console.log(`   Status: ${messageData.status || 'active'}`);
                            console.log(`   Token: ytest.usd`);
                            console.log(`   Chain: Base Sepolia\n`);
                            
                            console.log('✅ What this enables:');
                            console.log('   • Instant off-chain transactions (<100ms)');
                            console.log('   • Zero gas fees for trades');
                            console.log('   • Real-time balance updates');
                            console.log('   • Cryptographically secure state');
                            console.log('   • Single on-chain settlement when done\n');
                            
                            console.log('🚀 Next Steps:');
                            console.log('   1. Run: npm run demo:app-session');
                            console.log('   2. Create prediction markets');
                            console.log('   3. Execute instant trades\n');
                            
                            console.log('📖 Architecture:');
                            console.log('   • Channel = Off-chain "bank account"');
                            console.log('   • Trades = Account balance updates (instant)');
                            console.log('   • Settlement = Withdraw to wallet (on-chain)\n');

                            clearTimeout(timeout);
                            ws.close();
                            resolve();
                        } else if (messageData?.error) {
                            console.error('\n❌ Channel creation failed:', messageData.error);
                            await handleChannelError(messageData.error, account.address);
                            
                            clearTimeout(timeout);
                            ws.close();
                            reject(new Error(messageData.error));
                        }
                        break;

                    case 'bu':  // Balance update
                        const balances = messageData?.balance_updates || [];
                        if (balances.length > 0 && !channelCreated) {
                            console.log('💰 Current Ledger Balance:');
                            balances.forEach((bal: any) => {
                                const amount = parseInt(bal.amount || '0') / 1_000_000;
                                console.log(`   ${bal.asset}: ${amount.toFixed(2)} USDC\n`);
                            });
                        }
                        break;

                    case 'error':
                        console.error('\n❌ Yellow Network Error:', messageData?.error || messageData);
                        await handleChannelError(messageData?.error || 'Unknown error', account.address);
                        
                        clearTimeout(timeout);
                        ws.close();
                        reject(new Error(messageData?.error || 'Unknown error'));
                        break;

                    default:
                        if (process.env.DEBUG === 'true') {
                            console.log(`📨 Message type: ${messageType || 'unknown'}`);
                        }
                }
            } catch (error: any) {
                console.error('❌ Error processing message:', error.message);
                if (process.env.DEBUG === 'true') {
                    console.error('Stack:', error.stack);
                }
            }
        });

        ws.on('error', (error) => {
            clearTimeout(timeout);
            console.error('\n❌ WebSocket error:', error.message);
            reject(error);
        });

        ws.on('close', () => {
            if (!authenticated && !channelCreated) {
                clearTimeout(timeout);
                reject(new Error('Connection closed before completing operation'));
            }
        });
    });
}

/**
 * Handle authentication challenge with proper EIP-712 signing
 */
async function handleAuthChallenge(
    message: any,
    ws: WebSocket,
    walletClient: any,
    authParams: any,
    sessionSigner: any
): Promise<void> {
    const challengeData = message.res[2];
    const challenge = challengeData.challenge_message || challengeData.challenge || challengeData;

    // Create EIP-712 signer with user's EOA wallet
    // CRITICAL: These params must exactly match auth_request!
    const eip712Signer = createEIP712AuthMessageSigner(
        walletClient,
        {
            session_key: authParams.session_key,
            allowances: authParams.allowances,
            expires_at: authParams.expires_at.toString(),
            scope: authParams.scope,
        },
        {
            name: authParams.application,  // Must be 'Yellow'
        }
    );

    // Sign challenge and create verification message
    const authVerifyMsg = await createAuthVerifyMessageFromChallenge(
        eip712Signer,
        challenge
    );

    ws.send(authVerifyMsg);
    console.log('📤 Signed challenge with EIP-712 signature\n');
}

/**
 * Handle channel creation errors with helpful guidance
 */
async function handleChannelError(error: string, walletAddress: string): Promise<void> {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 TROUBLESHOOTING GUIDE\n');

    if (error.includes('insufficient') || error.includes('balance')) {
        console.log('Issue: Insufficient ytest.usd balance in your ledger\n');
        console.log('Solution 1: Get testnet tokens from the faucet');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n📥 Option A: Yellow Network Faucet (Recommended)\n');
        console.log('   Visit: https://earn-ynetwork.yellownetwork.io');
        console.log('   1. Connect your wallet');
        console.log('   2. Request ytest.usd tokens');
        console.log('   3. Wait for confirmation\n');
        
        console.log('📥 Option B: Direct API Call\n');
        console.log('   curl -X POST https://clearnet-sandbox.yellow.com/faucet/requestTokens \\');
        console.log(`        -H "Content-Type: application/json" \\`);
        console.log(`        -d '{"userAddress":"${walletAddress}"}'\n`);
        
        console.log('📥 Option C: Deposit existing tokens');
        console.log('   npm run deposit\n');
        
        console.log('Solution 2: Check your balance');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('   npm run check:balance\n');
        
    } else if (error.includes('exists') || error.includes('already')) {
        console.log('Issue: Channel already exists\n');
        console.log('Solution: Check existing channels');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('   npm run check:channels\n');
        console.log('You can use the existing channel for trading!\n');
        
    } else {
        console.log('Issue: Unexpected error\n');
        console.log('Solution: Enable debug mode');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('   DEBUG=true npm run create:channel\n');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Run the script
main().catch(error => {
    console.error('\n╔════════════════════════════════════════════════════════════════╗');
    console.error('║                    ❌ SCRIPT FAILED                            ║');
    console.error('╚════════════════════════════════════════════════════════════════╝\n');
    console.error('Error:', error.message);
    console.error('\n💡 Common issues:');
    console.error('   1. PRIVATE_KEY not set in .env');
    console.error('   2. No ytest.usd balance (get from faucet)');
    console.error('   3. Network connectivity issues');
    console.error('   4. Invalid wallet configuration\n');
    console.error('For detailed logs, run: DEBUG=true npm run create:channel\n');
    process.exit(1);
});
