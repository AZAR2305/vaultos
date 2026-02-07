/**
 * Server-side Session Service
 * Manages user sessions and Yellow Network integration
 */

import { SessionManager } from '../../auth/SessionManager';

export class SessionService {
  private sessions: Map<string, SessionManager> = new Map();

  /**
   * Create new session for user
   */
  async createSession(
    userAddress: string,
    signature: string,
    expiresAt: number
  ): Promise<string> {
    const sessionManager = new SessionManager();
    await sessionManager.createSession(userAddress, signature, expiresAt);
    
    const sessionId = this.generateSessionId();
    this.sessions.set(sessionId, sessionManager);
    
    return sessionId;
  }

  /**
   * Get session manager for user
   */
  getSession(sessionId: string): SessionManager | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Validate session is still active
    if (!session.validateSession()) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Execute trade through user's session
   */
  async executeTrade(
    sessionId: string,
    params: {
      destination: string;
      amount: string;
      marketId: string;
      position: 'YES' | 'NO';
    }
  ) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('Invalid or expired session');
    }

    const channelManager = session.getChannelManager();
    return await channelManager.executeTrade(params);
  }

  /**
   * Destroy session
   */
  async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.logout();
      this.sessions.delete(sessionId);
    }
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
