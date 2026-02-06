/**
 * Create Yellow Network State Channel for Prediction Market
 * 
 * This script:
 * 1. Authenticates with Yellow Network
 * 2. Creates session signer (ephemeral key)
 * 3. Checks for existing open channels
 * 4. Creates new channel if needed
 * 5. Submits channel to blockchain
 */

import {
    createAuthRequestMessage,
    createAuthVerifyMessageFromChallenge,
    createEIP712AuthMessageSigner,
    createECDSAMessageSigner,
    createCreateChannelMessage,
    createGetLedgerBalancesMessage,
    type MessageSigner,
} from '@erc7824/nitrolite';
import { createPublicClient, createWalletClient, http, type WalletClient, type PublicClient } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import WebSocket from 'ws';
import { ethers } from 'ethers';
import 'dotenv/config';

const CLEARNODE_URL = 'wss://clearnet-sandbox.yellow.com/ws';
const CLEARNODE_ADDRESS = '0x019B65A265EB3363822f2752141b3dF16131b262' as `0x${string}`;
const YTEST_USD_TOKEN = '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb' as `0x${string}`; // Correct sandbox token
const ADJUDICATOR_ADDRESS = '0xDfC4D57d100a764A572471829A2E1F76EBbD1E04' as `0x${string}`;

interface SessionData {
    ws: WebSocket;
    sessionSigner: MessageSigner;
    mainAccount: ReturnType<typeof privateKeyToAccount>;
    sessionWallet: ethers.Wallet;
    walletClient: WalletClient;
    publicClient: PublicClient;
    cachedChannels?: any[];
}

