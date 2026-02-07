# Yellow Network Sandbox Testing Guide

This guide shows how to create channels and test app sessions using **Yellow Network's sandbox testnet** (no mainnet funds required).

## 🎯 Overview

Yellow Network has 3 layers:
```
┌─────────────────────────────────┐
│ App Sessions (Your Application) │ ← Create prediction markets, payments, etc.
├─────────────────────────────────┤
│ Payment Channels                │ ← Must exist FIRST
├─────────────────────────────────┤
│ Ledger Balance (ytest.usd)      │ ← Get from faucet
└─────────────────────────────────┘
```

## 📋 Prerequisites

1. **Get test tokens** from the faucet:
   ```bash
   # Visit: https://earn-ynetwork.yellownetwork.io
   # Connect wallet: 0xFefa60F5aA4069F96b9Bf65c814DDb3A604974e1
   # Request ytest.usd tokens
   ```

2. **Verify balance**:
   ```bash
   npm run check:channels
   ```

## 🚀 Quick Start

### Step 1: Check Current Status

```bash
npm run check:channels
```

**Expected output if no channels:**
```
📊 Channel Information:
⚠️  No channels found!
🔴 BLOCKER: App sessions require funded channels
```

### Step 2: Create Sandbox Channel

```bash
npm run create:channel
```

**This will:**
- ✅ Connect to Yellow Network Sandbox
- ✅ Authenticate your wallet
- ✅ Create a payment channel (off-chain for testing)
- ✅ Verify channel creation

**Expected output:**
```
🏗️  Yellow Network Sandbox Channel Creation
🔐 Step 1: Authentication...
✅ Authenticated successfully

🏗️  Step 2: Creating sandbox channel...
   Token: ytest.usd
   Amount: 20 USDC (20000000 units)
   Chain: Base Sepolia (84532)

✅ CHANNEL CREATED SUCCESSFULLY!
📋 Channel Details:
   ID: 0x...
   Status: open
   Token: 0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb
   Chain ID: 84532
```

### Step 3: Test Prediction Market

Once channels are created:

```bash
npm run test:prediction
```

**Expected output:**
```
✓ Wallets initialized
  Wallet 1 (Creator):      0xFefa60F5aA4069F96b9Bf65c814DDb3A604974e1
  Wallet 2 (Participant):  0x44D113bD4682EEcFC2D2E47949593b0501C3661f
✅ Connected (49 ytest.usd)
📊 Creating prediction market app session...
✅ Market created!
   Market ID: 0x...
   Question: Will BTC reach $100k by end of 2024?
```

## 📝 Available Scripts

### Channel Management
```bash
npm run check:channels     # Check if channels exist
npm run create:channel     # Create sandbox channel (testnet)
npm run check:balance      # Check ytest.usd balance
```

### Testing
```bash
npm run app                # Run simple Yellow Network app example
npm run test:prediction    # Test prediction market with 2 wallets
npm run test:enhanced      # Test all 27 protocol methods
```

### Debug
```bash
npm run debug:auth         # Debug authentication issues
npm run check:yellow       # Check Yellow Network connection
```

## 🔧 Simple App Example

Run the example app:

```bash
npm run app
```

**What it does:**
1. Connects to Yellow Network Sandbox
2. Authenticates with EIP-712 signatures
3. Creates an application session
4. Sends off-chain messages

**Code example** (see [app.ts](./app.ts)):

```typescript
import { YellowNetworkApp } from './app';

const app = new YellowNetworkApp();

// Step 1: Connect
await app.init();

// Step 2: Create session with partner
const sessionId = await app.createSession('0xPartnerAddress', {
    weights: [50, 50],
    quorum: 100,
    allocations: [
        { participant: app.userAddress, asset: 'ytest.usd', amount: '10000000' },
        { participant: '0xPartnerAddress', asset: 'ytest.usd', amount: '10000000' }
    ]
});

// Step 3: Send messages
await app.sendMessage('payment', { amount: '1000000' });
```

## 🏗️ Architecture

### Authentication Flow

```
1. auth_request  → Send wallet + session key
2. auth_challenge → Receive random challenge
3. auth_verify   → Sign with EIP-712 & send
4. auth_success  → Receive JWT token
```

### Channel Creation Flow

```
1. Authenticate               → Get session token
2. Send create_channel        → Request new channel
3. Receive channel_id         → Channel created
4. Query get_channels         → Verify existence
```

