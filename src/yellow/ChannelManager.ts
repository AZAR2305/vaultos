/**
 * Channel Abstraction Layer
 * Manages Yellow Network state channels with async creation
 * Allows immediate trading using ledger balance
 */

import { VaultOSYellowClient } from './vaultos-yellow';

export enum ChannelState {
  DISCONNECTED = 'disconnected',
  AUTHENTICATING = 'authenticating',
  AUTHENTICATED = 'authenticated',
  CHANNEL_PENDING = 'channel_pending',
  CHANNEL_ACTIVE = 'channel_active',
  ERROR = 'error',
}

export interface ChannelStatus {
  state: ChannelState;
  channelId: string | null;
  canTrade: boolean;
  errorMessage?: string;
}

export interface TradeParams {
  destination: string;
  amount: string;
  marketId: string;
  position: 'YES' | 'NO';
}

export interface TradeResult {
  success: boolean;
  txType: 'ledger' | 'channel';
  channelId?: string;
  timestamp: number;
}

export class ChannelManager {
  private client: VaultOSYellowClient | null = null;
  private state: ChannelState = ChannelState.DISCONNECTED;
  private channelPromise: Promise<string | null> | null = null;

  /**
   * Initialize connection and authentication (fast, ~2-3 seconds)
   */
  async initialize(privateKey: `0x${string}`): Promise<void> {
    this.state = ChannelState.AUTHENTICATING;
    this.client = new VaultOSYellowClient(privateKey);
    
    await this.client.connect();
    this.state = ChannelState.AUTHENTICATED;
    
    // Trigger async channel creation (non-blocking)
    this.ensureChannel();
  }

  /**
   * Get or create channel - non-blocking
   * Returns immediately if one exists, otherwise queues creation
   */
  private async ensureChannel(): Promise<string | null> {
    if (!this.client) return null;

    const existingChannel = this.client.getChannelId();
    if (existingChannel) {
      this.state = ChannelState.CHANNEL_ACTIVE;
      return existingChannel;
    }

    // Return cached promise if creation already in progress
    if (this.channelPromise) {
      return this.channelPromise;
    }

    this.state = ChannelState.CHANNEL_PENDING;
    
    this.channelPromise = (async () => {
      try {
        await this.client!.createChannel();
        const channelId = this.client!.getChannelId();
        if (channelId) {
          this.state = ChannelState.CHANNEL_ACTIVE;
          console.log('✓ Channel created:', channelId);
          return channelId;
        }
        // Channel creation failed but didn't throw - likely token issue
        this.state = ChannelState.AUTHENTICATED;
        return null;
      } catch (error: any) {
        console.error('Channel creation failed:', error.message);
        this.state = ChannelState.ERROR;
        this.channelPromise = null;
        throw error;
      }
    })();

    return this.channelPromise;
  }

  /**
   * Execute trade - works with ledger balance even without on-chain channel
   * Non-blocking, returns immediately
   */
  async executeTrade(params: TradeParams): Promise<TradeResult> {
    if (!this.client) {
      throw new Error('Channel manager not initialized');
    }

    // Check if we can trade
    if (this.state === ChannelState.DISCONNECTED || this.state === ChannelState.AUTHENTICATING) {
      throw new Error('Not authenticated. Call initialize() first.');
    }

    // Execute transfer (works in both ledger and channel mode)
    await this.client.transfer(params.destination, params.amount);
    
    const channelId = this.client.getChannelId();
    
    return {
      success: true,
      txType: channelId ? 'channel' : 'ledger',
      channelId: channelId || undefined,
      timestamp: Date.now(),
    };
  }

  async getStatus(): Promise<ChannelStatus> {
    return {
      state: this.state,
      channelId: this.client?.getChannelId() || null,
      canTrade: this.state >= ChannelState.AUTHENTICATED,
      errorMessage: this.state === ChannelState.ERROR ? 'Channel error occurred' : undefined,
    };
  }

  disconnect(): void {
    if (this.client) {
      this.client.disconnect();
    }
    this.state = ChannelState.DISCONNECTED;
    this.channelPromise = null;
  }
}
