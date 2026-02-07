# 🎯 SUI DEPLOYMENT CHECKLIST

Use this checklist to deploy and demo your Sui integration.

---

## ✅ Pre-Deployment Checklist

### Environment Setup
- [ ] Sui CLI installed
  ```powershell
  cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui
  ```

- [ ] Sui CLI working
  ```powershell
  sui --version
  ```

- [ ] Keypair generated
  ```powershell
  sui client new-address ed25519
  ```

- [ ] Private key copied (Base64 format)

- [ ] `.env` file updated
  ```env
  SUI_PRIVATE_KEY=<your-base64-key>
  SUI_PACKAGE_ID=<leave-empty-for-now>
  ```

- [ ] Address funded
  1. Get address: `sui client active-address`
  2. Visit: https://faucet.sui.io
  3. Paste address and request tokens
  4. Verify: `sui client gas`

- [ ] Dependencies installed
  ```powershell
  npm install
  ```

---

## 🚀 Deployment Checklist

### Deploy Contract
- [ ] Navigate to project root
- [ ] Run deployment command
  ```powershell
  npm run sui:deploy
  ```

- [ ] Deployment succeeded
- [ ] Package ID copied from output
  ```
  Published Packages: 0x<package-id>
  ```

- [ ] Package ID added to `.env`
  ```env
  SUI_PACKAGE_ID=0x<package-id>
  ```

- [ ] Server/terminal restarted (to load new env vars)

---

## 🧪 Testing Checklist

### Run Test Script
- [ ] Test script executed
  ```powershell
  npm run sui:test-settlement
  ```

- [ ] Test passed successfully
- [ ] Transaction digest received
- [ ] Explorer link opened
  ```
  https://suiscan.xyz/testnet/tx/<digest>
  ```

- [ ] Transaction visible on explorer
- [ ] Settlement object created
- [ ] All values correct:
  - Market ID
  - Winning outcome
  - Total pool

---

## 📸 Evidence Collection (For Judges)

### Screenshots/Links to Collect
- [ ] Contract source code
  **File:** `sui/sources/prediction_settlement.move`
  
- [ ] Package on explorer
  **URL:** `https://suiscan.xyz/testnet/object/<PACKAGE_ID>`
  
- [ ] Test transaction
  **URL:** `https://suiscan.xyz/testnet/tx/<DIGEST>`
  
- [ ] Integration code
  **File:** `src/sui/settlement.ts`

### Save These for Demo
- [ ] Package ID written down
- [ ] Transaction digest written down
- [ ] Explorer URLs bookmarked
- [ ] Contract code ready to show

---

## 🎤 Demo Preparation

### Things to Show
- [ ] **1. Contract Code** (30 seconds)
  - Show `sui/sources/prediction_settlement.move`
  - Point out `MarketSettlement` struct
  - Point out `create_settlement` function

- [ ] **2. Live Transaction** (30 seconds)
  - Open transaction on SuiScan explorer
  - Show transaction details
  - Show object created

- [ ] **3. Integration** (30 seconds)
  - Show `src/sui/settlement.ts`
  - Highlight `submitSettlement` function
  - Mention it's called after market resolution

### Things to Say
- [ ] Memorize pitch:
  > "We use Yellow Network for instant trading and Sui for transparent settlement. Trading happens off-chain for speed, but every resolved market is recorded on Sui as an immutable object. This hybrid approach gives us the best of both worlds."

- [ ] Key points ready:
  - ✅ Built Move smart contract
  - ✅ Deployed on Sui testnet
  - ✅ Creates and mutates Sui objects
  - ✅ Real transaction on-chain
  - ✅ Integrated with backend

---

## 🔍 Verification Checklist

### Confirm Everything Works
- [ ] Contract deployed successfully
- [ ] Package ID in explorer
- [ ] Test transaction successful
- [ ] Transaction in explorer
- [ ] Settlement object created
- [ ] Integration code complete
- [ ] Backend can call settlement service

### Final Checks
- [ ] All files committed to git
- [ ] Documentation complete
- [ ] README updated with Sui section
- [ ] Environment variables documented
- [ ] No sensitive keys in repo

---

## 📋 Submission Checklist

### Include in Project Submission
- [ ] Contract source code link
- [ ] Deployed package ID
- [ ] Test transaction digest
- [ ] Explorer links
- [ ] Architecture diagram (optional)
- [ ] Integration explanation

### Add to README or Submission Form
```markdown
## Sui Integration

**Contract:** sui/sources/prediction_settlement.move
**Package ID:** 0x<your-package-id>
**Test Transaction:** https://suiscan.xyz/testnet/tx/<digest>

VaultOS uses Sui for transparent market settlement while keeping 
trading fast via Yellow Network state channels.
```

---

## ❌ Common Issues

### Issue: "SUI_PRIVATE_KEY not found"
**Fix:** Add private key to `.env` and restart server

### Issue: "Insufficient gas"
**Fix:** Visit https://faucet.sui.io and fund your address

### Issue: "Module not found: @mysten/sui.js"
**Fix:** Run `npm install`

### Issue: "Package not deployed"
**Fix:** Run `npm run sui:deploy` and add package ID to `.env`

### Issue: "Transaction failed"
**Fix:** Check gas balance with `sui client gas`

---

## ✅ Final Status Check

Before submitting, verify:

| Item | Status |
|------|--------|
| Sui CLI installed | ⬜ |
| Contract deployed | ⬜ |
| Test transaction sent | ⬜ |
| Transaction on explorer | ⬜ |
| Package ID saved | ⬜ |
| Integration tested | ⬜ |
| Documentation complete | ⬜ |
| Evidence collected | ⬜ |
| Pitch prepared | ⬜ |

**All checked?** → **You're ready to submit! 🚀**

---

## 🎉 You Did It!

Your project is now:
- ✅ Sui-eligible
- ✅ Fully deployed
- ✅ Tested and verified
- ✅ Ready to demo

**Good luck with your submission! 🏆**

---

*Questions? Check [SUI_SETUP.md](SUI_SETUP.md) or [SUI_QUICK_START.md](SUI_QUICK_START.md)*
