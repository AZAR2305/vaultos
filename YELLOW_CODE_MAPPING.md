# 🔗 Code Implementation Mapping

## How the Workflow Maps to Your Code

---

## 📁 Project Structure

```
vaultos/
├── scripts/
│   ├── demo-app-session.ts              ← App session demonstration
│   └── create-prediction-market-channel.ts ← Channel creation (what we just built!)
│
├── src/
│   ├── yellow/
│   │   ├── client.ts                    ← Original Yellow client (simulated)
│   │   ├── nitrolite.ts                 ← Real Yellow Network integration
│   │   ├── enhanced-yellow-client.ts    ← Enhanced client with auto-deposit
│   │   ├── vaultos-yellow.ts            ← VaultOS-specific implementation
│   │   ├── ChannelManager.ts            ← Channel lifecycle management
│   │   ├── session.ts                   ← Session management
│   │   ├── state.ts                     ← State management
│   │   └── protocol-types.ts            ← TypeScript interfaces
│   │
│   ├── markets/
│   │   ├── MarketService.ts             ← Core prediction market logic
│   │   └── types.ts                     ← Market type definitions
│   │
│   ├── auth/
│   │   └── SessionManager.ts            ← User session management
│   │
│   └── server/
│       ├── routes/
│       │   ├── session.ts               ← API: Session endpoints
│       │   └── trade.ts                 ← API: Trade endpoints
│       │
│       └── services/
│           ├── SessionService.ts        ← Business logic: Sessions
│           └── TradeService.ts          ← Business logic: Trading
│
└── vaultos/src/client/
    ├── App.tsx                          ← Frontend UI
    ├── components/                      ← React components
    ├── hooks/                           ← Custom React hooks
    └── services/                        ← Frontend services
```

---

## 🔄 Workflow → Code Mapping

### PHASE 1: Authentication

#### Step 1: Generate Session Key

**File:** `scripts/create-prediction-market-channel.ts` (line 68-71)

```typescript
// Generate ephemeral session key
const sessionWallet = ethers.Wallet.createRandom();
console.log(`🔑 Session Key (Ephemeral): ${sessionWallet.address}`);
console.log('   (Used for off-chain message signing)\n');
```

**Also used in:** `scripts/demo-app-session.ts` (line 52)

---

#### Step 2-5: Authentication Flow

**File:** `scripts/create-prediction-market-channel.ts` (line 73-107)

```typescript
// Auth parameters
const authParams = {
    address: mainAccount.address,
    session_key: sessionWallet.address,
    application: 'Yellow',
    expires_at: BigInt(Math.floor(Date.now() / 1000) + 7200), // 2 hours
    scope: 'console',
    allowances: [{
        asset: 'ytest.usd',
        amount: '100000000'  // 100 USDC allowance
    }],
};

// Connect and authenticate
ws.on('open', async () => {
    const authMsg = await createAuthRequestMessage(authParams);
    ws.send(authMsg);
});

ws.on('message', async (data) => {
    const message = JSON.parse(data.toString());
    
    // Handle auth challenge
    if (message.res && message.res[1] === 'auth_challenge') {
        const eip712Signer = createEIP712AuthMessageSigner(
            walletClient,
            {
                session_key: authParams.session_key,
                allowances: authParams.allowances,
                expires_at: authParams.expires_at.toString(),
                scope: authParams.scope,
            },
            { name: authParams.application }
        );
        
        const authVerifyMsg = await createAuthVerifyMessageFromChallenge(
            eip712Signer,
            challenge
        );
        
        ws.send(authVerifyMsg);
    }
    
    // Handle auth success
    else if (message.res && message.res[1] === 'auth_verify') {
        console.log('✅ Authentication successful!\n');
        authenticated = true;
    }
});
```

**SDK Reference:**
- `@erc7824/nitrolite` → `createAuthRequestMessage()`
- `@erc7824/nitrolite` → `createEIP712AuthMessageSigner()`
- `@erc7824/nitrolite` → `createAuthVerifyMessageFromChallenge()`

---

### PHASE 2: Channel Creation

#### Check for Existing Channels

**File:** `scripts/create-prediction-market-channel.ts` (line 244-294)

```typescript
let channels: any[] = [];

// Use cached channels from auth phase
if (session.cachedChannels !== undefined) {
    console.log(`✅ Using channels list from authentication phase\n`);
    channels = session.cachedChannels;
} else {
    // Query if needed
    const ledgerMsg = await createGetLedgerBalancesMessage(
        sessionSigner,
        mainAccount.address,
        Date.now()
    );
    ws.send(ledgerMsg);
}

// Check for open channel
const openChannel = channels.find((c: any) => c.status === 'open');
```

