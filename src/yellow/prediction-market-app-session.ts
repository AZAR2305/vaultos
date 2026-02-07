/**
 * Prediction Market with Yellow App Sessions
 * 
 * Uses Yellow Network App Sessions (NitroRPC/0.4) for multi-party prediction markets.
 * App Sessions enable:
 * - Multi-participant channels
 * - Intent-based state updates (OPERATE, DEPOSIT, WITHDRAW)
 * - Efficient market resolution and fund distribution
 * 
 * Market Flow:
 * 1. Create app session with participants
 * 2. Participants deposit funds (DEPOSIT intent)
 * 3. Trading happens via OPERATE intents
 * 4. Market resolves
 * 5. Close session and distribute winnings
 */

import { EnhancedYellowClient } from './enhanced-yellow-client';
import type {
    StateIntent,
    StateAllocation,
    CreateAppSessionParams,
    SubmitAppStateParams,
    CloseAppSessionParams,
    AppSession,
} from './protocol-types';

export enum MarketOutcome {
    YES = 'YES',
    NO = 'NO',
    UNRESOLVED = 'UNRESOLVED',
}

export interface PredictionMarket {
    marketId: string;
    appSessionId: string | null;
    question: string;
    description: string;
    
    // Participants
    creator: `0x${string}`;
    participants: `0x${string}`[];
    
    // Market state
    yesShares: Map<string, bigint>;
    noShares: Map<string, bigint>;
    yesPrice: number;  // 0-1
    noPrice: number;   // 0-1
    
    // Status
    status: 'pending' | 'active' | 'trading' | 'resolving' | 'resolved' | 'closed';
    outcome: MarketOutcome;
    
    // Timing
    createdAt: number;
    endTime: number;
    resolvedAt?: number;
    
    // Financial
    totalDeposited: bigint;
    totalYesShares: bigint;
    totalNoShares: bigint;
}

export interface TradeOrder {
    marketId: string;
    trader: `0x${string}`;
    position: 'YES' | 'NO';
    shares: bigint;
    cost: bigint;
    timestamp: number;
}

/**
 * Prediction Market Manager using App Sessions
 */
export class PredictionMarketManager {
    private client: EnhancedYellowClient;
    private markets: Map<string, PredictionMarket> = new Map();
    private appDefinitionAddress: `0x${string}`;

    constructor(client: EnhancedYellowClient, appDefinitionAddress?: `0x${string}`) {
        this.client = client;
        // Use a standard app definition address or deploy custom one
        this.appDefinitionAddress = appDefinitionAddress || 
            '0x0000000000000000000000000000000000000001' as `0x${string}`;
    }

