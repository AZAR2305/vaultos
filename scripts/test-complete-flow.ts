/**
 * Complete Yellow Network Integration Test
 * 
 * Tests the entire flow:
 * 1. Request testnet tokens from faucet
 * 2. Wait for tokens to arrive
 * 3. Create session and channel
 * 4. Test deposit to channel
 * 5. Test withdrawal from channel
 * 6. Verify balances at each step
 */

import axios from 'axios';
import { ethers } from 'ethers';

const BASE_URL = 'http://localhost:3000/api';
const WALLET_ADDRESS = '0xFefa60F5aA4069F96b9Bf65c814DDb3A604974e1';
const YTEST_USD_TOKEN = '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb';
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';

// ERC-20 ABI for balance check
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkTokenBalance(): Promise<string> {
  try {
    const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
    const contract = new ethers.Contract(YTEST_USD_TOKEN, ERC20_ABI, provider);
    
    const balance = await contract.balanceOf(WALLET_ADDRESS);
    const decimals = await contract.decimals();
    const formattedBalance = ethers.formatUnits(balance, decimals);
    
    return formattedBalance;
  } catch (error) {
    console.error('❌ Error checking balance:', error);
    return '0';
  }
}

async function requestFaucetTokens(): Promise<boolean> {
  console.log('\n🚰 Step 1: Requesting testnet tokens from faucet...');
  console.log(`   Address: ${WALLET_ADDRESS}`);
  
  try {
    const response = await axios.post(`${BASE_URL}/yellow/request-faucet`, {
      address: WALLET_ADDRESS,
    });

    if (response.data.success) {
      console.log('✅ Faucet request successful!');
      console.log(`   Message: ${response.data.message}`);
      return true;
    } else {
      console.log('⚠️  Faucet request returned false:', response.data.message);
      return false;
    }
  } catch (error: any) {
    console.error('❌ Faucet request failed:', error.response?.data || error.message);
    return false;
  }
}

async function waitForTokens(): Promise<boolean> {
  console.log('\n⏳ Step 2: Waiting for tokens to arrive (max 2 minutes)...');
  
  const startBalance = await checkTokenBalance();
  console.log(`   Starting balance: ${startBalance} ytest.USD`);
  
  const maxAttempts = 24; // 2 minutes (24 * 5 seconds)
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    await sleep(5000); // Wait 5 seconds between checks
    attempts++;
    
    const currentBalance = await checkTokenBalance();
    console.log(`   [${attempts}/${maxAttempts}] Current balance: ${currentBalance} ytest.USD`);
    
    if (parseFloat(currentBalance) > parseFloat(startBalance)) {
      console.log(`✅ Tokens received! Balance: ${currentBalance} ytest.USD`);
      return true;
    }
  }
  
  console.log('⚠️  Tokens did not arrive within 2 minutes');
  return false;
}

async function createSession(depositAmount: number = 1000): Promise<string | null> {
  console.log('\n📝 Step 3: Creating Yellow Network session...');
  console.log(`   Wallet: ${WALLET_ADDRESS}`);
  console.log(`   Deposit: ${depositAmount} ytest.USD`);
  
  try {
    const response = await axios.post(`${BASE_URL}/session/create`, {
      walletAddress: WALLET_ADDRESS,
      depositAmount,
    });

    if (response.data.success) {
      console.log('✅ Session created successfully!');
      console.log(`   Session ID: ${response.data.session.sessionId}`);
      console.log(`   Channel ID: ${response.data.session.channelId}`);
      console.log(`   Deposit: ${response.data.session.depositAmount} ytest.USD`);
      console.log(`   Session Address: ${response.data.session.sessionAddress}`);
      return response.data.session.sessionId;
    } else {
      console.log('❌ Session creation failed:', response.data.message);
      return null;
    }
  } catch (error: any) {
    console.error('❌ Session creation error:', error.response?.data || error.message);
    return null;
  }
}

async function getSessionInfo(sessionId: string): Promise<any> {
  try {
    const response = await axios.get(`${BASE_URL}/session/${sessionId}`);
    return response.data.session;
  } catch (error: any) {
    console.error('❌ Error getting session info:', error.response?.data || error.message);
    return null;
  }
}

async function depositToChannel(sessionId: string, amount: number): Promise<boolean> {
  console.log('\n💰 Step 4: Testing deposit to channel...');
  console.log(`   Session ID: ${sessionId}`);
  console.log(`   Deposit Amount: ${amount} ytest.USD`);
  
  try {
    const response = await axios.post(`${BASE_URL}/session/deposit`, {
      sessionId,
      amount,
    });

    if (response.data.success) {
      console.log('✅ Deposit successful!');
      console.log(`   New Balance: ${response.data.balance} ytest.USD`);
      console.log(`   Channel ID: ${response.data.channelId}`);
      return true;
    } else {
      console.log('❌ Deposit failed:', response.data.message);
      return false;
    }
  } catch (error: any) {
    console.error('❌ Deposit error:', error.response?.data || error.message);
    return false;
  }
}