---

#### Create New Channel

**File:** `scripts/create-prediction-market-channel.ts` (line 304-345)

```typescript
// Setup listener BEFORE sending request (prevents race condition)
const channelPromise = new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout')), 60000);
    
    const handler = (data: any) => {
        const response = JSON.parse(data.toString());
        if (response.res && response.res[1] === 'create_channel') {
            clearTimeout(timeout);
            ws.off('message', handler);
            resolve(response.res[2]);
        }
    };
    ws.on('message', handler);
});

// Send create channel request
const createChannelMsg = await createCreateChannelMessage(
    sessionSigner,
    {
        chain_id: 11155111, // Sepolia
        token: YTEST_USD_TOKEN,
    }
);

ws.send(createChannelMsg);

// Wait for response
const channelData = await channelPromise;
const channelId = channelData.channel_id;

console.log('✅ Channel created off-chain:');
console.log(`   Channel ID: ${channelId}\n`);
```

**SDK Reference:**
- `@erc7824/nitrolite` → `createCreateChannelMessage()`
- `@erc7824/nitrolite` → `createGetLedgerBalancesMessage()`

---

### PHASE 3: Trading Logic (To Be Implemented)

#### Market Service Structure

**File:** `src/markets/MarketService.ts` (line 1-60)

```typescript
export class MarketService {
    private markets: Map<string, PredictionMarket> = new Map();
    private yellowClient: YellowNetworkClient;

    async createMarket(params: {
        question: string;
        outcomes: string[];
        endTime: Date;
        creatorDeposit: bigint;
    }): Promise<PredictionMarket> {
        // Create app session on Yellow Network
        const appSession = await this.yellowClient.createAppSession({
            deposit: params.creatorDeposit,
            participants: [creator, clearNode],
        });

        const market: PredictionMarket = {
            id: generateMarketId(),
            question: params.question,
            outcomes: params.outcomes,
            pools: new Map(),
            totalVolume: 0n,
            endTime: params.endTime,
            appSessionId: appSession.id,
        };

        this.markets.set(market.id, market);
        return market;
    }

    async placeBet(
        marketId: string,
        userId: string,
        outcome: string,
        amount: bigint
    ): Promise<void> {
        const market = this.markets.get(marketId);
        if (!market) throw new Error('Market not found');

        // Update off-chain via Yellow Network
        await this.yellowClient.updateAppSession({
            sessionId: market.appSessionId,
            updates: [{
                user: userId,
                outcome: outcome,
                amount: amount,
            }],
        });

        // Update local state
        const currentPool = market.pools.get(outcome) || 0n;
        market.pools.set(outcome, currentPool + amount);
        market.totalVolume += amount;
    }
}
```

---

#### Trading Flow Implementation

**Pseudocode for your frontend:**

```typescript
// In your React component
async function placeBet(outcome: 'YES' | 'NO', amount: number) {
    try {
        // 1. Check session is authenticated
        if (!yellowSession) {
            await authenticate();
        }

        // 2. Send trade via WebSocket
        const tradeMsg = await createTradeMessage(
            sessionSigner,
            {
                market_id: currentMarket.id,
                outcome: outcome,
                amount: parseUnits(amount.toString(), 6), // USDC decimals
                side: 'BUY',
            }
        );

        ws.send(tradeMsg);

        // 3. Wait for confirmation
        const confirmation = await waitForTradeConfirmation();

        // 4. Update UI with new odds
        setOdds(calculateOdds(market.pools));
        
        // 5. Show success notification
        toast.success(`Bet placed: ${amount} USDC on ${outcome}`);

    } catch (error) {
        console.error('Trade failed:', error);
        toast.error('Failed to place bet');
    }
}
```

---

### PHASE 4: Settlement (To Be Implemented)

#### Resolution Flow

**File:** `src/markets/MarketService.ts` (to be implemented)

