# Bettify - Instant Prediction Markets

**⚡ Real-time trading powered by Yellow Network state channels**

> Trade on prediction markets with instant execution and zero gas fees

---

## 🎯 What is Bettify?

Bettify is a next-generation prediction market platform built on **Yellow Network**, solving the biggest problems in blockchain-based prediction markets:

### The Problems
1. **Speed**: Traditional blockchain markets are slow (15-60 seconds per trade)
2. **Cost**: Every trade requires gas fees ($1-50), making frequent trading expensive
3. **UX**: Complex wallet interactions create friction for users

### The Solution: Yellow Network State Channels

Bettify leverages **Yellow Network's Nitrolite state channels** to provide:
- ⚡ **Instant trades** - Execute in < 100ms (faster than centralized exchanges)
- 💸 **Zero gas fees** - Pay once to deposit, trade unlimited times, pay once to withdraw
- 🔒 **Session-based security** - Trade without exposing your main wallet
- 🎮 **Web2 UX, Web3 security** - Feels like a traditional app, backed by cryptographic proofs
- 🔐 **Non-custodial** - You always control your funds

---

## 🏗️ How Yellow Network Powers Bettify

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   USER'S WALLET                         │
│   - Main wallet stays safe offline                      │
│   - Session key created with limited permissions        │
│   - Deposits USDC to Yellow Network                     │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ 1. Deposit USDC (on-chain)
                 │ 2. Create session (off-chain)
                 ↓
┌─────────────────────────────────────────────────────────┐
│            YELLOW NETWORK STATE CHANNEL                 │
│                                                          │
│   💫 Off-chain Balance Tracking                         │
│   - User balance: Updated instantly                     │
│   - Market positions: Real-time changes                 │
│   - Every update cryptographically signed               │
│                                                          │
│   🔐 Security Properties                                │
│   - User signs every state transition                   │
│   - Signatures are stored as proof                      │
│   - Can dispute invalid states on-chain                 │
│                                                          │
│   ⚡ Why It's Fast                                       │
│   - No blockchain consensus needed                      │
│   - Just update local state + collect signatures        │
│   - Settlement happens later (batched)                  │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ All trades happen off-chain
                 │ (instant, zero gas)
                 ↓
┌─────────────────────────────────────────────────────────┐
│              BETTIFY TRADING ENGINE                     │
│                                                          │
│   📊 LMSR Automated Market Maker                        │
│   - Fair pricing based on liquidity                     │
│   - YES + NO prices always sum to 1.0                   │
│   - Prices adjust with volume                           │
│                                                          │
│   🎯 Features                                            │
│   - Buy YES or NO shares                                │
│   - Sell positions anytime (before resolution)          │
│   - Request refunds (25% penalty)                       │
│   - Multi-market portfolio tracking                     │
└─────────────────┬────────────────────────────────────────┘
                 │
                 │ On market resolution
                 ↓
┌─────────────────────────────────────────────────────────┐
│              ON-CHAIN SETTLEMENT                        │
│   - Admin freezes market (stops trading)                │
│   - Admin resolves outcome (YES or NO wins)             │
│   - Winners receive payouts on Yellow Network           │
│   - Settlement tx batched for efficiency                │
└─────────────────────────────────────────────────────────┘
```

### Why Yellow Network State Channels?

**State channels** are Layer 2 scaling solutions that move transactions off-chain:

1. **Opening**: User deposits funds on-chain → Opens a channel
2. **Trading**: All trades happen off-chain, just updating signed states
3. **Closing**: Final state is settled on-chain → Funds distributed

**Benefits for Prediction Markets:**
- ✅ Trade as fast as you want (no blockchain delays)
- ✅ No gas fees per trade (only pay for open/close)
- ✅ Still non-custodial (you can prove your balance)
- ✅ Can exit anytime with your cryptographic proofs

---

## 🔐 Security Model

### How Your Funds Stay Safe

**1. Session Keys (Limited Permissions)**
```
Main Wallet (Private Key)
    ↓ creates
