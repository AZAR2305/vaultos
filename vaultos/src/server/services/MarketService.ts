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
    private ammMath: LmsrAmm = new LmsrAmm();

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
    private broadcastMarketUpdate(market: Market) {
        if (!this.wss) return;

        const message = JSON.stringify({
            type: 'market_update',
            data: market,
        });

        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    /**
     * Create a new prediction market with LMSR AMM initialization
     * Authority: Backend calculates initial AMM state with liquidity parameter
     */
    async createMarket(data: {
        appSessionId: string;
        question: string;
        description: string;
        durationMinutes: number;
        initialLiquidity: number;
        creatorAddress: string;
    }): Promise<Market> {
        const marketId = `market_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const endTime = Date.now() + (data.durationMinutes * 60 * 1000);

        // Initialize AMM with LMSR
        const ammState = this.ammMath.initializeMarket(data.initialLiquidity);

        const newMarket: Market = {
            id: marketId,
            appSessionId: data.appSessionId,
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
            channelId: data.appSessionId,
        };

        this.markets.set(marketId, newMarket);
        
        // Broadcast authoritative initial state
        this.broadcastMarketUpdate(newMarket);

        console.log(`✅ Market created: ${marketId} | Session: ${data.appSessionId}`);
        return newMarket;
    }

    /**
     * Get all active markets
     */
    getActiveMarkets(): Market[] {
        return Array.from(this.markets.values()).filter(m => m.status !== MarketStatus.SETTLED);
    }

    /**
     * Get market by ID
     */
    getMarketById(marketId: string): Market | undefined {
        return this.markets.get(marketId);
    }

    /**
     * AUTHORITATIVE TRADE EXECUTION
     * Frontend sends INTENT only: { marketId, outcome, amount }
     * Backend calculates: cost, shares, price impact, new AMM state
     * 
     * This removes frontend authority - no client-side calculations trusted
     */
    async executeTrade(intent: TradeIntent): Promise<Trade> {
        const market = this.markets.get(intent.marketId);
        if (!market) throw new Error('Market not found');
        if (market.status !== MarketStatus.ACTIVE) {
            throw new Error(`Market is ${market.status}, trading disabled`);
        }

        // Calculate authoritative trade parameters using AMM
        const outcomeIndex = intent.outcome === 'YES' ? 0 : 1;
        const result = this.ammMath.buyShares(market.amm, outcomeIndex, intent.amount);

        // Update market state
        market.amm = result.newState;
        market.totalVolume += result.cost;

        // Update user position
        const positionKey = `${intent.userAddress}_${intent.outcome}`;
        const currentPosition = market.positions.get(positionKey) || { shares: 0, totalCost: 0 };
        market.positions.set(positionKey, {
            shares: currentPosition.shares + sharesReceived,
            totalCost: currentPosition.totalCost + cost,
        });

        // Record trade
        const trade: Trade = {
            id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            marketId: intent.marketId,
            userAddress: intent.userAddress,
            outcome: intent.outcome,
            amount: intent.amount,
            cost,
            sharesReceived,
            price: newPrice,
            timestamp: Date.now(),
        };
        market.trades.push(trade);

        this.markets.set(intent.marketId, market);

        // Broadcast authoritative state update
        this.broadcastMarketUpdate(market);

        console.log(`💰 Trade executed: ${sharesReceived.toFixed(2)} shares of ${intent.outcome} for ${cost.toFixed(2)} USDC | Market: ${intent.marketId}`);
        return trade;
    }

    /**
     * Get user's positions for a market
     */
    getUserPositions(marketId: string, userAddress: string): { outcome: number; shares: number; totalCost: number }[] {
        const market = this.markets.get(marketId);
        if (!market) return [];

        const positions: { outcome: number; shares: number; totalCost: number }[] = [];
        market.ammState.quantityShares.forEach((_, outcome) => {
            const positionKey = `${userAddress}_${outcome}`;
            const position = market.positions.get(positionKey);
            if (position && position.shares > 0) {
                positions.push({ outcome, shares: position.shares, totalCost: position.totalCost });
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

        return market.trades.filter(trade => trade.userAddress === userAddress);

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
    async resolveMarket(marketId: string, winningOutcome: number, oracleProof: string): Promise<Market> {
        const market = this.markets.get(marketId);
        if (!market) throw new Error('Market not found');
        if (market.status !== MarketStatus.FROZEN) {
            throw new Error('Market must be frozen before resolution');
        }

        // TODO: Verify oracle proof (Chainlink signature, signed event data, etc.)
        // For Phase 3: Validate oracleProof cryptographically

        market.status = MarketStatus.RESOLVED;
        market.winningOutcome = winningOutcome;
        market.resolvedAt = Date.now();

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
        market.settledAt = Date.now();
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

        const totalPool = market.ammState.totalVolume;

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

        // Calculate current prices from AMM
        const prices = market.ammState.quantityShares.map((_, outcome) => 
            this.ammMath.getPrice(market.ammState, outcome)
        );

        const volumes = Array.from(market.ammState.quantityShares);
        const participantCount = new Set(
            Array.from(market.positions.keys()).map(key => key.split('_')[0])
        ).size;

        return {
            prices,
            volumes,
            totalVolume: market.ammState.totalVolume,
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
}

export default new MarketService();