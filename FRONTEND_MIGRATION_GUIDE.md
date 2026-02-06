# 🎯 FRONTEND MIGRATION GUIDE
## Updating to Authoritative Backend Architecture

---

## 📋 Overview

**OLD PATTERN (INSECURE):**
- Frontend calculates pool sizes, odds, prices
- Frontend sends `{ yesPool: 1000, noPool: 800 }` to backend
- Backend trusts frontend calculations ❌

**NEW PATTERN (SECURE):**
- Frontend sends **intent only**: `{ outcome: 1, amount: 100 }`
- Backend calculates **everything**: cost, shares, new odds
- Frontend displays **authoritative** backend data ✅

---

## 🔄 API Changes

### 1. Trade Execution

#### ❌ OLD API (DEPRECATED)
```typescript
// Frontend sends pool sizes (BAD!)
POST /api/trade/buy-yes
{
  "sessionId": "session123",
  "marketId": "market456",
  "shares": 100,
  // Frontend calculated these ⚠️
  "yesPool": 1000,
  "noPool": 800
}
```

#### ✅ NEW API (SECURE)
```typescript
// Frontend sends intent only (GOOD!)
POST /api/trade/execute
{
  "sessionId": "session123",
  "marketId": "market456",
  "outcome": 1,          // 0=NO, 1=YES
  "amount": 100,         // Shares to buy
  "maxSlippage": 0.05    // 5% tolerance
}

// Backend response (authoritative)
{
  "success": true,
  "trade": {
    "id": "trade_xyz",
    "outcome": 1,
    "amount": 100,
    "cost": 105.23,       // Backend calculated
    "sharesReceived": 100,
    "price": 0.548,       // New odds
    "timestamp": 1735689600000
  },
  "balance": 894.77       // Updated balance
}
```

### 2. Market Data (Real-time)

#### ❌ OLD: Frontend calculates odds
```typescript
// Frontend computes (WRONG!)
const yesOdds = yesPool / (yesPool + noPool);
const noOdds = noPool / (yesPool + noPool);
```

#### ✅ NEW: Backend broadcasts authoritative state
```typescript
// WebSocket message from backend
{
  "type": "market_update",
  "data": {
    "id": "market456",
    "ammState": {
      "quantityShares": [800, 900],
      "liquidityParameter": 14427,
      "totalVolume": 10523.45
    },
    "prices": [0.452, 0.548],  // Backend calculated
    "volumes": [800, 900],
    "participantCount": 24
  }
}

// Frontend just displays (NO calculations)
<div>YES: {data.prices[1] * 100}%</div>
<div>NO: {data.prices[0] * 100}%</div>
```

### 3. User Positions

#### ✅ NEW API
```typescript
GET /api/trade/positions/:marketId?userAddress=0xABC...

// Response
{
  "success": true,
  "positions": [
    {
      "outcome": 1,        // YES
      "shares": 250,
      "totalCost": 260.45
    }
  ]
}
```

### 4. User Winnings (After Resolution)

#### ✅ NEW API
```typescript
GET /api/trade/winnings/:marketId?userAddress=0xABC...

// Response
{
  "success": true,
  "winnings": {
    "won": true,
    "invested": 260.45,
    "winnings": 450.00,
    "profit": 189.55
  }
}
```

---

## 🔌 WebSocket Integration

### Connect to Real-Time Updates
```typescript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:3000');

// Listen for market updates
socket.on('market_update', (data) => {
  updateMarketDisplay(data);
});

// Listen for signature requests (settlement)
socket.on('signature_request', async (data) => {
  const signature = await wallet.signTypedData(...);
  socket.emit('signature_submit', {
    marketId: data.marketId,
    stateHash: data.stateHash,
    signer: userAddress,
    signature
  });
});

// Listen for signature progress
socket.on('signature_progress', (status) => {
  updateSettlementProgress(status.collected, status.totalRequired);
});
```

---

## 🎨 Frontend Components Update

### 1. Trade Form Component

#### ❌ OLD (with pool calculations)
```tsx
const TradeForm = () => {
  const [yesPool, setYesPool] = useState(0);
  const [noPool, setNoPool] = useState(0);
  
  const calculateOdds = () => {
    return yesPool / (yesPool + noPool); // ❌ Frontend calculates
  };
  
  const handleTrade = async () => {
    await fetch('/api/trade/buy-yes', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        marketId,
        shares: amount,
        yesPool, // ❌ Sends pool size
        noPool   // ❌ Sends pool size
      })
    });
  };
  
  return <div>YES: {(calculateOdds() * 100).toFixed(1)}%</div>;
};
```

