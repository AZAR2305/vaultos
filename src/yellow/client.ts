/**
 * Yellow Network Client
 * 
 * Handles communication with Yellow Network testnet nodes.
 * In production, this would interact with actual Yellow Network infrastructure.
 * For the hackathon MVP, we simulate the essential behaviors.
 */

import { Wallet, HDNodeWallet, JsonRpcProvider, solidityPackedKeccak256 } from 'ethers';

export interface YellowConfig {
  rpcUrl: string;
  nodeUrl: string;
  chainId: number;
}

export interface ChannelState {
  channelId: string;
  participants: string[];
  balances: Map<string, bigint>;
  nonce: number;
  isOpen: boolean;
}

export class YellowClient {
  private config: YellowConfig;
  private provider: JsonRpcProvider;
  
  // Simulate Yellow Network testnet latency (50-200ms for off-chain operations)
  private readonly TESTNET_LATENCY_MIN = 50;
  private readonly TESTNET_LATENCY_MAX = 200;
  
  constructor(config: YellowConfig) {
    this.config = config;
    this.provider = new JsonRpcProvider(config.rpcUrl);
  }

  /**
   * Simulate Yellow Network testnet latency
   * Real testnet has variable latency due to network conditions
   */
  private async simulateTestnetLatency(): Promise<void> {
    const latency = Math.floor(
      Math.random() * (this.TESTNET_LATENCY_MAX - this.TESTNET_LATENCY_MIN) + this.TESTNET_LATENCY_MIN
    );
    await new Promise(resolve => setTimeout(resolve, latency));
  }

  /**
   * Connect to Yellow Network
   * Verifies network connectivity and retrieves chain state
   */
  async connect(): Promise<boolean> {
    try {
      const network = await this.provider.getNetwork();
      console.log(`✅ Connected to Yellow Network (Chain ID: ${network.chainId})`);
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to Yellow Network:', error);
      return false;
    }
  }

  /**
   * Create a session wallet with limited permissions
   * 
   * Security model:
   * - Session key is separate from main wallet
   * - Has spending limits (defined in state channel)
   * - Can be revoked at any time
   * - Reduces exposure of main wallet private key
   */
  createSessionWallet(): HDNodeWallet {
    const sessionWallet = Wallet.createRandom();
    console.log(`🔑 Session wallet created: ${sessionWallet.address}`);
    return sessionWallet.connect(this.provider) as HDNodeWallet;
  }

  /**
   * Open a state channel between user and Yellow node
   * 
   * Process:
   * 1. User deposits USDC into Yellow smart contract safe
   * 2. Channel is opened with defined parameters
   * 3. Session key is authorized for this channel
   * 4. Off-chain updates can now happen instantly
   * 
   * @param userWallet - The session wallet for signing
   * @param depositAmount - Initial USDC deposit (in smallest unit)
   * @param allowance - Maximum spending allowance for this session
   */
  async openChannel(
    userWallet: Wallet | HDNodeWallet,
    depositAmount: bigint,
    allowance: bigint
  ): Promise<ChannelState> {
    console.log(`🌐 Connecting to Yellow Network testnet...`);
    await this.simulateTestnetLatency();
    
    const channelId = this.generateChannelId(userWallet.address);
    
    // In real implementation, this would:
    // 1. Call Yellow smart contract to create channel
    // 2. Lock funds in the contract
    // 3. Get confirmation from Yellow node
    
    console.log(`📡 Opening state channel on Yellow node...`);
    await this.simulateTestnetLatency();
    
    const channel: ChannelState = {
      channelId,
      participants: [userWallet.address, this.getYellowNodeAddress()],
      balances: new Map([
        [userWallet.address, depositAmount],
        [this.getYellowNodeAddress(), 0n]
      ]),
      nonce: 0,
      isOpen: true
    };

    console.log(`📡 Channel opened: ${channelId}`);
    console.log(`💰 Deposited: ${this.formatUSDC(depositAmount)} USDC`);
    console.log(`🎫 Allowance: ${this.formatUSDC(allowance)} USDC`);
    
    return channel;
  }

  /**
   * Send an off-chain state update to Yellow node
   * 
   * Why Yellow node is NOT trusted:
   * - Every state update is signed by the user
   * - User can prove the correct state on-chain if needed
   * - Yellow node cannot forge transactions
   * - User maintains cryptographic proof of all updates
   * 
   * Dispute resolution:
   * - If Yellow node misbehaves, user submits signed state to L1
   * - Smart contract verifies signatures and enforces correct state
   * - User always has the latest signed state as backup
   */
  async sendStateUpdate(
    channel: ChannelState,
    userWallet: Wallet | HDNodeWallet,
    newBalance: bigint
  ): Promise<boolean> {
    channel.nonce++;
    
    // Create state update message
    const stateHash = this.hashChannelState(
      channel.channelId,
      channel.nonce,
      newBalance
    );

    // Sign with session key
    const signature = await userWallet.signMessage(stateHash);

    // Send to Yellow node (simulate network latency)
    console.log(`📤 Sending state update to Yellow node...`);
    await this.simulateTestnetLatency();
    
    console.log(`✅ State update confirmed (nonce: ${channel.nonce})`);
    console.log(`   New balance: ${this.formatUSDC(newBalance)} USDC`);
    console.log(`   Signature: ${signature.substring(0, 20)}...`);

    // Update local state
    channel.balances.set(userWallet.address, newBalance);
    
    return true;
  }

