/**
 * VaultOS Yellow Network Integration (Real SDK)
 * Based on Yellow Network Official Quickstart Guide
 * 
 * Features:
 * - Real authentication with session keys
 * - State channel creation and funding
 * - Off-chain transfers
 * - Channel closing and withdrawal
 * 
 * Testnet: Yellow Sandbox (Base Sepolia)
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
    type RPCNetworkInfo,
    type RPCAsset,
} from '@erc7824/nitrolite';
import { createPublicClient, createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import WebSocket from 'ws';
import 'dotenv/config';

interface YellowConfig {
    assets?: RPCAsset[];
    networks?: RPCNetworkInfo[];
    [key: string]: any;
}

export class VaultOSYellowClient {
    private nitroliteClient: NitroliteClient;
    private publicClient: any;
    private walletClient: any;
    private account: any;
    private ws: WebSocket | null = null;
    private sessionPrivateKey: `0x${string}` | null = null;
    private sessionSigner: any = null;
    private activeChannelId: string | null = null;
    private config: YellowConfig = {};
    private isAuthenticated = false;
    private authParams: any = null; // Store original auth params for signature verification
    private readonly custodyAddress = '0x019B65A265EB3363822f2752141b3dF16131b262' as `0x${string}`;
    private readonly clearnodeUrl = 'wss://clearnet-sandbox.yellow.com/ws';
    private readonly environment = 'SANDBOX'; // SANDBOX or PRODUCTION

    constructor(privateKey: `0x${string}`, rpcUrl?: string) {
        this.account = privateKeyToAccount(privateKey);

        // Create viem clients
        this.publicClient = createPublicClient({
            chain: baseSepolia,
            transport: http('https://sepolia.base.org'),
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
                custody: '0x019B65A265EB3363822f2752141b3dF16131b262',
                adjudicator: '0x7c7ccbc98469190849BCC6c926307794fDfB11F2',
            },
            chainId: baseSepolia.id,
            challengeDuration: 3600n, // 1 hour
        });

        console.log('🟢 Yellow Network Client initialized');
        console.log(`   Environment: ${this.environment} (Testnet)`);
        console.log(`   Chain: Base Sepolia (${baseSepolia.id})`);
        console.log(`   Clearnode: ${this.clearnodeUrl}`);
        console.log(`   Wallet: ${this.account.address}`);
        console.log(`   Token: ytest.USD (free faucet available)`);
    }

    /**
     * Fetch Yellow Network configuration
     */
    private async fetchConfig(): Promise<YellowConfig> {
        const tempSigner = createECDSAMessageSigner(this.account.address as `0x${string}`);
        const message = await createGetConfigMessage(tempSigner);

        const tempWs = new WebSocket(this.clearnodeUrl);

        return new Promise((resolve, reject) => {
            tempWs.onopen = () => tempWs.send(message);

            tempWs.on('message', (data: Buffer) => {
                try {
                    const response = JSON.parse(data.toString('utf-8'));
                    if (response.res && response.res[2]) {
                        resolve(response.res[2] as YellowConfig);
                        tempWs.close();
                    } else if (response.error) {
                        reject(new Error(response.error.message || 'Config fetch failed'));
                        tempWs.close();
                    }
                } catch (err) {
                    reject(err);
                    tempWs.close();
                }
            });

            tempWs.onerror = (error) => {
                reject(error);
                tempWs.close();
            };
        });
    }

    /**
     * Connect to Yellow Network and authenticate
     */
    async connect(): Promise<{ sessionAddress: string; userAddress: string }> {
        console.log('\n📡 Connecting to Yellow Network Sandbox...');

        // Fetch configuration
        this.config = await this.fetchConfig();
        console.log('✓ Configuration fetched');

        // Generate session keypair
        this.sessionPrivateKey = generatePrivateKey();
        const sessionAccount = privateKeyToAccount(this.sessionPrivateKey);
        this.sessionSigner = createECDSAMessageSigner(this.sessionPrivateKey);

        console.log('✓ Session key generated:', sessionAccount.address);

        // Connect WebSocket
        this.ws = new WebSocket(this.clearnodeUrl);

        await new Promise<void>((resolve) => {
            this.ws!.on('open', () => {
                console.log('✓ WebSocket connected');
                resolve();
            });
        });

        // Setup message handler
        this.setupMessageHandler();

        // Send auth request
        const authParams = {
            address: this.account.address,
            application: 'Yellow',  // Must match EIP-712 domain name
            session_key: sessionAccount.address,
            allowances: [{ asset: 'ytest.usd', amount: '1000000000' }],
            expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600),
            scope: 'vaultos.trading',
        };

        // Store auth params for signature verification in handleAuthChallenge
        this.authParams = authParams;

        const authRequestMsg = await createAuthRequestMessage(authParams);
        this.ws.send(authRequestMsg);

        // Wait for authentication
        await this.waitForAuthentication();

        return {
            sessionAddress: sessionAccount.address,
            userAddress: this.account.address,
        };
    }

    /**
     * Setup WebSocket message handler
     */
    private setupMessageHandler(): void {
        if (!this.ws) return;

        this.ws.on('message', async (data) => {
            const response = JSON.parse(data.toString());
            
            if (response.error) {
                console.error('❌ RPC Error:', response.error);
                return;
            }

            const messageType = response.res?.[1];

            switch (messageType) {
                case 'auth_challenge':
                    await this.handleAuthChallenge(response);
                    break;
                case 'auth_verify':
                    this.handleAuthVerify(response);
                    break;
                case 'channels':
                    await this.handleChannelsResponse(response);
                    break;
                case 'resize_channel':
                    await this.handleResizeChannel(response);
                    break;
                case 'transfer':
                    this.handleTransfer(response);
                    break;
                case 'close_channel':
                    await this.handleCloseChannel(response);
                    break;
            }
        });
    }

    /**
     * Handle auth challenge (EIP-712 signature)
     */
    private async handleAuthChallenge(response: any): Promise<void> {
        if (this.isAuthenticated) return;

        const challenge = response.res[2].challenge_message;
        
        // 🔑 CRITICAL: Must sign with USER EOA ONLY (not session key)
        // The signer must recover to the address from auth_request
        const sessionAccount = privateKeyToAccount(this.sessionPrivateKey!);
        
        // Create fresh wallet client with EOA account
        const eoaWalletClient = createWalletClient({
            account: this.account,
            chain: baseSepolia,
            transport: http('https://sepolia.base.org'),
        });
        
        // Auth params for EIP-712 signature (NO address field here!)
        const authParamsForSigning = {
            session_key: sessionAccount.address,
            allowances: [{ asset: 'ytest.usd', amount: '1000000000' }],
            expires_at: this.authParams.expires_at,  // Reuse same expires_at
            scope: 'vaultos.trading',
        };
        
        const signer = createEIP712AuthMessageSigner(
            eoaWalletClient,
            authParamsForSigning,
            { name: 'Yellow' }
        );

        const verifyMsg = await createAuthVerifyMessageFromChallenge(signer, challenge);
        this.ws!.send(verifyMsg);
    }

    /**
     * Handle auth verify success
     */
    private async handleAuthVerify(response: any): Promise<void> {
        console.log('✓ Authenticated successfully');
        this.isAuthenticated = true;

        // 🔑 CRITICAL: Request channels explicitly after auth
        const channelsMsg = await createGetChannelsMessage(
            this.sessionSigner,
            this.account.address,
            Date.now()
        );
        this.ws!.send(channelsMsg);
        console.log('✓ Requested channels list');

        // Query ledger balances
        const ledgerMsg = await createGetLedgerBalancesMessage(
            this.sessionSigner,
            this.account.address,
            Date.now()
        );
        this.ws!.send(ledgerMsg);
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
        } else {
            console.log('✓ No existing channel - ledger balance available for trading');
        }
    }

    /**
     * Create channel - OFFICIAL Yellow/Nitrolite flow
     * 
     * ⚠️ CRITICAL: depositAndCreateChannel handles everything atomically.
     * No WS create_channel message needed!
     */
    async createChannel(): Promise<void> {
        try {
            // Step 1: Use Official USDC token on Base Sepolia
            // This is where Circle faucet sends tokens
            const tokenAddress = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`;
            const decimals = 6n; // USDC has 6 decimals
            const depositAmount = 20n * (10n ** decimals); // 20 USDC = 20,000,000 units

            console.log('💰 Using Official USDC on Base Sepolia');
            console.log('💰 Token:', tokenAddress);
            console.log('💰 Decimals:', decimals.toString());
            console.log('💰 Deposit amount:', depositAmount.toString(), '(20 USDC)');

            // Step 2: Approve custody contract to spend tokens
            console.log('💳 Approving custody contract...');
            const custodyAddress = this.nitroliteClient.addresses.custody;
            
            const approvalHash = await this.walletClient.writeContract({
                address: tokenAddress,
                abi: [
                    {
                        name: 'approve',
                        type: 'function',
                        stateMutability: 'nonpayable',
                        inputs: [
                            { name: 'spender', type: 'address' },
                            { name: 'amount', type: 'uint256' }
                        ],
                        outputs: [{ type: 'bool' }]
                    }
                ],
                functionName: 'approve',
                args: [custodyAddress, depositAmount],
                account: this.account,
                chain: baseSepolia,
            });

            console.log('✓ Approval sent:', approvalHash);
            console.log('⏳ Waiting for approval confirmation...');
            
            await this.publicClient.waitForTransactionReceipt({ hash: approvalHash });
            console.log('✓ Approval confirmed');

            // Step 3: Create funded channel (NO manual state building needed!)
            console.log('💰 Creating funded channel...');
            const txHash = await this.nitroliteClient.depositAndCreateChannel(
                tokenAddress,
                depositAmount
            );

            console.log('✓ Channel created on-chain:', txHash);

            await this.publicClient.waitForTransactionReceipt({ hash: txHash });
            console.log('✓ Channel LIVE & FUNDED');
            console.log(`✓ Balance: ${depositAmount / (10n ** decimals)} ytest.USD`);

        } catch (error: any) {
            if (error.message?.includes('insufficient') || error.message?.includes('balance')) {
                console.log('\n⚠️  Need tokens to create channel');
                console.log('   Wallet:', this.account.address);
                console.log('   Faucet: curl -X POST https://clearnet-sandbox.yellow.com/faucet/requestTokens \\');
                console.log(`           -H "Content-Type: application/json" -d '{"userAddress":"${this.account.address}"}'`);
            } else {
                console.error('❌ Channel creation error:', error.message);
            }
        }
    }

    /**
     * Fund channel using allocate_amount (from Unified Balance)
     * This is for ADDING funds to existing channel, not initial creation
     */
    private async fundChannel(channelId: string, token: string): Promise<void> {
        console.log('\n💰 Adding more funds to channel...');

        const resizeMsg = await createResizeChannelMessage(this.sessionSigner, {
            channel_id: channelId as `0x${string}`,
            allocate_amount: 20n, // 20 tokens from Unified Balance
            funds_destination: this.account.address,
        });

        this.ws!.send(resizeMsg);
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

        console.log('✓ Channel resized on-chain:', txHash);
        console.log('✓ Channel funded with 20 USDC');
    }

    /**
     * Transfer funds off-chain
     */
    async transfer(destination: string, amount: string): Promise<void> {
        if (!this.ws || !this.sessionSigner) {
            throw new Error('Not connected. Call connect() first.');
        }

        console.log(`\n💸 Transferring ${amount} to ${destination}...`);

        const transferMsg = await createTransferMessage(
            this.sessionSigner,
            {
                destination,
                allocations: [{ asset: 'ytest.usd', amount }],
            },
            Date.now()
        );

        this.ws.send(transferMsg);
    }

    /**
     * Handle transfer confirmation
     */
    private handleTransfer(response: any): void {
        console.log('✓ Transfer complete!');
    }

    /**
     * Close channel and withdraw funds
     */
    async closeChannel(): Promise<void> {
        if (!this.activeChannelId || !this.ws) {
            throw new Error('No active channel to close');
        }

        console.log('\n🔒 Closing channel...');

        const closeMsg = await createCloseChannelMessage(
            this.sessionSigner,
            this.activeChannelId as `0x${string}`,
            this.account.address
        );

        this.ws.send(closeMsg);
    }

    /**
     * Handle channel close
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

        console.log('✓ Channel closed on-chain:', txHash);

        // Withdraw funds
        await this.withdrawFunds(state.allocations[0].token);
    }

    /**
     * Withdraw funds from custody contract
     */
    private async withdrawFunds(token: string): Promise<void> {
        console.log('\n💵 Withdrawing funds...');

        const result = await this.publicClient.readContract({
            address: this.nitroliteClient.addresses.custody,
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
            args: [[this.nitroliteClient.account.address], [token as `0x${string}`]],
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
     * Wait for authentication to complete
     */
    private async waitForAuthentication(): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Authentication timeout after 60 seconds'));
            }, 60000);

            const checkAuth = setInterval(() => {
                if (this.isAuthenticated) {
                    clearInterval(checkAuth);
                    clearTimeout(timeout);
                    resolve();
                }
            }, 100);
        });
    }

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
}

/**
 * Create VaultOS Yellow client from environment
 */
export function createVaultOSYellowClient(): VaultOSYellowClient {
    const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
    const rpcUrl = process.env.SEPOLIA_RPC_URL;

    if (!privateKey) {
        throw new Error('PRIVATE_KEY not found in environment');
    }

    return new VaultOSYellowClient(privateKey, rpcUrl);
}
