/**
 * Trading Actions
 * 
 * Implements all off-chain trading operations:
 * - Buy/sell YES/NO shares
 * - Balance management
 * - State updates via Yellow Network
 * 
 * Every action is cryptographically signed and verifiable.
 */

import { YellowClient } from './client';
import { Session } from './session';
import { PredictionMarket, Market } from './market';
import { StateManager, UserState } from './state';

export interface TradeResult {
  success: boolean;
  message: string;
  shares?: number;
  cost?: bigint;
  newBalance?: bigint;
}

export class TradingEngine {
  private client: YellowClient;
  private marketManager: PredictionMarket;
  private stateManager: StateManager;

  constructor(
    client: YellowClient,
    marketManager: PredictionMarket,
    stateManager: StateManager
  ) {
    this.client = client;
    this.marketManager = marketManager;
    this.stateManager = stateManager;
  }

  /**
   * Buy YES shares
   * 
   * Process:
   * 1. Validate market and balance
   * 2. Calculate cost based on market price
   * 3. Update off-chain state
   * 4. Sign state update with session key
   * 5. Send to Yellow node
   * 6. Update local position
   */
  async buyYes(
    session: Session,
    marketId: string,
    shares: number
  ): Promise<TradeResult> {
    // Get market
    const market = this.marketManager.getMarket(marketId);
    if (!market) {
      return { success: false, message: 'Market not found' };
    }

    // Get user state
    const state = this.stateManager.getState(session.channelId);
    if (!state) {
      return { success: false, message: 'State not found' };
    }

    // Calculate cost
    const cost = this.marketManager.calculateShareCost(market, shares, true);

    // Validate balance
    if (state.activeBalance < cost) {
      return {
        success: false,
        message: `Insufficient balance. Need ${this.formatUSDC(cost)} USDC, have ${this.formatUSDC(state.activeBalance)} USDC`
      };
    }

    // Deduct from active balance
    state.activeBalance -= cost;

    // Update position
    const position = this.stateManager.getPosition(state, marketId);
    position.yesShares += shares;
    position.investedAmount += cost;

    // Update state version with signature
    const signature = await this.signStateUpdate(session, state);
    this.stateManager.updateStateVersion(state, signature);

    // Send state update to Yellow node
    await this.client.sendStateUpdate(
      session.channel,
      session.sessionWallet,
      state.activeBalance
    );

    // Record trade in market
    this.marketManager.recordTrade(marketId, cost, shares, true);

    console.log(`✅ Bought ${shares} YES shares`);
    console.log(`   Cost: ${this.formatUSDC(cost)} USDC`);
    console.log(`   Price: ${(market.yesPrice * 100).toFixed(1)}%`);
    console.log(`   New balance: ${this.formatUSDC(state.activeBalance)} USDC`);

    return {
      success: true,
      message: 'Trade executed',
      shares,
      cost,
      newBalance: state.activeBalance
    };
  }

  /**
   * Buy NO shares
   */
  async buyNo(
    session: Session,
    marketId: string,
    shares: number
  ): Promise<TradeResult> {
    const market = this.marketManager.getMarket(marketId);
    if (!market) {
      return { success: false, message: 'Market not found' };
    }

    const state = this.stateManager.getState(session.channelId);
    if (!state) {
      return { success: false, message: 'State not found' };
    }

    const cost = this.marketManager.calculateShareCost(market, shares, false);

    if (state.activeBalance < cost) {
      return {
        success: false,
        message: `Insufficient balance. Need ${this.formatUSDC(cost)} USDC, have ${this.formatUSDC(state.activeBalance)} USDC`
      };
    }

    state.activeBalance -= cost;

    const position = this.stateManager.getPosition(state, marketId);
    position.noShares += shares;
    position.investedAmount += cost;

    const signature = await this.signStateUpdate(session, state);
    this.stateManager.updateStateVersion(state, signature);

    await this.client.sendStateUpdate(
      session.channel,
      session.sessionWallet,
      state.activeBalance
    );

    this.marketManager.recordTrade(marketId, cost, shares, false);

    console.log(`✅ Bought ${shares} NO shares`);
    console.log(`   Cost: ${this.formatUSDC(cost)} USDC`);
    console.log(`   Price: ${(market.noPrice * 100).toFixed(1)}%`);
    console.log(`   New balance: ${this.formatUSDC(state.activeBalance)} USDC`);

    return {
      success: true,
      message: 'Trade executed',
      shares,
      cost,
      newBalance: state.activeBalance
    };
  }

