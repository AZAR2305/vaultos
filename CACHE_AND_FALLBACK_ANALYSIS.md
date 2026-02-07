# Cache and Fallback Analysis

## Current Architecture Issues

### 1. **Backend State is Ephemeral (In-Memory Only)**

**Location**: 
- `vaultos/src/server/services/SessionService.ts` - `private sessions: Map<string, SessionData>`
- `vaultos/src/server/services/MarketService.ts` - `private markets: Map<string, Market>`

**Problem**:
- When backend restarts (npm run dev), ALL sessions and markets are LOST
- No database or file storage
- Everything stored in JavaScript Map objects (RAM only)

**Impact**:
```
User creates session → Stored in memory
Backend restarts → Session GONE
Frontend still has sessionId in localStorage → 404 errors
```

### 2. **Frontend localStorage Caching**

**Files Using localStorage**:
```typescript
// SessionManager.tsx - Saves session
localStorage.setItem(`session_${address}`, JSON.stringify(sessionData));

// MarketListNew.tsx - Loads cached session
const sessionData = localStorage.getItem(`session_${address}`);

// TradePanelNew.tsx - Uses cached session
const sessionData = localStorage.getItem(`session_${address}`);

// BalanceDisplayNew.tsx - Reads cached session
const sessionData = localStorage.getItem(`session_${address}`);
```

**Problem**:
- Frontend caches session in browser localStorage
- Session persists even after backend restart
- No validation that backend still has this session
- Results in "Session not found" errors

### 3. **No Session Validation**

**Missing**:
- No endpoint to check if session exists: `GET /api/session/:sessionId/validate`
- No heartbeat/ping mechanism
- No way for frontend to detect stale sessions

**Impact**:
- User sees old session (1100 USDC) but it doesn't exist on backend
- Trades fail with cryptic errors
- Markets fail with 404 errors

---

## Fallback Mechanisms Found

### 1. **YellowConnect.tsx - Balance Fallback**
```typescript
const balance = balanceData.balance || '60'; // Default from ledger
```
**Issue**: Hardcoded fallback to '60' USDC

### 2. **Market Creation - Session Fallback**
```typescript
appSessionId: sessionId || channelId || 'session_' + Date.now()
```
**Issue**: Creates fake session ID if missing

### 3. **Default Values Everywhere**
```typescript
// MarketService.ts
maxSlippage?: number;   // Default 5%

// SessionService.ts  
expiresAt: Date.now() + (3600 * 1000), // 1 hour

// Market routes
initialLiquidity: parseFloat(initialLiquidity) || 100
```

---

## Solutions Implemented

### Issue #1: Backend State Loss
**Solution**: Add session validation endpoint

### Issue #2: Stale localStorage
**Solution**: Clear invalid sessions on load

### Issue #3: No Error Feedback
**Solution**: Show clear "backend restarted" messages

---

## Files to Fix

### Priority 1 (CRITICAL):
1. ✅ `vaultos/src/server/routes/session.ts` - Add validation endpoint
2. ✅ `vaultos/src/client/components/SessionManager.tsx` - Auto-clear invalid sessions
3. ✅ `vaultos/src/client/components/MarketListNew.tsx` - Validate session before use
4. ✅ `vaultos/src/client/components/TradePanelNew.tsx` - Check session validity

### Priority 2 (MEDIUM):
5. `vaultos/src/server/services/SessionService.ts` - Add file-based persistence (optional)
6. `vaultos/src/server/services/MarketService.ts` - Add database storage (future)

### Priority 3 (LOW):
7. Remove hardcoded fallback values
8. Add proper error boundaries
9. Implement session heartbeat

---

## Quick Fixes Applied

### Fix 1: Session Validation Endpoint
```typescript
// vaultos/src/server/routes/session.ts
router.get('/validate/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const session = sessionService.getSession(sessionId);
  
  if (session) {
    res.json({ valid: true, session });
  } else {
    res.status(404).json({ valid: false });
  }
});
```

### Fix 2: Auto-Clear Invalid Sessions
```typescript
// vaultos/src/client/components/SessionManager.tsx
useEffect(() => {
  if (address) {
    const sessionData = localStorage.getItem(`session_${address}`);
    if (sessionData) {
      const session = JSON.parse(sessionData);
      
      // Validate with backend
      fetch(`http://localhost:3000/api/session/validate/${session.sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (!data.valid) {
            console.warn('Session invalid, clearing...');
            localStorage.removeItem(`session_${address}`);
            setSession(null);
          }
        });
    }
  }
}, [address]);
```

---

## Current State

### What Works:
✅ Session creation (creates new Yellow Network channel)
✅ Market creation (if valid session)
✅ Trading (if valid session and market)
✅ Balance tracking in localStorage

### What Breaks:
❌ Backend restart → All sessions lost
❌ Frontend shows stale session from localStorage
❌ 404 errors on /api/market
❌ Trade execution fails silently

### User Experience Flow:

**Scenario 1: Fresh Start**
```
1. User connects wallet → ✅
2. User creates session → ✅ (1100 USDC)
3. User creates market → ✅
4. User trades → ✅
```

**Scenario 2: Backend Restart**
```
1. Backend restarts (npm run dev) → Sessions LOST
2. Frontend loads → Shows cached session (1100 USDC)
3. User tries to create market → ❌ 404 (backend has no sessions)
4. User tries to trade → ❌ Session not found
5. User confused → Session shows but nothing works
```

**Scenario 3: With Validation Fix**
```
1. Backend restarts → Sessions LOST
2. Frontend loads → Validates session
3. Validation fails → Clears localStorage
4. UI shows "Create Session" button → ✅
5. User creates new session → ✅
6. Everything works again → ✅
```

---

## Recommendations

### Immediate (Do Now):
1. ✅ Add session validation endpoint
2. ✅ Auto-clear invalid sessions on load
3. ✅ Show "Create Session" when no valid session

### Short-term (This Week):
4. Add file-based session persistence (JSON file)
5. Add file-based market persistence
6. Implement session expiry warnings

### Long-term (Future):
7. Add database (SQLite/PostgreSQL)
8. Implement session migration on backend restart
9. Add Redis for session caching
10. Implement distributed state management

---

## Testing Checklist

- [ ] Create session → Works
- [ ] Restart backend → Backend loses state
- [ ] Refresh frontend → Clears invalid session
- [ ] Create new session → Works
- [ ] Create market → Works
- [ ] Execute trade → Works
- [ ] Close session → Works
- [ ] Backend restart → Cycle repeats cleanly

---

## Key Insight

**The root cause is: Backend has NO persistence layer.**

All state is in RAM. When the process restarts, everything is gone. 

The frontend's localStorage is actually CORRECT behavior (caching session info), but it becomes stale when the backend loses state.

**Solution**: Either persist backend state to disk/database, OR clear frontend cache on every backend restart.

Currently implementing: **Clear frontend cache** (quick fix)
Future: **Persist backend state** (proper solution)
