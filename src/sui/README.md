# Sui Integration

## Overview
VaultOS uses Sui blockchain for transparent market settlement while keeping trading fast via Yellow Network state channels.

## Architecture
- **Trading Layer:** Yellow Network (off-chain, sub-second)
- **Settlement Layer:** Sui (on-chain, immutable)

## Smart Contract
- **Location:** `sui/sources/prediction_settlement.move`
- **Purpose:** Record final market outcomes on-chain
- **Type:** Sui Move module with shared objects

## Integration Service
- **Location:** `src/sui/settlement.ts`
- **Purpose:** Submit settlements from Node.js backend
- **Usage:** See `src/sui/integration-example.ts`

## Quick Start
See [SUI_QUICK_START.md](../SUI_QUICK_START.md) for 5-command deployment.

## Full Setup
See [SUI_SETUP.md](../SUI_SETUP.md) for detailed guide.

## Test
```bash
npm run sui:test-settlement
```

## Environment Variables
```env
SUI_PRIVATE_KEY=<base64-encoded-private-key>
SUI_PACKAGE_ID=<deployed-package-id>
```

## For Judges
*"We use Yellow Network for high-speed trading and Sui for tamper-proof settlement records. This hybrid approach provides both performance and transparency."*

## Eligibility Checklist
- [x] Sui Move contract written
- [x] Deployable to testnet
- [x] Creates Sui objects
- [x] Mutates objects via transactions
- [x] Integrated with backend
- [x] Test script ready

✅ **Fully Sui-eligible**