  /**
   * Close the channel and prepare for settlement
   * 
   * Settlement phases:
   * Phase 1 (current): Simulate settlement
   * Phase 2 (Sui): Actual on-chain settlement using Sui's parallel execution
   */
  async closeChannel(channel: ChannelState, userWallet: Wallet | HDNodeWallet): Promise<bigint> {
    if (!channel.isOpen) {
      throw new Error('Channel already closed');
    }

    const finalBalance = channel.balances.get(userWallet.address) || 0n;
    
    console.log(`🔒 Initiating channel closure on Yellow node...`);
    await this.simulateTestnetLatency();
    
    console.log(`📡 Submitting final state to Yellow smart contract...`);
    await this.simulateTestnetLatency();
    
    console.log(`✅ Channel closed: ${channel.channelId}`);
    console.log(`💵 Final balance: ${this.formatUSDC(finalBalance)} USDC`);
    console.log(`📝 Total state updates: ${channel.nonce}`);
    
    channel.isOpen = false;

    // In Phase 2, this would:
    // 1. Submit final state to Sui contract
    // 2. Sui verifies signatures
    // 3. Sui processes settlement in parallel with other channels
    // 4. User receives funds back to main wallet
    
    return finalBalance;
  }

  /**
   * Generate deterministic channel ID
   */
  private generateChannelId(userAddress: string): string {
    const timestamp = Date.now();
    return solidityPackedKeccak256(
      ['address', 'uint256'],
      [userAddress, timestamp]
    );
  }

  /**
   * Hash channel state for signing
   */
  private hashChannelState(
    channelId: string,
    nonce: number,
    balance: bigint
  ): string {
    return solidityPackedKeccak256(
      ['bytes32', 'uint256', 'uint256'],
      [channelId, nonce, balance]
    );
  }

  /**
   * Get Yellow Network node address (simulated)
   */
  private getYellowNodeAddress(): string {
    return '0xYellowNode0000000000000000000000000000000';
  }

  /**
   * Deposit additional funds to existing channel
   * This updates the channel balance off-chain
   */
  async depositToChannel(
    channel: ChannelState,
    userWallet: Wallet | HDNodeWallet,
    depositAmount: bigint
  ): Promise<boolean> {
    if (!channel.isOpen) {
      throw new Error('Channel is closed');
    }

    console.log(`💰 Depositing ${this.formatUSDC(depositAmount)} USDC to Yellow channel...`);
    await this.simulateTestnetLatency();

    // Update channel balance
    const currentBalance = channel.balances.get(userWallet.address) || 0n;
    const newBalance = currentBalance + depositAmount;
    
    // Send state update to Yellow node
    await this.sendStateUpdate(channel, userWallet, newBalance);
    
    console.log(`✅ Deposit confirmed`);
    console.log(`   Previous: ${this.formatUSDC(currentBalance)} USDC`);
    console.log(`   Deposited: ${this.formatUSDC(depositAmount)} USDC`);
    console.log(`   New balance: ${this.formatUSDC(newBalance)} USDC`);
    
    return true;
  }

  /**
   * Withdraw funds from channel (partial withdrawal)
   * Updates off-chain state and returns available balance
   */
  async withdrawFromChannel(
    channel: ChannelState,
    userWallet: Wallet | HDNodeWallet,
    withdrawAmount: bigint
  ): Promise<boolean> {
    if (!channel.isOpen) {
      throw new Error('Channel is closed');
    }

    const currentBalance = channel.balances.get(userWallet.address) || 0n;
    
    if (currentBalance < withdrawAmount) {
      throw new Error(`Insufficient balance. Have ${this.formatUSDC(currentBalance)} USDC, trying to withdraw ${this.formatUSDC(withdrawAmount)} USDC`);
    }

    console.log(`💸 Withdrawing ${this.formatUSDC(withdrawAmount)} USDC from Yellow channel...`);
    await this.simulateTestnetLatency();

    const newBalance = currentBalance - withdrawAmount;
    
    // Send state update to Yellow node
    await this.sendStateUpdate(channel, userWallet, newBalance);
    
    console.log(`✅ Withdrawal confirmed`);
    console.log(`   Previous: ${this.formatUSDC(currentBalance)} USDC`);
    console.log(`   Withdrawn: ${this.formatUSDC(withdrawAmount)} USDC`);
    console.log(`   Remaining: ${this.formatUSDC(newBalance)} USDC`);
    
    return true;
  }

  /**
   * Format USDC amount (6 decimals)
   */
  private formatUSDC(amount: bigint): string {
    return (Number(amount) / 1_000_000).toFixed(2);
  }
}
