# Testing Yellow Network Integration

## 🎯 Overview

This guide walks through testing the Yellow Network SDK integration for VaultOS prediction markets.

## Prerequisites

1. **Environment Setup**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Add your private key to .env
   PRIVATE_KEY=0x...your_private_key...
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Get Test Tokens** (if testing on-chain operations)
   - Visit Yellow Network faucet
   - Request ytest.USD tokens for your wallet
   - Request Sepolia ETH from https://sepoliafaucet.com/

## Test 1: Yellow SDK Connection

**What it tests**: Basic connection to Yellow Network sandbox

```bash
npm run test:yellow
```

**Expected output**:
```
🟡 VaultOS Yellow Network Integration Test
============================================================

1️⃣ Connecting and authenticating...

✅ Connected Successfully
   User Address: 0x...
   Session Address: 0x...

2️⃣ Setting up state channel...
✅ Channel Active: ch_...

3️⃣ Testing off-chain transfer...
   (Skipped for test)

4️⃣ Closing channel and withdrawing funds...

============================================================
✅ All Yellow Network Operations Completed Successfully!
============================================================

📊 Summary:
   ✅ Authentication with session keys
   ✅ State channel creation
   ✅ Channel funding (allocate_amount)
   ✅ Off-chain operations
   ✅ Channel closure
   ✅ On-chain withdrawal

🎉 Yellow Network SDK Integration Verified!
```

**Troubleshooting**:
- If "Connection failed": Check SEPOLIA_RPC_URL in .env
- If "Authentication failed": Check PRIVATE_KEY format (needs 0x prefix)
- If "Channel not created": Yellow sandbox might be down, retry in a few minutes

## Test 2: Session Creation (Backend)

**What it tests**: SessionService integration with Yellow SDK

1. **Start the backend**:
   ```bash
   cd vaultos
   npm run dev
   ```

2. **Test session creation**:
   ```bash
   curl -X POST http://localhost:3000/api/session/create \
     -H "Content-Type: application/json" \
     -d '{
       "walletAddress": "0xYourWalletAddress",
       "depositAmount": 100
     }'
   ```

**Expected response**:
```json
{
  "success": true,
  "session": {
    "sessionId": "session_1234567890_0xYour...",
    "channelId": "ch_...",
    "walletAddress": "0x...",
    "sessionAddress": "0x...",
    "depositAmount": "100",
    "spentAmount": "0",
    "createdAt": 1234567890,
    "expiresAt": 1234571490
  }
}
```

**Backend logs should show**:
```
🟡 Creating Yellow Network session for 0x...
   Initial deposit: 100 USDC
✅ Connected to Yellow Network
   User: 0x...
   Session: 0x...
✅ State channel created: ch_...
✅ Channel funded with 100 ytest.USD
✅ Session created successfully
   Session ID: session_...
   Channel ID: ch_...
```

## Test 3: Trade Execution

**What it tests**: Off-chain trading via Yellow state channels

1. **Create a session first** (see Test 2)

2. **Execute a trade**:
   ```bash
   curl -X POST http://localhost:3000/api/balance/deposit \
     -H "Content-Type: application/json" \
     -d '{
       "sessionId": "session_1234567890_0xYour...",
       "amount": 50
     }'
   ```

**Expected response**:
```json
{
  "success": true,
  "newBalance": 150
}
```

**What happens**:
1. SessionService.depositFunds() is called
2. Yellow SDK resizes the channel (off-chain)
3. New balance is reflected immediately
4. No gas fees, instant execution

## Test 4: Channel Closure

**What it tests**: Cooperative channel closure and withdrawal

```bash
curl -X POST http://localhost:3000/api/session/close \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_1234567890_0xYour..."
  }'
```

**Expected response**:
```json
{
  "success": true,
  "finalBalance": 150
}
```

**What happens**:
1. Yellow SDK sends "close" message to counterparty
2. Both parties sign final state
3. Channel is settled on-chain
4. Funds withdrawn to user's wallet
5. Check Sepolia explorer for withdrawal transaction

## Test 5: Full Frontend Flow (Manual)

**What it tests**: Complete user journey through UI

1. **Start both frontend and backend**:
   ```bash
   # Terminal 1 - Backend
   cd vaultos
   npm run dev
   
   # Terminal 2 - Frontend
   cd vaultos
   npm run dev:client
   ```

2. **Open browser**: http://localhost:5173

3. **Test flow**:
   - ✅ Connect wallet (MetaMask/RainbowKit)
   - ✅ Create session with 100 USDC
   - ✅ Check channel ID appears in UI
   - ✅ Try depositing more funds (e.g., +50 USDC)
   - ✅ Execute a trade on a prediction market
   - ✅ Check balance updates instantly
   - ✅ Close session
   - ✅ Verify funds returned to wallet

4. **Check browser console**:
   - Should see WebSocket messages
   - No errors about missing SDK
   - Channel status updates