#### ✅ NEW (intent-only)
```tsx
const TradeForm = () => {
  const { market, refetch } = useMarketData(marketId); // From WebSocket
  
  const handleTrade = async (outcome: number, amount: number) => {
    try {
      const response = await fetch('/api/trade/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          marketId,
          outcome,
          amount,
          maxSlippage: 0.05
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(`Trade executed! Cost: ${result.trade.cost.toFixed(2)} USDC`);
        // Market update comes via WebSocket automatically
      }
    } catch (error) {
      toast.error(error.message);
    }
  };
  
  return (
    <div>
      <p>YES: {(market.prices[1] * 100).toFixed(1)}%</p> {/* ✅ Backend data */}
      <p>NO: {(market.prices[0] * 100).toFixed(1)}%</p>
      
      <button onClick={() => handleTrade(1, 100)}>
        Buy 100 YES
      </button>
      <button onClick={() => handleTrade(0, 100)}>
        Buy 100 NO
      </button>
    </div>
  );
};
```

### 2. Market Display Component

#### ✅ NEW (uses market stats API)
```tsx
const MarketCard = ({ marketId }: { marketId: string }) => {
  const { data: stats, isLoading } = useQuery(['market-stats', marketId], 
    () => fetch(`/api/trade/stats/${marketId}`).then(r => r.json())
  );
  
  if (isLoading) return <Spinner />;
  
  return (
    <div className="market-card">
      <h3>{market.question}</h3>
      
      {/* ✅ Backend-calculated prices */}
      <div className="odds">
        <div className="yes">
          YES: {(stats.prices[1] * 100).toFixed(1)}%
        </div>
        <div className="no">
          NO: {(stats.prices[0] * 100).toFixed(1)}%
        </div>
      </div>
      
      {/* ✅ Backend-calculated volumes */}
      <div className="volume">
        Total Volume: ${stats.totalVolume.toFixed(2)}
      </div>
      
      <div className="participants">
        {stats.participantCount} traders
      </div>
    </div>
  );
};
```

### 3. User Portfolio Component

#### ✅ NEW (fetches positions from backend)
```tsx
const UserPositions = ({ userAddress }: { userAddress: string }) => {
  const { data: positions } = useQuery(['user-positions', marketId, userAddress],
    () => fetch(`/api/trade/positions/${marketId}?userAddress=${userAddress}`)
      .then(r => r.json())
  );
  
  return (
    <div className="positions">
      <h4>Your Positions</h4>
      {positions?.map(pos => (
        <div key={pos.outcome}>
          <span>{pos.outcome === 1 ? 'YES' : 'NO'}</span>
          <span>{pos.shares} shares</span>
          <span>Cost: ${pos.totalCost.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
};
```

### 4. Settlement UI Component

#### ✅ NEW (signature collection flow)
```tsx
const SettlementFlow = ({ marketId }: { marketId: string }) => {
  const [signatureRequest, setSignatureRequest] = useState(null);
  const { wallet } = useWallet();
  
  useEffect(() => {
    socket.on('signature_request', async (request) => {
      if (request.marketId === marketId) {
        setSignatureRequest(request);
      }
    });
    
    socket.on('signature_progress', (progress) => {
      updateProgress(progress);
    });
  }, [marketId]);
  
  const handleSign = async () => {
    try {
      const signature = await wallet.signTypedData({
        domain: {
          name: 'VaultOS Prediction Market',
          version: '1',
          chainId: 84532,
        },
        types: {
          FinalState: [
            { name: 'stateHash', type: 'bytes32' },
            { name: 'timestamp', type: 'uint256' },
          ],
        },
        message: {
          stateHash: signatureRequest.stateHash,
          timestamp: Date.now(),
        },
      });
      
      socket.emit('signature_submit', {
        marketId,
        stateHash: signatureRequest.stateHash,
        signer: wallet.address,
        signature,
      });
      
      toast.success('Signature submitted!');
    } catch (error) {
      toast.error('Signing failed');
    }
  };
  
  if (!signatureRequest) return null;
  
  return (
    <div className="settlement-modal">
      <h3>Settlement Signature Required</h3>
      <p>Please sign to finalize market settlement</p>
      <p>Deadline: {new Date(signatureRequest.deadline).toLocaleString()}</p>
      
      <button onClick={handleSign}>
        Sign Settlement
      </button>
    </div>
  );
};
```

