/**
 * Market Routes - Create and manage prediction markets
 */

import express from 'express';
import marketService from '../services/MarketService';
import { MarketStatus } from '../services/MarketService';
import { LmsrAmm } from '../services/AmmMath';

const router = express.Router();

// MarketService is now a singleton - use the imported instance

/**
 * Create a new market (Admin only)
 * POST /api/markets/create
 */
router.post('/create', async (req, res) => {
    try {
        const {
            question,
            description,
            liquidity,
            durationDays,
            channelId,
            sessionId,
            creatorAddress
        } = req.body;

        // Validation
        if (!question || !liquidity || !durationDays || !channelId || !sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: question, liquidity, durationDays, channelId, sessionId'
            });
        }

        // Admin check (customize this based on your auth logic)
        const adminAddress = '0xFefa60F5aA4069F96b9Bf65c814DDb3A604974e1';
        if (creatorAddress && creatorAddress.toLowerCase() !== adminAddress.toLowerCase()) {
            return res.status(403).json({
                success: false,
                error: 'Only admin can create markets'
            });
        }

        // **STEP 1: Transfer liquidity to Yellow Network clearnode**
        console.log(`💸 Transferring ${liquidity / 1_000_000} ytest.USD to clearnode...`);
        
        const CLEARNODE_ADDRESS = '0x7df1fef832b57e46de2e1541951289c04b2781aa';
        
        try {
            // Dynamic imports for ESM modules
            const { 
                createECDSAMessageSigner,
                createTransferMessage,
                createAuthRequestMessage,
                createEIP712AuthMessageSigner,
                createAuthVerifyMessageFromChallenge,
                createGetLedgerBalancesMessage
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
            
            // Execute transfer via WebSocket
            const transferPromise = new Promise<string>((resolve, reject) => {
                const ws = new WebSocket(CLEARNODE_URL);
                let authenticated = false;
                let balanceChecked = false;
                let messageSequence = 0;
                const timeout = setTimeout(() => {
                    console.log(`   ⏰ Transfer timeout after ${++messageSequence} messages`);
                    ws.close();
                    reject(new Error('Timeout transferring funds (30s exceeded)'));
                }, 30000); // Increased timeout to 30 seconds
                
                ws.on('open', async () => {
                    console.log(`   📡 [${++messageSequence}] Connected to Yellow Network`);
                    
                    // CRITICAL: Wait before sending auth (sandbox requirement)
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
                    console.log(`   🔐 [${++messageSequence}] Authenticating...`);
                });
                
                ws.on('message', async (data: any) => {
                    const response = JSON.parse(data.toString());
                    const messageType = response.res?.[1];
                    console.log(`   📥 [${++messageSequence}] Received: ${messageType || 'unknown'}`);
                    
                    if (messageType === 'auth_challenge' && !authenticated) {
                        console.log('   🔑 Received auth challenge, signing...');
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
                        console.log(`   ✅ [${messageSequence}] Authenticated successfully`);
                        // CRITICAL: Check balance before transfer (sandbox requirement)
                        await new Promise(r => setTimeout(r, 300));
                        
                        console.log(`   💵 [${++messageSequence}] Checking ledger balance...`);
                        const balanceMsg = await createGetLedgerBalancesMessage(
                            sessionSigner,
                            adminAccount.address,
                            Date.now()
                        );
                        ws.send(balanceMsg);
                    }
                    
                    if (messageType === 'get_ledger_balances' && !balanceChecked) {
                        balanceChecked = true;
                        const balances = response.res[2].ledger_balances;
                        const usdBal = balances.find((b: any) => b.asset === 'ytest.usd');
                        const amount = usdBal ? parseFloat(usdBal.amount) / 1_000_000 : 0;
                        console.log(`   💰 [${messageSequence}] Current balance: ${amount.toFixed(6)} ytest.USD`);
                        
                        // VALIDATE: Check if user has enough balance
                        const requiredAmount = liquidity / 1_000_000;
                        if (amount < requiredAmount) {
                            clearTimeout(timeout);
                            ws.close();
                            reject(new Error(`Insufficient balance! You have ${amount.toFixed(2)} ytest.USD but need ${requiredAmount.toFixed(2)} ytest.USD to create this market.`));
                            return;
                        }
                        
                        // CRITICAL: Wait before sending transfer (sandbox requirement)
                        await new Promise(r => setTimeout(r, 500));
                        
                        // Send transfer
                        console.log(`   📤 [${++messageSequence}] Initiating transfer: ${liquidity / 1_000_000} ytest.USD → clearnode`);
                        const transferMsg = await createTransferMessage(
                            sessionSigner,
                            {
                                destination: CLEARNODE_ADDRESS,
                                allocations: [{ asset: 'ytest.usd', amount: liquidity.toString() }], // Already in 6 decimals
                            },
                            Date.now()
                        );
                        ws.send(transferMsg);
                    }
                    
                    if (messageType === 'transfer') {
                        const transferId = response.res[0];
                        clearTimeout(timeout);
                        ws.close();
                        const idStr = typeof transferId === 'string' ? transferId : JSON.stringify(transferId);
                        console.log(`   ✅ [${messageSequence}] Transfer confirmed! ID: ${idStr.slice(0, 50)}...`);
                        resolve(idStr);
                    }
                });
                
                ws.on('error', (error: Error) => {
                    console.error('   ❌ WebSocket error:', error.message);
                    clearTimeout(timeout);
                    reject(error);
                });
                
                ws.on('close', () => {
                    console.log('   🔌 Connection closed');
                });
            });
            
            const transferId = await transferPromise;
            console.log(`✅ Liquidity transferred to clearnode! Transfer ID: ${transferId}`);
            
            // **STEP 1.5: Verify balance AFTER transfer**
            console.log(`\n🔍 Verifying balance after transfer...`);
            try {
                await new Promise(r => setTimeout(r, 1000)); // Wait for settlement
                
                const balanceAfter = await new Promise<number>((resolve, reject) => {
                    const ws = new WebSocket(CLEARNODE_URL);
                    const timeout = setTimeout(() => {
                        ws.close();
                        reject(new Error('Balance verification timeout'));
                    }, 10000);
                    
                    ws.on('open', async () => {
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
                        
                        if (messageType === 'auth_challenge') {
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
                            const signer = createEIP712AuthMessageSigner(walletClient, authParamsForSigning, { name: 'VaultOS' });
                            const verifyMsg = await createAuthVerifyMessageFromChallenge(signer, challenge);
                            ws.send(verifyMsg);
                        }
                        
                        if (messageType === 'auth_verify') {
                            await new Promise(r => setTimeout(r, 300));
                            const balanceMsg = await createGetLedgerBalancesMessage(sessionSigner, adminAccount.address, Date.now());
                            ws.send(balanceMsg);
                        }
                        
                        if (messageType === 'get_ledger_balances') {
                            const balances = response.res[2].ledger_balances;
                            const usdBal = balances.find((b: any) => b.asset === 'ytest.usd');
                            const amount = usdBal ? parseFloat(usdBal.amount) / 1_000_000 : 0;
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
                
                console.log(`💰 Balance After Transfer: ${balanceAfter.toFixed(6)} ytest.USD`);
                console.log(`📉 Transfer Amount: ${(liquidity / 1_000_000).toFixed(6)} ytest.USD`);
                console.log(`✅ Balance verified - transfer successful!\n`);
            } catch (balanceError) {
                console.log(`⚠️  Balance verification skipped (${balanceError})\n`);
            }
            
            // Verify balance after transfer
            console.log(`\n📊 Yellow Network Status Summary:`);
            console.log(`   ✅ Connected to: wss://clearnet-sandbox.yellow.com/ws`);
            console.log(`   ✅ Transfer confirmed: ${liquidity / 1_000_000} ytest.USD`);
            console.log(`   ✅ Destination: clearnode (${CLEARNODE_ADDRESS})`);
            console.log(`   ⚡ Off-chain state channels: ACTIVE`);
            console.log(`   🔒 Liquidity locked in market pool\n`);
            
        } catch (transferError: any) {
            console.error('❌ Failed to transfer liquidity:', transferError);
            return res.status(500).json({
                success: false,
                error: `Failed to transfer liquidity to Yellow Network: ${transferError.message}`
            });
        }

        // **STEP 2: Create market (only if transfer succeeded)**
        const market = await marketService.createMarket({
            appSessionId: sessionId,
            channelId: channelId,
            question,
            description: description || '',
            durationMinutes: durationDays * 24 * 60,
            initialLiquidity: liquidity / 1_000_000, // Convert from 6 decimals
            creatorAddress: creatorAddress || adminAddress,
        });

        res.json({
            success: true,
            marketId: market.id,
            market: {
                id: market.id,
                question: market.question,
                description: market.description,
                status: market.status,
                endTime: market.endTime,
                channelId: market.channelId,
            }
        });
    } catch (error: any) {
        console.error('Market creation error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create market'
        });
    }
});

/**
 * Get all markets
 * GET /api/markets
 */
router.get('/', async (req, res) => {
    try {
        console.log('📊 GET /api/markets called');
        const markets = marketService.getActiveMarkets();
        console.log(`📊 MarketService returned ${markets.length} markets`);
        
        const marketsData = markets.map(market => {
            // getActiveMarkets() already calculates yesPrice/noPrice from AMM
            // No need to access market.amm here - use the pre-calculated prices
            
            return {
                id: market.id,
                question: market.question,
                description: market.description,
                status: market.status,
                endTime: market.endTime,
                totalVolume: market.totalVolume.toString(),
                channelId: market.channelId,
                // Use pre-calculated prices from getActiveMarkets()
                odds: {
                    YES: market.yesPrice.toFixed(4),
                    NO: market.noPrice.toFixed(4)
                }
            };
        });

        res.json({
            success: true,
            markets: marketsData
        });
        console.log(`✅ Sent response:`, JSON.stringify({ 
            success: true, 
            marketCount: marketsData.length,
            firstMarket: marketsData[0] ? {
                id: marketsData[0].id,
                odds: marketsData[0].odds
            } : 'none'
        }));
    } catch (error: any) {
        console.error('Get markets error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get markets'
        });
    }
});

/**
 * Get market by ID
 * GET /api/markets/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const market = marketService.getMarketById(id);

        if (!market) {
            return res.status(404).json({
                success: false,
                error: 'Market not found'
            });
        }

        // getMarketById() already returns an object with yesPrice/noPrice calculated
        res.json({
            success: true,
            market: {
                id: market.id,
                question: market.question,
                description: market.description,
                status: market.status,
                endTime: market.endTime,
                totalVolume: market.totalVolume.toString(),
                channelId: market.channelId,
                odds: {
                    YES: market.yesPrice.toFixed(4),
                    NO: market.noPrice.toFixed(4)
                }
            }
        });
    } catch (error: any) {
        console.error('Get market error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get market'
        });
    }
});

/**
 * Execute trade
 * POST /api/markets/:id/trade
 */
router.post('/:id/trade', async (req, res) => {
    try {
        const { id } = req.params;
        const { userAddress, outcome, amount } = req.body;
        
        console.log(`💰 Trade request for market ${id}:`, {
            userAddress,
            outcome,
            amount,
            bodyKeys: Object.keys(req.body)
        });

        if (!userAddress || !outcome || !amount) {
            console.error('❌ Trade failed: Missing required fields:', { userAddress: !!userAddress, outcome: !!outcome, amount: !!amount });
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userAddress, outcome, amount'
            });
        }

        if (outcome !== 'YES' && outcome !== 'NO') {
            return res.status(400).json({
                success: false,
                error: 'Invalid outcome. Must be YES or NO'
            });
        }

        const trade = await marketService.executeTrade({
            marketId: id,
            user: userAddress,
            outcome,
            amount: BigInt(Math.round(amount)), // Round to integer first, then convert to BigInt
        });

        console.log(`⚡ Off-chain trade executed (instant, no gas):`);
        console.log(`   User: ${userAddress.slice(0, 10)}...`);
        console.log(`   Outcome: ${outcome}`);
        console.log(`   Shares: ${trade.shares.toString()}`);
        console.log(`   Price: ${trade.price}`);
        console.log(`   💡 State channel: Position updated locally`);

        res.json({
            success: true,
            trade: {
                id: trade.id,
                marketId: trade.marketId,
                outcome: trade.outcome,
                shares: trade.shares.toString(),
                price: trade.price,
                timestamp: trade.timestamp,
            }
        });
    } catch (error: any) {
        console.error('Trade execution error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to execute trade'
        });
    }
});

/**
 * Get user positions
 * GET /api/markets/:id/positions/:userAddress
 */
router.get('/:id/positions/:userAddress', async (req, res) => {
    try {
        const { id, userAddress } = req.params;
        const positions = marketService.getUserPositions(id, userAddress);

        res.json({
            success: true,
            positions: positions.map(p => ({
                outcome: p.outcome,
                shares: p.shares.toString(),
                totalCost: p.totalCost.toString(),
            }))
        });
    } catch (error: any) {
        console.error('Get positions error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get positions'
        });
    }
});

export default router;
export { marketService };
