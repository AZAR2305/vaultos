/**
 * Yellow Network API Routes
 * Handles channel creation, sessions, and balance queries
 */

import express from 'express';
import {
    createECDSAMessageSigner,
    createEIP712AuthMessageSigner,
    createAuthRequestMessage,
    createAuthVerifyMessageFromChallenge,
    createCreateChannelMessage,
} from '@erc7824/nitrolite';
import { createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import WebSocket from 'ws';
import { ethers } from 'ethers';

const router = express.Router();

const CLEARNODE_URL = 'wss://clearnet-sandbox.yellow.com/ws';
const YTEST_USD_ADDRESS = '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb';
const CHAIN_ID = 84532;

/**
 * Create sandbox channel
 * POST /api/yellow/create-channel
 */
router.post('/create-channel', async (req, res) => {
    const { walletAddress } = req.body;

    if (!walletAddress) {
        return res.status(400).json({ error: 'walletAddress required' });
    }

    if (!process.env.PRIVATE_KEY) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
        const walletClient = createWalletClient({
            account,
            chain: baseSepolia,
            transport: http()
        });

        // Generate session key
        const sessionWallet = ethers.Wallet.createRandom();
        const sessionPrivateKey = sessionWallet.privateKey as `0x${string}`;
        const sessionSigner = createECDSAMessageSigner(sessionPrivateKey);

        // Auth parameters
        const authParams = {
            address: account.address,
            session_key: sessionWallet.address as `0x${string}`,
            application: 'Yellow',
            expires_at: BigInt(Math.floor(Date.now() / 1000) + 7200),
            scope: 'console',
            allowances: [{
                asset: 'ytest.usd',
                amount: '1000000000'
            }],
        };

        const channelId = await new Promise<string>((resolve, reject) => {
            const ws = new WebSocket(CLEARNODE_URL);
            let received = false;

            const timeout = setTimeout(() => {
                if (!received) {
                    ws.close();
                    reject(new Error('Timeout'));
                }
            }, 30000);

            ws.on('open', async () => {
                const authMsg = await createAuthRequestMessage(authParams);
                ws.send(authMsg);
            });

            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());

                    if (message.res && message.res[1] === 'auth_challenge') {
                        const challengeData = message.res[2];
                        const challenge = challengeData.challenge_message || challengeData.challenge || challengeData;

                        const eip712Signer = createEIP712AuthMessageSigner(
                            walletClient,
                            {
                                session_key: authParams.session_key,
                                allowances: authParams.allowances,
                                expires_at: authParams.expires_at,
                                scope: authParams.scope,
                            },
                            { name: authParams.application }
                        );

                        const authVerifyMsg = await createAuthVerifyMessageFromChallenge(
                            eip712Signer,
                            challenge
                        );

                        ws.send(authVerifyMsg);
                    } else if (message.res && message.res[1] === 'auth_verify') {
                        const channelMsg = await createCreateChannelMessage(
                            sessionSigner,
                            {
                                chain_id: CHAIN_ID,
                                token: YTEST_USD_ADDRESS as `0x${string}`,
                            }
                        );

                        ws.send(channelMsg);
                    } else if (message.res && message.res[1] === 'create_channel') {
                        const channelData = message.res[2];

                        if (channelData && channelData.channel_id) {
                            received = true;
                            clearTimeout(timeout);
                            ws.close();
                            resolve(channelData.channel_id);
                        } else if (channelData && channelData.error) {
                            clearTimeout(timeout);
                            ws.close();
                            reject(new Error(channelData.error));
                        }
                    } else if (message.res && message.res[1] === 'error') {
                        const errorData = message.res[2];
                        clearTimeout(timeout);
                        ws.close();
                        reject(new Error(errorData.error || 'Authentication failed'));
                    }
                } catch (error) {
                    clearTimeout(timeout);
                    ws.close();
                    reject(error);
                }
            });

            ws.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });

        res.json({
            success: true,
            channelId,
            message: 'Channel created successfully'
        });
    } catch (error: any) {
        console.error('Channel creation error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create channel'
        });
    }
});