```typescript
async resolveMarket(
    marketId: string,
    winningOutcome: string
): Promise<void> {
    const market = this.markets.get(marketId);
    if (!market) throw new Error('Market not found');

    // 1. Get final state from Yellow Network
    const finalState = await this.yellowClient.getAppSessionState(
        market.appSessionId
    );

    // 2. Calculate payouts
    const payouts = this.calculatePayouts(
        finalState,
        winningOutcome
    );

    // 3. Request settlement
    await this.yellowClient.settleAppSession({
        sessionId: market.appSessionId,
        finalState: finalState,
        payouts: payouts,
    });

    // 4. Submit to blockchain
    const tx = await this.yellowClient.submitSettlement(
        market.appSessionId
    );

    // 5. Wait for confirmation
    await tx.wait();

    // 6. Notify winners
    this.notifyWinners(payouts);

    market.resolved = true;
    market.winningOutcome = winningOutcome;
}

private calculatePayouts(
    state: AppSessionState,
    winningOutcome: string
): Map<string, bigint> {
    const payouts = new Map<string, bigint>();
    
    const winningPool = state.pools.get(winningOutcome)!;
    const losingPools = Array.from(state.pools.values())
        .filter(pool => pool.outcome !== winningOutcome);
    
    const totalLosing = losingPools.reduce((sum, pool) => sum + pool.amount, 0n);
    
    // Distribute losing bets proportionally to winners
    state.bets
        .filter(bet => bet.outcome === winningOutcome)
        .forEach(bet => {
            const share = (bet.amount * totalLosing) / winningPool;
            payouts.set(bet.userId, bet.amount + share);
        });
    
    return payouts;
}
```

---

## 🔧 Key Components Explained

### 1. YellowClient vs NitroliteClient

```typescript
// YellowClient (src/yellow/client.ts)
// - Original simulated client for testing
// - Good for understanding concepts
// - NOT connected to real network

// NitroliteClient (src/yellow/nitrolite.ts)
// - Real Yellow Network SDK
// - Connected to live sandbox
// - Production ready
// - What we use now ✅
```

---

### 2. Session Management

**File:** `src/yellow/session.ts`

```typescript
export interface YellowSession {
    sessionId: string;
    sessionPrivateKey: `0x${string}`;
    sessionAddress: `0x${string}`;
    userAddress: `0x${string}`;
    channelId?: string;
    expiresAt: bigint;
}

export class SessionManager {
    private activeSessions: Map<string, YellowSession> = new Map();
    
    createSession(userAddress: string): YellowSession {
        const sessionWallet = ethers.Wallet.createRandom();
        
        return {
            sessionId: generateSessionId(),
            sessionPrivateKey: sessionWallet.privateKey as `0x${string}`,
            sessionAddress: sessionWallet.address as `0x${string}`,
            userAddress: userAddress as `0x${string}`,
            expiresAt: BigInt(Date.now() / 1000 + 7200),
        };
    }
    
    isValid(sessionId: string): boolean {
        const session = this.activeSessions.get(sessionId);
        if (!session) return false;
        return BigInt(Date.now() / 1000) < session.expiresAt;
    }
}
```

---

### 3. State Updates

**Off-chain state update flow:**

```typescript
// 1. User signs state update with session key
const stateSigner = createECDSAMessageSigner(sessionPrivateKey);

const stateUpdate = {
    channel_id: channelId,
    version: currentVersion + 1,
    allocations: newAllocations,
    data: encodedMarketData,
};

const signature = await stateSigner.sign(stateUpdate);

// 2. Send to ClearNode
ws.send(JSON.stringify({
    type: 'state_update',
    channel_id: channelId,
    state: stateUpdate,
    signature: signature,
}));

// 3. ClearNode validates
// - Checks signature
// - Validates version increment
// - Ensures conservation of funds
// - Confirms all participants signed

// 4. Broadcast to all participants
// All users receive instant update
```

---

## 📊 Data Structures

### Channel Data

```typescript
interface ChannelData {
    channel_id: string;  // 0x6af3b42df22ad132...
    channel: {
        participants: string[];  // [user, clearNode]
        adjudicator: string;     // Smart contract address
        challenge: number;       // Dispute period (seconds)
        nonce: number;          // Unique channel nonce
    };
    state: {
        intent: number;          // Channel intent (1 = standard)
        version: number;         // State version (0 = initial)
        state_data: string;      // Application-specific data
        allocations: Array<{
            destination: string;  // Participant address
            token: string;        // Token contract address
            amount: string;       // Token amount (as string)
        }>;
    };
    server_signature: string;    // ClearNode's signature
}
```

### Market Data

```typescript
interface PredictionMarket {
    id: string;
    question: string;
    outcomes: string[];          // ['YES', 'NO']
    pools: Map<string, bigint>;  // {'YES': 15000000n, 'NO': 5000000n}
    totalVolume: bigint;
    bets: Bet[];
    createdAt: Date;
    endTime: Date;
    resolved: boolean;
    winningOutcome?: string;
    appSessionId: string;        // Yellow Network session
    channelId: string;           // State channel ID
}

interface Bet {
    userId: string;
    outcome: string;
    amount: bigint;
    timestamp: Date;
    odds: number;               // Odds at time of bet
}
```