Session Key (Temporary)
    ↓ with limits
    - Max spend: 1000 USDC
    - Duration: 1 hour
    - Max refund: 25%
```

**2. Cryptographic State Signing**

Every action you take is signed:
```typescript
State = {
  channelId: "0xABC...",
  nonce: 42,              // Prevents replay attacks  
  activeBalance: 850,     // Your current balance
  positions: {...}        // Your market positions
}

Signature = sign(State, SessionKey)
```

**3. Why Yellow Network Node Can't Steal**

Yellow Network's clearing node:
- ❌ **Cannot forge your signature** (doesn't have your private key)
- ❌ **Cannot spend more than allowance** (enforced by session limits)
- ❌ **Cannot submit old states** (nonce prevents replay)
- ✅ **Can only process states YOU signed** (cryptographically verifiable)

**4. Dispute Mechanism**

If Yellow Network misbehaves:
1. You submit your signed state proofs to L1 smart contract
2. Contract verifies signatures (math doesn't lie)
3. Correct state is enforced on-chain
4. You get your funds back + compensation

**You always win disputes with valid signatures.**

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- MetaMask or any Web3 wallet

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/bettify.git
cd bettify

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

Server starts on `http://localhost:3000`

### First Trade in 30 Seconds

1. **Connect Wallet** - Click "Connect Wallet" in the UI
2. **Deposit Funds** - Deposit ytest.USD (testnet USDC) to Yellow Network
3. **Browse Markets** - See active prediction markets
4. **Place Trade** - Buy YES or NO shares instantly
5. **Watch Updates** - See your positions update in real-time

---

## 🎮 Core Features

### 1. Instant Trading (Powered by Yellow Network)

Traditional blockchain prediction markets:
```
User clicks "Buy" 
  → Wallet popup (approve tx)
  → Wait for confirmation (15-60 seconds)
  → Trade executes
  → Pay gas fee ($1-50)
```

Bettify with Yellow Network:
```
User clicks "Buy"
  → Trade executes instantly (< 100ms)
  → Zero gas fee
  → Balance updates in real-time
```

### 2. LMSR Automated Market Maker

Fair market-driven pricing using Logarithmic Market Scoring Rule:

```
Price = f(liquidity, shares_in_pool)

Example:
- Initial: YES 50%, NO 50%
- After buying YES: YES 65%, NO 35%
- Market adjusts based on demand
```

### 3. Multi-Market Portfolio

- Track positions across multiple markets
- See aggregate P&L in real-time
- Manage all positions from one dashboard

### 4. Admin Controls (For Market Creators)

Market lifecycle management:
```
OPEN → Trade freely
  ↓ (Admin freezes)
FROZEN → Trading stopped
  ↓ (Admin resolves)
RESOLVED → Winner determined
  ↓ (Admin settles)
SETTLED → Payouts distributed
```

### 5. Refund System

Need to exit early?
- Request refund anytime before resolution
- Receive 25% of original cost
- 75% penalty stays in liquidity pool
- Shares returned to market

---

## 📡 How State Channels Work (Technical Deep Dive)

### Phase 1: Channel Opening (On-Chain)

```typescript
// User deposits USDC to Yellow Network
yellowClient.deposit({
  amount: 1000,        // 1000 ytest.USD
  token: "ytest.USD"
});

// State channel opens with initial state
State_0 = {
  channelId: "0xABC...",
  nonce: 0,
  balance: 1000,
  positions: {}
}
```

### Phase 2: Off-Chain Trading (Instant!)

```typescript
// User buys 100 YES shares
// NO blockchain transaction needed!

State_1 = {
  channelId: "0xABC...",
  nonce: 1,              // Incremented
  balance: 850,          // 1000 - 150 (cost)
  positions: {
    market_1: { YES: 100, cost: 150 }
  }
}

Signature_1 = sign(State_1, SessionKey)

// This happens in < 100ms
// Zero gas fees
// Just updating local state + signature
```

### Phase 3: Settlement (On-Chain)

