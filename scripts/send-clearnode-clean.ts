/**
 * Send to Yellow Clearnode - Clean Version
 * Shows: Initial balance → Transfer with hash → Final balance
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
const CLEARNODE_ADDRESS = '0x7df1fef832b57e46de2e1541951289c04b2781aa';

console.log('\n💸 ==================================');
console.log('   Yellow Network Transfer & Balance');
console.log('==================================\n');

let authenticated = false;
let initialBalanceChecked = false;
let transferSent = false;
let finalBalanceChecked = false;

async function main() {
    const ADMIN_KEY = process.env.PRIVATE_KEY as `0x${string}`;
    if (!ADMIN_KEY) {
        console.error('❌ PRIVATE_KEY not set');
        return;
    }

    const adminAccount = privateKeyToAccount(ADMIN_KEY);
    const sessionPrivateKey = generatePrivateKey();
    const sessionAccount = privateKeyToAccount(sessionPrivateKey);
    const sessionSigner = createECDSAMessageSigner(sessionPrivateKey);

    console.log(`Admin Wallet: ${adminAccount.address}`);
    console.log(`Clearnode: ${CLEARNODE_ADDRESS}\n`);

    const ws = new WebSocket(CLEARNODE_URL);

    ws.on('open', async () => {
        console.log('✅ Connected to Yellow Network\n');
        
        const authParams = {
            address: adminAccount.address,
            application: 'VaultOS',
            session_key: sessionAccount.address,
            allowances: [{ asset: 'ytest.usd', amount: '1000000000' }],
            expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600),
            scope: 'transfer',
        };

        const authRequestMsg = await createAuthRequestMessage(authParams);
        ws.send(authRequestMsg);
        console.log('📤 Authenticating...');
    });

    ws.on('message', async (data) => {
        const response = JSON.parse(data.toString());
        const messageType = response.res?.[1];

        if (messageType === 'auth_challenge' && !authenticated) {
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
                scope: 'transfer',
            };

            const signer = createEIP712AuthMessageSigner(
                walletClient,
                authParamsForSigning,
                { name: 'VaultOS' }
            );

            const verifyMsg = await createAuthVerifyMessageFromChallenge(signer, challenge);
            ws.send(verifyMsg);
        }

        if (messageType === 'auth_verify' && !authenticated) {
            authenticated = true;
            console.log('✅ Authenticated\n');
            
            // Check initial balance
            setTimeout(async () => {
                console.log('📋 Step 1: Initial Ledger Balance');
                console.log('----------------------------------');
                const msg = await createGetLedgerBalancesMessage(
                    sessionSigner,
                    adminAccount.address,
                    Date.now()
                );
                ws.send(msg);
            }, 300);
        }

        if (messageType === 'get_ledger_balances') {
            const balances = response.res[2].ledger_balances;
            const usdBal = balances.find((b: any) => b.asset === 'ytest.usd');
            const amount = usdBal ? parseFloat(usdBal.amount) / 1000000 : 0;
            
            if (!initialBalanceChecked) {
                initialBalanceChecked = true;
                console.log(`💰 Balance: ${amount.toFixed(2)} ytest.usd`);
                console.log(`   (Raw amount: ${usdBal.amount})\n`);

                if (amount < 10) {
                    console.log('⚠️  Insufficient balance for transfer\n');
                    ws.close();
                    return;
                }

                // Send transfer
                setTimeout(async () => {
                    console.log('📋 Step 2: Send Transfer');
                    console.log('----------------------------------');
                    console.log(`💸 Sending 10 ytest.usd → clearnode...\n`);
                    
                    const transferMsg = await createTransferMessage(
                        sessionSigner,
                        {
                            destination: CLEARNODE_ADDRESS,
                            allocations: [{ asset: 'ytest.usd', amount: '10000000' }], // 10 * 1000000 (6 decimals)
                        },
                        Date.now()
                    );
                    ws.send(transferMsg);
                    transferSent = true;
                }, 500);
            } else if (transferSent && !finalBalanceChecked) {
                finalBalanceChecked = true;
                console.log(`💰 Balance: ${amount.toFixed(2)} ytest.usd`);
                console.log(`   (Raw amount: ${usdBal.amount})\n`);
                
                console.log('✅ Complete!\n');
                setTimeout(() => ws.close(), 1000);
            }
        }

        if (messageType === 'transfer' && transferSent && !finalBalanceChecked) {
            console.log('✅ Transfer confirmed!');
            console.log(`   Transfer ID: ${response.res[0]}`);
            console.log(`   Timestamp: ${new Date().toISOString()}`);
            console.log(`   Cost: ZERO gas (off-chain)`);
            console.log(`   Speed: < 1 second\n`);

            // Check final balance
            setTimeout(async () => {
                console.log('📋 Step 3: Final Ledger Balance');
                console.log('----------------------------------');
                const msg = await createGetLedgerBalancesMessage(
                    sessionSigner,
                    adminAccount.address,
                    Date.now()
                );
                ws.send(msg);
            }, 500);
        }
    });

    ws.on('error', (error) => {
        console.error('❌ Error:', error.message);
    });

    ws.on('close', () => {
        console.log('🔌 Connection closed\n');
        process.exit(0);
    });

    setTimeout(() => {
        if (!finalBalanceChecked) {
            console.log('\n⏱️  Timeout\n');
            ws.close();
        }
    }, 20000);
}

main().catch(console.error);
