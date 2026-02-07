# 🌐 Environment Configuration

## Current Environment: **SANDBOX (Testnet)** ✅

Your VaultOS prediction market is configured for **development and testing** on Yellow Network's sandbox environment.

---

## Current Configuration

### Yellow Network Settings
- **Clearnode URL**: `wss://clearnet-sandbox.yellow.com/ws`
- **Environment**: Sandbox (Development)
- **Network**: Base Sepolia (Testnet)
- **Chain ID**: 84532

### Blockchain Settings
- **Chain**: Base Sepolia (testnet)
- **RPC URL**: `https://sepolia.base.org`
- **Block Explorer**: https://sepolia.basescan.org/

### Smart Contracts (Base Sepolia)
- **Custody Contract**: `0x019B65A265EB3363822f2752141b3dF16131b262`
- **Adjudicator Contract**: `0x7c7ccbc98469190849BCC6c926307794fDfB11F2`

### Tokens (Testnet)
- **Asset**: ytest.USD (testnet USDC equivalent)
- **Official USDC**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (Base Sepolia)
- **Decimals**: 6
- **Faucet**: `https://clearnet-sandbox.yellow.com/faucet/requestTokens`

---

## Sandbox vs Production Comparison

| Feature | **SANDBOX (Current)** | **PRODUCTION** |
|---------|----------------------|----------------|
| **Purpose** | Testing & Development | Real Trading |
| **Clearnode** | `wss://clearnet-sandbox.yellow.com/ws` | `wss://clearnet.yellow.com/ws` |
| **Chain** | Base Sepolia (84532) | Base Mainnet (8453) |
| **Token** | ytest.USD (free from faucet) | Real USDC (costs real money) |
| **Faucet** | ✅ Available | ❌ Not available |
| **Risk** | Zero (testnet) | Real money at risk |
| **Gas Fees** | Free testnet ETH | Real ETH required |

---

## How to Get Testnet Tokens

### 1. Get Sepolia ETH (for gas)
```bash
# Visit Ethereum Sepolia faucets:
# - https://sepoliafaucet.com/
# - https://www.alchemy.com/faucets/ethereum-sepolia
```

### 2. Get Base Sepolia ETH (bridge from Sepolia)
```bash
# Visit Base Sepolia bridge:
# https://bridge.base.org/deposit
# Select "Sepolia" → "Base Sepolia"
```

### 3. Get ytest.USD (Yellow Network testnet token)
```bash
# Request from Yellow sandbox faucet:
curl -X POST https://clearnet-sandbox.yellow.com/faucet/requestTokens \
  -H "Content-Type: application/json" \
  -d '{"userAddress":"YOUR_WALLET_ADDRESS"}'
```

### 4. Get Official Base Sepolia USDC (alternative)
```bash
# Request from Circle faucet:
# Visit: https://faucet.circle.com/
# Select "Base Sepolia" network
```

---

## File Locations Using Sandbox

All files are currently configured for sandbox:

### Backend Integration
- `vaultos/src/yellow/vaultos-yellow.ts` - Line 142: `'wss://clearnet-sandbox.yellow.com/ws'`
- `vaultos/src/yellow/vaultos-yellow.ts` - Line 67: `baseSepolia` chain
- `vaultos/src/server/routes/yellow.ts` - Line 22: Sandbox URL

### Frontend Integration  
- `vaultos/src/client/hooks/useYellowNetwork.ts` - Line 14: Sandbox URL

### Scripts (All use sandbox)
- `scripts/create-sandbox-channel.ts`
- `scripts/deposit-to-yellow.ts`
- `scripts/test-enhanced-yellow.ts`
- And 15+ other test scripts

---

## ⚠️ Switching to Production (NOT RECOMMENDED YET)

**DO NOT switch to production until:**
1. ✅ All features tested thoroughly in sandbox
2. ✅ Security audit completed
3. ✅ Real USDC acquired on Base mainnet
4. ✅ Production monitoring set up
5. ✅ Emergency shutdown procedures ready

### If You Must Switch (Advanced)

Change these values across the codebase:

```typescript
// ❌ SANDBOX (current)
chain: baseSepolia                // Chain ID: 84532
ws: 'wss://clearnet-sandbox.yellow.com/ws'
token: 'ytest.usd'

// ✅ PRODUCTION (do not use yet)
chain: base                       // Chain ID: 8453
ws: 'wss://clearnet.yellow.com/ws'
token: 'usdc'
```

---

## Environment Detection

You can verify your environment by checking:

### 1. Chain ID
```typescript
// Sandbox: 84532 (Base Sepolia)
// Production: 8453 (Base Mainnet)
console.log(baseSepolia.id); // 84532 ✅ SANDBOX
```

### 2. WebSocket URL
```typescript
// Check active connection
if (url.includes('sandbox')) {
  console.log('🟢 SANDBOX MODE');
} else {
  console.log('🔴 PRODUCTION MODE');
}
```

### 3. Token Symbol
```typescript
// Sandbox: 'ytest.usd'
// Production: 'usdc'
```

---

## Best Practices

### ✅ DO in Sandbox
- Experiment freely with features
- Test with large amounts
- Try edge cases and failures
- Request unlimited faucet tokens
- Share your testnet address publicly

### ❌ DON'T in Sandbox
- Expect real money
- Use real private keys (use test keys only)
- Deploy without testing in sandbox first
- Skip security reviews before production

---

## Quick Status Check

Run this to verify your environment:

```bash
# Check which network you're connected to
npm run dev:backend

# Look for startup logs:
# ✓ Yellow Network Client initialized
# ✓ Chain ID: 84532 (Base Sepolia)
# ✓ Environment: SANDBOX
```

---

## Summary

🟢 **You are safely working in SANDBOX mode**

- Zero financial risk
- Free testnet tokens
- Perfect for development
- Full Yellow Network features
- No real money involved

When you're ready for production, we'll create a comprehensive migration guide with proper safety checks.