```typescript
// When user wants to withdraw
// OR when market resolves

// Submit final signed state to Yellow Network
yellowClient.settle(State_N, Signature_N);

// Yellow Network verifies signatures
// Distributes funds accordingly
// Single on-chain transaction
```

**Key Insight**: 1000 trades off-chain = 1 trade worth of gas fees!

---

## 🏦 Balance Management

### Three Types of Balances

1. **Active Balance** - Available for trading
2. **Market Positions** - Locked in predictions
3. **Withdrawn** - Sent back to your wallet

### Balance Flow Example

```
Start: Deposit 1000 ytest.USD
  ↓
Active: 1000

Buy 100 YES shares (cost: 150)
  ↓
Active: 850
Position: 100 YES shares (value: market price)

Sell 50 YES shares (payout: 80)
  ↓
Active: 930
Position: 50 YES shares

Withdraw
  ↓
Wallet: 930 ytest.USD (+ any winnings)
```

---

## 🎨 User Interface

### Trading Panel

- **Live Markets** - Browse active prediction markets
- **Price Charts** - See YES/NO price trends
- **Quick Trade** - One-click buy/sell
- **Position Summary** - P&L tracking

### Admin Panel (Market Creators Only)

- **Freeze Market** - Stop trading before resolution
- **Resolve Outcome** - Declare winner (YES/NO)
- **Settle On-Chain** - Distribute payouts
- **Market Analytics** - Volume, participants, liquidity

### In-App Notifications

All critical actions show feedback:
- ✅ "Trade executed: 100 YES shares"
- ⚠️ "Insufficient balance"
- 💰 "Market resolved: You won 245 ytest.USD!"
- 🔒 "Market frozen by admin"

---

## �️ Technical Stack

### Backend
- **TypeScript** - Type-safe development
- **Express** - REST API server
- **Yellow Network SDK** - State channel integration
- **WebSocket** - Real-time updates

### Frontend
- **React 18** - Modern UI framework
- **Vite** - Fast build tool
- **Wagmi** - Web3 wallet connection
- **TailwindCSS** - Utility-first styling

### Blockchain
- **Yellow Network** - Layer 2 state channels
- **Ethereum** - L1 settlement layer (testnet)
- **ytest.USD** - Testnet stablecoin

---

## 📂 Project Structure

```
bettify/
├── src/
│   ├── client/           # Frontend React app
│   │   ├── components/   # UI components
│   │   │   ├── AppMain.tsx
│   │   │   ├── TradePanelNew.tsx
│   │   │   ├── PositionsView.tsx
│   │   │   └── MarketResolutionPanel.tsx
│   │   ├── services/     # API integration
│   │   └── styles/       # CSS styles
│   │
│   ├── server/           # Backend Express server
│   │   ├── routes/       # API endpoints
│   │   │   ├── market.ts
│   │   │   ├── trade.ts
│   │   │   └── session.ts
│   │   ├── services/     # Business logic
│   │   │   ├── MarketService.ts
│   │   │   └── YellowNetworkService.ts
│   │   └── index.ts      # Server entry point
│   │
│   └── yellow/           # Yellow Network integration
│       ├── client.ts     # Yellow SDK wrapper
│       ├── channel.ts    # State channel management
│       └── types.ts      # TypeScript definitions
│
├── vaultos/              # Main application folder
│   └── (duplicate of src for historical reasons)
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 🚀 Deployment

### Development

```bash
npm run dev
```

Starts:
- Frontend dev server on `http://localhost:5173`
- Backend API server on `http://localhost:3000`
- Hot reload enabled

### Production Build

```bash
# Build frontend and backend
npm run build

# Start production server
npm start
```

### Environment Variables

Create `.env` file:

```env
# Yellow Network Configuration
YELLOW_API_KEY=your_api_key
YELLOW_CLEARNODE_URL=https://testnet.yellow.org

# Server Configuration
PORT=3000
NODE_ENV=production

# Admin Wallet (for market resolution)
ADMIN_WALLET=0xFefa60F5aA4069F96b9Bf65c814DDb3A604974e1
```

---

## 🔮 Future Roadmap