    /**
     * Create a new prediction market
     * 
     * Creates an app session for the market with initial participants.
     * Uses INITIALIZE intent.
     */
    async createMarket(params: {
        question: string;
        description: string;
        durationMinutes: number;
        initialYesPrice: number;  // 0-1
        participants: `0x${string}`[];
        initialDeposit: bigint;   // Per participant
        token: `0x${string}`;
    }): Promise<PredictionMarket> {
        if (!this.client.isAuth()) {
            throw new Error('Must be authenticated');
        }

        // Validate price
        if (params.initialYesPrice <= 0 || params.initialYesPrice >= 1) {
            throw new Error('YES price must be between 0 and 1');
        }

        const marketId = this.generateMarketId();
        const creator = this.client.getAddress();

        // Create initial allocations
        // Note: Yellow expects asset symbol (e.g., 'ytest.usd'), not token address
        // For duplicate participants (same address), consolidate into one allocation
        const assetSymbol = 'ytest.usd';
        
        // Group allocations by unique participant address
        const allocationMap = new Map<string, bigint>();
        for (const participant of params.participants) {
            const current = allocationMap.get(participant) || 0n;
            allocationMap.set(participant, current + params.initialDeposit);
        }
        
        // Create unique allocations (one per unique address)
        const initialAllocations: StateAllocation[] = Array.from(allocationMap.entries()).map(
            ([participant, amount]) => ({
                participant: participant as `0x${string}`,
                asset: assetSymbol,
                amount: amount.toString(),
            })
        );

        // Encode market data
        const marketData = this.encodeMarketData({
            question: params.question,
            yesPrice: params.initialYesPrice,
            noPrice: 1 - params.initialYesPrice,
        });

        // Create app session
        console.log('\n📊 Creating prediction market app session...');
        
        // Calculate integer weights that sum to exactly 100
        const numParticipants = params.participants.length;
        const baseWeight = Math.floor(100 / numParticipants);
        const remainder = 100 - (baseWeight * numParticipants);
        const weights = params.participants.map((_, i) => 
            i < remainder ? baseWeight + 1 : baseWeight
        );
        
        const appSessionParams: CreateAppSessionParams = {
            definition: {
                application: 'Yellow',  // Must match auth session application
                protocol: 'NitroRPC/0.4',
                participants: params.participants,
                weights,  // Weights now sum to exactly 100
                quorum: 100,  // Require full consensus
                challenge_duration: 0,  // No challenge period (required parameter)
                nonce: Date.now(),
            },
            allocations: initialAllocations,
        };

        const response = await this.client.createAppSession(appSessionParams);
        
        // Check for errors
        if ('error' in response) {
            console.error('❌ App session creation failed:', response.error);
            throw new Error(`Failed to create app session: ${response.error}`);
        }

        console.log('✅ App session created:', response.app_session_id);

        // Store market
        const market: PredictionMarket = {
            marketId,
            appSessionId: response.app_session_id,
            question: params.question,
            description: params.description,
            creator,
            participants: params.participants,
            yesShares: new Map(),
            noShares: new Map(),
            yesPrice: params.initialYesPrice,
            noPrice: 1 - params.initialYesPrice,
            status: 'active',
            outcome: MarketOutcome.UNRESOLVED,
            createdAt: Date.now(),
            endTime: Date.now() + (params.durationMinutes * 60 * 1000),
            totalDeposited: params.initialDeposit * BigInt(params.participants.length),
            totalYesShares: 0n,
            totalNoShares: 0n,
        };

        this.markets.set(marketId, market);

        console.log('✓ Market created:', marketId);
        console.log(`  Question: ${params.question}`);
        console.log(`  Participants: ${params.participants.length}`);
        console.log(`  App Session: ${response.app_session_id}`);

        return market;
    }

    /**
     * Add funds to market (DEPOSIT intent)
     * 
     * Participants can deposit additional funds during trading.
     */
    async depositToMarket(params: {
        marketId: string;
        amount: bigint;
        token: `0x${string}`;
    }): Promise<void> {
        const market = this.markets.get(params.marketId);
        if (!market || !market.appSessionId) {
            throw new Error('Market not found');
        }

        if (market.status !== 'active' && market.status !== 'trading') {
            throw new Error('Market not accepting deposits');
        }

        const trader = this.client.getAddress();

        // Create new allocations with deposit
        const newAllocations: StateAllocation[] = market.participants.map(participant => {
            const current = this.getCurrentAllocation(market, participant, params.token);
            const additional = participant === trader ? params.amount : 0n;
            return {
                participant,
                token: params.token,
                amount: (BigInt(current) + additional).toString(),
            };
        });

        // Submit DEPOSIT intent
        console.log(`\n💰 Depositing ${params.amount} to market ${params.marketId}...`);
        const depositParams: SubmitAppStateParams = {
            app_session_id: market.appSessionId,
            intent: 5 as StateIntent.DEPOSIT,  // DEPOSIT = 5
            app_data: this.encodeMarketData({}),
            allocations: newAllocations,
        };

        await this.client.submitAppState(depositParams);

        market.totalDeposited += params.amount;
        console.log('✓ Deposit complete');
    }

