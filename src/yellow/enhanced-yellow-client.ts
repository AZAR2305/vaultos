/**
 * Enhanced Yellow Network Client (Protocol-Complete)
 * 
 * Implements all Yellow Network protocol features:
 * - Complete authentication flow
 * - All channel management methods
 * - Transfer operations
 * - App Session support for prediction markets
 * - All query methods
 * - Real-time notifications (bu, cu, tr, asu)
 * 
 * Protocol Version: NitroRPC/0.4
 * Based on: https://docs.yellow.org/protocol/off-chain-rpc/
 */

import {
    NitroliteClient,
    WalletStateSigner,
    createTransferMessage,
    createGetConfigMessage,
    createGetChannelsMessage,
    createECDSAMessageSigner,
    createEIP712AuthMessageSigner,
    createAuthVerifyMessageFromChallenge,
    createCreateChannelMessage,
    createResizeChannelMessage,
    createGetLedgerBalancesMessage,
    createAuthRequestMessage,
    createCloseChannelMessage,
    createAppSessionMessage,
} from '@erc7824/nitrolite';
import { createPublicClient, createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import WebSocket from 'ws';
import 'dotenv/config';
import type {
    YellowClientConfig,
    YellowSessionConfig,
    RPCConfig,
    ChannelInfo,
    LedgerBalance,
    LedgerTransaction,
    LedgerEntry,
    AppSession,
    Notification,
    TransferParams,
    TransferResponse,
    CreateAppSessionParams,
    SubmitAppStateParams,
    CloseAppSessionParams,
    RPCAsset,
    StateIntent,
} from './protocol-types';

export class EnhancedYellowClient {
    private nitroliteClient: NitroliteClient;
    private publicClient: any;
    private walletClient: any;
    private account: any;
    private ws: WebSocket | null = null;
    private sessionPrivateKey: `0x${string}` | null = null;
    private sessionSigner: any = null;
    private activeChannelId: string | null = null;
    private config: RPCConfig | null = null;
    private isAuthenticated = false;
    private authParams: any = null;
    private readonly custodyAddress = '0x019B65A265EB3363822f2752141b3dF16131b262' as `0x${string}`;
    private readonly clearnodeUrl = 'wss://clearnet-sandbox.yellow.com/ws';
    
    // Notification handlers
    private notificationHandlers: Map<string, Array<(notification: Notification) => void>> = new Map();
    
    // Request tracking
    private requestId = 1;
    private pendingRequests: Map<number, {
        resolve: (value: any) => void;
        reject: (error: Error) => void;
        method: string;
    }> = new Map();

    constructor(privateKey: `0x${string}`, rpcUrl?: string) {
        this.account = privateKeyToAccount(privateKey);

        // Create viem clients
        this.publicClient = createPublicClient({
            chain: baseSepolia,
            transport: http(rpcUrl || 'https://sepolia.base.org'),
        });

        this.walletClient = createWalletClient({
            chain: baseSepolia,
            transport: http(),
            account: this.account,
        });

        // Initialize Nitrolite client
        this.nitroliteClient = new NitroliteClient({
            publicClient: this.publicClient,
            walletClient: this.walletClient,
            stateSigner: new WalletStateSigner(this.walletClient),
            addresses: {
                custody: this.custodyAddress,
                adjudicator: '0x7c7ccbc98469190849BCC6c926307794fDfB11F2',
            },
            chainId: baseSepolia.id,
            challengeDuration: 3600n,
        });

        console.log('✓ Enhanced Yellow Network Client initialized');
        console.log('  Wallet:', this.account.address);
        console.log('  Protocol: NitroRPC/0.4');
    }

    // ========================================================================
    // Connection & Authentication
    // ========================================================================

    /**
     * Connect to Yellow Network and authenticate
     * Implements complete 3-step auth flow
     */
    async connect(sessionConfig?: Partial<YellowSessionConfig>): Promise<{
        sessionAddress: string;
        userAddress: string;
    }> {
        console.log('\n📡 Connecting to Yellow Network Sandbox...');

        // Step 1: Fetch configuration (public endpoint)
        this.config = await this.fetchConfig();
        console.log('✓ Configuration fetched');
        console.log(`  Networks: ${this.config.networks?.length || 0}`);
        console.log(`  Assets: ${this.config.assets?.length || 0}`);

        // Generate session keypair
        this.sessionPrivateKey = generatePrivateKey();
        const sessionAccount = privateKeyToAccount(this.sessionPrivateKey);
        this.sessionSigner = createECDSAMessageSigner(this.sessionPrivateKey);

        console.log('✓ Session key generated:', sessionAccount.address);

        // Connect WebSocket
        this.ws = new WebSocket(this.clearnodeUrl);

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('WebSocket connection timeout'));
            }, 10000);

            this.ws!.on('open', () => {
                clearTimeout(timeout);
                console.log('✓ WebSocket connected');
                resolve();
            });

            this.ws!.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });

        // Setup message handler FIRST
        this.setupMessageHandler();

        // Wait a bit to ensure handler is ready
        await new Promise(resolve => setTimeout(resolve, 100));

        // Step 2: Send auth_request
        const authParams = {
            address: this.account.address,
            application: 'Yellow',  // MUST match EIP-712 domain name
            session_key: sessionAccount.address,
            allowances: [{ 
                asset: 'ytest.usd', 
                amount: sessionConfig?.allowanceAmount || '1000000000' 
            }],
            expires_at: BigInt(Math.floor(Date.now() / 1000) + (sessionConfig?.expiresInSeconds || 3600)),
            scope: sessionConfig?.scope || 'vaultos.trading',
        };

        this.authParams = authParams;
        const authRequestMsg = await createAuthRequestMessage(authParams);
        this.ws.send(authRequestMsg);

        // Step 3: Wait for auth_challenge → auth_verify → success
        await this.waitForAuthentication();

        return {
            sessionAddress: sessionAccount.address,
            userAddress: this.account.address,
        };
    }

    /**
     * Fetch Yellow Network configuration
     * Public endpoint - no auth required
     */
    private async fetchConfig(): Promise<RPCConfig> {
        const tempSigner = createECDSAMessageSigner(this.account.address as `0x${string}`);
        const message = await createGetConfigMessage(tempSigner);

        const tempWs = new WebSocket(this.clearnodeUrl);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                tempWs.close();
                reject(new Error(' Config fetch timeout'));
            }, 30000);

            tempWs.onopen = () => tempWs.send(message);

            tempWs.on('message', (data: Buffer) => {
                try {
                    const response = JSON.parse(data.toString('utf-8'));
                    if (response.res && response.res[2]) {
                        clearTimeout(timeout);
                        resolve(response.res[2] as RPCConfig);
                        tempWs.close();
                    } else if (response.error) {
                        clearTimeout(timeout);
                        reject(new Error(response.error.message || 'Config fetch failed'));
                        tempWs.close();
                    }
                } catch (err) {
                    clearTimeout(timeout);
                    reject(err);
                    tempWs.close();
                }
            });

            tempWs.onerror = (error) => {
                clearTimeout(timeout);
                reject(error);
                tempWs.close();
            };
        });
    }

    // ========================================================================
    // Query Methods (Public & Private)
    // ========================================================================

    /**
     * Get Yellow Network configuration
     * Public endpoint
     */
    async getConfig(): Promise<RPCConfig> {
        if (this.config) return this.config;
        this.config = await this.fetchConfig();
        return this.config;
    }

    /**
     * Get supported assets
     * Public endpoint
     */
    async getAssets(chainId?: number): Promise<RPCAsset[]> {
        const config = await this.getConfig();
        if (!config.assets) return [];
        
        if (chainId) {
            return config.assets.filter(asset => asset.chain_id === chainId);
        }
        
        return config.assets;
    }

    /**
     * Get channels for user
     * Public endpoint
     */
    async getChannels(params?: {
        wallet?: `0x${string}`;
        chain_id?: number;
        status?: string;
    }): Promise<ChannelInfo[]> {
        if (!this.isAuthenticated) {
            throw new Error('Must be authenticated to query channels');
        }

        const message = await createGetChannelsMessage(
            this.sessionSigner,
            params?.wallet || this.account.address
        );

        return this.sendRequest('get_channels', message);
    }

    /**
     * Get ledger balances (unified balance)
     * Private endpoint - requires auth
     */
    async getLedgerBalances(wallet?: `0x${string}`): Promise<LedgerBalance[]> {
        if (!this.isAuthenticated) {
            throw new Error('Must be authenticated to query ledger balances');
        }

        const message = await createGetLedgerBalancesMessage(
            this.sessionSigner,
            wallet || this.account.address,
            Date.now()
        );

        return this.sendRequest('get_ledger_balances', message);
    }

    /**
     * Get transaction history
     * Public endpoint
     */
    async getLedgerTransactions(params?: {
        account_id?: string;
        asset?: string;
        tx_type?: string;
        offset?: number;
        limit?: number;
        sort?: 'asc' | 'desc';
    }): Promise<LedgerTransaction[]> {
        const reqId = this.requestId++;
        const message = [
            reqId,
            'get_ledger_transactions',
            params || {},
            Date.now(),
        ];

        return this.sendRequest('get_ledger_transactions', JSON.stringify(message));
    }

    /**
     * Get ledger entries (double-entry bookkeeping)
     * Public endpoint
     */
    async getLedgerEntries(params?: {
        account_id?: string;
        wallet?: `0x${string}`;
        asset?: string;
        offset?: number;
        limit?: number;
        sort?: 'asc' | 'desc';
    }): Promise<LedgerEntry[]> {
        const reqId = this.requestId++;
        const message = [
            reqId,
            'get_ledger_entries',
            params || {},
            Date.now(),
        ];

        return this.sendRequest('get_ledger_entries', JSON.stringify(message));
    }

    /**
     * Get app sessions
     * Public endpoint
     */
    async getAppSessions(params?: {
        wallet?: `0x${string}`;
        app_definition?: `0x${string}`;
        status?: 'active' | 'closing' | 'closed';
    }): Promise<AppSession[]> {
        const reqId = this.requestId++;
        const message = [
            reqId,
            'get_app_sessions',
            params || {},
            Date.now(),
        ];

        return this.sendRequest('get_app_sessions', JSON.stringify(message));
    }

    // ========================================================================
    // Channel Management
    // ========================================================================

    /**
     * Create channel with deposit
     * Uses depositAndCreateChannel for atomic operation
     */
    async createChannel(depositAmount?: bigint): Promise<string> {
        try {
            // Use Official USDC token on Base Sepolia (where Circle faucet sends)
            const tokenAddress = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`;
            const decimals = 6n; // USDC has 6 decimals
            const amount = depositAmount || (20n * (10n ** decimals)); // Default 20 USDC

            console.log('💰 Creating funded channel...');
            console.log(`   Token: Official USDC (${tokenAddress})`);
            console.log(`   Amount: ${amount / (10n ** decimals)} USDC`);

            // Approve custody contract
            console.log('💳 Approving custody contract...');
            const approvalHash = await this.walletClient.writeContract({
                address: tokenAddress,
                abi: [{
                    name: 'approve',
                    type: 'function',
                    stateMutability: 'nonpayable',
                    inputs: [
                        { name: 'spender', type: 'address' },
                        { name: 'amount', type: 'uint256' }
                    ],
                    outputs: [{ type: 'bool' }]
                }],
                functionName: 'approve',
                args: [this.custodyAddress, amount],
                account: this.account,
                chain: baseSepolia,
            });

            await this.publicClient.waitForTransactionReceipt({ hash: approvalHash });
            console.log('✓ Approval confirmed');

            // Create funded channel
            const txHash = await this.nitroliteClient.depositAndCreateChannel(
                tokenAddress,
                amount,
                {
                    chain_id: baseSepolia.id,
                    token: tokenAddress
                }
            );

            console.log('✓ Channel created:', txHash);
            await this.publicClient.waitForTransactionReceipt({ hash: txHash });
            
            // Query to get channel ID
            const channels = await this.getChannels();
            const openChannel = channels.find(c => c.status === 'open');
            
            if (openChannel) {
                this.activeChannelId = openChannel.channel_id;
                console.log('✓ Channel active:', this.activeChannelId);
                return this.activeChannelId;
            }

            throw new Error('Channel created but not found in channels list');

        } catch (error: any) {
            if (error.message?.includes('insufficient') || error.message?.includes('balance')) {
                console.log('\n⚠️  Need tokens to create channel');
                console.log('   Wallet:', this.account.address);
                console.log('   Faucet: curl -X POST https://clearnet-sandbox.yellow.com/faucet/requestTokens \\');
                console.log(`           -H "Content-Type: application/json" -d '{"userAddress":"${this.account.address}"}'`);
            }
            throw error;
        }
    }

    /**
     * Resize channel (deposit or withdraw)
     */
    async resizeChannel(params: {
        channel_id: string;
        allocate_amount?: string;
        resize_amount?: string;
        funds_destination: `0x${string}`;
    }): Promise<void> {
        const resizeMsg = await createResizeChannelMessage(this.sessionSigner, {
            channel_id: params.channel_id as `0x${string}`,
            allocate_amount: params.allocate_amount ? BigInt(params.allocate_amount) : undefined,
            resize_amount: params.resize_amount ? BigInt(params.resize_amount) : undefined,
            funds_destination: params.funds_destination,
        } as any);

        this.ws!.send(resizeMsg);
        
        // Wait for response
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    /**
     * Close channel cooperatively
     */
    async closeChannel(channelId?: string): Promise<void> {
        const targetChannel = channelId || this.activeChannelId;
        if (!targetChannel) {
            throw new Error('No channel to close');
        }

        console.log('\n🔒 Closing channel...');

        const closeMsg = await createCloseChannelMessage(
            this.sessionSigner,
            targetChannel as `0x${string}`,
            this.account.address
        );

        this.ws!.send(closeMsg);
        
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // ========================================================================
    // Transfer Operations
    // ========================================================================

    /**
     * Transfer funds off-chain (instant, no gas)
     * Supports multi-asset transfers
     */
    async transfer(params: TransferParams): Promise<TransferResponse> {
        if (!this.isAuthenticated) {
            throw new Error('Must be authenticated to transfer');
        }

        console.log(`\n💸 Initiating transfer...`);
        
        const transferMsg = await createTransferMessage(
            this.sessionSigner,
            params,
            Date.now()
        );

        return this.sendRequest('transfer', transferMsg);
    }

    // ========================================================================
    // App Session Methods (for Prediction Markets)
    // ========================================================================

    /**
     * Create app session (multi-party application channel)
     * Perfect for prediction markets with multiple participants
     */
    async createAppSession(params: CreateAppSessionParams): Promise<{
        app_session_id: string;
        state: any;
    }> {
        if (!this.isAuthenticated) {
            throw new Error('Must be authenticated to create app session');
        }

        // Use nitrolite SDK to create properly formatted message
        const reqId = this.requestId++;
        const timestamp = Date.now();
        const message = await createAppSessionMessage(
            this.sessionSigner,
            params,
            reqId,
            timestamp
        );

        return this.sendRequest('create_app_session', message, reqId);
    }

    /**
     * Submit app state update (OPERATE, DEPOSIT, WITHDRAW)
     * Use for trading in prediction markets
     */
    async submitAppState(params: SubmitAppStateParams): Promise<any> {
        if (!this.isAuthenticated) {
            throw new Error('Must be authenticated to submit app state');
        }

        const reqId = this.requestId++;
        const message = [
            reqId,
            'submit_app_state',
            params,
            Date.now(),
        ];

        return this.sendRequest('submit_app_state', JSON.stringify(message));
    }

    /**
     * Close app session and distribute funds
     * Use when market resolves
     */
    async closeAppSession(params: CloseAppSessionParams): Promise<any> {
        if (!this.isAuthenticated) {
            throw new Error('Must be authenticated to close app session');
        }

        const reqId = this.requestId++;
        const message = [
            reqId,
            'close_app_session',
            params,
            Date.now(),
        ];

        return this.sendRequest('close_app_session', JSON.stringify(message));
    }

    // ========================================================================
    // Notification Handlers
    // ========================================================================

    /**
     * Subscribe to notifications
     * 
     * Notification types:
     * - bu: Balance updates
     * - cu: Channel updates
     * - tr: Transfers (incoming/outgoing)
     * - asu: App session updates
     */
    on(event: 'bu' | 'cu' | 'tr' | 'asu' | 'all', handler: (notification: Notification) => void): void {
        if (!this.notificationHandlers.has(event)) {
            this.notificationHandlers.set(event, []);
        }
        this.notificationHandlers.get(event)!.push(handler);
    }

    /**
     * Unsubscribe from notifications
     */
    off(event: string, handler: (notification: Notification) => void): void {
        const handlers = this.notificationHandlers.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * Emit notification to handlers
     */
    private emitNotification(notification: Notification): void {
        // Specific handlers
        const handlers = this.notificationHandlers.get(notification.method);
        if (handlers) {
            handlers.forEach(handler => handler(notification));
        }

        // Global handlers
        const globalHandlers = this.notificationHandlers.get('all');
        if (globalHandlers) {
            globalHandlers.forEach(handler => handler(notification));
        }
    }

    // ========================================================================
    // WebSocket Message Handling
    // ========================================================================

    /**
     * Setup WebSocket message handler
     */
    private setupMessageHandler(): void {
        if (!this.ws) return;

        this.ws.on('message', async (data) => {
            try {
                const response = JSON.parse(data.toString());

                // Handle errors
                if (response.error) {
                    console.error('❌ RPC Error:', response.error);
                    const pending = Array.from(this.pendingRequests.values())[0];
                    if (pending) {
                        pending.reject(new Error(response.error.message));
                        this.pendingRequests.clear();
                    }
                    return;
                }

                const messageType = response.res?.[1];

                // Handle notifications (no requestId)
                if (!response.res?.[0] && ['bu', 'cu', 'tr', 'asu'].includes(messageType)) {
                    this.emitNotification({
                        method: messageType,
                        params: response.res[2],
                    } as Notification);
                    return;
                }

                // Handle RPC responses
                switch (messageType) {
                    case 'auth_challenge':
                        await this.handleAuthChallenge(response);
                        break;
                    case 'auth_verify':
                        await this.handleAuthVerify(response);
                        break;
                    case 'get_channels':
                    case 'channels':
                        await this.handleChannelsResponse(response);
                        break;
                    case 'resize_channel':
                        await this.handleResizeChannel(response);
                        break;
                    case 'close_channel':
                        await this.handleCloseChannel(response);
                        break;
                    default:
                        // Handle pending requests
                        const requestId = response.res?.[0];
                        if (requestId && this.pendingRequests.has(requestId)) {
                            const pending = this.pendingRequests.get(requestId)!;
                            pending.resolve(response.res[2]);
                            this.pendingRequests.delete(requestId);
                        }
                }
            } catch (error: any) {
                console.error('❌ Error processing message:', error.message);
            }
        });

        this.ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error);
        });

        this.ws.on('close', () => {
            console.log('🔌 WebSocket closed');
        });
    }

    /**
     * Send RPC request and wait for response
     */
    private sendRequest(method: string, message: string, preformattedRequestId?: number): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.ws) {
                reject(new Error('Not connected'));
                return;
            }

            // Use pre-formatted requestId if provided (from nitrolite SDK)
            // Otherwise generate our own
            const reqId = preformattedRequestId !== undefined ? preformattedRequestId : this.requestId++;
            this.pendingRequests.set(reqId, { resolve, reject, method });

            this.ws.send(message);

            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(reqId)) {
                    this.pendingRequests.delete(reqId);
                    reject(new Error(`Request timeout: ${method}`));
                }
            }, 30000);
        });
    }

    /**
     * Handle auth challenge
     */
    private async handleAuthChallenge(response: any): Promise<void> {
        if (this.isAuthenticated) {
            return;
        }

        try {
            const challenge = response.res[2].challenge_message;

            const sessionAccount = privateKeyToAccount(this.sessionPrivateKey!);

            const eoaWalletClient = createWalletClient({
                account: this.account,
                chain: baseSepolia,
                transport: http('https://sepolia.base.org'),
            });

            // 🔑 CRITICAL: Auth params for EIP-712 signature (NO address field!)
            // Must use EXACT SAME values as auth_request (except address)
            const authParamsForSigning = {
                session_key: sessionAccount.address,
                allowances: this.authParams.allowances,  // Use exact same from request
                expires_at: this.authParams.expires_at,  // Use exact same from request
                scope: this.authParams.scope,  // Use exact same from request
            };

            const signer = createEIP712AuthMessageSigner(
                eoaWalletClient,
                authParamsForSigning,
                { name: 'Yellow' }  // MUST match application field in auth_request
            );

            const verifyMsg = await createAuthVerifyMessageFromChallenge(signer, challenge);
            this.ws!.send(verifyMsg);
        } catch (error: any) {
            console.error('❌ Error handling auth challenge:', error.message);
            throw error;
        }
    }

    /**
     * Handle auth verify
     */
    private async handleAuthVerify(response: any): Promise<void> {
        try {
            // Check if verification was successful
            if (response.res && response.res[2]) {
                console.log('✓ Authenticated successfully');
                this.isAuthenticated = true;

                // Query channels
                const channelsMsg = await createGetChannelsMessage(
                    this.sessionSigner,
                    this.account.address,
                    Date.now()
                );
                this.ws!.send(channelsMsg);

                // Query ledger balances
                const ledgerMsg = await createGetLedgerBalancesMessage(
                    this.sessionSigner,
                    this.account.address,
                    Date.now()
                );
                this.ws!.send(ledgerMsg);
            } else {
                console.error('❌ Auth verify response invalid:', response);
                throw new Error('Auth verification failed');
            }
        } catch (error: any) {
            console.error('❌ Error handling auth verify:', error.message);
            throw error;
        }
    }

    /**
     * Handle channels response
     */
    private async handleChannelsResponse(response: any): Promise<void> {
        const channels = response.res[2].channels;
        const openChannel = channels.find((c: any) => c.status === 'open');

        if (openChannel) {
            console.log('✓ Found existing open channel:', openChannel.channel_id);
            this.activeChannelId = openChannel.channel_id;
        }
    }

    /**
     * Handle resize channel
     */
    private async handleResizeChannel(response: any): Promise<void> {
        const { channel_id, state, server_signature } = response.res[2];

        console.log('✓ Resize prepared');

        const resizeState = {
            intent: state.intent,
            version: BigInt(state.version),
            data: state.state_data || state.data,
            allocations: state.allocations.map((a: any) => ({
                destination: a.destination,
                token: a.token,
                amount: BigInt(a.amount),
            })),
            channelId: channel_id,
            serverSignature: server_signature,
        };

        const { txHash } = await this.nitroliteClient.resizeChannel({
            resizeState,
            proofStates: [],
        });

        console.log('✓ Channel resized:', txHash);
    }

    /**
     * Handle close channel
     */
    private async handleCloseChannel(response: any): Promise<void> {
        const { channel_id, state, server_signature } = response.res[2];

        console.log('✓ Close prepared');

        const txHash = await this.nitroliteClient.closeChannel({
            finalState: {
                intent: state.intent,
                version: BigInt(state.version),
                data: state.state_data || state.data,
                allocations: state.allocations.map((a: any) => ({
                    destination: a.destination,
                    token: a.token,
                    amount: BigInt(a.amount),
                })),
                channelId: channel_id,
                serverSignature: server_signature,
            },
            stateData: state.state_data || state.data || '0x',
        });

        console.log('✓ Channel closed:', txHash);

        // Withdraw funds
        if (state.allocations[0]?.token) {
            await this.withdrawFunds(state.allocations[0].token);
        }
    }

    /**
     * Withdraw funds from custody contract
     */
    private async withdrawFunds(token: string): Promise<void> {
        console.log('\n💵 Withdrawing funds...');

        const result = await this.publicClient.readContract({
            address: this.custodyAddress,
            abi: [{
                type: 'function',
                name: 'getAccountsBalances',
                inputs: [
                    { name: 'users', type: 'address[]' },
                    { name: 'tokens', type: 'address[]' }
                ],
                outputs: [{ type: 'uint256[]' }],
                stateMutability: 'view'
            }] as const,
            functionName: 'getAccountsBalances',
            args: [[this.account.address], [token as `0x${string}`]],
        }) as bigint[];

        const withdrawableBalance = result[0];

        if (withdrawableBalance > 0n) {
            console.log(`  Withdrawing ${withdrawableBalance} tokens...`);
            const withdrawalTx = await this.nitroliteClient.withdrawal(
                token as `0x${string}`,
                withdrawableBalance
            );
            console.log('✓ Funds withdrawn:', withdrawalTx);
        } else {
            console.log('  No funds to withdraw');
        }
    }

    /**
     * Wait for authentication
     */
    private async waitForAuthentication(): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Authentication timeout'));
            }, 30000);

            const checkAuth = setInterval(() => {
                if (this.isAuthenticated) {
                    clearInterval(checkAuth);
                    clearTimeout(timeout);
                    resolve();
                }
            }, 100);
        });
    }

    // ========================================================================
    // Utility Methods
    // ========================================================================

    /**
     * Disconnect from Yellow Network
     */
    disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        console.log('✓ Disconnected from Yellow Network');
    }

    /**
     * Get Nitrolite client for advanced operations
     */
    getClient(): NitroliteClient {
        return this.nitroliteClient;
    }

    /**
     * Get active channel ID
     */
    getChannelId(): string | null {
        return this.activeChannelId;
    }

    /**
     * Check if connected and authenticated
     */
    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }

    /**
     * Check if authenticated
     */
    isAuth(): boolean {
        return this.isAuthenticated;
    }

    /**
     * Get user wallet address
     */
    getAddress(): `0x${string}` {
        return this.account.address;
    }
}

/**
 * Create Enhanced Yellow client from environment
 */
export function createEnhancedYellowClient(): EnhancedYellowClient {
    const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
    const rpcUrl = process.env.SEPOLIA_RPC_URL;

    if (!privateKey) {
        throw new Error('PRIVATE_KEY not found in environment');
    }

    return new EnhancedYellowClient(privateKey, rpcUrl);
}
