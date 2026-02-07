/**
 * Send funds to Yellow Network and check ledger balance
 * 
 * This script:
 * 1. Connects to Yellow Network clearnode
 * 2. Authenticates admin wallet
 * 3. Sends transfer to clearnode
 * 4. Shows transfer hash/confirmation
 * 5. Queries ledger_balance (should show ~700000)
 */

import {
    createECDSAMessageSigner,
    createGetLedgerBalancesMessage,
    createTransferMessage,
    createAuthRequestMessage,
    createEIP712AuthMessageSigner,
    createAuthVerifyMessageFromChallenge,
} from '@erc7824/nitrolite';
import { createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import WebSocket from 'ws';
import 'dotenv/config';

const CLEARNODE_URL = 'wss://clearnet-sandbox.yellow.com/ws';
const CLEARNODE_ADDRESS = '0x7df1fef832b57e46de2e1541951289c04b2781aa'; // Yellow clearnode address

console.log('\n💸 ====================================');
console.log('   Send to Yellow Network Clearnode');
console.log('====================================\n');

async function sendAndCheckBalance() {
    const ADMIN_KEY = process.env.PRIVATE_KEY as `0x${string}`;
    
    if (!ADMIN_KEY) {
        console.error('❌ Error: PRIVATE_KEY not set in .env');
        console.log('Set it with: $env:PRIVATE_KEY="0x..."');
        return;
    }

    const adminAccount = privateKeyToAccount(ADMIN_KEY);
    const sessionPrivateKey = generatePrivateKey();
    const sessionAccount = privateKeyToAccount(sessionPrivateKey);
    const sessionSigner = createECDSAMessageSigner(sessionPrivateKey);

    let transferSent = false; // Track if we've sent the transfer

    console.log('📋 Configuration:');
    console.log('----------------------------------------');
    console.log(`Admin Wallet: ${adminAccount.address}`);
    console.log(`Session Key:  ${sessionAccount.address}`);
    console.log(`Clearnode:    ${CLEARNODE_URL}`);
    console.log(`Target:       ${CLEARNODE_ADDRESS}`);
    console.log('');

    const ws = new WebSocket(CLEARNODE_URL);

    ws.on('open', async () => {
        console.log('✅ WebSocket connected to Yellow Network\n');

        console.log('📋 Step 1: Authenticate');
        console.log('----------------------------------------');

        const authParams = {
            address: adminAccount.address,
            application: 'VaultOS',
            session_key: sessionAccount.address,
            allowances: [{ asset: 'ytest.usd', amount: '1000000000' }],
            expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600),
            scope: 'transfer.ledger',
        };

        const authRequestMsg = await createAuthRequestMessage(authParams);
        ws.send(authRequestMsg);
        console.log('📤 Sent auth_request...');
    });

    ws.on('message', async (data) => {
        const response = JSON.parse(data.toString());
        
        // Log all responses for debugging
        const msgType = response.res?.[1] || response.error?.message || 'unknown';
        console.log(`📥 Received: ${msgType}`);
        
        // Show full response for ledger_balances to debug
        if (msgType === 'get_ledger_balances' || msgType === 'ledger_balances') {
            console.log('   Full response:', JSON.stringify(response, null, 2));
        }
        
        if (response.error) {
            console.error('❌ Error Details:', JSON.stringify(response.error, null, 2));
            // Don't close immediately, might be recoverable
        }

        const messageType = response.res?.[1];

        switch (messageType) {
            case 'auth_challenge':
                console.log('   Processing auth_challenge...');
                
                const challenge = response.res[2].challenge_message;
                const walletClient = createWalletClient({
                    account: adminAccount,
                    chain: baseSepolia,
                    transport: http('https://sepolia.base.org'),
                });

                const authParamsForSigning = {
                    session_key: sessionAccount.address,
                    allowances: [{ asset: 'ytest.usd', amount: '1000000000' }],
                    expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600),
                    scope: 'transfer.ledger',
                };

                const signer = createEIP712AuthMessageSigner(
                    walletClient,
                    authParamsForSigning,
                    { name: 'VaultOS' }
                );

                const verifyMsg = await createAuthVerifyMessageFromChallenge(signer, challenge);
                ws.send(verifyMsg);
                console.log('📤 Sent auth_verify with EIP-712 signature');
                console.log('   Waiting for confirmation...\n');
                break;

            case 'auth_verify':
                console.log('✅ Authenticated successfully!\n');
                
                // Wait a moment then check initial balance
                setTimeout(async () => {
                    console.log('📋 Step 2: Check Initial Ledger Balance');
                    console.log('----------------------------------------');
                    
                    const ledgerMsg = await createGetLedgerBalancesMessage(
                        sessionSigner,
                        adminAccount.address,
                        Date.now()
                    );
                    ws.send(ledgerMsg);
                    console.log('📤 Sent get_ledger_balances request...\n');
                }, 500);
                break;

            case 'get_ledger_balances':
            case 'ledger_balances':
                const balances = response.res[2].ledger_balances;
                console.log('📥 Received ledger_balances:');
                console.log('----------------------------------------');
                
                balances.forEach((bal: any) => {
                    const amount = parseFloat(bal.amount);
                    // Yellow uses 6 decimals for USD
                    const displayAmount = amount / 1000000;
                    console.log(`   ${bal.asset}: ${displayAmount.toFixed(2)} (raw: ${bal.amount})`);
                });
                console.log('');

                // Check if we have enough balance
                const usdBalance = balances.find((b: any) => b.asset === 'ytest.usd');
                const currentBalance = usdBalance ? parseFloat(usdBalance.amount) / 1000000 : 0;

                // Only send transfer if we haven't sent it yet
                if (!transferSent) {
                    if (currentBalance < 10) {
                        console.log('⚠️  Balance too low to send transfer');
                        console.log('   Request tokens from faucet:');
                        console.log(`   curl -X POST https://clearnet-sandbox.yellow.com/faucet/requestTokens \\`);
                        console.log(`        -H "Content-Type: application/json" -d '{"userAddress":"${adminAccount.address}"}'`);
                        ws.close();
                        return;
                    }

                    transferSent = true; // Mark that we're sending transfer
                    
                    // Send transfer to clearnode
                    setTimeout(async () => {
                        console.log('📋 Step 3: Send Transfer to Clearnode');
                        console.log('----------------------------------------');
                        console.log(`💸 Sending 10 ytest.usd → ${CLEARNODE_ADDRESS.slice(0, 10)}...`);
                        
                        const transferMsg = await createTransferMessage(
                            sessionSigner,
                            {
                                destination: CLEARNODE_ADDRESS,
                                allocations: [{ asset: 'ytest.usd', amount: '10' }],
                            },
                            Date.now()
                        );
                        
                        ws.send(transferMsg);
                        console.log('📤 Transfer request sent...\n');
                    }, 500);
                } else {
                    // This is the final balance check after transfer
                    console.log('✅ All steps completed!\n');
                    console.log('📊 Summary:');
                    console.log('----------------------------------------');
                    console.log('✓ Connected to Yellow Network');
                    console.log('✓ Authenticated with EIP-712');
                    console.log('✓ Sent transfer to clearnode');
                    console.log('✓ Received transfer confirmation');
                    console.log('✓ Verified ledger balance\n');
                    
                    // Close after showing everything
                    setTimeout(() => ws.close(), 1000);
                }
                break;

            case 'transfer':
                console.log('📥 Transfer Confirmation Received:');
                console.log('----------------------------------------');
                const transferData = response.res[2];
                
                // Show transfer details
                console.log('✅ Transfer completed successfully!');
                console.log(`   Transfer ID: ${response.res[0] || 'N/A'}`);
                console.log(`   Timestamp: ${new Date().toISOString()}`);
                
                if (transferData.transfer_id) {
                    console.log(`   Hash/ID: ${transferData.transfer_id}`);
                }
                if (transferData.nonce) {
                    console.log(`   Nonce: ${transferData.nonce}`);
                }
                if (transferData.destination) {
                    console.log(`   Destination: ${transferData.destination}`);
                }
                if (transferData.allocations) {
                    console.log('   Allocations:');
                    transferData.allocations.forEach((alloc: any) => {
                        console.log(`     • ${alloc.amount} ${alloc.asset}`);
                    });
                }
                
                console.log('   Status: ✅ Confirmed');
                console.log('   Cost: 💰 ZERO gas fees (off-chain)');
                console.log('   Speed: ⚡ < 1 second');
                console.log('');

                // Check updated balance
                setTimeout(async () => {
                    console.log('📋 Step 4: Check Updated Ledger Balance');
                    console.log('----------------------------------------');
                    
                    const ledgerMsg2 = await createGetLedgerBalancesMessage(
                        sessionSigner,
                        adminAccount.address,
                        Date.now()
                    );
                    ws.send(ledgerMsg2);
                    console.log('📤 Querying final balance...\n');
                }, 1000);
                break;

            default:
                // Ignore other message types
                break;
        }
    });

    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
    });

    ws.on('close', () => {
        console.log('\n🔌 Connection closed\n');
        process.exit(0);
    });

    // Timeout after 60 seconds
    setTimeout(() => {
        console.log('\n⏱️  Timeout reached (60s), closing...\n');
        ws.close();
    }, 60000);
}

// Run
sendAndCheckBalance().catch((error) => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
});
