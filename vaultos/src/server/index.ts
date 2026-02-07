import express from 'express';
import cors from 'cors';
import sessionRoutes from './routes/session';
import marketRoutes from './routes/market';
import marketsRoutes from './routes/markets';
import tradeRoutes from './routes/trade';
import balanceRoutes from './routes/balance';
import stateRoutes from './routes/state';
import yellowRoutes from './routes/yellow';

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/', (req, res) => {
  res.json({
    name: 'VaultOS',
    version: '1.0.0',
    phase: 'Phase 1 - Yellow Network Integration',
    status: 'operational',
    features: [
      'Wallet-based session management',
      'Instant prediction market trading',
      'Off-chain state channels',
      'Yield optimization',
      'Partial refunds'
    ]
  });
});

app.use('/api/session', sessionRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/markets', marketsRoutes);
app.use('/api/trade', tradeRoutes);
app.use('/api/balance', balanceRoutes);
app.use('/api/state', stateRoutes);
app.use('/api/yellow', yellowRoutes);

app.listen(PORT, () => {
  console.log(`\n🟢 ====================================`);
  console.log(`   VaultOS Server Started`);
  console.log(`====================================`);
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🌐 Environment: SANDBOX (Testnet)`);
  console.log(`⚡ Yellow Network: Base Sepolia`);
  console.log(`🔗 Clearnode: wss://clearnet-sandbox.yellow.com/ws`);
  console.log(`💰 Token: ytest.USD (free testnet)`);
  console.log(`📊 Markets: LMSR AMM ready`);
  console.log(`⚠️  Using testnet - no real money`);
  console.log(`====================================\n`);
});

export default app;