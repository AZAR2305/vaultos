# 🎯 VaultOS - Complete Demo Guide

## ✨ What You'll See

A fully functional prediction market platform with:
- **Admin Panel**: Create prediction markets (admin wallet only)
- **Market Trading**: Buy YES/NO shares with instant execution
- **Real-time Updates**: Live market odds and volumes
- **Position Tracking**: Monitor your active positions
- **Session Management**: Secure trading with Yellow Network
- **Sui Settlement**: Blockchain verification of outcomes

---

## 🚀 Quick Start

### 1. Start the Backend
```powershell
# Terminal 1: Backend API
npm run dev
```

The backend will start on http://localhost:3000

### 2. Start the Frontend
```powershell
# Terminal 2: Frontend UI (in a new terminal)
cd vaultos
npm run dev
```

The frontend will start on http://localhost:5173

### 3. Alternative: Run Both Together
```powershell
# Single command to run both
npm run demo
```

---

## 📋 Step-by-Step Walkthrough

### Step 1: Connect Your Wallet
1. Open http://localhost:5173
2. Click "Connect Wallet" in the sidebar
3. Connect with MetaMask or your wallet
4. **Admin Wallet**: `0xFefa60F5aA4069F96b9Bf65c814DDb3A604974e1`

### Step 2: Create a Session
1. In the sidebar, find "Session Manager"
2. Enter deposit amount (e.g., 10 USDC)
3. Click "Create Session"
4. This creates a Yellow Network channel for trading

### Step 3: Create a Market (Admin Only)
If you're using the admin wallet:
1. You'll see "Admin: Create New Market" panel
2. Enter a question (e.g., "Will BTC reach $100k in 2024?")
3. Add description (optional)
4. Set duration (minutes)
5. Set initial liquidity (in microUSDC)
6. Click "Create Market"

### Step 4: Trade on Markets
1. Click on any market card to select it
2. Trading interface appears with:
   - YES/NO outcome selector
   - Amount input (in USDC)
   - Current odds display
3. Choose YES or NO
4. Enter amount
5. Click "Trade"

### Step 5: View Positions
1. Click "Positions" tab
2. See all your active positions
3. Track shares and average prices

### Step 6: Monitor Markets
Markets update every 3 seconds showing:
- Current YES/NO odds (as percentages)
- Total volume
- Time remaining
- Market status (open/closed)

---

## 🎨 Features Showcase

### 1. Admin Panel (Admin Only)
Located at the top of the Markets tab for admin wallet:
- **Market Creation**: Full control over new markets
- **Parameters**: Question, description, duration, liquidity
- **Validation**: Ensures session exists before creation
- **Real-time Feedback**: Shows creation status

### 2. Market Cards
Each market displays:
- **Question**: The prediction question
- **Description**: Additional context
- **Status Badge**: Open (green) or Closed (red)
- **Time Remaining**: Countdown timer
- **Odds Display**: Live YES/NO percentages
- **Volume**: Total trading volume
- **Trading Interface**: Click to expand

### 3. Trading Interface
When you click a market:
- **Outcome Selector**: Toggle between YES/NO
- **Amount Input**: Enter USDC amount
- **Trade Button**: Execute instantly
- **Visual Feedback**: Loading states and confirmations

### 4. Real-time Updates
- Markets refresh every 3 seconds
- Positions update every 5 seconds
- Odds recalculate on every trade
- Volume updates automatically

### 5. Session Management
- **Create Session**: Generate Yellow Network channel
- **View Status**: See active session details
- **Balance Display**: Real-time USDC balance
- **Security**: Session keys protect main wallet

---

## 📊 Dashboard Statistics

Top of the Markets tab shows:
- **Total Markets**: Number of active markets
- **Your Positions**: Count of your active trades
- **Session Status**: Active or None

---

## 🏗️ Architecture Display