---

## 🎯 Integration Points

### Where to Add Trading Logic

**1. Frontend Component** (`vaultos/src/client/components/MarketCard.tsx`)

```typescript
import { useYellowNetwork } from '../hooks/useYellowNetwork';

function MarketCard({ market }: { market: PredictionMarket }) {
    const { placeBet, session } = useYellowNetwork();
    
    async function handleBet(outcome: string, amount: number) {
        await placeBet({
            marketId: market.id,
            outcome,
            amount: parseUnits(amount.toString(), 6),
        });
    }
    
    return (
        <div className="market-card">
            <h3>{market.question}</h3>
            <BettingInterface onBet={handleBet} />
        </div>
    );
}
```

**2. Custom Hook** (`vaultos/src/client/hooks/useYellowNetwork.ts`)

```typescript
export function useYellowNetwork() {
    const [session, setSession] = useState<YellowSession | null>(null);
    const [ws, setWs] = useState<WebSocket | null>(null);
    
    useEffect(() => {
        // Initialize connection
        const websocket = new WebSocket(CLEARNODE_URL);
        setWs(websocket);
        
        return () => websocket.close();
    }, []);
    
    async function authenticate(wallet: Wallet) {
        // ... authentication flow from our script
    }
    
    async function placeBet(params: BetParams) {
        // ... betting logic using our channel
    }
    
    return { session, placeBet, authenticate };
}
```

**3. API Routes** (`src/server/routes/trade.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { marketService } from '../services/MarketService';

export async function POST(request: NextRequest) {
    const { marketId, outcome, amount, userId } = await request.json();
    
    try {
        await marketService.placeBet(marketId, userId, outcome, amount);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
```

---

## 🚀 Next Steps to Complete

### 1. Implement Trading Logic

**File to create:** `src/yellow/trading.ts`

```typescript
import { createECDSAMessageSigner } from '@erc7824/nitrolite';

export class TradingEngine {
    async executeTrade(params: TradeParams): Promise<TradeResult> {
        // 1. Validate trade
        // 2. Calculate new allocations
        // 3. Create state update message
        // 4. Sign with session key
        // 5. Send to ClearNode
        // 6. Wait for confirmation
    }
}
```

### 2. Add Oracle Integration

**File to create:** `src/oracle/ChainlinkOracle.ts`

```typescript
export class ChainlinkOracle {
    async getPrice(asset: string): Promise<bigint> {
        // Query Chainlink price feed
    }
    
    async resolveMarket(market: PredictionMarket): Promise<string> {
        // Check condition and return winning outcome
    }
}
```

### 3. Build UI Components

```bash
vaultos/src/client/components/
├── MarketList.tsx       # Display all markets
├── MarketCard.tsx       # Individual market
├── BettingInterface.tsx # Place bet UI
├── PositionsList.tsx    # User's positions
└── SettlementModal.tsx  # Settlement UI
```

---

## 📚 Quick Reference

### Important Constants

```typescript
// Network
const CLEARNODE_URL = 'wss://clearnet-sandbox.yellow.com/ws';
const CLEARNODE_ADDRESS = '0x019B65A265EB3363822f2752141b3dF16131b262';

// Contracts
const YTEST_USD_TOKEN = '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb';
const ADJUDICATOR = '0x7c7ccbc98469190849BCC6c926307794fDfB11F2';
const CUSTODY = '0xDfC4D57d100a764A572471829A2E1F76EBbD1E04';

// Chain
const SEPOLIA_CHAIN_ID = 11155111;
const BASE_SEPOLIA_CHAIN_ID = 84532;
```

### SDK Imports

```typescript
import {
    createAuthRequestMessage,
    createAuthVerifyMessageFromChallenge,
    createEIP712AuthMessageSigner,
    createECDSAMessageSigner,
    createCreateChannelMessage,
    createGetLedgerBalancesMessage,
    NitroliteClient,
} from '@erc7824/nitrolite';
```

### Run Commands

```bash
# Create channel
npm run create:market-channel

# Demo app session
npm run demo:session

# Check balance
npm run check:yellow

# View channels
npm run check:channels
```

---

**🎉 You now have a complete roadmap from code to production!**

Your channel is live and ready: `0x6af3b42df22ad132b45209d9cfa1716f0b693440749c5fbc7ecba4526b2c7aad`
