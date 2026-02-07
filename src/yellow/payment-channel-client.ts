import WebSocket from 'isomorphic-ws';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { createWalletClient, http, type WalletClient } from 'viem';
import { baseSepolia } from 'viem/chains';
import {
  createEIP712AuthMessageSigner,
  createAuthRequestMessage,
  createAuthVerifyMessageFromChallenge,
  type AuthParams,
} from '@erc7824/nitrolite';

const YELLOW_WS_URL = 'wss://clearnet-sandbox.yellow.com/ws';
const CLEARNODE_ADDRESS = '0x019B65A2026d31BF7BeADDE9B30E5fA6f0A6f6';

// Payment channel interfaces
export interface Channel {
  participants: [string, string]; // [User, Clearnode]
  adjudicator: string;
  challenge: number; // Challenge period in seconds
  nonce: number;
}

export interface StateAllocation {
  participant: string;
  token: string;
  amount: string;
}

export interface ChannelState {
  intent: number; // StateIntent: INITIALIZE=1, RESIZE=2, FINALIZE=3
  version: number;
  state_data: string;
  allocations: StateAllocation[];
}

export interface ChannelInfo {
  channel_id: string;
  channel: Channel;
  state: ChannelState;
  status: 'open' | 'resizing' | 'challenged' | 'closed';
}

export interface PaymentMessage {
  type: 'payment';
  amount: string;
  recipient: string;
  timestamp: number;
  signature?: string;
  sender?: string;
}

/**
 * Payment Channel Client for Yellow Network
 * 
 * Enables:
 * - Creating payment channels with the clearnode
 * - Depositing/withdrawing funds (resize_channel)
 * - Sending instant off-chain payments
 * - Cooperative channel closure
 */
export class PaymentChannelClient {
  private ws: WebSocket | null = null;
  private account: PrivateKeyAccount;
  private walletClient: WalletClient;
  private sessionWallet: PrivateKeyAccount;
  private authParams: AuthParams | null = null;
  private authenticated = false;
  private channels: Map<string, ChannelInfo> = new Map();
  private messageHandlers: Map<number, (message: any) => void> = new Map();

  constructor(privateKey: `0x${string}`) {
    this.account = privateKeyToAccount(privateKey);
    
    // Main wallet client
    this.walletClient = createWalletClient({
      account: this.account,
      chain: baseSepolia,
      transport: http(),
    });

    // Session wallet for signing operations
    const sessionPrivateKey = `0x${Array(64).fill(0).map(() => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}` as `0x${string}`;
    
    this.sessionWallet = privateKeyToAccount(sessionPrivateKey);
  }