### Phase 2: Advanced Features
- [ ] Oracle integration (Chainlink price feeds)
- [ ] Conditional markets (depends on other outcomes)
- [ ] Liquidity pools (earn fees by providing liquidity)
- [ ] Social features (share markets, comments)

### Phase 3: Mobile & Scale
- [ ] Native mobile apps (iOS/Android)
- [ ] Push notifications for market events
- [ ] Advanced charting and analytics
- [ ] Multi-language support

### Phase 4: DAO & Governance
- [ ] Community governance token
- [ ] Decentralized market creation approval
- [ ] Dispute resolution voting
- [ ] Revenue sharing for liquidity providers

---

## 💡 Why Yellow Network?

### Comparison with Other Approaches

| Feature | Traditional Blockchain | Optimistic Rollups | **Yellow Network** |
|---------|----------------------|-------------------|-------------------|
| Trade Speed | 15-60s | 1-5s | **< 100ms** ⚡ |
| Gas per Trade | $1-50 | $0.10-1 | **$0** 💸 |
| Finality | 1-2 min | 7 days (withdrawal) | **Instant** ✅ |
| UX Complexity | High (approve each tx) | Medium | **Low (one-time setup)** 🎮 |
| Security Model | On-chain | Fraud proofs | **Cryptographic signatures** 🔐 |

### Key Benefits for Prediction Markets

1. **High-Frequency Trading** - Users can rapidly update positions
2. **Microtransactions** - Small bets are economically viable
3. **Better UX** - No wallet popups for every action
4. **Scalability** - Can handle millions of trades/day
5. **Cost Efficiency** - 99% reduction in gas fees

---

## 📚 Learn More

### Yellow Network Resources
- [Yellow Network Documentation](https://docs.yellow.org)
- [Nitrolite Protocol Spec](https://github.com/layer-3/nitrolite)
- [State Channels Explained](https://docs.yellow.org/state-channels)

### Prediction Market Theory
- [Logarithmic Market Scoring Rule (LMSR)](https://en.wikipedia.org/wiki/Scoring_rule#Logarithmic_scoring_rule)
- [Automated Market Makers](https://www.paradigm.xyz/2021/03/amm-analysis)

### Code Documentation
Key files with detailed comments:
- [YellowNetworkService.ts](vaultos/src/server/services/YellowNetworkService.ts) - State channel integration
- [MarketService.ts](vaultos/src/server/services/MarketService.ts) - Trading logic & LMSR
- [TradePanelNew.tsx](vaultos/src/client/components/TradePanelNew.tsx) - Frontend trading UI

---

## 🤝 Contributing

Bettify is open for contributions! Areas that need help:

- **Frontend UX** - Improve design and user experience
- **Testing** - Unit tests and integration tests
- **Documentation** - More guides and tutorials
- **Features** - Implement items from the roadmap

### Development Setup

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

---

## 🎉 Demo Script (For Presentations)

### 30-Second Pitch
> "Bettify brings prediction markets to Web2 speed using Yellow Network state channels. Trade instantly with zero gas fees while maintaining full custody of your funds."

### 2-Minute Live Demo
1. **Show the problem** (30s)
   - "Traditional prediction markets are slow and expensive"
   - "Each trade takes 15-60 seconds and costs $1-50 in gas"

2. **Demonstrate Bettify** (60s)
   - Connect wallet → Instant
   - Buy YES shares → Executes in < 1 second
   - Show balance update → Real-time
   - Sell shares → Another instant trade
   - "Just made 2 trades in 5 seconds, zero gas fees"

3. **Explain the tech** (30s)
   - "Powered by Yellow Network state channels"
   - "All trades happen off-chain, settlement happens later"
   - "You keep cryptographic proofs, always in control"

---

## 📞 Support & Contact

- **Issues**: [GitHub Issues](https://github.com/yourusername/bettify/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/bettify/discussions)
- **Twitter**: [@BettifyApp](https://twitter.com/BettifyApp)

---

**Built with ⚡ by the Bettify team**

*Making prediction markets instant, accessible, and fun.*