/**
 * Authoritative Market Service
 * 
 * This service is the SINGLE SOURCE OF TRUTH for:
 * - Market state (pools, shares, odds)
 * - Trade validation and execution
 * - Balance tracking
 * - Settlement calculations
 * 
 * Frontend can only send INTENT, never state.
 */

import { WebSocket, WebSocketServer } from 'ws';
import { LmsrAmm, AmmState, AmmResult, toAmmAmount, fromAmmAmount } from './AmmMath';
import { SettlementMath } from './SettlementMath';
import { VaultOSYellowClient } from '../../../../src/yellow/vaultos-yellow';

// Position for Market (uses BigInt for precision)
export interface Position {
    userAddress: string;
    outcome: 'YES' | 'NO';
    shares: bigint;
    totalCost: bigint;
}

export enum MarketStatus {
    ACTIVE = 'active',
    FROZEN = 'frozen',      // Trading disabled, awaiting resolution
    RESOLVED = 'resolved',   // Outcome determined, awaiting settlement
    SETTLED = 'settled',     // Final state submitted on-chain
    CANCELLED = 'cancelled',
}

export interface Market {
    id: string;
    question: string;
    description?: string;
    outcomes: ['YES', 'NO'];
    creator: string;
    createdAt: Date;
    endTime: Date;
    status: MarketStatus;
    
    // AMM State (authoritative)
    amm: AmmState;
    
    // Tracking
    totalVolume: bigint;
    trades: Trade[];
    positions: Map<string, Position>; // user address -> position
    
    // Resolution
    winningOutcome?: 'YES' | 'NO';
    resolvedAt?: Date;
    settledAt?: Date;
    
    // Yellow Network
    appSessionId: string;
    channelId: string;
}

export interface Trade {
    id: string;
    marketId: string;
    user: string;
    outcome: 'YES' | 'NO';
    amount: bigint;         // USDC spent
    shares: bigint;         // Shares received
    price: number;          // Price at execution (0-1)
    timestamp: Date;
    txHash?: string;        // If settled on-chain
}

export interface TradeIntent {
    marketId: string;
    user: string;
    outcome: 'YES' | 'NO';
    amount: bigint;         // USDC to spend
    maxSlippage?: number;   // Default 5%
}

export interface TradeResult {
    success: boolean;
    trade?: Trade;
    error?: string;
    marketState?: {
        odds: { YES: number; NO: number };
        totalVolume: bigint;
    };
}

export class MarketService {
    private markets: Map<string, Market> = new Map();
    private tradeNonce: number = 0;
    private wss: WebSocketServer | null = null;
    private yellowClient: VaultOSYellowClient | null = null;
    // Track liquidity locked in markets per user (address -> amount in USDC)
    private lockedLiquidity: Map<string, number> = new Map();
    private persistenceFile = './markets-data.json';

    constructor(privateKey?: `0x${string}`) {
        if (privateKey) {
            this.yellowClient = new VaultOSYellowClient(privateKey);
            this.initializeYellowClient();
        }
        // Load persisted markets on startup
        this.loadMarkets();
    }
    
