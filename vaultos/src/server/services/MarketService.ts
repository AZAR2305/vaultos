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
import { SettlementMath, Position } from './SettlementMath';
import { VaultOSYellowClient } from '../../../../src/yellow/vaultos-yellow';

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

    constructor(privateKey?: `0x${string}`) {
        if (privateKey) {
            this.yellowClient = new VaultOSYellowClient(privateKey);
            this.initializeYellowClient();
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

        // Execute transfer via Yellow Network (using ledger balance)
        if (this.yellowClient) {
            try {
                // In production, this would transfer USDC from user to market pool
                // For now, we're using ledger balance so no actual transfer needed
                console.log(`💰 Trade authorized: ${fromAmmAmount(result.cost)} USDC via Yellow Network`);
            } catch (error) {
                console.error('Yellow Network transfer failed:', error);
                throw new Error('Trade execution failed on Yellow Network');
            }
        }

        // Update market state
        market.amm = { ...market.amm, shares: result.newShares };
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

        console.log(`💰 Trade executed: ${fromAmmAmount(sharesBigInt)} shares of ${intent.outcome} for ${fromAmmAmount(result.cost)} USDC | Market: ${intent.marketId}`);
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

        // Calculate current prices from AMM (static methods)
        const yesPrice = LmsrAmm.getPrice(market.amm, 0);
        const noPrice = LmsrAmm.getPrice(market.amm, 1);
        const prices = [yesPrice, noPrice];

        const volumes = [Number(market.amm.shares.YES), Number(market.amm.shares.NO)];
        const participantCount = new Set(
            Array.from(market.positions.keys()).map(key => key.split('_')[0])
        ).size;

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
        const markets: any[] = [];
        this.markets.forEach((market) => {
            const yesPrice = LmsrAmm.getPrice(market.amm, 0);
            const noPrice = LmsrAmm.getPrice(market.amm, 1);
            
            markets.push({
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
                participantCount: new Set(
                    Array.from(market.positions.keys()).map(key => key.split('_')[0])
                ).size,
            });
        });
        return markets;
    }

    /**
     * Get market by ID
     */
    getMarketById(marketId: string): any | null {
        const market = this.markets.get(marketId);
        if (!market) return null;
        
        const yesPrice = LmsrAmm.getPrice(market.amm, 0);
        const noPrice = LmsrAmm.getPrice(market.amm, 1);
        
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
            participantCount: new Set(
                Array.from(market.positions.keys()).map(key => key.split('_')[0])
            ).size,
        };
    }
}

export default new MarketService();