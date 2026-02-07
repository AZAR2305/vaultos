# How to Get ytest.USD on Yellow Network

## Understanding the System

Yellow Network uses **state channels** for instant, off-chain trading. Here's how it works:

```
On-Chain Assets          Yellow Network          Your Trading Balance
(Base Sepolia)          State Channel           (Yellow Ledger)
    │                       │                         │
    │                       │                         │
  USDC  ─────deposit────► Channel ═══════════► ytest.USD
    │                       │                         │
    │◄────withdraw──────  Channel  ◄═══════════  ytest.USD
    │                       │                         │
```

**Important:** `ytest.USD` is NOT a separate token! It's just USDC that you've deposited into the Yellow Network testnet.

## The Two Methods

### 🎯 Method 1: On-Chain USDC → Yellow Network (RECOMMENDED)

This is the standard way to get ytest.USD:

#### Step 1: Get On-Chain USDC on Base Sepolia

**Option A: Circle's Testnet Faucet**
```bash
# Visit Circle's faucet
https://faucet.circle.com/

# Select:
- Network: Base Sepolia
- Token: USDC
- Address: [Your wallet address]

# You'll receive: 10-100 testnet USDC
```

**Option B: Alternative Faucets**
```bash
# Base Sepolia ETH (for gas)
https://www.alchemy.com/faucets/base-sepolia

# Then swap for USDC on a testnet DEX
# Or use Chainlink faucet if available
```

#### Step 2: Check Your On-Chain Balance

```bash
# Set your private key
$env:PRIVATE_KEY="0x..."

# Check your USDC balance on Base Sepolia
npm run check:balance
```

You should see something like:
```
USDC Balance: 100.000000 USDC
```

#### Step 3: Deposit into Yellow Network

Run the test that creates a channel and deposits:

```bash
npm run test:enhanced
```

This script will:
1. ✅ Connect to Yellow Network sandbox
2. ✅ Authenticate your wallet
3. ✅ Create a new Yellow channel
4. ✅ Deposit 50 USDC from your on-chain balance
5. ✅ Show your new ytest.USD balance

#### Step 4: Verify Your ytest.USD Balance

```bash
npm run check:balance
```

You should now see:
```
Yellow Ledger Balance:
  usdc: 50.000000 ytest.USD
```

### 🏢 Method 2: Yellow Canarynet Direct Access

Yellow Network's Canarynet might provide direct faucet access to participants.

#### Step 1: Join the Canarynet

```bash
# Visit Yellow Network's Canarynet page
https://yellow.org/canarynet

# Sign up for early access:
- Provide your email
- Wait for approval (usually 1-3 days)
- Receive invite link
```

#### Step 2: Access the Dashboard

Once approved:
1. Log in to the Yellow dashboard
2. Look for "Faucet" or "Get Test Tokens"
3. Request ytest.USD directly
4. Tokens appear in your Yellow ledger

**Note:** This method is only available to approved Canarynet participants.

## Quick Check Script

I've created a helper script to check your current status:

```bash
# Check your Yellow Network balance and get instructions
npm run check:yellow
```

This will show you:
- ✅ Your current Yellow channel status
- ✅ Your ytest.USD balance
- ✅ Available assets on Yellow
- ✅ Step-by-step instructions based on your status

## Complete Example Flow

Here's the complete process from start to finish:

```bash
# 1. Set up your environment
$env:PRIVATE_KEY="0x..."
$env:BASE_SEPOLIA_RPC="https://sepolia.base.org"

# 2. Check current status
npm run check:yellow

# Output will show:
# - No channels found (first time)
# - Instructions to get USDC

# 3. Get on-chain USDC
# Visit: https://faucet.circle.com/
# Request USDC for your address on Base Sepolia

# 4. Verify you received USDC
npm run check:balance

# Should show:
# USDC Balance: 100.000000 USDC

# 5. Deposit into Yellow Network
npm run test:enhanced

# This will:
# - Create Yellow channel
# - Deposit 50 USDC
# - Show your ytest.USD balance

# 6. Check your Yellow balance
npm run check:yellow

# Now shows:
# ✅ Yellow channel exists
# ✅ ytest.USD balance: 50.000000
```

## Troubleshooting

### Issue: "No on-chain USDC found"