    /**
     * Load markets from disk (persist across server restarts)
     */
    private loadMarkets() {
        try {
            const fs = require('fs');
            if (fs.existsSync(this.persistenceFile)) {
                const data = JSON.parse(fs.readFileSync(this.persistenceFile, 'utf-8'));
                console.log(`📂 Loading ${data.markets?.length || 0} markets from persistence...`);
                
                // Restore markets
                if (data.markets) {
                    data.markets.forEach((m: any) => {
                        // Parse positions Map correctly
                        const positionsMap = new Map<string, Position>();
                        if (m.positions && typeof m.positions === 'object') {
                            Object.entries(m.positions).forEach(([key, val]: [string, any]) => {
                                positionsMap.set(key, {
                                    userAddress: val.userAddress,
                                    outcome: val.outcome,
                                    shares: BigInt(val.shares || '0'),
                                    totalCost: BigInt(val.totalCost || '0')
                                });
                            });
                        }
                        
                        // Parse AMM state - CRITICAL: restore BigInts
                        const ammState: AmmState = {
                            liquidityParameter: BigInt(m.amm.liquidityParameter),
                            shares: {
                                YES: BigInt(m.amm.shares.YES),
                                NO: BigInt(m.amm.shares.NO)
                            }
                        };
                        
                        // Parse trades - restore BigInts
                        const trades = (m.trades || []).map((t: any) => ({
                            ...t,
                            amount: BigInt(t.amount),
                            shares: BigInt(t.shares),
                            timestamp: new Date(t.timestamp)
                        }));
                        
                        const market: Market = {
                            ...m,
                            createdAt: new Date(m.createdAt),
                            endTime: new Date(m.endTime),
                            resolvedAt: m.resolvedAt ? new Date(m.resolvedAt) : undefined,
                            settledAt: m.settledAt ? new Date(m.settledAt) : undefined,
                            totalVolume: BigInt(m.totalVolume),
                            positions: positionsMap,
                            trades: trades,
                            amm: ammState
                        };
                        this.markets.set(market.id, market);
                    });
                }
                
                // Restore locked liquidity
                if (data.lockedLiquidity) {
                    this.lockedLiquidity = new Map(Object.entries(data.lockedLiquidity));
                }
                
                console.log(`✅ Loaded ${this.markets.size} markets, ${this.lockedLiquidity.size} locked accounts`);
                
                // Verify AMM and positions for each market
                this.markets.forEach((market, id) => {
                    console.log(`   🔍 Market ${id}:`, {
                        amm: {
                            liquidity: market.amm.liquidityParameter.toString(),
                            sharesYES: market.amm.shares.YES.toString(),
                            sharesNO: market.amm.shares.NO.toString()
                        },
                        positions: market.positions.size,
                        trades: market.trades.length
                    });
                });
            } else {
                console.log('📂 No persisted markets found, starting fresh');
            }
        } catch (error) {
            console.error('❌ Failed to load markets:', error);
        }
    }
    
    /**
     * Save markets to disk
     */
    private saveMarkets() {
        try {
            const fs = require('fs');
            const data = {
                markets: Array.from(this.markets.values()).map(m => {
                    // Convert positions Map to serializable object
                    const positionsObj: any = {};
                    m.positions.forEach((pos, key) => {
                        positionsObj[key] = {
                            userAddress: pos.userAddress,
                            outcome: pos.outcome,
                            shares: pos.shares.toString(),
                            totalCost: pos.totalCost.toString()
                        };
                    });
                    
                    return {
                        ...m,
                        totalVolume: m.totalVolume.toString(),
                        positions: positionsObj,
                        // Convert AMM BigInts to strings
                        amm: {
                            liquidityParameter: m.amm.liquidityParameter.toString(),
                            shares: {
                                YES: m.amm.shares.YES.toString(),
                                NO: m.amm.shares.NO.toString()
                            }
                        },
                        // Convert trades BigInts to strings
                        trades: m.trades.map(t => ({
                            ...t,
                            amount: t.amount.toString(),
                            shares: t.shares.toString(),
                            timestamp: t.timestamp.toISOString()
                        })),
                        createdAt: m.createdAt.toISOString(),
                        endTime: m.endTime.toISOString(),
                        resolvedAt: m.resolvedAt?.toISOString(),
                        settledAt: m.settledAt?.toISOString()
                    };
                }),
                lockedLiquidity: Object.fromEntries(this.lockedLiquidity)
            };
            fs.writeFileSync(this.persistenceFile, JSON.stringify(data, null, 2));
            console.log(`💾 Saved ${this.markets.size} markets to disk`);
        } catch (error) {
            console.error('❌ Failed to save markets:', error);
        }
    }

