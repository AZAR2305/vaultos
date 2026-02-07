# 🔄 Session vs Channel Lifecycle - Critical Guide

## ⚠️ THE KEY DIFFERENCE

### Session Key ≠ Channel

| Component | Lifespan | Regenerated on Reload? | Purpose |
|-----------|----------|------------------------|---------|
| **Session Key** | Ephemeral (1 hour) | ✅ **YES** - Always regenerated | Signs trades, off-chain state updates |
| **Channel** | Persistent (until closed) | ❌ **NO** - Survives reload | Holds funds, on-chain + off-chain state |

---

## 📊 What Happens on Page Reload?

```
USER RELOADS PAGE
        ↓
┌───────────────────────────────────────┐
│ Session Key: ❌ LOST                  │
│ - Must sign EIP-712 message again     │
│ - Generate new session key            │
│ - Re-authenticate with Yellow Network │
└───────────────────────────────────────┘
        ↓
┌───────────────────────────────────────┐
│ Channel: ✅ PERSISTS                  │
│ - On-chain state unchanged            │
│ - Off-chain state recoverable         │
│ - Query channels → Resume trading     │
└───────────────────────────────────────┘
```

---

## 🎯 Correct Recovery Flow (After Reload)

### Step-by-Step

1. **User reloads page**
   - LocalStorage session expired → ask to reconnect
   - Channel ID saved separately in `channel_${address}`

2. **User clicks "Reconnect Session"**
   - MetaMask prompts for signature (EIP-712)
   - Backend generates NEW session key
   - Session key scope: trading only (cannot withdraw)

3. **Backend authenticates with Yellow**
   - `yellowClient.connect()` → new session key created
   - Queries existing channels: `requestChannels()`
   - Finds existing open channel → reuse it

4. **Channel Resumed**
   - No new on-chain transaction needed
   - No gas fees
   - Same channel ID
   - Balances intact

**Result:** ✅ Seamless recovery without creating duplicate channels

---

## 🏗️ Architecture Roles

### Who Creates What?

| Component | Created By | Frequency | Persistence |
|-----------|------------|-----------|-------------|
| **Session Key** | Backend (on user request) | Every page reload | Ephemeral (1 hour) |
| **Channel** | User (via depositAndCreateChannel) | Once per user | Until manually closed |
| **Market** | Admin only | Per market | Until resolved |
| **Trades** | User (via session key) | Many per session | Permanent (signed) |

### Critical Rules:

- ❌ **Admin does NOT create channels** - Users create their own
- ❌ **Channel is NOT per-market** - One channel, many markets
- ❌ **Session key cannot withdraw** - Limited scope (trading only)
- ✅ **Channel persists** - Even if backend restarts
- ✅ **Session key regenerated** - Always fresh on reload

---

## 💡 Common Scenarios

### Scenario 1: First-Time User

```
1. Connect MetaMask
2. Click "Start Trading Session"
3. Sign EIP-712 message
   - Backend generates session key
   - User authorizes (cannot withdraw)
4. depositAndCreateChannel(1000 ytest.USD)
   - ON-CHAIN transaction (pays gas once)
   - Channel created
5. Trade on any market (OFF-CHAIN, free)
```

### Scenario 2: User Reloads Page

```
1. Page reloads
2. Session expired message shown
3. Click "Reconnect Session"
4. Sign EIP-712 message again
   - NEW session key generated
   - OLD channel still exists
5. Backend queries channels
   - Finds existing open channel
   - Resumes with same channel ID
6. Continue trading (no gas, no new deposit)
```

### Scenario 3: Long Inactivity (Channel Cleanup)

```
1. User away for days/weeks
2. Yellow Network may garbage-collect inactive channels
3. On return: Click "Start Trading Session"
4. Query channels → none found
5. Create new channel (pays gas again)
6. Resume trading
```

### Scenario 4: Browser Crash

```
1. Browser crashes mid-session
2. Session key lost (ephemeral)
3. Channel still exists (persistent)
4. Reopen browser → reconnect
5. Query channels → resume seamlessly
```

---

## 🔧 Implementation Details

### Backend (SessionService.ts)

```typescript
async createSession(
  walletAddress: string, 
  depositAmount: number,
  existingChannelId?: string  // ← Pass this on reconnect
): Promise<SessionData> {
  // Create Yellow client
  const yellowClient = createVaultOSYellowClient();
  
  // Connect = new session key
  await yellowClient.connect();
  
  // Check for existing channel
  const channelId = yellowClient.getChannelId();
  
  if (channelId) {
    // ✅ Reuse existing channel
    console.log('Resumed channel:', channelId);
  } else {
    // 🆕 Create new channel
    await yellowClient.resizeChannel(amount);
  }
  
  // Return session data (new session ID, same channel ID)
}
```

