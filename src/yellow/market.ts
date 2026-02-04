/**
 * Prediction Market Model
 * 
 * Defines binary prediction markets (YES/NO) with simple pricing.
 * Trading happens off-chain via Yellow state channels.
 */

export enum MarketStatus {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  RESOLVED = 'RESOLVED'
}

export enum Outcome {
  YES = 'YES',
  NO = 'NO',
  UNRESOLVED = 'UNRESOLVED'
}

export interface Market {
  marketId: string;
  question: string;
  description: string;
  
  // Pricing (simple fixed odds for MVP)
  yesPrice: number;   // Price of YES share (0-1 scale, e.g., 0.65 = 65%)
  noPrice: number;    // Price of NO share (0-1 scale, e.g., 0.35 = 35%)
  
  // Timing
  createdAt: number;
  endTime: number;
  resolvedAt?: number;
  
  // Status
  status: MarketStatus;
  outcome: Outcome;
  
  // Volume tracking
  totalVolume: bigint;      // Total USDC traded
  totalYesShares: bigint;   // Total YES shares issued
  totalNoShares: bigint;    // Total NO shares issued
}

export class PredictionMarket {
  private markets: Map<string, Market>;

  constructor() {
    this.markets = new Map();
  }

  /**
   * Create a new binary prediction market
   * 
   * Pricing model (Phase 1 - Simple Fixed Odds):
   * - YES price + NO price = 1.0
   * - Example: YES at 0.65, NO at 0.35
   * - Prices are fixed for MVP simplicity
   * 
   * Phase 2 could add:
   * - AMM pricing (Uniswap-style)
   * - Order book matching
   * - Dynamic odds based on volume
   */
  createMarket(
    question: string,
    description: string,
    durationMinutes: number,
    initialYesPrice: number
  ): Market {
    // Validate pricing
    if (initialYesPrice <= 0 || initialYesPrice >= 1) {
      throw new Error('YES price must be between 0 and 1');
    }

    const marketId = this.generateMarketId();
    const now = Date.now();

    const market: Market = {
      marketId,
      question,
      description,
      yesPrice: initialYesPrice,
      noPrice: 1 - initialYesPrice,
      createdAt: now,
      endTime: now + (durationMinutes * 60 * 1000),
      status: MarketStatus.ACTIVE,
      outcome: Outcome.UNRESOLVED,
      totalVolume: 0n,
      totalYesShares: 0n,
      totalNoShares: 0n
    };

    this.markets.set(marketId, market);

    console.log(`📊 Market created: ${marketId}`);
    console.log(`   Question: ${question}`);
    console.log(`   YES price: ${(initialYesPrice * 100).toFixed(1)}%`);
    console.log(`   NO price: ${((1 - initialYesPrice) * 100).toFixed(1)}%`);
    console.log(`   Duration: ${durationMinutes} minutes`);

    return market;
  }

  /**
   * Get market by ID
   */
  getMarket(marketId: string): Market | undefined {
    return this.markets.get(marketId);
  }

  /**
   * Get all active markets
   */
  getActiveMarkets(): Market[] {
    const now = Date.now();
    return Array.from(this.markets.values()).filter(
      market => market.status === MarketStatus.ACTIVE && market.endTime > now
    );
  }

  /**
   * Calculate share cost in USDC
   * 
   * Formula: shares * price
   * Example: 100 YES shares at 0.65 = 65 USDC
   * 
   * Returns amount in smallest unit (6 decimals for USDC)
   */
  calculateShareCost(market: Market, shares: number, isYes: boolean): bigint {
    const price = isYes ? market.yesPrice : market.noPrice;
    const costInUSDC = shares * price;
    
    // Convert to smallest unit (6 decimals)
    return BigInt(Math.floor(costInUSDC * 1_000_000));
  }

  /**
   * Calculate shares received for USDC amount
   * 
   * Formula: usdcAmount / price
   * Example: 65 USDC at 0.65 = 100 YES shares
   */
  calculateSharesReceived(market: Market, usdcAmount: bigint, isYes: boolean): number {
    const price = isYes ? market.yesPrice : market.noPrice;
    const usdcFloat = Number(usdcAmount) / 1_000_000;
    
    return usdcFloat / price;
  }

  /**
   * Record trade volume
   */
  recordTrade(marketId: string, usdcAmount: bigint, shares: number, isYes: boolean): void {
    const market = this.markets.get(marketId);
    if (!market) {
      throw new Error('Market not found');
    }

    market.totalVolume += usdcAmount;
    
    if (isYes) {
      market.totalYesShares += BigInt(Math.floor(shares));
    } else {
      market.totalNoShares += BigInt(Math.floor(shares));
    }
  }

  /**
   * Close market for trading
   */
  closeMarket(marketId: string): void {
    const market = this.markets.get(marketId);
    if (!market) {
      throw new Error('Market not found');
    }

    market.status = MarketStatus.CLOSED;
    console.log(`🔒 Market closed: ${marketId}`);
  }

  /**
   * Resolve market outcome
   * 
   * Phase 1: Manual resolution for demo
   * Phase 2: Oracle-based resolution on Sui
   * - Chainlink oracle
   * - DAO voting
   * - Automated event verification
   */
  resolveMarket(marketId: string, outcome: Outcome.YES | Outcome.NO): void {
    const market = this.markets.get(marketId);
    if (!market) {
      throw new Error('Market not found');
    }

    if (market.status !== MarketStatus.CLOSED) {
      throw new Error('Market must be closed before resolution');
    }

    market.status = MarketStatus.RESOLVED;
    market.outcome = outcome;
    market.resolvedAt = Date.now();

    console.log(`✅ Market resolved: ${marketId}`);
    console.log(`   Outcome: ${outcome}`);
    console.log(`   Total volume: ${this.formatUSDC(market.totalVolume)} USDC`);
  }

  /**
   * Generate unique market ID
   */
  private generateMarketId(): string {
    return `market_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format USDC amount
   */
  private formatUSDC(amount: bigint): string {
    return (Number(amount) / 1_000_000).toFixed(2);
  }
}