  /**
   * Connect to Yellow Network and authenticate
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(YELLOW_WS_URL);

      this.ws.onopen = async () => {
        console.log('✅ Connected to Yellow Network');
        
        try {
          await this.authenticate();
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        reject(error);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.ws.onclose = () => {
        console.log('🔌 Disconnected from Yellow Network');
        this.authenticated = false;
      };
    });
  }

  /**
   * Authenticate with Yellow Network
   */
  private async authenticate(): Promise<void> {
    if (!this.ws) throw new Error('Not connected');

    return new Promise(async (resolve, reject) => {
      try {
        // Build auth parameters
        this.authParams = {
          address: this.account.address,
          session_key: this.sessionWallet.address,
          application: 'Yellow',
          expires_at: BigInt(Math.floor(Date.now() / 1000) + 7200),
          scope: 'console',
          allowances: [
            {
              asset: 'ytest.usd',
              amount: '1000000000', // 1000 USDC max
            },
          ],
        };

        // Create auth request
        const authSigner = createEIP712AuthMessageSigner(
          this.walletClient,
          this.account.address
        );

        const authRequestMsg = await createAuthRequestMessage(authSigner, this.authParams);

        // Set up auth response handler
        const authTimeout = setTimeout(() => {
          reject(new Error('Authentication timeout'));
        }, 30000);

        const handleAuthResponse = async (message: any) => {
          try {
            if (message.res?.[1] === 'auth_challenge') {
              // Handle challenge
              const challenge = message.res[2];
              
              const authVerifyMsg = await createAuthVerifyMessageFromChallenge(
                authSigner,
                challenge,
                {
                  address: this.authParams!.address,
                  session_key: this.authParams!.session_key,
                  application: this.authParams!.application,
                  expires_at: this.authParams!.expires_at.toString(),
                  scope: this.authParams!.scope,
                  allowances: this.authParams!.allowances,
                }
              );

              this.ws!.send(JSON.stringify(authVerifyMsg));
            } else if (message.res?.[1] === 'auth_verify') {
              if (message.res[2] === 'ok') {
                clearTimeout(authTimeout);
                this.authenticated = true;
                console.log('✅ Authentication successful');
                
                // Load existing channels
                await this.loadChannels();
                resolve();
              } else {
                reject(new Error('Authentication failed'));
              }
            }
          } catch (error) {
            clearTimeout(authTimeout);
            reject(error);
          }
        };

        // Temporarily add auth handler
        this.ws!.addEventListener('message', (event) => {
          try {
            const message = JSON.parse(event.data.toString());
            handleAuthResponse(message);
          } catch (error) {
            console.error('Error parsing auth message:', error);
          }
        });

        // Send auth request
        this.ws!.send(JSON.stringify(authRequestMsg));
        console.log('📤 Sent authentication request');
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Load existing channels from clearnode
   */
  private async loadChannels(): Promise<void> {
    const requestId = Date.now();
    const message = {
      req: [requestId, 'get_channels', {}],
    };

    return new Promise((resolve) => {
      this.messageHandlers.set(requestId, (response) => {
        if (response.res?.[2]) {
          const channelsData = response.res[2];
          
          if (Array.isArray(channelsData)) {
            channelsData.forEach((channelInfo: ChannelInfo) => {
              this.channels.set(channelInfo.channel_id, channelInfo);
            });
            console.log(`✅ Loaded ${channelsData.length} existing channels`);
          }
        }
        resolve();
      });

      this.ws!.send(JSON.stringify(message));
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data.toString());
      
      // Handle RPC responses
      if (message.res) {
        const [requestId, method, data] = message.res;
        
        // Check for specific handler
        const handler = this.messageHandlers.get(requestId);
        if (handler) {
          handler(message);
          this.messageHandlers.delete(requestId);
          return;
        }

        // Handle common message types
        switch (method) {
          case 'create_channel':
            console.log('✅ Channel created:', data.channel_id);
            if (data.channel_id) {
              this.channels.set(data.channel_id, {
                channel_id: data.channel_id,
                channel: data.channel,
                state: data.state,
                status: 'open',
              });
            }
            break;

          case 'resize_channel':
            console.log('✅ Channel resized:', data.channel_id);
            break;

          case 'close_channel':
            console.log('✅ Channel closed:', data.channel_id);
            this.channels.delete(data.channel_id);
            break;

          case 'payment':
            console.log('💰 Payment received:', data.amount, 'from', data.sender);
            break;

          case 'error':
            console.error('❌ Error:', data);
            break;
        }
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  /**
   * Create a new payment channel
   * 
   * @param chainId - Blockchain network ID (e.g., 84532 for Base Sepolia)
   * @param token - Token contract address
   * @returns Channel information with clearnode signature
   */
  async createChannel(
    chainId: number,
    token: string
  ): Promise<{
    channel_id: string;
    channel: Channel;
    state: ChannelState;
    server_signature: string;
  }> {
    if (!this.authenticated) throw new Error('Not authenticated');

    const requestId = Date.now();
    const message = {
      req: [
        requestId,
        'create_channel',
        {
          chain_id: chainId,
          token: token,
        },
      ],
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.messageHandlers.delete(requestId);
        reject(new Error('Channel creation timeout'));
      }, 30000);

      this.messageHandlers.set(requestId, (response) => {
        clearTimeout(timeout);
        
        if (response.res?.[1] === 'error') {
          reject(new Error(response.res[2]));
        } else if (response.res?.[2]) {
          const data = response.res[2];
          console.log('✅ Channel prepared:', data.channel_id);
          console.log('📋 Next step: Submit Custody.create() on-chain');
          resolve(data);
        } else {
          reject(new Error('Invalid response'));
        }
      });

      this.ws!.send(JSON.stringify(message));
      console.log('📤 Requesting channel creation...');
    });
  }

  /**
   * Resize channel (add or remove funds)
   * 
   * @param channelId - Channel identifier
   * @param resizeAmount - Amount to add (positive) or remove (negative)
   * @param fundsDestination - Destination address for funds
   * @returns Resize state with clearnode signature
   */
  async resizeChannel(
    channelId: string,
    resizeAmount: string,
    fundsDestination: string
  ): Promise<{
    channel_id: string;
    state: ChannelState;
    server_signature: string;
  }> {
    if (!this.authenticated) throw new Error('Not authenticated');

    const requestId = Date.now();
    const message = {
      req: [
        requestId,
        'resize_channel',
        {
          channel_id: channelId,
          allocate_amount: '0',
          resize_amount: resizeAmount,
          funds_destination: fundsDestination,
        },
      ],
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.messageHandlers.delete(requestId);
        reject(new Error('Resize timeout'));
      }, 30000);

      this.messageHandlers.set(requestId, (response) => {
        clearTimeout(timeout);
        
        if (response.res?.[1] === 'error') {
          reject(new Error(response.res[2]));
        } else if (response.res?.[2]) {
          const data = response.res[2];
          console.log('✅ Channel resize prepared');
          console.log('📋 Next step: Submit Custody.resize() on-chain');
          resolve(data);
        } else {
          reject(new Error('Invalid response'));
        }
      });

      this.ws!.send(JSON.stringify(message));
      console.log(`📤 Requesting channel resize: ${resizeAmount}`);
    });
  }

  /**
   * Close channel cooperatively
   * 
   * @param channelId - Channel identifier
   * @param fundsDestination - Destination address for your funds
   * @returns Final state with clearnode signature
   */
  async closeChannel(
    channelId: string,
    fundsDestination: string
  ): Promise<{
    channel_id: string;
    state: ChannelState;
    server_signature: string;
  }> {
    if (!this.authenticated) throw new Error('Not authenticated');

    const requestId = Date.now();
    const message = {
      req: [
        requestId,
        'close_channel',
        {
          channel_id: channelId,
          funds_destination: fundsDestination,
        },
      ],
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.messageHandlers.delete(requestId);
        reject(new Error('Close timeout'));
      }, 30000);

      this.messageHandlers.set(requestId, (response) => {
        clearTimeout(timeout);
        
        if (response.res?.[1] === 'error') {
          reject(new Error(response.res[2]));
        } else if (response.res?.[2]) {
          const data = response.res[2];
          console.log('✅ Channel closure prepared');
          console.log('📋 Next step: Submit Custody.close() on-chain');
          resolve(data);
        } else {
          reject(new Error('Invalid response'));
        }
      });

      this.ws!.send(JSON.stringify(message));
      console.log('📤 Requesting channel closure...');
    });
  }

  /**
   * Send instant off-chain payment through channel
   * 
   * @param amount - Amount to send (in smallest units)
   * @param recipient - Recipient address
   */
  async sendPayment(amount: string, recipient: string): Promise<void> {
    if (!this.authenticated) throw new Error('Not authenticated');

    const paymentData: PaymentMessage = {
      type: 'payment',
      amount,
      recipient,
      timestamp: Date.now(),
    };

    // Sign payment
    const paymentJson = JSON.stringify(paymentData);
    const signature = await this.account.signMessage({
      message: paymentJson,
    });

    const signedPayment = {
      ...paymentData,
      signature,
      sender: this.account.address,
    };

    this.ws!.send(JSON.stringify(signedPayment));
    console.log(`💸 Payment sent: ${amount} to ${recipient}`);
  }

  /**
   * Get list of active channels
   */
  getChannels(): ChannelInfo[] {
    return Array.from(this.channels.values());
  }

  /**
   * Get specific channel by ID
   */
  getChannel(channelId: string): ChannelInfo | undefined {
    return this.channels.get(channelId);
  }

  /**
   * Disconnect from Yellow Network
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.authenticated = false;
    this.channels.clear();
  }
}