### Frontend (SessionManager.tsx)

```typescript
// On load: Check if session expired but channel exists
useEffect(() => {
  const savedSession = localStorage.getItem(`session_${address}`);
  if (savedSession) {
    const parsed = JSON.parse(savedSession);
    
    if (parsed.expiresAt > Date.now()) {
      setSession(parsed);  // Valid session
    } else {
      // Session expired, but save channel ID
      localStorage.setItem(`channel_${address}`, parsed.channelId);
      setError('Session expired. Click "Reconnect" to resume.');
    }
  }
}, [address]);

// On reconnect: Pass existing channel ID
const createSession = async () => {
  const existingChannelId = localStorage.getItem(`channel_${address}`);
  
  const response = await fetch('/api/session/create', {
    body: JSON.stringify({
      walletAddress: address,
      depositAmount,
      existingChannelId  // ← Resume channel
    })
  });
};
```

---

## 🎓 For Judges: Key Questions Answered

### Q: Why does session key expire on reload?
**A:** Security by design. Session keys are ephemeral and limited-scope. They can trade but cannot withdraw, preventing theft if compromised. Re-signing after reload ensures user consent.

### Q: Does reload erase the channel?
**A:** NO. Channel is persistent (on-chain + off-chain state). Only the session key is regenerated. Channel survives reloads, browser crashes, and backend restarts.

### Q: Who creates channels?
**A:** **Individual users** create their own channels (via depositAndCreateChannel). Admin does NOT create channels. One channel per user, reused across many markets.

### Q: One channel per market?
**A:** NO. **One channel, many markets**. Users create ONE channel and trade on Market A, B, C, etc. without creating new channels.

### Q: What if Yellow sandbox resets?
**A:** Testnet may occasionally reset infra. Channels may vanish. Users simply create new channel on next reconnect. This is expected testnet behavior, not a bug.

### Q: How do you prevent duplicate channels?
**A:** Backend queries `requestChannels()` before creating. If open channel exists → reuse. Only creates new channel if none found.

---

## 📋 Testing Checklist for Judges

- [ ] **Test 1: Create Session**
  - Connect wallet → Sign → Channel created
  - Verify single on-chain transaction
  
- [ ] **Test 2: Reload Page**
  - Reload browser
  - Verify "Session expired" message
  - Click "Reconnect Session"
  - Sign again → Resume without new channel
  - Verify NO new on-chain transaction
  
- [ ] **Test 3: Trade After Reload**
  - Reconnect session (new session key)
  - Trade on markets
  - Verify instant execution (< 100ms)
  - Verify zero gas fees
  
- [ ] **Test 4: Check Channel ID**
  - Note channel ID before reload
  - Reload → reconnect
  - Verify channel ID unchanged
  
- [ ] **Test 5: Multiple Markets**
  - Create channel once
  - Trade on Market A (works)
  - Trade on Market B (works)
  - Trade on Market C (works)
  - All use same channel

---

## 🔒 Security Boundaries (Session vs Channel)

```
┌──────────────────────────────────────────────┐
│ SESSION KEY (Ephemeral)                      │
│                                              │
│ ✅ CAN:                                      │
│   - Sign trades                              │
│   - Update positions                         │
│   - Place orders                             │
│                                              │
│ 🚫 CANNOT:                                   │
│   - Withdraw funds                           │
│   - Close channel                            │
│   - Steal assets                             │
│                                              │
│ Expires: 1 hour                              │
│ Regenerated: Every page reload               │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ CHANNEL (Persistent)                         │
│                                              │
│ Contains:                                    │
│   - User funds (locked on-chain)            │
│   - Balance state (off-chain)               │
│   - Trade history (signed)                  │
│                                              │
│ Controlled by:                               │
│   - User EOA (MetaMask)                     │
│   - Yellow smart contract                   │
│                                              │
│ Persists: Until user closes                  │
│ Survives: Reloads, crashes, restarts        │
└──────────────────────────────────────────────┘
```

---

## 🎯 One-Line Summary

**"Session keys are ephemeral trading credentials regenerated on reload; channels are persistent fund containers that survive across sessions, enabling seamless recovery without duplicate on-chain transactions."**

---

## 📖 Related Documentation

- **[JUDGE_ARCHITECTURE.md](JUDGE_ARCHITECTURE.md)** - Full architecture overview
- **[SECURITY_VERIFICATION.md](SECURITY_VERIFICATION.md)** - Security audit
- **[QUICKSTART.md](QUICKSTART.md)** - Setup guide

---

**Last Updated:** February 6, 2026  
**Status:** ✅ Implemented with channel recovery logic