### App Session Flow

```
1. Ensure channels exist      → Must have funded channels
2. Send create_app_session    → Define participants, weights, quorum
3. Receive app_session_id     → Session ready
4. Send/receive messages      → Off-chain communication
```

## 🚨 Troubleshooting

### Error: "No channels found"

**Solution:**
```bash
npm run create:channel
```

### Error: "insufficient funds"

**Cause:** Need ytest.usd in ledger

**Solution:**
1. Visit: https://earn-ynetwork.yellownetwork.io
2. Connect wallet
3. Request ytest.usd
4. Wait for confirmation
5. Retry channel creation

### Error: "Authentication failed"

**Solution:**
```bash
npm run debug:auth
```

Check:
- ✅ PRIVATE_KEY in .env file
- ✅ Valid Ethereum address
- ✅ Correct network (Base Sepolia)

### Error: "Market creation requires funded channel"

**Cause:** Channels don't exist yet

**Solution:**
```bash
# Step 1: Verify channels
npm run check:channels

# Step 2: If empty, create channel
npm run create:channel

# Step 3: Retry
npm run test:prediction
```

## 📚 Protocol Methods

Our integration implements **all 27 Yellow Network RPC methods**:

### Authentication (4 methods)
- ✅ `auth_request` - Start authentication
- ✅ `auth_challenge` - Receive challenge
- ✅ `auth_verify` - Submit signature
- ✅ `auth_success` - Confirmation

### Query Methods (6 methods)
- ✅ `get_config` - Protocol configuration
- ✅ `get_assets` - Available tokens
- ✅ `get_channels` - List channels
- ✅ `get_ledger_balances` - Account balances
- ✅ `get_ledger_transactions` - Transaction history
- ✅ `get_ledger_entries` - Ledger entries

### Channel Methods (4 methods)
- ✅ `create_channel` - Create payment channel
- ✅ `resize_channel` - Deposit/withdraw funds
- ✅ `close_channel` - Close channel
- ✅ `transfer` - Transfer between ledgers

### App Session Methods (3 methods)
- ✅ `create_app_session` - Create application
- ✅ `submit_app_state` - Update state
- ✅ `close_app_session` - Close application

### Notifications (4 methods)
- ✅ `bu` - Balance updates
- ✅ `cu` - Channel updates
- ✅ `tr` - Transfers
- ✅ `asu` - App session updates

## 🔗 Useful Links

- **Faucet**: https://earn-ynetwork.yellownetwork.io
- **Dashboard**: https://apps.yellow.com
- **Documentation**: https://docs.yellow.org
- **Sandbox ClearNode**: wss://clearnet-sandbox.yellow.com/ws

## 🎯 Next Steps

1. ✅ **Get test tokens** from faucet
2. ✅ **Create channels** using `npm run create:channel`
3. ✅ **Test prediction markets** with `npm run test:prediction`
4. 🚀 **Build your app** using [app.ts](./app.ts) as template

## 💡 Tips

- **Sandbox vs Production**: 
  - Sandbox: Free testnet tokens, no risk
  - Production: Real funds, mainnet deployment

- **Channel Lifecycle**:
  - Create → Fund → Use in app sessions → Close → Withdraw

- **Testing Strategy**:
  1. Start with single-wallet tests
  2. Then test with 2 wallets
  3. Finally test multi-party scenarios

- **Error Handling**:
  - Always check `message.res[1]` for method name
  - Look for `error` field in response
  - Use `challenge_duration: 0` for testing (no challenge period)

## 📄 Files Reference

| File | Purpose |
|------|---------|
| `app.ts` | Simple Yellow Network app example |
| `scripts/check-channels-direct.ts` | Check channel status |
| `scripts/create-sandbox-channel.ts` | Create testnet channels |
| `scripts/test-prediction-market.ts` | Full prediction market demo |
| `src/yellow/enhanced-yellow-client.ts` | Complete protocol client |
| `src/yellow/protocol-types.ts` | TypeScript type definitions |

## ✅ Success Criteria

Your setup is complete when:

- ✅ `npm run check:channels` shows at least 1 channel
- ✅ `npm run test:prediction` creates app session successfully
- ✅ App session ID is returned (not undefined)
- ✅ No "requires funded channel" errors

---

**Happy coding on Yellow Network! 🟡**
