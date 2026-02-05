/**
 * Session Service - Yellow Network Integration
 * 
 * Manages Yellow Network state channels for VaultOS prediction markets
 * Uses real Nitrolite SDK for off-chain trading
 * 
 * Features:
 * - Session creation with Yellow Network authentication
 * - State channel management (create, fund, close)
 * - Off-chain balance tracking
 * - Cooperative channel closure
 */
import { VaultOSYellowClient, createVaultOSYellowClient } from '../../../../src/yellow/vaultos-yellow';

interface SessionData {
  sessionId: string;
  channelId: string | null;
  walletAddress: string;
  sessionAddress: string;
  depositAmount: string;
  spentAmount: string;
  createdAt: number;
  expiresAt: number;
  yellowClient: VaultOSYellowClient;
}

export class SessionService {
  private sessions: Map<string, SessionData>;

  constructor() {
    this.sessions = new Map();
  }

  /**
   * Create a new Yellow Network session
   * 
   * Steps:
   * 1. Create VaultOSYellowClient instance
   * 2. Connect and authenticate with Yellow Network
   * 3. Channel is auto-created by SDK
   * 4. Fund channel with initial deposit
   * 
   * @param walletAddress - User's Ethereum address
   * @param depositAmount - Initial deposit in USDC (will be converted to ytest.USD)
   * @returns Session data with channel ID and addresses
   */
  async createSession(walletAddress: string, depositAmount: number): Promise<SessionData> {
    console.log(`🟡 Creating Yellow Network session for ${walletAddress}`);
    console.log(`   Initial deposit: ${depositAmount} USDC`);

    // Create Yellow Network client
    const yellowClient = createVaultOSYellowClient();

    try {
      // Connect and authenticate with Yellow Network
      const { sessionAddress, userAddress } = await yellowClient.connect();
      
      console.log(`✅ Connected to Yellow Network`);
      console.log(`   User: ${userAddress}`);
      console.log(`   Session: ${sessionAddress}`);

      // Fund the channel with initial deposit
      await yellowClient.resizeChannel(depositAmount.toString());
      console.log(`✅ Channel funded with ${depositAmount} ytest.USD`);

      // Generate session ID
      const sessionId = `session_${Date.now()}_${walletAddress.slice(0, 8)}`;

      const sessionData: SessionData = {
        sessionId,
        channelId,
        walletAddress,
        sessionAddress,
        depositAmount: depositAmount.toString(),
        spentAmount: '0',
        createdAt: Date.now(),
        expiresAt: Date.now() + (3600 * 1000), // 1 hour
        yellowClient,
      };

      this.sessions.set(sessionId, sessionData);
      
      console.log(`✅ Session created successfully`);
      console.log(`   Session ID: ${sessionId}`);
      console.log(`   Channel ID: ${channelId}`);

      return sessionData;

    } catch (error: any) {
      console.error('❌ Failed to create session:', error.message);
      yellowClient.disconnect();
      throw error;
    }
  }

  /**
   * Close Yellow Network session and settle on-chain
   * 
   * Steps:
   * 1. Close state channel cooperatively
   * 2. Funds are withdrawn to user's wallet
   * 3. Clean up session data
   * 
   * @param sessionId - Session to close
   * @returns Final balance returned to user
   */
  async closeSession(sessionId: string): Promise<number> {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    console.log(`🔒 Closing session ${sessionId}`);

    try {
      // Close Yellow Network channel
      await sessionData.yellowClient.closeChannel();
      
      // Disconnect client
      sessionData.yellowClient.disconnect();
      
      // Remove session
      this.sessions.delete(sessionId);
      
      const finalBalance = parseFloat(sessionData.depositAmount) - parseFloat(sessionData.spentAmount);
      console.log(`✅ Session closed, final balance: ${finalBalance} USDC`);
      
      return finalBalance;

    } catch (error: any) {
      console.error('❌ Failed to close session:', error.message);
      throw error;
    }
  }

  /**
   * Execute a trade on Yellow Network
   * 
   * Uses state channel for instant, gasless trading
   * 
   * @param sessionId - Active session
   * @param amount - Trade amount
   * @param destination - Destination address (market contract)
   */
  async executeTrade(sessionId: string, amount: number, destination: string): Promise<void> {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    console.log(`⚡ Executing trade: ${amount} USDC to ${destination}`);

    // Execute off-chain transfer via Yellow Network
    await sessionData.yellowClient.transfer(destination, amount.toString());

    // Update spent amount
    const currentSpent = parseFloat(sessionData.spentAmount);
    sessionData.spentAmount = (currentSpent + amount).toString();

    console.log(`✅ Trade executed off-chain`);
  }

  /**
   * Deposit additional funds to session
   */
  async depositFunds(sessionId: string, amount: number): Promise<void> {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    console.log(`💰 Depositing ${amount} USDC to session ${sessionId}`);

    // Resize channel to add more funds
    const newTotal = parseFloat(sessionData.depositAmount) + amount;
    await sessionData.yellowClient.resizeChannel(newTotal.toString());

    sessionData.depositAmount = newTotal.toString();
    console.log(`✅ Deposit successful, new balance: ${newTotal} USDC`);
  }

  getSession(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  updateSpentAmount(sessionId: string, amount: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      const currentSpent = parseFloat(session.spentAmount);
      session.spentAmount = (currentSpent + amount).toString();
    }
  }

  /**
   * Get active channel balance
   */
  getAvailableBalance(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session) return 0;
    return parseFloat(session.depositAmount) - parseFloat(session.spentAmount);
  }
}