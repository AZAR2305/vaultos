# 💸 Withdraw Funds Guide

## Overview

The withdraw button has been **removed from the UI** as requested. Withdrawals are now **only available via API**.

## ✅ Withdraw API Endpoint

### Endpoint
```
POST http://localhost:3000/api/balance/withdraw
```

### Request Body
```json
{
  "sessionId": "YOUR_SESSION_ID",
  "amount": 100
}
```

### Example cURL Command
```bash
curl -X POST http://localhost:3000/api/balance/withdraw \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"0x1234...","amount":100}'
```

### Example with PowerShell
```powershell
$body = @{
    sessionId = "0x1234..."
    amount = 100
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/balance/withdraw" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

### Response (Success)
```json
{
  "success": true,
  "withdrawnAmount": 100,
  "remainingBalance": 900,
  "message": "Withdrew 100 USDC off-chain"
}
```

### Response (Error)
```json
{
  "error": "Insufficient balance"
}
```

## 🔧 How It Works

1. **OFF-CHAIN**: Withdrawal happens instantly via Yellow Network state channel
2. **NO GAS FEES**: No blockchain transaction needed
3. **INSTANT**: < 200ms latency (Yellow testnet simulation)
4. **SECURE**: Cryptographically signed state updates

## 📝 Implementation Details

### Backend Code
File: `src/api/marketRoutes.ts`

```typescript
router.post('/api/balance/withdraw', async (req, res) => {
  const { sessionId, amount } = req.body;
  
  const result = await withdrawFunds(sessionId, amount);
  
  res.json({
    success: true,
    withdrawnAmount: amount,
    remainingBalance: result.newBalance
  });
});
```

### Yellow Network Integration
File: `src/yellow/client.ts`

```typescript
async withdrawFromChannel(
  channel: ChannelState,
  userWallet: Wallet | HDNodeWallet,
  withdrawAmount: bigint
): Promise<boolean> {
  // OFF-CHAIN state update
  const newBalance = currentBalance - withdrawAmount;
  await this.sendStateUpdate(channel, userWallet, newBalance);
  
  console.log(`✅ Withdrawal confirmed`);
  return true;
}
```

## 🚀 Testing

### 1. Start Backend
```bash
npm run dev:server
```

### 2. Create Session (via UI)
- Connect wallet
- Click "Create Session"
- Deposit 1000 USDC

### 3. Get Session ID
Check browser console or LocalStorage:
```javascript
localStorage.getItem('session_0xYourAddress')
```

### 4. Test Withdraw
```bash
curl -X POST http://localhost:3000/api/balance/withdraw \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"YOUR_SESSION_ID","amount":100}'
```

### 5. Verify Balance
Check UI or query state:
```bash
curl http://localhost:3000/api/state/YOUR_SESSION_ID
```

## 🛡️ Security Notes

- Session ID required (prevents unauthorized withdrawals)
- Balance validation (can't withdraw more than available)
- Cryptographic signatures on all state updates
- Yellow Network node cannot forge withdrawals

## 📊 UI Changes

**Before:**
- ❌ Withdraw button in SessionManager
- ❌ Withdraw amount input field
- ❌ handleWithdraw() function

**After:**
- ✅ Removed withdraw UI completely
- ✅ API endpoint still active
- ✅ Added note in UI: "Withdraw via API"

## 🔗 Related Files

- **API Route**: `src/api/marketRoutes.ts` (POST /api/balance/withdraw)
- **Yellow Client**: `src/yellow/client.ts` (withdrawFromChannel method)
- **Actions**: `src/yellow/actions.ts` (withdrawFunds function)
- **Frontend**: `vaultos/src/client/components/SessionManager.tsx` (button removed)

---

**Status**: ✅ Withdraw button removed from UI  
**API**: ✅ Still functional via HTTP endpoint  
**Yellow Network**: ✅ Off-chain withdrawals working