    /**
     * Execute trade (OPERATE intent)
     * 
     * Buy YES or NO shares. Updates app session state.
     */
    async executeTrade(params: {
        marketId: string;
        position: 'YES' | 'NO';
        shares: bigint;
        token: `0x${string}`;
    }): Promise<TradeOrder> {
        const market = this.markets.get(params.marketId);
        if (!market || !market.appSessionId) {
            throw new Error('Market not found');
        }

        if (market.status !== 'active' && market.status !== 'trading') {
            throw new Error('Market not open for trading');
        }

        const trader = this.client.getAddress();
        const price = params.position === 'YES' ? market.yesPrice : market.noPrice;
        const cost = BigInt(Math.floor(Number(params.shares) * price * 1e6)); // USDC has 6 decimals

        // Update market state
        if (params.position === 'YES') {
            const current = market.yesShares.get(trader.toLowerCase()) || 0n;
            market.yesShares.set(trader.toLowerCase(), current + params.shares);
            market.totalYesShares += params.shares;
        } else {
            const current = market.noShares.get(trader.toLowerCase()) || 0n;
            market.noShares.set(trader.toLowerCase(), current + params.shares);
            market.totalNoShares += params.shares;
        }

        market.status = 'trading';

        // Create new allocations (deduct cost from trader)
        const newAllocations: StateAllocation[] = market.participants.map(participant => {
            const current = this.getCurrentAllocation(market, participant, params.token);
            const deduction = participant === trader ? cost : 0n;
            return {
                participant,
                token: params.token,
                amount: (BigInt(current) - deduction).toString(),
            };
        });

        // Encode trade data
        const tradeData = this.encodeTradeData({
            trader,
            position: params.position,
            shares: params.shares,
            cost,
        });

        // Submit OPERATE intent
        console.log(`\n📈 Executing trade: ${params.shares} ${params.position} shares for ${cost}...`);
        const operateParams: SubmitAppStateParams = {
            app_session_id: market.appSessionId,
            intent: 4 as StateIntent.OPERATE,  // OPERATE = 4
            app_data: tradeData,
            allocations: newAllocations,
        };

        await this.client.submitAppState(operateParams);

        const trade: TradeOrder = {
            marketId: params.marketId,
            trader,
            position: params.position,
            shares: params.shares,
            cost,
            timestamp: Date.now(),
        };

        console.log('✓ Trade executed');
        return trade;
    }

    /**
     * Withdraw from market (WITHDRAW intent)
     * 
     * Before market resolution, participants can withdraw up to 25% of deposit.
     */
    async withdrawFromMarket(params: {
        marketId: string;
        amount: bigint;
        token: `0x${string}`;
    }): Promise<void> {
        const market = this.markets.get(params.marketId);
        if (!market || !market.appSessionId) {
            throw new Error('Market not found');
        }

        if (market.status === 'resolved' || market.status === 'closed') {
            throw new Error('Market already resolved');
        }

        const trader = this.client.getAddress();
        const userDeposit = this.getCurrentAllocation(market, trader, params.token);
        const maxWithdraw = BigInt(userDeposit) / 4n; // 25% max

        if (params.amount > maxWithdraw) {
            throw new Error(`Can only withdraw up to 25% (${maxWithdraw})`);
        }

        // Create new allocations with withdrawal
        const newAllocations: StateAllocation[] = market.participants.map(participant => {
            const current = this.getCurrentAllocation(market, participant, params.token);
            const withdrawal = participant === trader ? params.amount : 0n;
            return {
                participant,
                token: params.token,
                amount: (BigInt(current) - withdrawal).toString(),
            };
        });

        // Submit WITHDRAW intent
        console.log(`\n💸 Withdrawing ${params.amount} from market ${params.marketId}...`);
        const withdrawParams: SubmitAppStateParams = {
            app_session_id: market.appSessionId,
            intent: 6 as StateIntent.WITHDRAW,  // WITHDRAW = 6
            app_data: this.encodeMarketData({}),
            allocations: newAllocations,
        };

        await this.client.submitAppState(withdrawParams);

        market.totalDeposited -= params.amount;
        console.log('✓ Withdrawal complete');
    }

