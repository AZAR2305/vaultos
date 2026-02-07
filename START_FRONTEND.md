# 🚀 Frontend Startup Guide

## Quick Start

The backend is already running on `http://localhost:3000` ✅

### Start the Frontend

```powershell
npm run dev:frontend
```

This will start the frontend on `http://localhost:5173`

## What's Included

### 🎯 Market Dashboard Features
- **Admin Panel** (for wallet: `0xFefa60F5aA4069F96b9Bf65c814DDb3A604974e1`)
  - Create new prediction markets
  - Set questions, descriptions, duration, and initial liquidity
  - Markets are created with Yellow Network channels
  
- **Market Display**
  - Real-time market updates (polls every 3 seconds)
  - Live odds for YES/NO outcomes
  - Volume tracking
  - Time remaining indicators
  
- **Trading Interface**
  - Buy YES or NO positions
  - Real-time price calculations
  - Instant execution through Yellow Network
  - Gasless trading with state channels
  
- **Session Management**
  - Automatic Yellow Network session creation
  - Channel ID display
  - Balance tracking

### 🔗 Technology Stack

**Frontend**
- React + TypeScript
- Vite for fast development
- Wagmi for wallet connection
- Responsive gradient UI

**Backend** (already running)
- Express.js on port 3000
- Yellow Network integration for instant trading
- Sui blockchain for final settlement
- LMSR automated market maker

### 📡 API Endpoints

All endpoints are proxied through Vite to avoid CORS issues:

- `POST /api/session` - Create/retrieve Yellow Network session
- `GET /api/market` - List all markets
- `POST /api/market` - Create new market (admin only)
- `POST /api/trade` - Execute trade
- `GET /api/balance` - Check Yellow Network balance
- `POST /api/yellow/deposit` - Deposit to Yellow Network
- `POST /api/yellow/withdraw` - Withdraw from Yellow Network

### 🎮 User Flow

1. **Connect Wallet** - Click "Connect Wallet" button
2. **Create Session** - Automatically creates Yellow Network session
3. **View Markets** - See all available prediction markets
4. **Place Trade** - Select market, choose YES/NO, enter amount
5. **Track Positions** - View your positions in the Positions tab
6. **Settlement** - When market resolves, Sui blockchain handles final settlement and payouts

### 🔐 Admin Features

If you're connected with the admin wallet (`0xFefa60F5aA4069F96b9Bf65c814DDb3A604974e1`):
- Create new prediction markets
- Set initial liquidity (recommended: 1,000,000 microUSDC = 1 USDC)
- Control market parameters

### 🌟 Key Benefits

✅ **Instant Trading** - Yellow Network state channels enable gasless, instant trades
✅ **Real-time Updates** - Live market data and position tracking
✅ **Secure Settlement** - Sui blockchain for final on-chain settlement
✅ **Professional UI** - Modern gradient design with responsive layout
✅ **Admin Control** - Easy market creation and management

## Troubleshooting

### Frontend won't start
```powershell
# Install dependencies
npm install

# Try again
npm run dev:frontend
```

### Backend not responding
Check that the backend is running on port 3000:
```powershell
curl http://localhost:3000
```

### Trading not working
1. Make sure wallet is connected
2. Verify session is created (check browser console)
3. Ensure market is in ACTIVE status

## Next Steps

After starting the frontend:
1. Open `http://localhost:5173` in your browser
2. Connect your wallet
3. If you're admin, create a test market
4. Try placing some trades
5. Check the Positions tab to see your holdings

Enjoy trading! 🎉