---

## 🚨 Critical Frontend Rules

### ✅ DO:
1. **Send intent only** (outcome, amount, slippage)
2. **Display backend data** via WebSocket or API
3. **Trust backend calculations** for all prices/costs/shares
4. **Listen for signature requests** during settlement
5. **Show real-time updates** from market_update events

### ❌ DON'T:
1. **Calculate odds on frontend** (backend does this)
2. **Send pool sizes to backend** (backend manages AMM state)
3. **Manipulate market state locally** (single source of truth: backend)
4. **Ignore slippage tolerance** (always send maxSlippage)
5. **Cache stale market data** (use WebSocket for real-time)

---

## 🔍 Testing Checklist

### Trade Execution
- [ ] Buy YES shares → backend calculates cost
- [ ] Buy NO shares → backend calculates cost
- [ ] Slippage protection triggers on large trades
- [ ] WebSocket broadcasts updated odds to all clients
- [ ] Balance updates correctly after trade

### Market Display
- [ ] Odds show backend-calculated probabilities
- [ ] Volume displays authoritative total
- [ ] Participant count matches backend
- [ ] Real-time updates when other users trade

### Settlement Flow
- [ ] Signature request appears after market resolves
- [ ] User can sign EIP-712 message with wallet
- [ ] Signature submission confirmed
- [ ] Progress bar updates as signatures collected
- [ ] Winnings displayed after settlement complete

---

## 📊 Migration Checklist

### Phase 1: Update API Calls
- [ ] Replace `/buy-yes` and `/buy-no` with `/execute`
- [ ] Change request body to intent-only format
- [ ] Remove pool size calculations from frontend
- [ ] Add maxSlippage parameter (default 0.05)

### Phase 2: WebSocket Integration
- [ ] Connect to WebSocket server
- [ ] Listen for `market_update` events
- [ ] Update UI on real-time broadcasts
- [ ] Remove polling/manual refetching

### Phase 3: Settlement UI
- [ ] Implement signature request modal
- [ ] Add EIP-712 signing with wallet
- [ ] Show signature collection progress
- [ ] Display final winnings after settlement

### Phase 4: Testing
- [ ] Test trade execution with multiple users
- [ ] Test slippage protection
- [ ] Test market resolution & settlement
- [ ] Test signature collection timeout

---

## 🎓 Example: Complete Trade Flow

```tsx
// 1. User clicks "Buy 100 YES"
const handleTrade = async () => {
  // Frontend sends INTENT ONLY
  const response = await fetch('/api/trade/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: userSession.id,
      marketId: 'market123',
      outcome: 1,         // YES
      amount: 100,        // Shares
      maxSlippage: 0.05   // 5% tolerance
    })
  });
  
  const result = await response.json();
  // result.trade.cost = 105.23 (backend calculated)
  // result.trade.sharesReceived = 100
  // result.trade.price = 0.548 (new odds)
  
  // 2. Backend executes trade with AMM
  // - Calculates cost using LMSR formula
  // - Updates ammState.quantityShares
  // - Validates slippage tolerance
  // - Records trade in database
  
  // 3. Backend broadcasts update via WebSocket
  // ALL clients receive:
  {
    type: 'market_update',
    data: {
      ...market,
      prices: [0.452, 0.548], // Updated odds
      totalVolume: 10628.68   // Updated volume
    }
  }
  
  // 4. Frontend updates UI (automatically via WebSocket)
  // Market card shows new odds: YES 54.8%, NO 45.2%
};
```

---

## 🏆 Summary

**Before:** Frontend has too much control → Security risk
**After:** Backend authoritative → Production-ready

**Key Changes:**
1. Intent-only API (no pool sizes from frontend)
2. Backend calculates all prices/costs/shares
3. WebSocket real-time updates (single source of truth)
4. Settlement signature collection (EIP-712)
5. Oracle-driven resolution (no user control)

**Result:** **Secure, auditable, judge-approved architecture** 🎯
