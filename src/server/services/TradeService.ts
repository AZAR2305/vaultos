/**
 * Trade Service
 * Coordinates between SessionService and MarketService
 */

import { SessionService } from './SessionService';
import { MarketService } from '../../markets/MarketService';

export class TradeService {
  constructor(
    private sessionService: SessionService,
    private marketService: MarketService
  ) {}

  /**
   * Execute trade for user
   */
  async executeTrade(
    sessionId: string,
    params: {
      marketId: string;
      position: 'YES' | 'NO';
      shares: bigint;
      maxPrice: number;
    }
  ) {
    // Get user session
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Invalid session');
    }

    const sessionData = session.getSession();
    if (!sessionData) {
      throw new Error('Session data not found');
    }

    // Execute trade through market service
    const trade = await this.marketService.executeTrade(
      sessionData.userAddress,
      params.marketId,
      params.position,
      params.shares,
      params.maxPrice
    );

    return trade;
  }

  /**
   * Get user's positions
   */
  getUserPosition(userId: string, marketId: string) {
    return this.marketService.getUserPosition(userId, marketId);
  }

  /**
   * Get market trades
   */
  getMarketTrades(marketId: string) {
    return this.marketService.getMarketTrades(marketId);
  }
}
