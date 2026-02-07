/**
 * Simple Yellow Network App Example
 * 
 * Demonstrates:
 * 1. Connecting to Yellow Network Sandbox
 * 2. Creating application sessions
 * 3. Sending off-chain messages
 * 
 * This is for TESTNET/SANDBOX usage (no mainnet funds required)
 */

import {
    createAppSessionMessage,
    parseRPCResponse,
    createECDSAMessageSigner,
    createEIP712AuthMessageSigner,
    createAuthRequestMessage,
    createAuthVerifyMessageFromChallenge,
} from '@erc7824/nitrolite';
import { createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import WebSocket from 'ws';
import { ethers } from 'ethers';
import 'dotenv/config';

class YellowNetworkApp {
    constructor() {
        this.ws = null;
        this.sessionSigner = null;
        this.userAddress = null;
        this.sessionId = null;
        this.isAuthenticated = false;
    }

    /**
     * Step 1: Initialize and connect to Yellow Network Sandbox
     */
    async init() {
        console.log('🟡 Yellow Network App - Sandbox Mode\n');
        console.log('='.repeat(50));

        // Setup wallet (Node.js version - for browser, use window.ethereum)
        const { userAddress, sessionSigner, walletClient, sessionKey } = await this.setupWallet();
        this.userAddress = userAddress;
        this.sessionSigner = sessionSigner;
        this.sessionKey = sessionKey;
        this.walletClient = walletClient;
        
        console.log('✅ Wallet setup complete');
        console.log(`   Address: ${userAddress}`);
        console.log(`   Session: ${sessionKey}\n`);
        
        // Connect to Yellow Network Sandbox
        this.ws = new WebSocket('wss://clearnet-sandbox.yellow.com/ws');
        
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Connection timeout')), 30000);

            this.ws.on('open', async () => {
                clearTimeout(timeout);
                console.log('🟢 Connected to Yellow Network Sandbox!\n');
                
                // Authenticate
                await this.authenticate();
                resolve();
            });

            this.ws.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
        
        // Setup message handler
        this.ws.on('message', (data) => this.handleMessage(data));
        
        return userAddress;
    }

    /**
     * Setup wallet and message signer
     */
    async setupWallet() {
        if (!process.env.PRIVATE_KEY) {
            throw new Error('PRIVATE_KEY not found in .env file');
        }

        // Main wallet
        const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
        const userAddress = account.address;

        // Session key for signing off-chain messages
        const sessionWallet = ethers.Wallet.createRandom();
        const sessionKey = sessionWallet.address;
        const sessionPrivateKey = sessionWallet.privateKey as `0x${string}`;
        const sessionSigner = createECDSAMessageSigner(sessionPrivateKey);

        // Wallet client for EIP-712 signatures
        const walletClient = createWalletClient({
            account,
            chain: baseSepolia,
            transport: http()
        });

        return { userAddress, sessionSigner, walletClient, sessionKey, sessionPrivateKey };
    }

    /**
     * Authenticate with Yellow Network
     */
    async authenticate() {
        console.log('🔐 Authenticating...');

        // Send auth request
        const authMsg = await createAuthRequestMessage({
            address: this.userAddress,
            session_key: this.sessionKey,
            application: 'Yellow',
            expires_at: BigInt(Math.floor(Date.now() / 1000) + 7200),
            scope: 'console',
            allowances: [{
                asset: 'ytest.usd',
                amount: '1000000000'
            }],
        });

        this.ws.send(authMsg);

        // Wait for auth completion
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Auth timeout')), 20000);
            
            const checkAuth = setInterval(() => {
                if (this.isAuthenticated) {
                    clearTimeout(timeout);
                    clearInterval(checkAuth);
                    resolve();
                }
            }, 100);
        });
    }

    /**
     * Step 2: Create Application Session
     */
    async createSession(partnerAddress, options = {}) {
        if (!this.isAuthenticated) {
            throw new Error('Must authenticate first');
        }

        console.log('\n🏗️  Creating application session...');
        console.log(`   Participants: ${this.userAddress}, ${partnerAddress}`);

        const appDefinition = {
            application: 'Yellow',
            protocol: 'NitroRPC/0.4',
            participants: [this.userAddress, partnerAddress],
            weights: options.weights || [50, 50],
            quorum: options.quorum || 100,
            challenge_duration: options.challengeDuration || 0,
            nonce: Date.now()
        };

        // Initial allocations (20 USDC total = 20,000,000 units with 6 decimals)
        const allocations = options.allocations || [
            { participant: this.userAddress, asset: 'ytest.usd', amount: '10000000' },
            { participant: partnerAddress, asset: 'ytest.usd', amount: '10000000' }
        ];

        console.log('   Allocations:', allocations);

        // Create signed session message
        const sessionMessage = await createAppSessionMessage(
            this.sessionSigner,
            {
                definition: appDefinition,
                allocations
            }
        );

        this.ws.send(sessionMessage);
        console.log('✅ Session request sent!\n');
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Session creation timeout')), 30000);
            
            const checkSession = setInterval(() => {
                if (this.sessionId) {
                    clearTimeout(timeout);
                    clearInterval(checkSession);
                    resolve(this.sessionId);
                }
            }, 100);
        });
    }

    /**
     * Step 3: Send messages in the session
     */
    async sendMessage(messageType, data) {
        if (!this.sessionId) {
            throw new Error('No active session');
        }

        const message = {
            session_id: this.sessionId,
            type: messageType,
            data,
            timestamp: Date.now()
        };

        // Sign the message
        const signature = await this.sessionSigner(JSON.stringify(message));
        
        this.ws.send(JSON.stringify({
            ...message,
            signature,
            sender: this.userAddress
        }));
        
        console.log(`📤 Message sent: ${messageType}`);
    }

    /**
     * Handle incoming messages
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            
            // Handle auth challenge
            if (message.res && message.res[1] === 'auth_challenge') {
                this.handleAuthChallenge(message);
            }
            // Handle auth success
            else if (message.res && message.res[1] === 'auth_verify') {
                const verifyData = message.res[2];
                if (verifyData && verifyData.address) {
                    console.log('✅ Authentication successful!\n');
                    this.isAuthenticated = true;
                }
            }
            // Handle session creation
            else if (message.res && message.res[1] === 'create_app_session') {
                const sessionData = message.res[2];
                if (sessionData && sessionData.app_session_id) {
                    this.sessionId = sessionData.app_session_id;
                    console.log('✅ Session created!');
                    console.log(`   Session ID: ${this.sessionId}\n`);
                } else if (sessionData && sessionData.error) {
                    console.error('❌ Session creation failed:', sessionData.error);
                }
            }
            // Handle session messages
            else if (message.type === 'session_message') {
                console.log('📨 App message received:', message.data);
                // Handle your application logic here
            }
            // Handle errors
            else if (message.res && message.res[1] === 'error') {
                const errorData = message.res[2];
                console.error('❌ Error:', errorData.error || errorData);
            }
        } catch (error) {
            console.error('Error handling message:', error.message);
        }
    }

    /**
     * Handle authentication challenge
     */
    async handleAuthChallenge(message) {
        const challengeData = message.res[2];
        const challenge = challengeData.challenge_message || challengeData.challenge;
        
        const eip712Signer = createEIP712AuthMessageSigner(
            this.walletClient,
            {
                session_key: this.sessionKey,
                allowances: [{
                    asset: 'ytest.usd',
                    amount: '1000000000'
                }],
                expires_at: (Math.floor(Date.now() / 1000) + 7200).toString(),
                scope: 'console',
            },
            {
                name: 'Yellow',
            }
        );
        
        const authVerifyMsg = await createAuthVerifyMessageFromChallenge(
            eip712Signer,
            challenge
        );
        
        this.ws.send(authVerifyMsg);
    }

    /**
     * Close connection
     */
    close() {
        if (this.ws) {
            this.ws.close();
            console.log('👋 Disconnected from Yellow Network');
        }
    }
}

// ============================================================================
// Example Usage
// ============================================================================

async function runExample() {
    const app = new YellowNetworkApp();
    
    try {
        // Step 1: Initialize
        const userAddress = await app.init();
        
        // Step 2: Create a session with a partner
        const partnerAddress = '0x44D113bD4682EEcFC2D2E47949593b0501C3661f'; // Your 2nd wallet
        
        const sessionId = await app.createSession(partnerAddress, {
            weights: [50, 50],
            quorum: 100,
            challengeDuration: 0,
            allocations: [
                { participant: userAddress, asset: 'ytest.usd', amount: '10000000' },
                { participant: partnerAddress, asset: 'ytest.usd', amount: '10000000' }
            ]
        });
        
        console.log(`🎉 Success! Session ready: ${sessionId}\n`);
        
        // Step 3: Send a message in the session
        await app.sendMessage('test_message', {
            content: 'Hello from Yellow Network!',
            value: 100
        });
        
        // Keep connection open for a bit
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Cleanup
        app.close();
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        app.close();
        process.exit(1);
    }
}

// Run the example
if (require.main === module) {
    runExample();
}

// Export for use in other scripts
export { YellowNetworkApp };