async function withdrawFromChannel(sessionId: string, amount: number): Promise<boolean> {
  console.log('\n💸 Step 5: Testing withdrawal from channel...');
  console.log(`   Session ID: ${sessionId}`);
  console.log(`   Withdrawal Amount: ${amount} ytest.USD`);
  
  try {
    const response = await axios.post(`${BASE_URL}/session/withdraw`, {
      sessionId,
      amount,
    });

    if (response.data.success) {
      console.log('✅ Withdrawal successful!');
      console.log(`   New Balance: ${response.data.balance} ytest.USD`);
      console.log(`   Channel ID: ${response.data.channelId}`);
      return true;
    } else {
      console.log('❌ Withdrawal failed:', response.data.message);
      return false;
    }
  } catch (error: any) {
    console.error('❌ Withdrawal error:', error.response?.data || error.message);
    return false;
  }
}

async function closeSession(sessionId: string): Promise<boolean> {
  console.log('\n🔒 Step 6: Closing session...');
  
  try {
    const response = await axios.post(`${BASE_URL}/session/close`, {
      sessionId,
    });

    if (response.data.success) {
      console.log('✅ Session closed successfully!');
      console.log(`   Final Balance: ${response.data.finalBalance} ytest.USD`);
      return true;
    } else {
      console.log('❌ Session close failed:', response.data.message);
      return false;
    }
  } catch (error: any) {
    console.error('❌ Session close error:', error.response?.data || error.message);
    return false;
  }
}

async function runCompleteTest() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Yellow Network Complete Integration Test                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  let sessionId: string | null = null;
  
  try {
    // Step 1: Check initial balance
    console.log('\n🔍 Checking initial balance...');
    const initialBalance = await checkTokenBalance();
    console.log(`   Balance: ${initialBalance} ytest.USD`);
    
    // Step 2: Request faucet tokens if balance is low
    if (parseFloat(initialBalance) < 100) {
      console.log('\n⚠️  Low balance detected, requesting tokens...');
      const faucetSuccess = await requestFaucetTokens();
      
      if (faucetSuccess) {
        const tokensArrived = await waitForTokens();
        if (!tokensArrived) {
          console.log('\n⚠️  Proceeding with existing balance...');
        }
      }
    } else {
      console.log('✅ Sufficient balance for testing');
    }
    
    // Step 3: Create session
    sessionId = await createSession(1000);
    if (!sessionId) {
      console.log('\n❌ Cannot proceed without session');
      process.exit(1);
    }
    
    // Step 4: Verify session was created
    await sleep(2000);
    const sessionInfo = await getSessionInfo(sessionId);
    if (sessionInfo) {
      console.log('\n✅ Session verification:');
      console.log(`   Session ID: ${sessionInfo.sessionId}`);
      console.log(`   Channel ID: ${sessionInfo.channelId}`);
      console.log(`   Deposit: ${sessionInfo.depositAmount} ytest.USD`);
      console.log(`   Wallet: ${sessionInfo.walletAddress}`);
    }
    
    // Step 5: Test deposit
    await sleep(2000);
    const depositSuccess = await depositToChannel(sessionId, 500);
    
    if (depositSuccess) {
      await sleep(2000);
      const afterDeposit = await getSessionInfo(sessionId);
      console.log(`   Deposit amount after deposit: ${afterDeposit?.depositAmount} ytest.USD`);
    }
    
    // Step 6: Test withdrawal
    await sleep(2000);
    const withdrawSuccess = await withdrawFromChannel(sessionId, 200);
    
    if (withdrawSuccess) {
      await sleep(2000);
      const afterWithdraw = await getSessionInfo(sessionId);
      console.log(`   Deposit amount after withdrawal: ${afterWithdraw?.depositAmount} ytest.USD`);
    }
    
    // Step 7: Close session
    await sleep(2000);
    await closeSession(sessionId);
    
    // Step 8: Final balance check
    await sleep(2000);
    const finalBalance = await checkTokenBalance();
    console.log(`\n💰 Final token balance: ${finalBalance} ytest.USD`);
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║   Test Complete!                                          ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    
    // Try to close session if it was created
    if (sessionId) {
      console.log('\n🧹 Cleaning up session...');
      await closeSession(sessionId);
    }
    
    process.exit(1);
  }
}

// Run the test
runCompleteTest().catch(console.error);
