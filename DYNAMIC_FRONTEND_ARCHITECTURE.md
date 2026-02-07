# VaultOS Dynamic Prediction Market - Complete Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Frontend (vaultos/)                   │
│  - Market Discovery (all active markets)                        │
│  - Real-time Yellow Network connection                          │
│  - Place bets, monitor positions, request refunds               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                Express Backend (src/server/)                    │
│  - Broadcast markets to all users                               │
│  - Track app session IDs                                        │
│  - Manage market state                                          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              Yellow Network (WebSocket)                         │
│  - App sessions for each market                                 │
│  - Off-chain state updates                                      │
│  - Real-time balance tracking                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Architecture Components

### 1. Market Creator Flow
```typescript
User Creates Market
  ↓
Connect to Yellow Network
  ↓
Create App Session (You + ClearNode)
  ↓
Get App Session ID ← CRITICAL
  ↓
Store in Backend + Broadcast to all users
  ↓
Market appears in UI for everyone
```

### 2. User Betting Flow
```typescript
User sees market list
  ↓
Clicks market to view details
  ↓
Enters bet amount + selects YES/NO
  ↓
Deposits to app session (off-chain)
  ↓
Position recorded instantly
  ↓
UI updates in real-time
```

### 3. Refund Flow
```typescript
User requests refund
  ↓
Check market not resolved yet
  ↓
Submit state update (withdraw intent)
  ↓
Yellow Network processes
  ↓
Balance returned to user's ledger
```

### 4. Settlement Flow
```typescript
Market creator resolves (YES/NO)
  ↓
Calculate winners vs losers
  ↓
Submit final state
  ↓
Yellow Network settlement
  ↓
Winners receive payouts
```

## File Structure

```
vaultos/
├── src/
│   ├── client/                      # Frontend (React)
│   │   ├── components/
│   │   │   ├── MarketList.tsx       # Show all markets
│   │   │   ├── MarketDetail.tsx     # Market + betting UI
│   │   │   ├── PlaceBet.tsx         # Bet placement form
│   │   │   ├── UserPositions.tsx    # User's active bets
│   │   │   └── YellowConnection.tsx # Yellow Network status
│   │   ├── hooks/
│   │   │   ├── useYellowNetwork.ts  #  Yellow WebSocket hook
│   │   │   ├── useMarkets.ts        # Markets state
│   │   │   └── usePositions.ts      # User positions
│   │   └── services/
│   │       ├── yellowClient.ts      # Yellow Network client
│   │       └── marketService.ts     # Market API calls
│   │
│   └── server/                      # Backend (Express + WebSocket)
│       ├── routes/
│       │   ├── market.ts            # Market CRUD endpoints
│       │   ├── bet.ts               # Betting endpoints
│       │   └── refund.ts            # Refund endpoints
│       └── services/
│           ├── YellowSessionManager.ts  # Manage app sessions
│           ├── MarketBroadcast.ts       # Real-time updates
│           └── SettlementService.ts     # Market resolution
```

## Key Features to Implement

### ✅ 1. Yellow Network Connection (Frontend)
**File: `src/client/hooks/useYellowNetwork.ts`**

```typescript
import { useState, useEffect } from 'react';
import { createEnhancedYellowClient } from '../../../src/yellow/enhanced-yellow-client';

export function useYellowNetwork() {
  const [client, setClient] = useState(null);
  const [connected, setConnected] = useState(false);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    const initYellow = async () => {
      const yellowClient = createEnhancedYellowClient();
      await yellowClient.connect();
      
      // Authenticate with user's wallet
      await yellowClient.authenticate(account);
      
      // Get balance
      const balances = await yellowClient.getLedgerBalances();
      setBalance(balances[0]?.balance || 0);
      
      setClient(yellowClient);
      setConnected(true);
    };
    
    initYellow();
  }, []);

  return { client, connected, balance };
}
```

### ✅ 2. Market Discovery (Show All Markets)
**File: `src/client/components/MarketList.tsx`**

```typescript
import { useEffect, useState } from 'react';
import { getMarkets } from '../services/marketService';

interface Market {
  id: string;
  appSessionId: string;  // ← CRITICAL: Yellow app session ID
  question: string;
  yesPool: number;
  noPool: number;
  totalPool: number;
  status: 'open' | 'closed' | 'resolved';
  outcome?: 'YES' | 'NO';
}

export function MarketList() {
  const [markets, setMarkets] = useState<Market[]>([]);

  useEffect(() => {
    // Fetch markets from backend
    const fetchMarkets = async () => {
      const data = await getMarkets();
      setMarkets(data);
    };
    
    fetchMarkets();
    
    // Poll every 5 seconds for real-time updates
    const interval = setInterval(fetchMarkets, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h2>Active Prediction Markets</h2>
      {markets.map(market => (
        <div key={market.id} onClick={() => navigate(`/market/${market.id}`)}>
          <h3>{market.question}</h3>
          <div>YES Pool: ${market.yesPool} | NO Pool: ${market.noPool}</div>
          <div>Total: ${market.totalPool}</div>
        </div>
      ))}
    </div>
  );
}
```

### ✅ 3. Place Bet (Deposit to App Session)
**File: `src/client/components/PlaceBet.tsx`**