    /**
     * Resolve market and close app session
     * 
     * Calculates winnings and distributes funds using FINALIZE intent.
     */
    async resolveMarket(params: {
        marketId: string;
        outcome: MarketOutcome;
        token: `0x${string}`;
    }): Promise<void> {
        const market = this.markets.get(params.marketId);
        if (!market || !market.appSessionId) {
            throw new Error('Market not found');
        }

        if (market.status === 'resolved' || market.status === 'closed') {
            throw new Error('Market already resolved');
        }

        if (params.outcome === MarketOutcome.UNRESOLVED) {
            throw new Error('Must specify YES or NO outcome');
        }

        console.log(`\n🎯 Resolving market: ${market.question}`);
        console.log(`   Outcome: ${params.outcome}`);

        market.status = 'resolving';
        market.outcome = params.outcome;
        market.resolvedAt = Date.now();

        // Calculate final allocations based on winnings
        const finalAllocations = this.calculateWinnings(market, params.token);

        // Close app session with final distribution
        const closeParams: CloseAppSessionParams = {
            app_session_id: market.appSessionId,
            final_allocations: finalAllocations,
        };

        await this.client.closeAppSession(closeParams);

        market.status = 'resolved';
        console.log('✓ Market resolved and session closed');
        
        // Log winnings
        finalAllocations.forEach(alloc => {
            console.log(`   ${alloc.participant}: ${alloc.amount} tokens`);
        });
    }

    /**
     * Calculate winnings based on market outcome
     */
    private calculateWinnings(market: PredictionMarket, token: `0x${string}`): StateAllocation[] {
        const totalPool = market.totalDeposited;
        const winningShares = market.outcome === MarketOutcome.YES 
            ? market.totalYesShares 
            : market.totalNoShares;

        if (winningShares === 0n) {
            // No winners - return deposits
            return market.participants.map(participant => ({
                participant,
                token,
                amount: (totalPool / BigInt(market.participants.length)).toString(),
            }));
        }

        // Calculate per-share payout
        const payoutPerShare = totalPool / winningShares;

        return market.participants.map(participant => {
            const shares = market.outcome === MarketOutcome.YES
                ? (market.yesShares.get(participant.toLowerCase()) || 0n)
                : (market.noShares.get(participant.toLowerCase()) || 0n);

            const winnings = shares * payoutPerShare;

            return {
                participant,
                token,
                amount: winnings.toString(),
            };
        });
    }

    /**
     * Get current allocation for participant
     */
    private getCurrentAllocation(
        market: PredictionMarket, 
        participant: `0x${string}`, 
        token: `0x${string}`
    ): string {
        // This should query the latest state from the app session
        // For now, return estimated based on initial deposit
        return (market.totalDeposited / BigInt(market.participants.length)).toString();
    }

    /**
     * Encode market data for app_data field
     */
    private encodeMarketData(data: any): string {
        // Simple JSON encoding - in production, use proper ABI encoding
        return '0x' + Buffer.from(JSON.stringify(data)).toString('hex');
    }

    /**
     * Encode trade data
     */
    private encodeTradeData(trade: any): string {
        return '0x' + Buffer.from(JSON.stringify(trade)).toString('hex');
    }

    /**
     * Generate unique market ID
     */
    private generateMarketId(): string {
        return `market_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get market by ID
     */
    getMarket(marketId: string): PredictionMarket | undefined {
        return this.markets.get(marketId);
    }

    /**
     * Get all markets
     */
    getAllMarkets(): PredictionMarket[] {
        return Array.from(this.markets.values());
    }

    /**
     * Get active markets
     */
    getActiveMarkets(): PredictionMarket[] {
        return Array.from(this.markets.values())
            .filter(m => m.status === 'active' || m.status === 'trading');
    }

    /**
     * Get user's position in market
     */
    getUserPosition(marketId: string, userAddress: `0x${string}`): {
        yesShares: bigint;
        noShares: bigint;
        invested: bigint;
    } {
        const market = this.markets.get(marketId);
        if (!market) {
            return { yesShares: 0n, noShares: 0n, invested: 0n };
        }

        const addressLower = userAddress.toLowerCase();
        return {
            yesShares: market.yesShares.get(addressLower) || 0n,
            noShares: market.noShares.get(addressLower) || 0n,
            invested: 0n, // Calculate from trades
        };
    }
}
