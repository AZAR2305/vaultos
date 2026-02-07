/**
 * Off-Chain Session Management
 * Handles wallet connection and session key authorization
 * NO gas fees required for login
 */

import { ChannelManager } from '../yellow/ChannelManager';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

export interface SessionCredentials {
  userAddress: string;
  sessionKey: string;
  expiresAt: number;
  signature: string;
}

export interface SessionStatus {
  isActive: boolean;
  userAddress: string | null;
  sessionKey: string | null;
  canTrade: boolean;
}

export class SessionManager {
  private channelManager: ChannelManager | null = null;
  private session: SessionCredentials | null = null;
  private sessionPrivateKey: `0x${string}` | null = null;

  /**
   * Create off-chain session with EIP-712 signature
   * User signs message authorizing session key (NO gas)
   */
  async createSession(
    userAddress: string,
    signature: string,
    expiresAt: number
  ): Promise<SessionCredentials> {
    // Generate ephemeral session key
    this.sessionPrivateKey = generatePrivateKey();
    const sessionAccount = privateKeyToAccount(this.sessionPrivateKey);

    this.session = {
      userAddress,
      sessionKey: sessionAccount.address,
      expiresAt,
      signature,
    };

    // Initialize Yellow Network with session key
    await this.initializeYellowSession();

    return this.session;
  }

  private async initializeYellowSession(): Promise<void> {
    if (!this.sessionPrivateKey) {
      throw new Error('Session private key not generated');
    }

    this.channelManager = new ChannelManager();
    await this.channelManager.initialize(this.sessionPrivateKey);
  }

  /**
   * Verify session is valid before operations
   */
  validateSession(): boolean {
    if (!this.session) return false;
    return Date.now() / 1000 < this.session.expiresAt;
  }

  getChannelManager(): ChannelManager {
    if (!this.channelManager) {
      throw new Error('Session not initialized. Call createSession() first.');
    }
    return this.channelManager;
  }

  getSession(): SessionCredentials | null {
    return this.session;
  }

  async getStatus(): Promise<SessionStatus> {
    const isActive = this.validateSession();
    const canTrade = isActive && this.channelManager !== null;

    return {
      isActive,
      userAddress: this.session?.userAddress || null,
      sessionKey: this.session?.sessionKey || null,
      canTrade,
    };
  }

  /**
   * Logout - destroy session and disconnect
   */
  async logout(): Promise<void> {
    if (this.channelManager) {
      this.channelManager.disconnect();
    }
    this.session = null;
    this.sessionPrivateKey = null;
    this.channelManager = null;
  }
}