/**
 * Create session
 * POST /api/yellow/create-session
 */
router.post('/create-session', async (req, res) => {
    const { walletAddress, channelId } = req.body;

    if (!walletAddress || !channelId) {
        return res.status(400).json({ error: 'walletAddress and channelId required' });
    }

    try {
        // Generate session ID (in production, store this in database)
        const sessionWallet = ethers.Wallet.createRandom();
        const sessionId = sessionWallet.address;

        res.json({
            success: true,
            sessionId,
            channelId,
            message: 'Session created successfully'
        });
    } catch (error: any) {
        console.error('Session creation error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create session'
        });
    }
});

/**
 * Get balance - Query real Yellow Network ledger balance
 * GET /api/yellow/balance/:address
 */
router.get('/balance/:address', async (req, res) => {
    const { address } = req.params;

    if (!address) {
        return res.status(400).json({ error: 'address required' });
    }

    try {
        console.log(`🔍 Querying REAL Yellow Network balance for ${address}...`);
        
        // Dynamic imports for ESM modules
        const { 
            createECDSAMessageSigner,
            createGetLedgerBalancesMessage,
            createAuthRequestMessage,
            createEIP712AuthMessageSigner,
            createAuthVerifyMessageFromChallenge
        } = await import('@erc7824/nitrolite');
        const { privateKeyToAccount, generatePrivateKey } = await import('viem/accounts');
        const { createWalletClient, http } = await import('viem');
        const { baseSepolia } = await import('viem/chains');
        const WebSocket = (await import('ws')).default;
        
        const CLEARNODE_URL = 'wss://clearnet-sandbox.yellow.com/ws';
        
        // Setup accounts
        const adminAccount = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
        const sessionPrivateKey = generatePrivateKey();
        const sessionAccount = privateKeyToAccount(sessionPrivateKey);
        const sessionSigner = createECDSAMessageSigner(sessionPrivateKey);
        
        // Create promise to handle WebSocket communication
        const balancePromise = new Promise<number>((resolve, reject) => {
            const ws = new WebSocket(CLEARNODE_URL);
            let authenticated = false;
            let balanceChecked = false;
            const timeout = setTimeout(() => {
                if (!balanceChecked) {
                    console.log('   ⏰ Balance query timeout - Yellow Network may be slow');
                }
                ws.close();
                reject(new Error('Timeout waiting for balance'));
            }, 15000); // Increased to 15s
            
            ws.on('open', async () => {
                // CRITICAL: Wait before sending (sandbox requirement)
                await new Promise(r => setTimeout(r, 300));
                
                const authParams = {
                    address: adminAccount.address,
                    application: 'VaultOS',
                    session_key: sessionAccount.address,
                    allowances: [{ asset: 'ytest.usd', amount: '1000000000' }],
                    expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600),
                    scope: 'transfer',
                };
                
                const authRequestMsg = await createAuthRequestMessage(authParams);
                ws.send(authRequestMsg);
            });
            
            ws.on('message', async (data: any) => {
                const response = JSON.parse(data.toString());
                const messageType = response.res?.[1];
                
                if (messageType === 'auth_challenge' && !authenticated) {
                    const challenge = response.res[2].challenge_message;
                    const walletClient = createWalletClient({
                        account: adminAccount,
                        chain: baseSepolia,
                        transport: http('https://sepolia.base.org'),
                    });
                    
                    const authParamsForSigning = {
                        session_key: sessionAccount.address,
                        allowances: [{ asset: 'ytest.usd', amount: '1000000000' }],
                        expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600),
                        scope: 'transfer',
                    };
                    
                    const signer = createEIP712AuthMessageSigner(
                        walletClient,
                        authParamsForSigning,
                        { name: 'VaultOS' }
                    );
                    
                    const verifyMsg = await createAuthVerifyMessageFromChallenge(signer, challenge);
                    ws.send(verifyMsg);
                }
                
                if (messageType === 'auth_verify' && !authenticated) {
                    authenticated = true;
                    // CRITICAL: Wait before balance query
                    await new Promise(r => setTimeout(r, 300));
                    // Request balance
                    const msg = await createGetLedgerBalancesMessage(
                        sessionSigner,
                        adminAccount.address,
                        Date.now()
                    );
                    ws.send(msg);
                }
                
                if (messageType === 'get_ledger_balances') {
                    const balances = response.res[2].ledger_balances;
                    const usdBal = balances.find((b: any) => b.asset === 'ytest.usd');
                    const amount = usdBal ? parseFloat(usdBal.amount) / 1000000 : 0;
                    clearTimeout(timeout);
                    ws.close();
                    resolve(amount);
                }
            });
            
            ws.on('error', (error: Error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
        
        const totalBalance = await balancePromise;
        
        // Subtract locked liquidity (from created markets)
        const marketService = (await import('../services/MarketService')).default;
        const lockedLiquidity = marketService.getLockedLiquidity(address);
        const availableBalance = Math.max(0, totalBalance - lockedLiquidity);
        
        const balance = {
            total: totalBalance,
            available: availableBalance,
            reserved: lockedLiquidity,
            pending: 0
        };

        console.log(`✅ Real balance: ${balance.total} ytest.USD`);
        console.log(`   Available: ${balance.available} | Locked in markets: ${balance.reserved}`);

        res.json({
            success: true,
            ...balance,
            asset: 'ytest.usd',
            address: address
        });
    } catch (error: any) {
        res.json({
            success: true,
            total: 0,
            available: 0,
            reserved: 0,
            pending: 0,
            asset: 'ytest.usd',
            address: address,
            error: 'Could not query Yellow Network: ' + error.message
        });
    }
});

/**
 * Request testnet tokens from Yellow Network faucet
 * POST /api/yellow/request-faucet
 */
router.post('/request-faucet', async (req, res) => {
    const { address } = req.body;

    if (!address) {
        return res.status(400).json({ error: 'address required' });
    }

    try {
        console.log(`💰 Requesting testnet tokens for ${address}...`);

        const response = await fetch('https://clearnet-sandbox.yellow.com/faucet/requestTokens', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                userAddress: address,
            }),
        });

        const contentType = response.headers.get('content-type');
        const isJson = contentType && contentType.includes('application/json');

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Faucet returned ${response.status}:`, errorText);
            throw new Error(`Faucet API unavailable (status ${response.status})`);
        }

        // Check if response is actually JSON
        if (!isJson) {
            const htmlResponse = await response.text();
            console.error('❌ Faucet returned HTML instead of JSON');
            console.log('Response preview:', htmlResponse.substring(0, 200));
            throw new Error('Faucet API format changed - use manual method');
        }

        const data = await response.json();
        console.log('✅ Faucet request successful:', data);

        res.json({
            success: true,
            message: 'Tokens requested successfully! Wait 1-2 minutes for delivery.',
            data,
            instructions: {
                checkBalance: 'Refresh your wallet to see the tokens',
                amount: 'You should receive testnet ytest.USD tokens',
                time: 'Usually arrives within 1-2 minutes'
            }
        });
    } catch (error: any) {
        console.error('❌ Faucet request error:', error.message);
        
        // Return helpful error with manual alternatives
        res.status(200).json({
            success: false,
            error: 'Automatic faucet unavailable',
            message: 'Please use the manual faucet instead',
            alternatives: [
                {
                    method: 'Web Interface',
                    url: 'https://clearnet-sandbox.yellow.com',
                    steps: [
                        `1. Visit: https://clearnet-sandbox.yellow.com`,
                        `2. Paste your wallet: ${address}`,
                        '3. Request ytest.USD tokens',
                        'Select token: ytest.usd',
                        'Click "Request Tokens"'
                    ]
                },
                {
                    method: 'Base Sepolia ETH Faucet',
                    url: 'https://www.alchemy.com/faucets/base-sepolia',
                    note: 'Get ETH for gas fees'
                }
            ]
        });
    }
});

export default router;