**Solution:** Get USDC from Circle's faucet
```bash
# Visit https://faucet.circle.com/
# Network: Base Sepolia
# Token: USDC
# Amount: Request maximum (usually 10-100 USDC)
```

### Issue: "Insufficient gas for transaction"

**Solution:** Get Base Sepolia ETH for gas
```bash
# Visit https://www.alchemy.com/faucets/base-sepolia
# Request ETH for gas fees
# Wait a few minutes and try again
```

### Issue: "Channel already exists"

**This is good!** It means you already have a Yellow channel.

**Next steps:**
```bash
# Check your balance
npm run check:yellow

# If you need more ytest.USD, deposit more USDC
# The test:enhanced script will resize your channel
npm run test:enhanced
```

### Issue: "Yellow Network sandbox not responding"

**Solutions:**
1. Check your internet connection
2. Verify the sandbox is online: https://yellow.org/status
3. Try again in a few minutes
4. Check Yellow Network Discord for updates

## Understanding Your Balance

When you run `npm run check:yellow`, you'll see:

```
💵 Yellow Ledger Balances:
  usdc: 50.000000 ytest.USD

🔗 Your Channels:
  Channel 1:
    Status: open
    Your Balance: 50.00 (across all assets)
```

**What this means:**
- **Yellow Ledger Balance**: Your off-chain trading balance
- **Channel Balance**: Total value locked in your Yellow channel
- **ytest.USD**: USDC deposited into Yellow's testnet

These should match! If they don't, it means you have pending deposits or withdrawals.

## FAQ

### Q: What's the difference between USDC and ytest.USD?

**A:** They're the same value, just in different places:
- **USDC** = On-chain token on Base Sepolia (ERC-20)
- **ytest.USD** = Your USDC deposited into Yellow Network's state channel

Think of it like:
- Bank account (USDC) → Trading account (ytest.USD)

### Q: Can I withdraw ytest.USD back to USDC?

**A:** Yes! You can withdraw at any time:

```bash
# The enhanced client supports withdrawals
# Create a withdrawal request
await client.resizeChannel({
  channel_id: 'your-channel-id',
  intent: StateIntent.FINALIZE,  // Close and withdraw
  // ... configuration
});
```

### Q: How long does it take to get ytest.USD?

**A:** 
- Getting on-chain USDC from faucet: **5-10 minutes**
- Depositing into Yellow channel: **2-3 minutes** (on-chain tx)
- **Total: ~10-15 minutes**

### Q: Is there a minimum deposit?

**A:** Yellow Network requires **at least 1 USDC** to create a channel. The test scripts use 50 USDC as a reasonable starting amount.

### Q: Can I get ytest.USD without on-chain USDC?

**A:** Currently, no. Yellow Network is a Layer 2 solution, so you need:
1. On-chain assets first (USDC on Base Sepolia)
2. Then deposit them into Yellow channels

The only exception would be if Yellow's Canarynet provides direct faucet access to approved participants.

### Q: Where can I use ytest.USD?

**A:** Your ytest.USD can be used for:
1. ✅ Instant transfers to other Yellow users
2. ✅ Trading on Yellow DEX
3. ✅ Prediction markets (like your VaultOS app!)
4. ✅ Any app built on Yellow Network

## Resources

- 📖 **Yellow Network Docs**: https://docs.yellow.org
- 🌐 **Canarynet**: https://yellow.org/canarynet
- 💬 **Discord**: https://discord.gg/yellow
- 🔧 **Base Sepolia Explorer**: https://sepolia.basescan.org/
- 💰 **Circle USDC Faucet**: https://faucet.circle.com/
- 💰 **Base Sepolia ETH Faucet**: https://www.alchemy.com/faucets/base-sepolia

## Next Steps

Once you have ytest.USD, you can:
1. ✅ Test instant transfers
2. ✅ Create prediction markets
3. ✅ Trade on Yellow DEX
4. ✅ Build your own Yellow Network apps

Run the enhanced test to see all features in action:
```bash
npm run test:enhanced
```

Or try the prediction market demo:
```bash
npm run test:prediction
```

---

**Still stuck? Run the diagnostic:**
```bash
npm run check:yellow
```

This will analyze your situation and provide specific next steps!


<function_calls>
<invoke name="file_search">
<parameter name="query">**/*.ts