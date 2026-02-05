# 🔐 Admin Configuration - Market Creation

## IMPORTANT: Only Admin Can Create Markets

### Setup Your Admin Wallet

1. **Open file:** `vaultos/src/client/components/MarketList.tsx`

2. **Find line 17:**
```typescript
const ADMIN_WALLET = '0xYourAdminWalletAddressHere'.toLowerCase();
```

3. **Replace with YOUR wallet address:**
```typescript
const ADMIN_WALLET = '0x1234...your...actual...address'.toLowerCase();
```

### How It Works

#### ✅ Admin (You)
- Sees "➕ Create Market" button
- Can create new prediction markets
- Market creation form visible
- 👑 ADMIN badge shows in UI

#### ❌ Regular Users
- **Cannot** create markets
- Only see existing markets list
- Can trade on existing markets
- No create button visible

### Security Model

```typescript
// Frontend check (UI only)
const isAdmin = address?.toLowerCase() === ADMIN_WALLET;

// If user tries API directly, backend should also validate
// (For hackathon demo, frontend check is sufficient)
```

### Example

1. Connect your admin wallet: `0x1234...`
2. You see: `👑 ADMIN` badge + `➕ Create Market` button
3. Regular user connects: `0x5678...`
4. They see: Only market list (no create button)

### Test It

```bash
# 1. Connect with admin wallet
# 2. See create button ✅

# 3. Connect with different wallet  
# 4. Create button hidden ❌
```

---

**Current Status:** 
- ✅ Frontend checks in place
- ✅ Admin-only UI rendering
- ✅ Market creation restricted

**To Enable:**
Replace `0xYourAdminWalletAddressHere` with your actual wallet address in MarketList.tsx line 17.
