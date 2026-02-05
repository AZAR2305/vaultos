/**
 * Prediction Market Service
 * Handles market creation, trading, and resolution
 */

import { ChannelManager } from '../yellow/ChannelManager';
import {
  Market,
  MarketStatus,
  Position,
  Trade,
  CreateMarketParams,
} from './types';

const MARKET_ESCROW_ADDRESS = '0x0000000000000000000000000000000000000001'; // Placeholder

export class MarketService {
  private channelManager: ChannelManager;
  private markets: Map<string, Market> = new Map();
  private positions: Map<string, Position> = new Map();
  private trades: Map<string, Trade> = new Map();
  private admins: Set<string> = new Set();

  constructor(channelManager: ChannelManager, adminAddresses: string[] = []) {
    this.channelManager = channelManager;
    adminAddresses.forEach(addr => this.admins.add(addr.toLowerCase()));
  }

  /**
   * ADMIN ONLY: Create new prediction market
   */
  async createMarket(
    adminAddress: string,
    params: CreateMarketParams
  ): Promise<Market> {
    if (!this.isAdmin(adminAddress)) {
      throw new Error('Only admins can create markets');
    }

    this.validateMarketParams(params);

    const market: Market = {
      id: this.generateId(),
      creator: adminAddress,
      question: params.question,
      description: params.description,
      resolutionSource: params.resolutionSource,
      closeTime: params.closeTime,
      resolveTime: params.resolveTime,
      status: MarketStatus.OPEN,
      totalYesShares: 0n,
      totalNoShares: 0n,
      totalVolume: 0n,
      createdAt: Date.now(),
    };

    this.markets.set(market.id, market);
    return market;
  }

  /**
   * USER: Execute trade (buy YES or NO shares)
   */
  async executeTrade(
    userId: string,
    marketId: string,
    position: 'YES' | 'NO',
    shares: bigint,
    maxPrice: number
  ): Promise<Trade> {
    const market = this.markets.get(marketId);
    if (!market) {
      throw new Error('Market not found');
    }

    if (market.status !== MarketStatus.OPEN) {
      throw new Error('Market is not open for trading');
    }

    if (Date.now() / 1000 > market.closeTime) {
      throw new Error('Market has closed');
    }

    // Calculate trade cost using AMM formula
    const cost = this.calculateTradeCost(market, position, shares);
    const pricePerShare = cost / Number(shares);
    
    if (pricePerShare > maxPrice) {
      throw new Error(`Price ${pricePerShare.toFixed(4)} exceeds max ${maxPrice}`);
    }

    // Execute off-chain transfer via Yellow Network
    const yellowTx = await this.channelManager.executeTrade({
      destination: MARKET_ESCROW_ADDRESS,
      amount: Math.floor(cost * 1e6).toString(), // Convert to token units
      marketId,
      position,
    });

    // Update market state
    if (position === 'YES') {
      market.totalYesShares += shares;
    } else {
      market.totalNoShares += shares;
    }
    market.totalVolume += BigInt(Math.floor(cost * 1e6));

    // Update user position
    this.updateUserPosition(userId, marketId, position, shares, pricePerShare);

    // Record trade
    const trade: Trade = {
      id: this.generateId(),
      marketId,
      userId,
      position,
      shares,
      price: pricePerShare,
      timestamp: Date.now(),
      yellowTxId: yellowTx.channelId || 'ledger',
    };
    this.trades.set(trade.id, trade);

    return trade;
  }

  /**
   * Calculate trade cost using Constant Product AMM
   */
  private calculateTradeCost(
    market: Market,
    position: 'YES' | 'NO',
    shares: bigint
  ): number {
    const yesPool = Number(market.totalYesShares) || 1000;
    const noPool = Number(market.totalNoShares) || 1000;
    const k = yesPool * noPool;

    if (position === 'YES') {
      const newYes = yesPool + Number(shares);
      const newNo = k / newYes;
      return noPool - newNo;
    } else {
      const newNo = noPool + Number(shares);
      const newYes = k / newNo;
      return yesPool - newYes;
    }
  }

  private updateUserPosition(
    userId: string,
    marketId: string,
    position: 'YES' | 'NO',
    shares: bigint,
    price: number
  ): void {
    const key = `${userId}-${marketId}`;
    let pos = this.positions.get(key);

    if (!pos) {
      pos = {
        userId,
        marketId,
        yesShares: 0n,
        noShares: 0n,
        averageYesPrice: 0,
        averageNoPrice: 0,
        realizedPnL: 0n,
      };
    }

    if (position === 'YES') {
      const totalShares = pos.yesShares + shares;
      pos.averageYesPrice = 
        (pos.averageYesPrice * Number(pos.yesShares) + price * Number(shares)) / 
        Number(totalShares);
      pos.yesShares = totalShares;
    } else {
      const totalShares = pos.noShares + shares;
      pos.averageNoPrice = 
        (pos.averageNoPrice * Number(pos.noShares) + price * Number(shares)) / 
        Number(totalShares);
      pos.noShares = totalShares;
    }

    this.positions.set(key, pos);
  }

  /**
   * ADMIN ONLY: Resolve market with outcome
   */
  async resolveMarket(
    adminAddress: string,
    marketId: string,
    outcome: 'YES' | 'NO'
  ): Promise<void> {
    if (!this.isAdmin(adminAddress)) {
      throw new Error('Only admins can resolve markets');
    }

    const market = this.markets.get(marketId);
    if (!market) {
      throw new Error('Market not found');
    }

    if (market.status !== MarketStatus.CLOSED) {
      throw new Error('Market must be closed before resolution');
    }

    market.status = MarketStatus.RESOLVED;
    market.outcome = outcome;
    this.markets.set(marketId, market);
  }

  getMarket(marketId: string): Market | undefined {
    return this.markets.get(marketId);
  }

  getAllMarkets(): Market[] {
    return Array.from(this.markets.values());
  }

  getOpenMarkets(): Market[] {
    return Array.from(this.markets.values()).filter(
      m => m.status === MarketStatus.OPEN
    );
  }

  getUserPosition(userId: string, marketId: string): Position | undefined {
    return this.positions.get(`${userId}-${marketId}`);
  }

  getMarketTrades(marketId: string): Trade[] {
    return Array.from(this.trades.values()).filter(
      t => t.marketId === marketId
    );
  }

  private validateMarketParams(params: CreateMarketParams): void {
    if (!params.question || params.question.length < 10) {
      throw new Error('Question must be at least 10 characters');
    }
    if (params.closeTime <= Date.now() / 1000) {
      throw new Error('Close time must be in the future');
    }
    if (params.resolveTime <= params.closeTime) {
      throw new Error('Resolve time must be after close time');
    }
  }

  private isAdmin(address: string): boolean {
    return this.admins.has(address.toLowerCase());
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