```typescript
import { useState } from 'react';
import { useYellowNetwork } from '../hooks/useYellowNetwork';
import { placeBet } from '../services/marketService';

export function PlaceBet({ marketId, appSessionId }: Props) {
  const { client } = useYellowNetwork();
  const [amount, setAmount] = useState('');
  const [position, setPosition] = useState<'YES' | 'NO'>('YES');

  const handlePlaceBet = async () => {
    // 1. Submit state update to Yellow Network app session
    await client.submitAppState({
      app_session_id: appSessionId,
      intent: 'DEPOSIT',  // Add funds to session
      allocations: [{
        participant: userAddress,
        asset: 'ytest.usd',
        amount: (parseFloat(amount) * 1_000_000).toString(),
      }],
    });

    // 2. Record bet in backend
    await placeBet({
      marketId,
      amount: parseFloat(amount),
      position,
    });

    alert(`Bet placed! $${amount} on ${position}`);
  };

  return (
    <div>
      <input 
        type="number" 
        value={amount} 
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount in USDC"
      />
      <button onClick={() => setPosition('YES')}>YES</button>
      <button onClick={() => setPosition('NO')}>NO</button>
      <button onClick={handlePlaceBet}>Place Bet</button>
    </div>
  );
}
```

### ✅ 4. Refund System
**File: `src/client/components/Refund.tsx`**

```typescript
export function RefundButton({ marketId, appSessionId, userBet }: Props) {
  const { client } = useYellowNetwork();

  const handleRefund = async () => {
    // Check market not resolved
    const market = await getMarket(marketId);
    if (market.status !== 'open') {
      alert('Market is closed or resolved');
      return;
    }

    // Submit withdraw intent to Yellow Network
    await client.submitAppState({
      app_session_id: appSessionId,
      intent: 'WITHDRAW',  // Remove funds from session
      allocations: [{
        participant: userAddress,
        asset: 'ytest.usd',
        amount: (userBet.amount * 1_000_000).toString(),
      }],
    });

    // Update backend
    await requestRefund(marketId, userBet.id);

    alert('Refund processed!');
  };

  return <button onClick={handleRefund}>Request Refund</button>;
}
```

### ✅ 5. Real-Time Monitoring
**File: `src/server/services/MarketBroadcast.ts`**

```typescript
import { WebSocketServer } from 'ws';

export class MarketBroadcast {
  private wss: WebSocketServer;
  private markets: Map<string, Market> = new Map();

  constructor() {
    this.wss = new WebSocketServer({ port: 8080 });
  }

  // Broadcast market updates to all connected clients
  broadcastMarketUpdate(marketId: string) {
    const market = this.markets.get(marketId);
    
    this.wss.clients.forEach(client => {
      client.send(JSON.stringify({
        type: 'market_update',
        data: market,
      }));
    });
  }

  // When user places bet, update and broadcast
  async onBetPlaced(marketId: string, bet: Bet) {
    const market = this.markets.get(marketId);
    
    if (bet.position === 'YES') {
      market.yesPool += bet.amount;
    } else {
      market.noPool += bet.amount;
    }
    market.totalPool += bet.amount;

    this.markets.set(marketId, market);
    this.broadcastMarketUpdate(marketId);
  }
}
```

## Database Schema (Store Market Sessions)

```typescript
interface Market {
  id: string;
  appSessionId: string;  // ← Yellow Network app session ID
  creatorAddress: string;
  question: string;
  createdAt: Date;
  resolutionDate: Date;
  status: 'open' | 'closed' | 'resolved';
  outcome?: 'YES' | 'NO';
  
  // Pool tracking
  yesPool: number;
  noPool: number;
  totalPool: number;
  
  // Participants
  bets: Bet[];
}

interface Bet {
  id: string;
  marketId: string;
  userAddress: string;
  amount: number;
  position: 'YES' | 'NO';
  timestamp: Date;
  status: 'active' | 'refunded' | 'settled';
}
```

## Implementation Steps

### Phase 1: Core Integration (Week 1)
1. ✅ Fix session ID capture in demo script
2. ✅ Create `useYellowNetwork` hook
3. ✅ Build market creation UI + store app_session_id
4. ✅ Implement market list view

### Phase 2: Betting & Refunds (Week 2)
5. ✅ Build bet placement UI
6. ✅ Implement DEPOSIT intent to app session
7. ✅ Add refund functionality (WITHDRAW intent)
8. ✅ Real-time balance updates

### Phase 3: Settlement & Polish (Week 3)
9. ✅ Build resolution UI for market creator
10. ✅ Implement settlement logic
11. ✅ Add winner payout distribution
12. ✅ Polish UI/UX

## Testing Checklist

- [ ] Market creator can create market → gets app_session_id
- [ ] Market appears in list for all users
- [ ] User can place bet → balance updates instantly
- [ ] User can request refund → funds returned
- [ ] Market creator can resolve → winners get paid
- [ ] All operations work off-chain (no gas fees)

## Run Demo to See Session ID

```bash
npm run demo:session
```

Should now show: **Session ID: [actual ID]**

## Next: Start Building Frontend

```bash
cd vaultos/src/client
# Implement useYellowNetwork hook first
# Then MarketList component
# Then betting UI
```

---

**Key Points:**
1. ✅ **App Session ID** is critical - store it when market created
2. ✅ **Broadcast** markets to all users via WebSocket
3. ✅ **DEPOSIT intent** = place bet (add to app session)
4. ✅ **WITHDRAW intent** = refund (remove from app session)
5. ✅ **Everything off-chain** until final settlement

Ready to implement? Let's start with the Yellow Network connection hook!
