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
import marketRoutes from './api/marketRoutes';

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
    phase: 'Phase 1 - Yellow Network Integration',
    status: 'operational',
    features: [
      'Instant off-chain trading',
      'Session-based security',
      'State channel management',
      'Binary prediction markets',
      'Simulated yield accrual'
    ],
    nextPhase: 'Sui blockchain settlement'
  });
});

// API routes
app.use('/api', marketRoutes);

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
  console.log('║          Real-time Prediction Market MVP              ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('');
  console.log('📡 Phase 1: Yellow Network Integration');
  console.log('   ✅ Instant off-chain trading');
  console.log('   ✅ Gasless transactions');
  console.log('   ✅ Session-based security');
  console.log('   ✅ State channel management');
  console.log('');
  console.log('🔮 Next Phase: Sui Blockchain Settlement');
  console.log('   ⏳ Parallel transaction processing');
  console.log('   ⏳ Oracle-based resolution');
  console.log('   ⏳ Real yield protocols');
  console.log('');
  console.log('📖 API Documentation:');
  console.log(`   http://localhost:${PORT}/`);
  console.log('');
});

export default app;
