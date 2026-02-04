/**
 * Yellow Session Management
 * 
 * Manages the lifecycle of a trading session:
 * - Session creation with limited permissions
 * - Allowance tracking
 * - Session expiration
 * - Security boundaries
 */

import { Wallet } from 'ethers';
import { YellowClient, ChannelState } from './client';

export interface SessionConfig {
  maxAllowance: bigint;      // Maximum USDC that can be spent
  duration: number;           // Session duration in seconds
  maxRefundPercent: number;   // Max % of funds that can be refunded early (25%)
}

export interface Session {
  sessionId: string;
  channelId: string;
  sessionWallet: Wallet;
  channel: ChannelState;
  config: SessionConfig;
  createdAt: number;
  spentAmount: bigint;
  refundRequested: boolean;
}

export class SessionManager {
  private client: YellowClient;
  private sessions: Map<string, Session>;

  constructor(client: YellowClient) {
    this.client = client;
    this.sessions = new Map();
  }

  /**
   * Create a new trading session
   * 
   * Security features:
   * - Session key is isolated from main wallet
   * - Spending is capped by maxAllowance
   * - Session automatically expires
   * - Refund is limited to 25% max
   * - Main wallet stays offline and safe
   */
  async createSession(
    depositAmount: bigint,
    config: SessionConfig
  ): Promise<Session> {
    // Create session wallet (temporary key)
    const sessionWallet = this.client.createSessionWallet();

    // Open state channel
    const channel = await this.client.openChannel(
      sessionWallet,
      depositAmount,
      config.maxAllowance
    );

    const session: Session = {
      sessionId: this.generateSessionId(),
      channelId: channel.channelId,
      sessionWallet,
      channel,
      config,
      createdAt: Date.now(),
      spentAmount: 0n,
      refundRequested: false
    };

    this.sessions.set(session.sessionId, session);

    console.log(`🎮 Session created: ${session.sessionId}`);
    console.log(`⏱️  Duration: ${config.duration}s`);
    console.log(`🛡️  Max allowance: ${this.formatUSDC(config.maxAllowance)} USDC`);

    return session;
  }

  /**
   * Get active session
   */
  getSession(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return undefined;
    }

    // Check if session expired
    const elapsed = Date.now() - session.createdAt;
    if (elapsed > session.config.duration * 1000) {
      console.warn(`⚠️  Session ${sessionId} has expired`);
      return undefined;
    }

    return session;
  }

  /**
   * Check if session can spend amount
   */
  canSpend(session: Session, amount: bigint): boolean {
    const totalSpent = session.spentAmount + amount;
    
    if (totalSpent > session.config.maxAllowance) {
      console.error(`❌ Spending limit exceeded`);
      console.error(`   Attempted: ${this.formatUSDC(amount)} USDC`);
      console.error(`   Already spent: ${this.formatUSDC(session.spentAmount)} USDC`);
      console.error(`   Allowance: ${this.formatUSDC(session.config.maxAllowance)} USDC`);
      return false;
    }

    return true;
  }

  /**
   * Record spending in session
   */
  recordSpending(session: Session, amount: bigint): void {
    session.spentAmount += amount;
  }

  /**
   * Request partial refund (max 25% of deposit)
   * Can only be requested once per session
   * 
   * Why 25% limit?
   * - Prevents abuse of refund mechanism
   * - Ensures market liquidity
   * - Users still committed to their positions
   * - Emergency exit available if needed
   */
  requestPartialRefund(session: Session): bigint {
    if (session.refundRequested) {
      throw new Error('Refund already requested for this session');
    }

    const userBalance = session.channel.balances.get(session.sessionWallet.address) || 0n;
    const maxRefund = (userBalance * BigInt(session.config.maxRefundPercent)) / 100n;

    session.refundRequested = true;
    
    console.log(`💸 Partial refund requested`);
    console.log(`   Refund amount: ${this.formatUSDC(maxRefund)} USDC`);
    console.log(`   Remaining: ${this.formatUSDC(userBalance - maxRefund)} USDC`);

    return maxRefund;
  }

  /**
   * Close session and settlement
   */
  async closeSession(sessionId: string): Promise<bigint> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    const finalBalance = await this.client.closeChannel(
      session.channel,
      session.sessionWallet
    );

    this.sessions.delete(sessionId);
    
    console.log(`✅ Session closed: ${sessionId}`);
    
    return finalBalance;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format USDC amount
   */
  private formatUSDC(amount: bigint): string {
    return (Number(amount) / 1_000_000).toFixed(2);
  }
}