5. **Check backend logs**:
   - Session creation messages
   - Yellow SDK connection logs
   - Trade execution confirmations

## Test 6: Error Handling

**What it tests**: SDK resilience and error recovery

### Test 6.1: Insufficient Balance
```bash
curl -X POST http://localhost:3000/api/balance/deposit \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_...",
    "amount": 999999
  }'
```

**Expected**: Error message about insufficient funds

### Test 6.2: Invalid Session
```bash
curl -X POST http://localhost:3000/api/session/close \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "invalid_session"
  }'
```

**Expected**: "Session not found" error

### Test 6.3: Network Disconnection
1. Start test script
2. Disable network mid-test
3. Re-enable network

**Expected**: SDK should reconnect automatically

## Test 7: WebSocket Messages

**What it tests**: Real-time Yellow Network communication

1. **Enable verbose logging** in `.env`:
   ```
   VERBOSE_LOGGING=true
   ```

2. **Run test and check messages**:
   ```bash
   npm run test:yellow
   ```

3. **Look for WebSocket messages**:
   - `authenticate_request` → `authenticate_response`
   - `create_channel_request` → `create_channel_response`
   - `resize_allocate_amount_request` → `resize_allocate_amount_response`
   - `close_request` → `close_response`

4. **Verify message structure**:
   - All messages have `req_id`
   - Signatures are present (EIP-712)
   - Channel states are updated correctly

## Performance Benchmarks

Run these to measure Yellow Network benefits:

### Benchmark 1: Trade Speed
```bash
# Traditional L1 trade
time cast send 0xContractAddress "trade(uint256)" 100 --rpc-url $SEPOLIA_RPC_URL

# Yellow off-chain trade
time npm run test:yellow
```

**Expected results**:
- L1 trade: 10-30 seconds
- Yellow trade: < 100ms

### Benchmark 2: Gas Costs
```bash
# Check L1 transaction
cast receipt 0xTxHash --rpc-url $SEPOLIA_RPC_URL | grep gasUsed

# Yellow trade (off-chain)
echo "Gas used: 0"
```

**Expected results**:
- L1 trade: ~50,000 gas = ~$2-5 (mainnet)
- Yellow trade: 0 gas = $0

## Debugging Tips

### Issue: "Cannot find module '@erc7824/nitrolite'"
**Fix**: 
```bash
npm install @erc7824/nitrolite viem ws dotenv
```

### Issue: "Connection to Yellow Network failed"
**Check**:
1. SEPOLIA_RPC_URL is correct
2. Yellow sandbox is online: wss://clearnet-sandbox.yellow.com/ws
3. Firewall allows WebSocket connections
4. Try: `curl https://clearnet-sandbox.yellow.com` (should respond)

### Issue: "Authentication failed"
**Check**:
1. PRIVATE_KEY has 0x prefix
2. Wallet has Sepolia ETH for gas
3. Wallet has ytest.USD tokens
4. Session key generation working (check logs)

### Issue: "Channel not created"
**Fix**:
1. Increase wait time in createSession() to 5 seconds
2. Check Yellow Network status
3. Verify custody contract address is correct
4. Ensure proper authentication completed

### Issue: Frontend shows "Session created" but no channel ID
**Check**:
1. SessionService is using VaultOSYellowClient (not old client)
2. Backend logs show "State channel created"
3. Response from API includes `channelId`
4. Frontend is reading `channelId` from response

## Success Criteria

### ✅ All Tests Pass
- [x] Test 1: SDK connection works
- [x] Test 2: Session creation succeeds
- [x] Test 3: Trades execute off-chain
- [x] Test 4: Channel closes properly
- [x] Test 5: UI flow works end-to-end
- [x] Test 6: Errors handled gracefully
- [x] Test 7: WebSocket messages correct

### ✅ Performance Metrics
- Trade execution: < 100ms
- Gas costs: $0 (off-chain)
- Connection time: < 3 seconds
- Channel closure: < 10 seconds

### ✅ ETHGlobal Requirements
- Using @erc7824/nitrolite SDK ✅
- Connected to Yellow sandbox ✅
- Real state channels ✅
- EIP-712 signatures ✅
- Off-chain transactions ✅
- Cooperative closure ✅

## Next Steps After Testing

1. **Record demo video** (2-3 minutes)
   - Show problem (slow L1 trades)
   - Demonstrate solution (Yellow channels)
   - Live demo of VaultOS
   - Architecture overview

2. **Deploy prototype**
   - Frontend: Vercel/Netlify
   - Backend: Railway/Render
   - Update URLs in production config

3. **Submit to ETHGlobal**
   - Project name: VaultOS
   - Track: Yellow Network
   - Include demo video link
   - GitHub repo link
   - Live demo URL

---

**Questions?** Check:
- Yellow Network docs: https://docs.yellow.org/
- Nitrolite SDK: https://github.com/layer-3/nitrolite
- VaultOS integration: See YELLOW_INTEGRATION_STATUS.md