  /**
   * Sell YES shares
   * 
   * Returns USDC based on current market price
   */
  async sellYes(
    session: Session,
    marketId: string,
    shares: number
  ): Promise<TradeResult> {
    const market = this.marketManager.getMarket(marketId);
    if (!market) {
      return { success: false, message: 'Market not found' };
    }

    const state = this.stateManager.getState(session.channelId);
    if (!state) {
      return { success: false, message: 'State not found' };
    }

    const position = this.stateManager.getPosition(state, marketId);
    
    if (position.yesShares < shares) {
      return {
        success: false,
        message: `Insufficient YES shares. Have ${position.yesShares}, trying to sell ${shares}`
      };
    }

    // Calculate payout
    const payout = this.marketManager.calculateShareCost(market, shares, true);

    // Update position
    position.yesShares -= shares;

    // Add to active balance
    state.activeBalance += payout;

    const signature = await this.signStateUpdate(session, state);
    this.stateManager.updateStateVersion(state, signature);

    await this.client.sendStateUpdate(
      session.channel,
      session.sessionWallet,
      state.activeBalance
    );

    console.log(`✅ Sold ${shares} YES shares`);
    console.log(`   Received: ${this.formatUSDC(payout)} USDC`);
    console.log(`   New balance: ${this.formatUSDC(state.activeBalance)} USDC`);

    return {
      success: true,
      message: 'Shares sold',
      shares,
      cost: payout,
      newBalance: state.activeBalance
    };
  }

  /**
   * Sell NO shares
   */
  async sellNo(
    session: Session,
    marketId: string,
    shares: number
  ): Promise<TradeResult> {
    const market = this.marketManager.getMarket(marketId);
    if (!market) {
      return { success: false, message: 'Market not found' };
    }

    const state = this.stateManager.getState(session.channelId);
    if (!state) {
      return { success: false, message: 'State not found' };
    }

    const position = this.stateManager.getPosition(state, marketId);
    
    if (position.noShares < shares) {
      return {
        success: false,
        message: `Insufficient NO shares. Have ${position.noShares}, trying to sell ${shares}`
      };
    }

    const payout = this.marketManager.calculateShareCost(market, shares, false);

    position.noShares -= shares;
    state.activeBalance += payout;

    const signature = await this.signStateUpdate(session, state);
    this.stateManager.updateStateVersion(state, signature);

    await this.client.sendStateUpdate(
      session.channel,
      session.sessionWallet,
      state.activeBalance
    );

    console.log(`✅ Sold ${shares} NO shares`);
    console.log(`   Received: ${this.formatUSDC(payout)} USDC`);
    console.log(`   New balance: ${this.formatUSDC(state.activeBalance)} USDC`);

    return {
      success: true,
      message: 'Shares sold',
      shares,
      cost: payout,
      newBalance: state.activeBalance
    };
  }

  /**
   * Move funds to idle balance (for yield earning)
   */
  async moveToIdle(
    session: Session,
    amount: bigint
  ): Promise<TradeResult> {
    const state = this.stateManager.getState(session.channelId);
    if (!state) {
      return { success: false, message: 'State not found' };
    }

    try {
      this.stateManager.moveToIdle(state, amount);

      const signature = await this.signStateUpdate(session, state);
      this.stateManager.updateStateVersion(state, signature);

      return {
        success: true,
        message: 'Funds moved to idle balance',
        newBalance: state.activeBalance
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Move funds back to active balance
   */
  async moveToActive(
    session: Session,
    amount: bigint
  ): Promise<TradeResult> {
    const state = this.stateManager.getState(session.channelId);
    if (!state) {
      return { success: false, message: 'State not found' };
    }

    try {
      this.stateManager.moveToActive(state, amount);

      const signature = await this.signStateUpdate(session, state);
      this.stateManager.updateStateVersion(state, signature);

      return {
        success: true,
        message: 'Funds moved to active balance',
        newBalance: state.activeBalance
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Accrue yield on idle balance
   */
  async accrueYield(session: Session): Promise<TradeResult> {
    const state = this.stateManager.getState(session.channelId);
    if (!state) {
      return { success: false, message: 'State not found' };
    }

    const yieldAmount = this.stateManager.accrueYield(state);

    if (yieldAmount > 0n) {
      const signature = await this.signStateUpdate(session, state);
      this.stateManager.updateStateVersion(state, signature);
    }

    return {
      success: true,
      message: 'Yield accrued',
      cost: yieldAmount
    };
  }

  /**
   * Request partial refund (max 25%)
   */
  async requestPartialRefund(session: Session): Promise<TradeResult> {
    const state = this.stateManager.getState(session.channelId);
    if (!state) {
      return { success: false, message: 'State not found' };
    }

    try {
      const refundAmount = this.stateManager.requestRefund(state);

      const signature = await this.signStateUpdate(session, state);
      this.stateManager.updateStateVersion(state, signature);

      return {
        success: true,
        message: 'Refund processed',
        cost: refundAmount,
        newBalance: state.activeBalance
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Get current state summary
   */
  getStateSummary(session: Session): object | null {
    const state = this.stateManager.getState(session.channelId);
    if (!state) {
      return null;
    }

    return this.stateManager.getSummary(state);
  }

  /**
   * Sign state update with session key
   * 
   * This signature proves:
   * - User authorized this state change
   * - State update is authentic
   * - Can be verified by anyone
   * - Cannot be forged by Yellow node
   */
  private async signStateUpdate(session: Session, state: UserState): Promise<string> {
    const message = `State update: ${state.channelId}:${state.nonce}:${state.activeBalance}`;
    return await session.sessionWallet.signMessage(message);
  }

  /**
   * Format USDC amount
   */
  private formatUSDC(amount: bigint): string {
    return (Number(amount) / 1_000_000).toFixed(2);
  }
}