Click the "About" tab to see:
- **Feature Overview**: Key platform capabilities
- **Architecture Layers**: 
  - Trading Layer (Yellow Network)
  - Settlement Layer (Sui Blockchain)
  - Security Model (Session-based)
- **Workflow Steps**: User journey from start to finish
- **Tech Stack**: Visual badges showing technologies

---

## 🔗 API Endpoints Used

The frontend interacts with these backend routes:

### Session
- `POST /api/session/create` - Create Yellow Network session
- `GET /api/session/:channelId` - Get session status
- `POST /api/session/close` - Close and settle session

### Markets
- `GET /api/market` - List all markets
- `GET /api/market/:id` - Get market details
- `POST /api/market/create` - Create new market (admin only)

### Trading
- `POST /api/market/:id/bet` - Execute trade
- `GET /api/market/:id/bets` - Get user's positions

### Balance
- `GET /api/balance/:address` - Get Yellow Network balance

---

## 🎯 Demo Scenarios

### Scenario 1: Admin Creates Market
1. Connect as admin wallet
2. Create session with 100 USDC
3. Create market: "Will ETH reach $5k by March?"
4. Set duration: 60 minutes
5. Set liquidity: 1,000,000 µUSDC (1 USDC)
6. Market appears in list immediately

### Scenario 2: User Trades
1. Connect any wallet
2. Create session with 50 USDC
3. Browse markets
4. Click on a market
5. Select YES outcome
6. Enter 10 USDC
7. Click Trade
8. Shares received instantly
9. Odds update in real-time

### Scenario 3: Position Tracking
1. After making trades
2. Click "Positions" tab
3. See all active positions
4. View shares owned
5. See average entry prices
6. Monitor potential returns

---

## 🎨 UI/UX Highlights

### Visual Design
- **Gradient Theme**: Purple/blue gradient design
- **Card-based Layout**: Clean, modern market cards
- **Responsive Grid**: Auto-adjusts to screen size
- **Hover Effects**: Cards lift on hover
- **Selected State**: Blue border for active market

### Color Coding
- **YES**: Green backgrounds and buttons
- **NO**: Red backgrounds and buttons
- **Open Markets**: Green status badge
- **Closed Markets**: Red status badge
- **Active Session**: Green indicator
- **No Session**: Red indicator

### Animations
- **Button Hover**: Lift effect
- **Loading States**: Spinner + disabled state
- **Success Feedback**: Alert messages
- **Real-time Updates**: Smooth transitions

---

## 🐛 Troubleshooting

### "Only admin can create markets"
- You're not connected with the admin wallet
- Admin wallet: `0xFefa60F5aA4069F96b9Bf65c814DDb3A604974e1`

### "Please create a Yellow Network session first"
- Go to sidebar
- Fill in Session Manager
- Click "Create Session"

### Markets not loading
- Check backend is running on port 3000
- Open http://localhost:3000 to verify
- Check browser console for errors

### Trades failing
- Ensure you have an active session
- Check your session balance
- Verify market is still open
- Check amount is valid

---

## 📱 Browser Compatibility

Tested on:
- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Brave
- ⚠️ Safari (may have wallet issues)

---

## 🚀 Next Steps

After the demo:
1. **Sui Settlement**: Markets can be settled on Sui blockchain
2. **Oracle Integration**: Automated outcome resolution
3. **More Market Types**: Scalar, multi-outcome markets
4. **Mobile App**: Native iOS/Android apps
5. **Liquidity Pools**: Community-provided liquidity

---

## 📞 Support

If you encounter issues:
1. Check both terminals are running
2. Open browser console (F12)
3. Look for error messages
4. Verify wallet is connected
5. Ensure session is created

---

**Built for ETHGlobal** 🎉

This showcases a hybrid blockchain architecture where:
- Speed comes from Yellow Network (off-chain)
- Trust comes from Sui blockchain (on-chain)
- Security comes from session keys (cryptographic)

**The best of all worlds!**
