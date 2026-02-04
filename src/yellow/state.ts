/**
 * Off-chain State Model
 * 
 * Tracks user's position and balances within Yellow state channel.
 * All updates happen off-chain and are signed by session key.
 */

export interface UserState {
  // Channel identity
  channelId: string;
  userAddress: string;
  sessionKey: string;

  // Balance tracking
  depositedAmount: bigint;    // Initial deposit
  activeBalance: bigint;      // Available for trading
  idleBalance: bigint;        // Set aside (earning yield in Phase 2)
  
  // Position tracking
  positions: Map<string, MarketPosition>;
  
  // Refund tracking
  refundableAmount: bigint;   // Max 25% of deposit
  refundClaimed: boolean;
  
  // Yield simulation (Phase 2: real Sui DeFi integration)
  accruedYield: bigint;       // Simulated yield on idle balance
  lastYieldUpdate: number;

  // State versioning
  nonce: number;              // Monotonically increasing
  version: string;
  signatures: string[];       // Audit trail of all state updates
}

export interface MarketPosition {
  marketId: string;
  yesShares: number;
  noShares: number;
  investedAmount: bigint;     // Total USDC spent on this market
}

export class StateManager {
  private states: Map<string, UserState>;
  
  // Simulated APR for idle balance (Phase 2: real Sui yield protocol)
  private readonly SIMULATED_APR = 0.05; // 5% APR

  constructor() {
    this.states = new Map();
  }

  /**
   * Initialize user state for a new session
   */
  createState(
    channelId: string,
    userAddress: string,
    sessionKey: string,
    depositAmount: bigint
  ): UserState {
    const state: UserState = {
      channelId,
      userAddress,
      sessionKey,
      depositedAmount: depositAmount,
      activeBalance: depositAmount,
      idleBalance: 0n,
      positions: new Map(),
      refundableAmount: (depositAmount * 25n) / 100n, // Max 25% refundable
      refundClaimed: false,
      accruedYield: 0n,
      lastYieldUpdate: Date.now(),
      nonce: 0,
      version: '1.0.0',
      signatures: []
    };

    this.states.set(channelId, state);
    
    console.log(`📝 State initialized for channel: ${channelId}`);
    console.log(`   Deposit: ${this.formatUSDC(depositAmount)} USDC`);
    console.log(`   Max refundable: ${this.formatUSDC(state.refundableAmount)} USDC`);

    return state;
  }

  /**
   * Get user state by channel ID
   */
  getState(channelId: string): UserState | undefined {
    return this.states.get(channelId);
  }

  /**
   * Update state nonce and add signature
   * 
   * Critical for security:
   * - Every state change increments nonce
   * - Nonce prevents replay attacks
   * - Signatures prove user authorized the change
   * - State can be verified on-chain if disputed
   */
  updateStateVersion(state: UserState, signature: string): void {
    state.nonce++;
    state.signatures.push(signature);
    
    // Keep only last 10 signatures for memory efficiency
    if (state.signatures.length > 10) {
      state.signatures = state.signatures.slice(-10);
    }
  }

  /**
   * Move funds from active to idle balance
   * 
   * Idle balance earns yield (simulated in Phase 1, real in Phase 2)
   * This lets users optimize returns on unused capital
   */
  moveToIdle(state: UserState, amount: bigint): void {
    if (state.activeBalance < amount) {
      throw new Error('Insufficient active balance');
    }

    state.activeBalance -= amount;
    state.idleBalance += amount;

    console.log(`💤 Moved to idle: ${this.formatUSDC(amount)} USDC`);
    console.log(`   Active: ${this.formatUSDC(state.activeBalance)} USDC`);
    console.log(`   Idle: ${this.formatUSDC(state.idleBalance)} USDC`);
  }

  /**
   * Move funds from idle back to active balance
   */
  moveToActive(state: UserState, amount: bigint): void {
    if (state.idleBalance < amount) {
      throw new Error('Insufficient idle balance');
    }

    state.idleBalance -= amount;
    state.activeBalance += amount;

    console.log(`⚡ Moved to active: ${this.formatUSDC(amount)} USDC`);
  }

  /**
   * Accrue yield on idle balance
   * 
   * Phase 1: Simulated based on time elapsed and APR
   * Phase 2: Real yield from Sui DeFi protocols:
   * - Scallop lending
   * - NAVI protocol
   * - Cetus LP rewards
   * - Sui native staking
   */
  accrueYield(state: UserState): bigint {
    const now = Date.now();
    const timeDelta = (now - state.lastYieldUpdate) / 1000; // seconds
    
    if (state.idleBalance === 0n || timeDelta === 0) {
      return 0n;
    }

    // Calculate yield: balance * APR * (time / year)
    const secondsPerYear = 365.25 * 24 * 60 * 60;
    const yieldFactor = this.SIMULATED_APR * (timeDelta / secondsPerYear);
    const yieldAmount = BigInt(Math.floor(Number(state.idleBalance) * yieldFactor));

    state.accruedYield += yieldAmount;
    state.lastYieldUpdate = now;

    console.log(`💰 Yield accrued: ${this.formatUSDC(yieldAmount)} USDC`);
    console.log(`   Total yield: ${this.formatUSDC(state.accruedYield)} USDC`);
    console.log(`   APR: ${(this.SIMULATED_APR * 100).toFixed(2)}%`);

    return yieldAmount;
  }

  /**
   * Get or create market position
   */
  getPosition(state: UserState, marketId: string): MarketPosition {
    let position = state.positions.get(marketId);
    
    if (!position) {
      position = {
        marketId,
        yesShares: 0,
        noShares: 0,
        investedAmount: 0n
      };
      state.positions.set(marketId, position);
    }

    return position;
  }

  /**
   * Request partial refund (max 25%)
   */
  requestRefund(state: UserState): bigint {
    if (state.refundClaimed) {
      throw new Error('Refund already claimed');
    }

    if (state.activeBalance < state.refundableAmount) {
      throw new Error('Insufficient balance for refund');
    }

    state.activeBalance -= state.refundableAmount;
    state.refundClaimed = true;

    console.log(`💸 Refund processed: ${this.formatUSDC(state.refundableAmount)} USDC`);

    return state.refundableAmount;
  }

  /**
   * Calculate total user value
   */
  getTotalValue(state: UserState): bigint {
    return state.activeBalance + state.idleBalance + state.accruedYield;
  }

  /**
   * Get state summary for display
   */
  getSummary(state: UserState): object {
    return {
      channelId: state.channelId,
      balances: {
        active: this.formatUSDC(state.activeBalance),
        idle: this.formatUSDC(state.idleBalance),
        yield: this.formatUSDC(state.accruedYield),
        total: this.formatUSDC(this.getTotalValue(state))
      },
      positions: Array.from(state.positions.entries()).map(([marketId, pos]) => ({
        marketId,
        yesShares: pos.yesShares,
        noShares: pos.noShares,
        invested: this.formatUSDC(pos.investedAmount)
      })),
      refund: {
        available: !state.refundClaimed,
        amount: this.formatUSDC(state.refundableAmount)
      },
      version: {
        nonce: state.nonce,
        signatures: state.signatures.length
      }
    };
  }

  /**
   * Format USDC amount
   */
  private formatUSDC(amount: bigint): string {
    return (Number(amount) / 1_000_000).toFixed(2);
  }
}
