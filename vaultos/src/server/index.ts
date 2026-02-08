import express from 'express';
import cors from 'cors';
import http from 'http';
import sessionRoutes from './routes/session';
import marketRoutes from './routes/market';
import marketsRoutes from './routes/markets';
import tradeRoutes from './routes/trade';
import balanceRoutes from './routes/balance';
import stateRoutes from './routes/state';
import yellowRoutes from './routes/yellow';
import positionsRoutes from './routes/positions';
import tradesRoutes from './routes/trades';
import { initializeCommunityChat } from './routes/community';
import { ResolutionEngine } from '../oracle/ResolutionEngine';
import { EthPriceOracle } from '../oracle/EthPriceOracle';
import { OracleType } from '../oracle/OracleInterface';
import MarketService from './services/MarketService';

const app = express();
const server = http.createServer(app);
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
app.use('/api/positions', positionsRoutes);
app.use('/api/trades', tradesRoutes);

// Initialize WebSocket community chat
initializeCommunityChat(server);

server.listen(PORT, () => {
  console.log(`\n🟢 ====================================`);
  console.log(`   VaultOS Server Started`);
  console.log(`====================================`);
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`💬 Community: ws://localhost:${PORT}/community`);
  console.log(`🌐 Environment: SANDBOX (Testnet)`);
  console.log(`⚡ Yellow Network: Base Sepolia`);
  console.log(`🔗 Clearnode: wss://clearnet-sandbox.yellow.com/ws`);
  console.log(`💰 Token: ytest.USD (free testnet)`);
  console.log(`📊 Markets: LMSR AMM ready`);
  console.log(`⚠️  Using testnet - no real money`);
  console.log(`====================================\n`);
  
  // Initialize ETH Price Oracle for real-time market resolution
  const oracleConfig = {
    type: OracleType.CUSTOM,
    network: 'base-sepolia',
    updateInterval: 60
  };
  const ethOracle = new EthPriceOracle(oracleConfig);
  
  // Initialize Resolution Engine for automatic market resolution
  const resolutionEngine = new ResolutionEngine(
    ethOracle,
    {
      checkIntervalSeconds: 60,  // Check every minute
      autoFreeze: true,           // Auto-freeze when endTime reached
      autoResolve: true,          // Auto-resolve when funded
      requireManualApproval: false // For demo - auto-resolve immediately
    }
  );
  
  resolutionEngine.start();
  console.log('🎯 Resolution Engine started with ETH Price Oracle');
  console.log('   ✅ Checking markets every 60 seconds');
  console.log('   ✅ Auto-freezing when endTime reached');
  console.log('   ✅ Auto-resolving with real ETH price data');
  console.log('   📡 Oracle: CoinGecko API\n');
});

export default app;