async function main() {
    console.log('\n🎯 Yellow Network State Channel Creation\n');
    console.log('='.repeat(70));
    console.log('📍 Prediction Market Channel Setup\n');
    console.log('This will:');
    console.log('  1. Authenticate with Yellow Network');
    console.log('  2. Create ephemeral session key');
    console.log('  3. Check for existing open channels');
    console.log('  4. Create new channel if needed');
    console.log('  5. Submit to blockchain\n');
    console.log('='.repeat(70) + '\n');

    if (!process.env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY not found in environment');
    }

    // STAGE 1: Setup wallet and session key
    const mainAccount = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
    console.log(`📍 Main Wallet: ${mainAccount.address}\n`);

    const walletClient = createWalletClient({
        account: mainAccount,
        chain: baseSepolia,
        transport: http()
    });

    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http()
    });

    // Generate ephemeral session key
    const sessionWallet = ethers.Wallet.createRandom();
    console.log(`🔑 Session Key (Ephemeral): ${sessionWallet.address}`);
    console.log('   (Used for off-chain message signing)\n');

    // Create session signer
    const sessionSigner = createECDSAMessageSigner(sessionWallet.privateKey as `0x${string}`);

    // Auth parameters
    const authParams = {
        address: mainAccount.address,
        session_key: sessionWallet.address,
        application: 'Yellow',
        expires_at: BigInt(Math.floor(Date.now() / 1000) + 7200), // 2 hours
        scope: 'console',
        allowances: [{
            asset: 'ytest.usd',
            amount: '100000000'  // 100 USDC allowance
        }],
    };

    console.log('📋 Session Configuration:');
    console.log(`   Application: ${authParams.application}`);
    console.log(`   Allowance: 100 USDC`);
    console.log(`   Expires: ${new Date(Number(authParams.expires_at) * 1000).toLocaleString()}\n`);

    // STAGE 2: Connect and Authenticate
    const ws = new WebSocket(CLEARNODE_URL);
    let authenticated = false;
    let cachedChannels: any[] = [];

    console.log('🌐 Connecting to Yellow Network Sandbox...\n');

    const sessionData: SessionData = await new Promise<SessionData>((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Authentication timeout'));
        }, 60000);

        ws.on('open', async () => {
            console.log('✅ WebSocket Connected\n');
            console.log('🔐 Stage 1: Authentication\n');
            
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
                
                console.log(`📨 Received: ${message.res?.[1] || 'unknown'}`);
                
                // Debug: log full message if DEBUG env is set
                if (process.env.DEBUG) {
                    console.log('   Full message:', JSON.stringify(message, null, 2));
                }
                
                // Handle auth challenge
                if (message.res && message.res[1] === 'auth_challenge') {
                    const challengeData = message.res[2];
                    const challenge = challengeData.challenge_message || challengeData.challenge || challengeData;
                    
                    console.log('   Received auth challenge, signing...\n');
                    
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
                }
                // Handle auth success
                else if (message.res && message.res[1] === 'auth_verify') {
                    const verifyData = message.res[2];
                    if (verifyData && verifyData.address) {
                        console.log('✅ Authentication successful!\n');
                        authenticated = true;
                        
                        // Now we're authenticated, resolve with session data
                        clearTimeout(timeout);
                        resolve({
                            ws,
                            sessionSigner,
                            mainAccount,
                            sessionWallet,
                            walletClient,
                            publicClient,
                        });
                    }
                }
                // Cache channels if received during auth
                else if (message.res && message.res[1] === 'channels') {
                    const channelsData = message.res[2];
                    cachedChannels = channelsData.channels || [];
                    console.log(`   Cached ${cachedChannels.length} channels from auth\n`);
                }
                // Handle errors
                else if (message.res && message.res[1] === 'error') {
                    const errorData = message.res[2];
                    console.error('❌ Error response:', JSON.stringify(errorData, null, 2));
                    clearTimeout(timeout);
                    reject(new Error(errorData.error || JSON.stringify(errorData)));
                }
            } catch (error: any) {
                console.error('Error parsing message:', error.message);
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

    // Add cached channels to session data
    sessionData.cachedChannels = cachedChannels;

    console.log('🔗 Stage 2: Channel Creation\n');

    // STAGE 3: Check for existing channels or create new one
    const channelId = await createOrGetChannel(sessionData);

    console.log('\n🎉 SUCCESS!\n');
    console.log('═'.repeat(70));
    console.log(`✅ Channel Ready: ${channelId}`);
    console.log('═'.repeat(70) + '\n');
    console.log('Next Steps:');
    console.log('1. Use this channel for prediction market trades');
    console.log('2. All trades are instant & gas-free');
    console.log('3. Settle on-chain when market resolves\n');

    ws.close();
}

async function createOrGetChannel(session: SessionData): Promise<string> {
    const { ws, sessionSigner, mainAccount, publicClient } = session;

    console.log('📊 Checking WebSocket state...');
    console.log(`   State: ${ws.readyState} (OPEN=1)\n`);

    if (ws.readyState !== 1) {
        throw new Error(`WebSocket not open (State: ${ws.readyState})`);
    }

    let channels: any[] = [];

    if (session.cachedChannels !== undefined) {
        console.log(`✅ Using channels list from authentication phase\n`);
        channels = session.cachedChannels;
    } else {
        console.log('📡 No cached channels, querying...\n');

        // Setup listener BEFORE sending request (prevents race condition)
        const channelsPromise = new Promise<any>((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.error('❌ Channels query timed out after 60s');
                reject(new Error('Channels query timeout'));
            }, 60000); // 60s for testnet latency

            const handler = (data: any) => {
                try {
                    const response = JSON.parse(data.toString());
                    console.log(`📨 WS Message: ${response.res?.[1]}`);
                    
                    if (response.res && response.res[1] === 'channels') {
                        clearTimeout(timeout);
                        ws.off('message', handler);
                        resolve(response.res[2]);
                    }
                } catch (e) {
                    console.error('Parse error:', e);
                }
            };
            ws.on('message', handler);
        });

        // Query ledger balances (triggers channels list response)
        console.log('📤 Sending ledger balance query...\n');
        const ledgerMsg = await createGetLedgerBalancesMessage(
            sessionSigner,
            mainAccount.address,
            Date.now()
        );
        ws.send(ledgerMsg);

        const channelsData = await channelsPromise;
        channels = channelsData.channels || [];
    }

    console.log(`📋 Found ${channels.length} total channels\n`);

    // Check for existing open channel
    const openChannel = channels.find((c: any) => c.status === 'open');

    if (openChannel) {
        console.log('✅ Using existing open channel:');
        console.log(`   Channel ID: ${openChannel.channel_id}`);
        console.log(`   Status: ${openChannel.status}\n`);
        return openChannel.channel_id;
    }

    // No open channel, create new one
    console.log('🆕 No open channel found, creating new one...\n');

    // Setup listener BEFORE sending request
    const channelPromise = new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
            console.error('❌ Channel creation timed out after 60s');
            reject(new Error('Channel creation timeout'));
        }, 60000);

        const handler = (data: any) => {
            try {
                const response = JSON.parse(data.toString());
                console.log(`📨 WS Message: ${response.res?.[1]}`);

                if (response.res && response.res[1] === 'create_channel') {
                    clearTimeout(timeout);
                    ws.off('message', handler);
                    resolve(response.res[2]);
                } else if (response.res && response.res[1] === 'error') {
                    clearTimeout(timeout);
                    ws.off('message', handler);
                    const errorData = response.res[2];
                    reject(new Error(errorData.error || 'Channel creation failed'));
                }
            } catch (e) {
                console.error('Parse error:', e);
            }
        };
        ws.on('message', handler);
    });

    // Send create channel request
    console.log('📤 Sending create_channel request...');
    console.log(`   Chain: Sepolia (11155111)`);
    console.log(`   Token: ytest.usd\n`);

    const createChannelMsg = await createCreateChannelMessage(
        sessionSigner,
        {
            chain_id: 11155111, // Sepolia
            token: YTEST_USD_TOKEN,
        }
    );

    ws.send(createChannelMsg);

    // Wait for channel creation response
    const channelData = await channelPromise;
    const channelId = channelData.channel_id;

    console.log('✅ Channel created off-chain:');
    console.log(`   Channel ID: ${channelId}\n`);

    // Transform state data for reference
    const unsignedInitialState = {
        intent: channelData.state.intent,
        version: BigInt(channelData.state.version),
        data: channelData.state.state_data,
        allocations: channelData.state.allocations.map((a: any) => ({
            destination: a.destination,
            token: a.token,
            amount: BigInt(a.amount),
        })),
    };

    console.log('💡 Channel Status:');
    console.log('   ✅ Off-chain channel ready for trading');
    console.log('   💰 Can accept deposits and process instant trades');
    console.log('   🔗 Blockchain registration: Coming soon (requires NitroliteClient.depositAndCreateChannel)\n');

    console.log('📋 Channel Details for Production:');
    console.log(JSON.stringify({
        channel_id: channelId,
        participants: channelData.channel.participants,
        adjudicator: channelData.channel.adjudicator,
        challenge: channelData.channel.challenge,
        nonce: channelData.channel.nonce,
        state: {
            intent: unsignedInitialState.intent,
            version: unsignedInitialState.version.toString(),
            data: unsignedInitialState.data,
            allocations: unsignedInitialState.allocations.map((a: any) => ({
                destination: a.destination,
                token: a.token,
                amount: a.amount.toString(),
            })),
        },
        server_signature: channelData.server_signature,
    }, null, 2));
    console.log();

    // Note: Blockchain submission would use:
    // await nitroliteClient.depositAndCreateChannel(tokenAddress, amount, {chain_id, token})
    // See enhanced-yellow-client.ts line 423 for reference

    return channelId;
}

main().catch(error => {
    console.error('\n❌ Error:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
});
