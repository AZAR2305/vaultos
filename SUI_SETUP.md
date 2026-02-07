# Sui Integration Setup Guide

## 🎯 Goal
Make VaultOS officially Sui-eligible by deploying a market settlement contract and integrating it with your backend.

## ✅ What This Gives You
- Real Sui Move smart contract (deployed on testnet)
- On-chain transaction proof
- Sui object creation and mutation
- Clear value proposition for judges

---

## 📋 Setup (10 Minutes)

### 1. Install Sui CLI

```powershell
# Using Cargo (Rust required)
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui
```

Or download binary from: https://docs.sui.io/guides/developer/getting-started/sui-install

### 2. Generate Sui Keypair

```powershell
# Create new address
sui client new-address ed25519

# This will output:
# - Address: 0x1234...
# - Private key (Base64)
```

Copy the private key (Base64 format).

### 3. Configure Environment

Add to `.env`:

```env
# Sui Configuration
SUI_PRIVATE_KEY=<your-base64-private-key-from-step-2>
SUI_PACKAGE_ID=<leave-empty-until-deployed>
```

### 4. Fund Your Address

```powershell
# Get your address
sui client active-address

# Go to faucet
# https://faucet.sui.io
# Paste your address and request testnet SUI
```

### 5. Deploy the Contract

```powershell
# Install dependencies
npm install

# Deploy to Sui testnet
npm run sui:deploy
```

This will output:
```
Published Package: 0xabcd1234...
```

**IMPORTANT:** Copy the Package ID and add it to `.env`:

```env
SUI_PACKAGE_ID=0xabcd1234...
```

### 6. Test the Integration

```powershell
npm run sui:test-settlement
```

Expected output:
```
✅ SUCCESS! Settlement recorded on Sui
Transaction: https://suiscan.xyz/testnet/tx/...
🎉 Your project is now Sui-eligible!
```

---

## 🔗 Integration with Your Backend

The settlement service is already integrated. When a market resolves, just call:

```typescript
import { getSuiSettlementService } from './src/sui/settlement';

// After market resolves
const suiService = getSuiSettlementService();
const txDigest = await suiService.submitSettlement({
  marketId: market.id,
  winningOutcome: market.winner, // 'YES' or 'NO'
  totalPool: market.totalPool,
});

console.log('Settlement on Sui:', txDigest);
```

### Example Integration (in MarketService.ts)

Add this after line where market is resolved:

```typescript
// Submit settlement to Sui blockchain
try {
  const suiService = getSuiSettlementService();
  await suiService.submitSettlement({
    marketId: market.id,
    winningOutcome: market.winner,
    totalPool: market.totalPool,
  });
  console.log('✅ Settlement recorded on Sui');
} catch (error) {
  console.warn('⚠️ Sui settlement failed (non-critical):', error);
  // Continue - settlement is optional for demo
}
```

---

## 🎤 What to Tell Judges

> "VaultOS uses Yellow Network state channels for high-speed trading with sub-second latency. When a prediction market resolves, we commit the final settlement to Sui as an immutable on-chain object. This provides transparent verification while keeping the trading layer fast and scalable."

### Key Points:
- ✅ Trading = Off-chain (Yellow Network) → Speed
- ✅ Settlement = On-chain (Sui) → Trust
- ✅ Best of both worlds

---

## 📁 Files Created

```
vaultos/
├── sui/
│   ├── Move.toml              # Sui package config
│   └── sources/
│       └── prediction_settlement.move  # Settlement contract
├── src/
│   └── sui/
│       └── settlement.ts      # Integration service
├── scripts/
│   └── test-sui-settlement.ts # Test script
└── .env                        # Add SUI_PRIVATE_KEY + SUI_PACKAGE_ID
```

---

## 🔍 Verification

1. **Contract Deployed:** Check explorer at `https://suiscan.xyz/testnet/object/{PACKAGE_ID}`
2. **Transaction Sent:** Run test script, verify transaction link works
3. **Integration Ready:** Settlement service accessible from backend

---

## ⚡ Quick Commands

```powershell
# Deploy contract
npm run sui:deploy

# Test settlement
npm run sui:test-settlement

# Check Sui CLI
sui --version

# View your address
sui client active-address

# Get testnet tokens
# Visit: https://faucet.sui.io
```

---

## ❓ Troubleshooting

### "SUI_PRIVATE_KEY not found"
- Make sure you added the Base64 private key to `.env`
- Restart your terminal/server after editing `.env`

### "Insufficient gas"
- Fund your address at https://faucet.sui.io
- Check balance: `sui client gas`

### "Package not deployed"
- Run `npm run sui:deploy`
- Add package ID to `.env` as `SUI_PACKAGE_ID`

### "Module not found: @mysten/sui.js"
- Run `npm install`

---

## 🏁 Checklist

- [ ] Sui CLI installed
- [ ] Keypair generated
- [ ] Address funded (testnet SUI)
- [ ] Contract deployed
- [ ] Package ID in `.env`
- [ ] Test script runs successfully
- [ ] Transaction visible on explorer
- [ ] Integration tested

Once all checked → **You are officially Sui-eligible! 🎉**
