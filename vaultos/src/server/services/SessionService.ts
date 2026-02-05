import { YellowClient } from '../../../../src/yellow/client';
import { SessionManager, SessionConfig } from '../../../../src/yellow/session';
import { StateManager } from '../../../../src/yellow/state';

interface SessionData {
  sessionId: string;
  channelId: string;
  walletAddress: string;
  depositAmount: string;
  spentAmount: string;
  createdAt: number;
  expiresAt: number;
}

export class SessionService {
  private sessions: Map<string, SessionData>;
  private yellowClient: YellowClient;
  private sessionManager: SessionManager;
  private stateManager: StateManager;

  constructor() {
    this.sessions = new Map();
    
    // Initialize Yellow Network client
    this.yellowClient = new YellowClient({
      rpcUrl: 'https://sepolia.infura.io/v3/your-key',
      nodeUrl: 'https://yellow-testnet.example.com',
      chainId: 11155111,
    });
    
    this.sessionManager = new SessionManager(this.yellowClient);
    this.stateManager = new StateManager();
  }

  async createSession(walletAddress: string, depositAmount: number): Promise<SessionData> {
    // Create session with Yellow Network
    const depositAmountBigInt = BigInt(Math.floor(depositAmount * 1_000_000)); // Convert to USDC units
    
    const config: SessionConfig = {
      maxAllowance: depositAmountBigInt,
      duration: 3600, // 1 hour
      maxRefundPercent: 25, // 25% refundable
    };

    const session = await this.sessionManager.createSession(depositAmountBigInt, config);

    // Initialize state for this channel
    const state = this.stateManager.initializeState(
      session.channelId,
      depositAmountBigInt,
      config.maxRefundPercent
    );

    const sessionData: SessionData = {
      sessionId: session.sessionId,
      channelId: session.channelId,
      walletAddress,
      depositAmount: depositAmount.toString(),
      spentAmount: '0',
      createdAt: Date.now(),
      expiresAt: Date.now() + (config.duration * 1000),
    };

    this.sessions.set(session.sessionId, sessionData);
    
    console.log(`✅ Session created for wallet ${walletAddress}`);
    return sessionData;
  }

  async closeSession(sessionId: string): Promise<number> {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    // Close Yellow Network session
    const finalBalance = await this.sessionManager.closeSession(sessionId);
    
    this.sessions.delete(sessionId);
    
    return Number(finalBalance) / 1_000_000; // Convert back to USDC
  }

  getSession(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  getStateManager(): StateManager {
    return this.stateManager;
  }

  updateSpentAmount(sessionId: string, amount: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      const currentSpent = parseFloat(session.spentAmount);
      session.spentAmount = (currentSpent + amount).toString();
    }
  }
}