# VaultOS Sui Settlement Contract

This Move contract handles **on-chain settlement** for prediction markets resolved off-chain via Yellow Network.

## 🎯 Purpose

- **Trading**: Off-chain via Yellow Network (instant, gas-free)
- **Settlement**: On-chain via Sui (transparent, verifiable)

## 📦 Contract Overview

### `MarketSettlement` Object

Each resolved market creates one shared Sui object containing:
- `market_id`: Off-chain market identifier
- `winning_outcome`: 1 (YES) or 0 (NO)
- `total_pool`: Total USDC in pool (6 decimals)
- `timestamp`: When resolved
- `oracle`: Admin address that resolved
- `settled`: Always true

### Functions

**`create_settlement()`**
- Creates settlement object on-chain
- Emits `SettlementCreated` event
- Makes object publicly readable via `share_object`

**`get_settlement_info()`**
- View function to read settlement details

**`is_outcome_winner()`**
- Check if specific outcome won

## 🚀 Deployment

### Prerequisites

```bash
# Install Sui CLI
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui

# Verify installation
sui --version
```

### Deploy to Testnet

```bash
cd sui-contract

# Build contract
sui move build

# Test contract
sui move test

# Deploy to testnet (requires Sui wallet with gas)
sui client publish --gas-budget 200000000
```

### Save Package ID

After deployment, save the `packageId` from the output:

```bash
# Example output:
# Package published: 0x1234...
# Transaction digest: ABC123...
```

Add to `.env`:
```
SUI_PACKAGE_ID=0x1234567890abcdef...
SUI_ADMIN_SECRET_KEY=suiprivkey...
```

## 🔗 Backend Integration

See `src/server/services/SuiSettlement.ts` for Node.js integration.

When a market resolves:
1. Backend calls `resolveMarket()` (off-chain)
2. Backend calls `submitSettlementToSui()` (on-chain)
3. Settlement object created on Sui
4. Event emitted for indexing

## 🎤 Judge Pitch

> "Trading happens off-chain via Yellow Network for speed. When a market resolves, we commit the final settlement to Sui as an on-chain object, enabling transparent verification and trustless payout claims."

## 📊 Why This Matters

✅ **Real Sui usage**: Creates and shares Sui objects
✅ **On-chain verification**: Anyone can verify settlements
✅ **Event emission**: Indexable for analytics
✅ **Hybrid architecture**: Off-chain speed + on-chain security
