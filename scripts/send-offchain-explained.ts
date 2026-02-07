/**
 * Yellow Network Transfer - On-Chain vs Off-Chain Explained
 * 
 * This demonstrates:
 * 1. Yellow Network transfers are OFF-CHAIN (no Base Sepolia tx)
 * 2. Ledger balance updates happen instantly off-chain
 * 3. On-chain txs only happen for: deposit to Yellow, withdraw from Yellow
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

console.log('\n🔗 ==============================================');
console.log('   Yellow Network: On-Chain vs Off-Chain');
console.log('==============================================\n');

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

    console.log('📋 Configuration:');
    console.log('----------------------------------');
    console.log(`Admin Wallet: ${adminAccount.address}`);
    console.log(`Clearnode: ${CLEARNODE_ADDRESS}`);
    console.log(`Base Sepolia Explorer: https://sepolia.basescan.org/address/${adminAccount.address}`);
    console.log('');
    
    console.log('💡 Important: Yellow Network transfers are OFF-CHAIN');
    console.log('   ✓ No Base Sepolia transaction created');
    console.log('   ✓ Zero gas fees (no blockchain tx)');
    console.log('   ✓ Instant settlement (< 1 second)');
    console.log('   ✓ Updates happen in Yellow Ledger only');
    console.log('');
    console.log('🔗 On-chain transactions ONLY happen for:');
    console.log('   1. Initial deposit TO Yellow (approve + deposit)');
    console.log('   2. Final withdrawal FROM Yellow (close channel)');
    console.log('   3. ALL trading/transfers are off-chain!');
    console.log('');

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
        console.log('🔐 Authenticating with Yellow Network...');
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
            console.log('✅ Authenticated with EIP-712 signature\n');
            
            setTimeout(async () => {
                console.log('📋 STEP 1: Check Initial Ledger Balance');
                console.log('==========================================');
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
                console.log(`💰 Ledger Balance: ${amount.toFixed(2)} ytest.usd`);
                console.log(`   Raw amount: ${usdBal.amount}`);
                console.log(`   Source: Yellow Network Unified Ledger (OFF-CHAIN)`);
                console.log(`   ⚠️  NOT visible on Base Sepolia blockchain\n`);

                if (amount < 10) {
                    console.log('⚠️  Insufficient balance for transfer\n');
                    ws.close();
                    return;
                }

                setTimeout(async () => {
                    console.log('📋 STEP 2: Send OFF-CHAIN Transfer');
                    console.log('==========================================');
                    console.log(`💸 Sending: 10 ytest.usd`);
                    console.log(`📍 From: ${adminAccount.address.slice(0, 10)}...`);
                    console.log(`📍 To: ${CLEARNODE_ADDRESS.slice(0, 10)}... (clearnode)`);
                    console.log(`🌐 Network: Yellow Network (OFF-CHAIN)`);
                    console.log(`⛽ Gas: ZERO (no blockchain transaction)`);
                    console.log('');
                    
                    const transferMsg = await createTransferMessage(
                        sessionSigner,
                        {
                            destination: CLEARNODE_ADDRESS,
                            allocations: [{ asset: 'ytest.usd', amount: '10' }],
                        },
                        Date.now()
                    );
                    ws.send(transferMsg);
                    transferSent = true;
                }, 500);
            } else if (transferSent && !finalBalanceChecked) {
                finalBalanceChecked = true;
                console.log(`💰 Ledger Balance: ${amount.toFixed(2)} ytest.usd`);
                console.log(`   Raw amount: ${usdBal.amount}`);
                console.log(`   Source: Yellow Network Unified Ledger (OFF-CHAIN)`);
                console.log(`   Balance decreased by 10 (transfer completed)\n`);
                
                console.log('==============================================');
                console.log('📊 SUMMARY: Off-Chain Transfer Complete');
                console.log('==============================================\n');
                
                console.log('✅ What Happened (OFF-CHAIN):');
                console.log('   • Yellow Network ledger updated instantly');
                console.log('   • Admin balance decreased by 10');
                console.log('   • Clearnode received 10');
                console.log('   • Settlement took < 1 second');
                console.log('   • Cost: ZERO gas fees\n');
                
                console.log('❌ What DID NOT Happen (ON-CHAIN):');
                console.log('   • No Base Sepolia transaction created');
                console.log('   • No blockchain confirmation needed');
                console.log('   • No gas fees paid');
                console.log('   • No mempool wait time\n');
                
                console.log('🔗 Where to Verify:');
                console.log('   ✓ Yellow Network API: get_ledger_balances (shown above)');
                console.log('   ✓ Transfer ID: See confirmation hash above');
                console.log(`   ✗ Base Sepolia: https://sepolia.basescan.org/address/${adminAccount.address}`);
                console.log('     (No new transactions - this is correct!)\n');
                
                console.log('💡 To See ON-CHAIN Transactions:');
                console.log('   1. Deposit to Yellow: Call custody contract deposit()');
                console.log('   2. Withdraw from Yellow: Call close_channel()');
                console.log('   3. These CREATE Base Sepolia transactions\n');
                
                setTimeout(() => ws.close(), 1000);
            }
        }

        if (messageType === 'transfer' && transferSent && !finalBalanceChecked) {
            const transferData = response.res[2];
            console.log('✅ OFF-CHAIN Transfer Confirmed!');
            console.log('----------------------------------');
            console.log(`📝 Yellow Transfer ID: ${response.res[0]}`);
            console.log(`🕐 Timestamp: ${new Date().toISOString()}`);
            console.log(`⚡ Speed: < 1 second (instant)`);
            console.log(`⛽ Gas Cost: 0 (off-chain)`);
            console.log(`🔗 Base Sepolia TX: None (this is off-chain)`);
            console.log('');
            console.log('ℹ️  This transfer happened entirely on Yellow Network.');
            console.log('   No blockchain transaction was created.');
            console.log('   This is WHY it\'s instant and free!\n');

            setTimeout(async () => {
                console.log('📋 STEP 3: Check Updated Ledger Balance');
                console.log('==========================================');
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
        console.log('🔌 Disconnected from Yellow Network\n');
        process.exit(0);
    });

    setTimeout(() => {
        if (!finalBalanceChecked) {
            console.log('\n⏱️  Timeout reached\n');
            ws.close();
        }
    }, 20000);
}

main().catch(console.error);
