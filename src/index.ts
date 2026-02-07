/**
 * VaultOS - Real-time Prediction Market
 * 
 * Phase 1: Yellow Network Integration MVP
 * 
 * Demonstrates:
 * - Instant, gasless trading via state channels
 * - Session-based security model
 * - Off-chain state management
 * - Cryptographic verification
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sessionRoutes from '../vaultos/src/server/routes/session';
import marketRoutes from '../vaultos/src/server/routes/market';
import tradeRoutes from '../vaultos/src/server/routes/trade';
import yellowRoutes from '../vaultos/src/server/routes/yellow';
import balanceRoutes from '../vaultos/src/server/routes/balance';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({
    name: 'VaultOS',
    version: '1.0.0',
    status: 'operational',
    features: [
      'Instant off-chain trading via Yellow Network',
      'Session-based security model',
      'Binary prediction markets',
      'Zero gas fees during trading',
      'Real-time market updates'
    ],
    endpoints: {
      session: '/api/session/*',
      markets: '/api/market/*',
      trading: '/api/trade/*',
      yellow: '/api/yellow/*',
      balance: '/api/balance/*'
    }
  });
});

// API routes
app.use('/api/session', sessionRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/trade', tradeRoutes);
app.use('/api/yellow', yellowRoutes);
app.use('/api/balance', balanceRoutes);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║                      VaultOS                          ║');
  console.log('║     Real-time Prediction Market - Yellow Network      ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('');
  console.log('⚡ Yellow Network Features:');
  console.log('   ✅ Instant off-chain trading (< 100ms)');
  console.log('   ✅ Zero gas fees during trading');
  console.log('   ✅ Session-based security');
  console.log('   ✅ State channel management');
  console.log('   ✅ Cryptographic settlement');
  console.log('');
  console.log('📊 Market Features:');
  console.log('   ✅ LMSR AMM pricing');
  console.log('   ✅ Real-time odds updates');
  console.log('   ✅ Multi-market portfolios');
  console.log('');
  console.log('📖 API Documentation:');
  console.log(`   http://localhost:${PORT}/`);
  console.log('');
});

export default app;