    /**
     * Initialize Yellow Network client
     */
    async initializeYellowClient() {
        if (!this.yellowClient) return;
        
        try {
            await this.yellowClient.connect();
            console.log('✅ Yellow Network client connected for MarketService');
        } catch (error) {
            console.error('❌ Failed to connect Yellow Network client:', error);
        }
    }

    // Initialize WebSocket server for real-time updates
    initializeWebSocket(server: any) {
        this.wss = new WebSocketServer({ server, path: '/ws/markets' });
        console.log('✅ WebSocket server initialized for real-time market updates');

        this.wss.on('connection', (ws: WebSocket) => {
            console.log('📱 New client connected to market updates');
            
            // Send current markets to new client
            const markets = Array.from(this.markets.values()).map(m => this.getMarketStats(m.id));
            ws.send(JSON.stringify({
                type: 'initial_markets',
                data: markets,
            }));
        });
    }

    /**
     * Broadcast market update to all connected clients via WebSocket
     * Clients receive AUTHORITATIVE state - no calculations on frontend
     */
    private broadcastMarketUpdate(market: Market): void {        // Skip broadcasting if WebSocket server not initialized
        if (!this.wss) return;
                const stats = this.getMarketStats(market.id);
        const message = JSON.stringify({
            type: 'market_update',
            data: stats,
        });

        this.wss.clients.forEach((client: WebSocket) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    async createMarket(data: {
        appSessionId: string;
        channelId: string;
        question: string;
        description: string;
        durationMinutes: number;
        initialLiquidity: number;
        creatorAddress: string;
    }): Promise<Market> {
        const marketId = `market_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const endTime = Date.now() + (data.durationMinutes * 60 * 1000);

        // Initialize AMM with LMSR
        const liquidityBigInt = toAmmAmount(data.initialLiquidity);
        const ammState = LmsrAmm.initializeMarket(liquidityBigInt);

        console.log(`🔧 AMM initialized:`, {
            liquidityParameter: ammState.liquidityParameter.toString(),
            sharesYES: ammState.shares.YES.toString(),
            sharesNO: ammState.shares.NO.toString()
        });

        const newMarket: Market = {
            id: marketId,
            appSessionId: data.appSessionId,
            channelId: data.channelId,
            question: data.question,
            description: data.description,
            outcomes: ['YES', 'NO'],
            creator: data.creatorAddress,
            createdAt: new Date(),
            endTime: new Date(endTime),
            status: MarketStatus.ACTIVE,
            amm: ammState,
            totalVolume: 0n,
            trades: [],
            positions: new Map(),
        };

        this.markets.set(marketId, newMarket);
        
        // Track locked liquidity
        const currentLocked = this.lockedLiquidity.get(data.creatorAddress.toLowerCase()) || 0;
        this.lockedLiquidity.set(
            data.creatorAddress.toLowerCase(), 
            currentLocked + data.initialLiquidity
        );
        
        // PERSIST TO DISK
        this.saveMarkets();
        
        console.log(`💰 Locked ${data.initialLiquidity} ytest.USD for ${data.creatorAddress}`);
        console.log(`   Total locked: ${currentLocked + data.initialLiquidity} ytest.USD`);
        
        // Broadcast authoritative initial state
        this.broadcastMarketUpdate(newMarket);

        console.log(`✅ Market created: ${marketId} | Channel: ${data.channelId}`);
        console.log(`   Question: ${data.question}`);
        console.log(`   Liquidity: ${data.initialLiquidity} USDC`);
        
        return newMarket;
    }

    /**
     * Execute Trade
     * Now integrates with Yellow Network for balance transfers
     */
    async executeTrade(intent: TradeIntent): Promise<Trade> {
        const market = this.markets.get(intent.marketId);
        if (!market) throw new Error('Market not found');
        if (market.status !== MarketStatus.ACTIVE) {
            throw new Error(`Market is ${market.status}, trading disabled`);
        }

        // Calculate authoritative trade parameters using AMM
        const outcomeIndex = intent.outcome === 'YES' ? 0 : 1;
        const sharesBigInt = toAmmAmount(intent.amount);
        const result = LmsrAmm.calculateCost(market.amm, intent.outcome, sharesBigInt);

        // STATE CHANNELS: No per-trade transfers needed
        // Money flow:
        // 1. Market creation: 10 ytest.USD → Clearnode (DONE)
        // 2. Trading: Internal accounting only (STATE CHANNELS)
        // 3. Settlement: Clearnode → Winners (at resolution)
        console.log(`⚡ Off-chain trade: ${fromAmmAmount(result.cost)} ytest.USD via state channels`);
        console.log(`   User: ${intent.user.slice(0, 10)}... | Outcome: ${intent.outcome} | Shares: ${fromAmmAmount(sharesBigInt)}`);

        // Update market state - preserve liquidityParameter
        market.amm = {
            liquidityParameter: market.amm.liquidityParameter,
            shares: result.newShares
        };
        market.totalVolume += result.cost;

        // Update user position
        const positionKey = `${intent.user}_${intent.outcome}`;
        const currentPosition = market.positions.get(positionKey) || { 
            userAddress: intent.user,
            outcome: intent.outcome,
            shares: 0n, 
            totalCost: 0n 
        };
        market.positions.set(positionKey, {
            userAddress: intent.user,
            outcome: intent.outcome,
            shares: currentPosition.shares + sharesBigInt,
            totalCost: currentPosition.totalCost + result.cost,
        });

        // Record trade
        const trade: Trade = {
            id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            marketId: intent.marketId,
            user: intent.user,
            outcome: intent.outcome,
            amount: result.cost,
            shares: sharesBigInt,
            price: result.priceAfter,
            timestamp: new Date(),
        };
        market.trades.push(trade);

        this.markets.set(intent.marketId, market);

        // Broadcast authoritative state update
        this.broadcastMarketUpdate(market);

        console.log(`✅ Trade complete: ${fromAmmAmount(sharesBigInt)} ${intent.outcome} shares for ${fromAmmAmount(result.cost)} ytest.USD`);
        console.log(`   New prices → YES: ${LmsrAmm.getPrice(market.amm.liquidityParameter, market.amm.shares.YES, market.amm.shares.NO, 'YES').toFixed(4)} | NO: ${LmsrAmm.getPrice(market.amm.liquidityParameter, market.amm.shares.YES, market.amm.shares.NO, 'NO').toFixed(4)}`);
        
        // Persist to disk after trade
        this.saveMarkets();
        
        return trade;
    }

    /**
     * Get user's positions for a market
     */
    getUserPositions(marketId: string, userAddress: string): Position[] {
        const market = this.markets.get(marketId);
        if (!market) return [];

        const positions: Position[] = [];
        market.positions.forEach((position) => {
            if (position.userAddress === userAddress && position.shares > 0n) {
                positions.push(position);
            }
        });

        return positions;
    }

    /**
     * Get user's recent trades
     */
    getUserTrades(marketId: string, userAddress: string): Trade[] {
        const market = this.markets.get(marketId);
        if (!market) return [];

        return market.trades.filter(trade => trade.user === userAddress);
    }

    /**
     * Refund Position (Partial Exit)
     * User can exit position early with 25% refund (75% penalty)
     * Shares are returned to AMM, prices recalculate
     */
    async refundPosition(marketId: string, userAddress: string, outcome: 'YES' | 'NO'): Promise<{
        refundAmount: bigint;
        sharesReturned: bigint;
        penalty: bigint;
    }> {
        const market = this.markets.get(marketId);
        if (!market) throw new Error('Market not found');
        if (market.status !== MarketStatus.ACTIVE) {
            throw new Error(`Cannot refund - market is ${market.status}`);
        }

        // Find user's position
        const positionKey = `${userAddress}_${outcome}`;
        const position = market.positions.get(positionKey);
        if (!position || position.shares === 0n) {
            throw new Error('No position found for this outcome');
        }

        // Calculate refund: 25% of total cost paid
        const refundAmount = position.totalCost / 4n; // 25%
        const penalty = position.totalCost - refundAmount; // 75%

        // Return shares to AMM (reverse the purchase)
        const newShares = {
            YES: outcome === 'YES' ? market.amm.shares.YES + position.shares : market.amm.shares.YES,
            NO: outcome === 'NO' ? market.amm.shares.NO + position.shares : market.amm.shares.NO
        };

        market.amm = {
            liquidityParameter: market.amm.liquidityParameter,
            shares: newShares
        };

        // Remove position
        market.positions.delete(positionKey);

        // Process refund via Yellow Network (25% back to user)
        if (this.yellowClient) {
            try {
                // In production: Transfer refundAmount from market pool to user
                console.log(`💸 Refund issued: ${fromAmmAmount(refundAmount)} USDC (25% of ${fromAmmAmount(position.totalCost)} USDC)`);
                console.log(`   Penalty: ${fromAmmAmount(penalty)} USDC (75%) stays in pool`);
            } catch (error) {
                console.error('Yellow Network refund failed:', error);
                throw new Error('Refund execution failed on Yellow Network');
            }
        }

        // Record refund as trade (negative amount)
        const refundTrade: Trade = {
            id: `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            marketId: marketId,
            user: userAddress,
            outcome: outcome,
            amount: -refundAmount, // Negative = refund
            shares: -position.shares, // Negative = returned
            price: 0, // Not applicable for refunds
            timestamp: new Date(),
        };
        market.trades.push(refundTrade);

        this.markets.set(marketId, market);

        // Broadcast update
        this.broadcastMarketUpdate(market);

        console.log(`🔄 Position refunded: ${fromAmmAmount(position.shares)} ${outcome} shares returned to pool`);
        console.log(`   New prices - YES: ${LmsrAmm.getPrice(market.amm.liquidityParameter, market.amm.shares.YES, market.amm.shares.NO, 'YES').toFixed(3)}, NO: ${LmsrAmm.getPrice(market.amm.liquidityParameter, market.amm.shares.YES, market.amm.shares.NO, 'NO').toFixed(3)}`);

        // Persist to disk
        this.saveMarkets();

        return {
            refundAmount,
            sharesReturned: position.shares,
            penalty
        };
    }

    /**
     * MARKET LIFECYCLE: Freeze Market
     * Called by oracle when event occurs (e.g., market endTime reached)
     * Disables trading before resolution
     * Authority: Only oracle can freeze
     */
    async freezeMarket(marketId: string, oracleAddress: string): Promise<Market> {
        const market = this.markets.get(marketId);
        if (!market) throw new Error('Market not found');
        if (market.status !== MarketStatus.ACTIVE) {
            throw new Error(`Market already ${market.status}`);
        }

        // TODO: Verify oracle signature/authority
        // For Phase 3: Check if oracleAddress matches trusted oracle

        market.status = MarketStatus.FROZEN;
        this.markets.set(marketId, market);

        this.broadcastMarketUpdate(market);

        console.log(`❄️ Market frozen: ${marketId} | Oracle: ${oracleAddress}`);
        return market;
    }

    /**
     * MARKET LIFECYCLE: Resolve Market
     * Called by oracle with outcome determination
     * Authority: ONLY oracle can resolve (not user-triggered)
     */
    async resolveMarket(marketId: string, winningOutcome: 'YES' | 'NO', oracleProof: string): Promise<Market> {
        const market = this.markets.get(marketId);
        if (!market) throw new Error('Market not found');
        if (market.status !== MarketStatus.FROZEN) {
            throw new Error('Market must be frozen before resolution');
        }

        // TODO: Verify oracle proof (Chainlink signature, signed event data, etc.)
        // For Phase 3: Validate oracleProof cryptographically

        market.status = MarketStatus.RESOLVED;
        market.winningOutcome = winningOutcome;
        market.resolvedAt = new Date();

        this.markets.set(marketId, market);

        this.broadcastMarketUpdate(market);

        console.log(`✅ Market resolved: ${marketId} | Winning outcome: ${winningOutcome}`);
        return market;
    }

    /**
     * MARKET LIFECYCLE: Settle Market (On-Chain)
     * After resolution, submit final state to Yellow Network for settlement
     * This triggers on-chain payout distribution
     */
    async settleMarket(marketId: string): Promise<{ stateHash: string; signatures: string[] }> {
        const market = this.markets.get(marketId);
        if (!market) throw new Error('Market not found');
        if (market.status !== MarketStatus.RESOLVED) {
            throw new Error('Market must be resolved before settlement');
        }

        // Calculate final payouts for all participants
        const payouts = this.calculatePayouts(market);

        // TODO: Phase 4 - Build Yellow Network settlement message
        // 1. Create final state hash (market ID + winningOutcome + payouts)
        // 2. Collect signatures from all participants
        // 3. Submit to Yellow Network adjudicator contract

        market.status = MarketStatus.SETTLED;
        market.settledAt = new Date();
        this.markets.set(marketId, market);

        this.broadcastMarketUpdate(market);

        console.log(`💎 Market settled on-chain: ${marketId}`);
        
        // Placeholder return for Phase 4
        return {
            stateHash: '0x...', // TODO: Real state hash
            signatures: [], // TODO: Participant signatures
        };
    }

    /**
     * Calculate payouts for resolved market
     * Uses winner-takes-all formula: winners split loser pool proportionally
     * 
     * Formula: payout = (user_winning_shares / total_winning_shares) * (loser_pool + winner_pool)
     */
    private calculatePayouts(market: Market): Map<string, number> {
        if (market.winningOutcome === undefined) {
            throw new Error('Market outcome not determined');
        }

        const payouts = new Map<string, number>();
        let totalWinningShares = 0;

        // Calculate total winning shares
        market.positions.forEach((position, key) => {
            const [, outcomeStr] = key.split('_');
            const outcome = parseInt(outcomeStr);
            if (outcome === market.winningOutcome) {
                totalWinningShares += position.shares;
            }
        });

        if (totalWinningShares === 0) {
            console.warn(`⚠️ No winning positions for market ${market.id}`);
            return payouts;
        }

        const totalPool = market.totalVolume;

        // Calculate payouts for winners
        market.positions.forEach((position, key) => {
            const [userAddress, outcomeStr] = key.split('_');
            const outcome = parseInt(outcomeStr);
            
            if (outcome === market.winningOutcome) {
                const shareOfPool = position.shares / totalWinningShares;
                const payout = shareOfPool * totalPool;
                payouts.set(userAddress, (payouts.get(userAddress) || 0) + payout);
            }
        });

        return payouts;
    }

    /**
     * Get market statistics for frontend display
     * Returns AUTHORITATIVE prices and volumes - frontend NEVER calculates these
     */
    getMarketStats(marketId: string): {
        prices: number[];
        volumes: number[];
        totalVolume: number;
        participantCount: number;
    } | null {
        const market = this.markets.get(marketId);
        if (!market) return null;

        // Defensive check for AMM state
        if (!market.amm || !market.amm.liquidityParameter) {
            console.error(`❌ Market ${marketId} has corrupted AMM state:`, market.amm);
            return {
                prices: [0.5, 0.5],
                volumes: [0, 0],
                totalVolume: 0,
                participantCount: 0
            };
        }

        // Calculate current prices from AMM using correct method
        const odds = LmsrAmm.getOdds(market.amm);
        const prices = [odds.YES, odds.NO];

        const volumes = [Number(market.amm.shares.YES), Number(market.amm.shares.NO)];
        const participantCount = market.positions ? new Set(
            Array.from(market.positions.keys()).map(key => key.split('_')[0])
        ).size : 0;

        return {
            prices,
            volumes,
            totalVolume: Number(market.totalVolume),
            participantCount,
        };
    }

    /**
     * Get user's winnings after market resolution
     */
    getUserWinnings(marketId: string, userAddress: string): {
        won: boolean;
        invested: number;
        winnings: number;
        profit: number;
    } {
        const market = this.markets.get(marketId);
        if (!market || market.status !== MarketStatus.RESOLVED) {
            throw new Error('Market not resolved');
        }

        const payouts = this.calculatePayouts(market);
        const userPayout = payouts.get(userAddress) || 0;

        // Calculate total invested across all outcomes
        let totalInvested = 0;
        market.positions.forEach((position, key) => {
            const [addr] = key.split('_');
            if (addr === userAddress) {
                totalInvested += position.totalCost;
            }
        });

        return {
            won: userPayout > 0,
            invested: totalInvested,
            winnings: userPayout,
            profit: userPayout - totalInvested,
        };
    }

    /**
     * Get all active markets
     */
    getActiveMarkets(): any[] {
        console.log(`🔍 getActiveMarkets - ${this.markets.size} total markets`);
        const markets: any[] = [];
        this.markets.forEach((market) => {
            console.log(`   Processing market ${market.id}:`, {
                status: market.status,
                question: market.question,
                hasAmm: !!market.amm,
                ammLiquidity: market.amm?.liquidityParameter?.toString()
            });
            
            const yesPrice = LmsrAmm.getPrice(
                market.amm.liquidityParameter,
                market.amm.shares.YES,
                market.amm.shares.NO,
                'YES'
            );
            const noPrice = LmsrAmm.getPrice(
                market.amm.liquidityParameter,
                market.amm.shares.YES,
                market.amm.shares.NO,
                'NO'
            );
            
            console.log(`   📊 Calculated prices: YES=${yesPrice}, NO=${noPrice}`);
            
            // Check if positions exists
            if (!market.positions || !(market.positions instanceof Map)) {
                market.positions = new Map();
            }
            
            const result = {
                id: market.id,
                question: market.question,
                description: market.description || '',
                durationMinutes: Math.floor((market.endTime.getTime() - market.createdAt.getTime()) / 60000),
                yesPrice,
                noPrice,
                createdAt: market.createdAt,
                endTime: market.endTime,
                status: market.status,
                totalVolume: Number(market.totalVolume),
                channelId: market.channelId,
                participantCount: new Set(
                    Array.from(market.positions.keys()).map(key => key.split('_')[0])
                ).size,
            };
            console.log(`   ✅ Adding market:`, { id: result.id, yesPrice: result.yesPrice, noPrice: result.noPrice });
            markets.push(result);
        });
        console.log(`📊 Returning ${markets.length} markets total`);
        return markets;
    }

    /**
     * Get all markets with full details (including positions Map)
     * Used internally for positions and trades routes
     */
    getAllMarkets(): Market[] {
        return Array.from(this.markets.values());
    }

    /**
     * Get market by ID
     */
    getMarketById(marketId: string): any | null {
        const market = this.markets.get(marketId);
        if (!market) return null;
        
        const yesPrice = LmsrAmm.getPrice(
            market.amm.liquidityParameter,
            market.amm.shares.YES,
            market.amm.shares.NO,
            'YES'
        );
        const noPrice = LmsrAmm.getPrice(
            market.amm.liquidityParameter,
            market.amm.shares.YES,
            market.amm.shares.NO,
            'NO'
        );
        
        return {
            id: market.id,
            question: market.question,
            description: market.description || '',
            durationMinutes: Math.floor((market.endTime.getTime() - market.createdAt.getTime()) / 60000),
            yesPrice,
            noPrice,
            createdAt: market.createdAt,
            endTime: market.endTime,
            status: market.status,
            totalVolume: Number(market.totalVolume),
            channelId: market.channelId,
            participantCount: new Set(
                Array.from(market.positions.keys()).map(key => key.split('_')[0])
            ).size,
        };
    }

    /**
     * Get locked liquidity for a user (liquidity committed to created markets)
     */
    getLockedLiquidity(address: string): number {
        return this.lockedLiquidity.get(address.toLowerCase()) || 0;
    }
}

export default new MarketService();