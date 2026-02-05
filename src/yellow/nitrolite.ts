/**
 * Real Yellow Network Integration using Nitrolite SDK
 * 
 * This replaces the simulated client with actual Yellow Network sandbox integration.
 * Uses @erc7824/nitrolite SDK for production-ready state channel operations.
 * 
 * Testnet: Yellow Network Sandbox (Sepolia)
 * Clearnode: wss://clearnet-sandbox.yellow.com/ws
 */

import { 
  NitroliteClient, 
  WalletStateSigner, 
  createECDSAMessageSigner,
  createAuthRequestMessage,
  createAuthVerifyMessageFromChallenge,
  createEIP712AuthMessageSigner,
  createCreateChannelMessage,
  createResizeChannelMessage,
  createCloseChannelMessage,
  generatePrivateKey
} from '@erc7824/nitrolite';
import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  type PublicClient, 
  type WalletClient 
} from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import WebSocket from 'ws';
import 'dotenv/config';

export interface YellowConfig {
  privateKey: `0x${string}`;
  rpcUrl: string;
  clearnodeUrl: string;
  custodyContract: `0x${string}`;
  adjudicatorContract: `0x${string}`;
}

export interface YellowSession {
  sessionId: string;
  sessionPrivateKey: `0x${string}`;
  sessionAddress: `0x${string}`;
  userAddress: `0x${string}`;
  channelId?: string;
  expiresAt: bigint;
}

export class YellowNetworkClient {
  private nitroliteClient: NitroliteClient;
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private ws: WebSocket | null = null;
  private config: YellowConfig;
  private account: ReturnType<typeof privateKeyToAccount>;

  constructor(config: YellowConfig) {
    this.config = config;
    this.account = privateKeyToAccount(config.privateKey);

    // Setup Viem clients
    this.publicClient = createPublicClient({
      chain: sepolia,
      transport: http(config.rpcUrl),
    });

    this.walletClient = createWalletClient({
      chain: sepolia,
      transport: http(config.rpcUrl),
      account: this.account,
    });

    // Initialize Nitrolite Client
    this.nitroliteClient = new NitroliteClient({
      publicClient: this.publicClient,
      walletClient: this.walletClient,
      stateSigner: new WalletStateSigner(this.walletClient),
      addresses: {
        custody: config.custodyContract,
        adjudicator: config.adjudicatorContract,
      },
      chainId: sepolia.id,
      challengeDuration: 3600n, // 1 hour
    });
  }

  /**
   * Connect to Yellow Network Clearnode (WebSocket)
   */
  async connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.clearnodeUrl);

      this.ws.on('open', () => {
        console.log('✅ Connected to Yellow Network Clearnode');
        resolve(true);
      });

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('🔌 Disconnected from Clearnode');
      });
    });
  }

  /**
   * Authenticate and create session
   * 
   * This generates a temporary session key and authenticates with the Clearnode
   * using EIP-712 signature from main wallet.
   */
  async createSession(allowanceAmount: string = '1000000000'): Promise<YellowSession> {
    if (!this.ws) {
      throw new Error('Not connected to Clearnode. Call connect() first.');
    }

    // Generate temporary session key
    const sessionPrivateKey = generatePrivateKey();
    const sessionSigner = createECDSAMessageSigner(sessionPrivateKey);
    const sessionAccount = privateKeyToAccount(sessionPrivateKey);

    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now

    // Send auth request
    const authParams = {
      address: this.account.address,
      application: 'VaultOS Prediction Market',
      session_key: sessionAccount.address,
      allowances: [{ asset: 'ytest.usd', amount: allowanceAmount }],
      expires_at: expiresAt,
      scope: 'vaultos.trading',
    };

    const authRequestMsg = await createAuthRequestMessage(authParams);
    
    // Wait for auth challenge
    const challenge = await this.waitForMessage('auth_challenge');
    
    // Sign challenge with main wallet (EIP-712)
    const signer = createEIP712AuthMessageSigner(
      this.walletClient, 
      authParams, 
      { name: 'VaultOS Prediction Market' }
    );
    
    const verifyMsg = await createAuthVerifyMessageFromChallenge(signer, challenge.res[2].challenge_message);
    this.ws.send(verifyMsg);

    // Wait for auth success
    await this.waitForMessage('auth_verify');

    console.log('✅ Session authenticated');
    console.log('👤 User:', this.account.address);
    console.log('🔑 Session:', sessionAccount.address);

    return {
      sessionId: `session_${Date.now()}`,
      sessionPrivateKey,
      sessionAddress: sessionAccount.address,
      userAddress: this.account.address,
      expiresAt,
    };
  }

  /**
   * Request test tokens from Yellow Network Sandbox Faucet
   * 
   * Tokens are credited directly to your Unified Balance (off-chain)
   */
  async requestTestTokens(): Promise<void> {
    console.log('🚰 Requesting test tokens from Yellow Sandbox Faucet...');
    
    const response = await fetch('https://clearnet-sandbox.yellow.com/faucet/requestTokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress: this.account.address }),
    });

    if (!response.ok) {
      throw new Error('Failed to request test tokens');
    }

    const data = await response.json();
    console.log('✅ Test tokens received:', data);
  }

  /**
   * Wait for specific WebSocket message type
   */
  private waitForMessage(messageType: string, timeout: number = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${messageType}`));
      }, timeout);

      const handler = (data: WebSocket.Data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.res && response.res[1] === messageType) {
            clearTimeout(timer);
            this.ws?.removeListener('message', handler);
            resolve(response);
          }
        } catch (err) {
          // Ignore parse errors
        }
      };

      this.ws?.on('message', handler);
    });
  }

  /**
   * Get Nitrolite client for advanced operations
   */
  getClient(): NitroliteClient {
    return this.nitroliteClient;
  }

  /**
   * Close WebSocket connection
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

/**
 * Create Yellow Network client from environment variables
 */
export function createYellowClient(): YellowNetworkClient {
  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const clearnodeUrl = process.env.CLEARNODE_WS_URL || 'wss://clearnet-sandbox.yellow.com/ws';
  const custodyContract = (process.env.CUSTODY_CONTRACT || '0x019B65A265EB3363822f2752141b3dF16131b262') as `0x${string}`;
  const adjudicatorContract = (process.env.ADJUDICATOR_CONTRACT || '0x7c7ccbc98469190849BCC6c926307794fDfB11F2') as `0x${string}`;

  if (!privateKey || !rpcUrl) {
    throw new Error('Missing environment variables: PRIVATE_KEY and SEPOLIA_RPC_URL required');
  }

  return new YellowNetworkClient({
    privateKey,
    rpcUrl,
    clearnodeUrl,
    custodyContract,
    adjudicatorContract,
  });
}
