/**
 * Market API Routes
 * 
 * REST API for interacting with prediction markets
 */

import { Router, Request, Response } from 'express';
import { YellowClient } from '../yellow/client';
import { SessionManager, SessionConfig } from '../yellow/session';
import { PredictionMarket, MarketStatus } from '../yellow/market';
import { StateManager } from '../yellow/state';
import { TradingEngine } from '../yellow/actions';

const router = Router();

// Initialize components
const yellowClient = new YellowClient({
  rpcUrl: process.env.YELLOW_TESTNET_RPC || 'https://testnet.yellow.org/rpc',
  nodeUrl: process.env.YELLOW_NODE_URL || 'https://testnet.yellow.org/channel',
  chainId: 12345 // Yellow testnet chain ID
});

const sessionManager = new SessionManager(yellowClient);
const marketManager = new PredictionMarket();
const stateManager = new StateManager();
const tradingEngine = new TradingEngine(yellowClient, marketManager, stateManager);

/**
 * POST /api/session/create
 * Create a new trading session
 */
router.post('/session/create', async (req: Request, res: Response) => {
  try {
    const { depositAmount } = req.body;

    if (!depositAmount || depositAmount <= 0) {
      return res.status(400).json({ error: 'Invalid deposit amount' });
    }

    // Convert USDC to smallest unit (6 decimals)
    const depositBigInt = BigInt(Math.floor(depositAmount * 1_000_000));

    // Session configuration
    const config: SessionConfig = {
      maxAllowance: depositBigInt,
      duration: 3600, // 1 hour
      maxRefundPercent: 25
    };

    const session = await sessionManager.createSession(depositBigInt, config);

    // Initialize user state
    stateManager.createState(
      session.channelId,
      session.sessionWallet.address,
      session.sessionWallet.address,
      depositBigInt
    );

    res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        channelId: session.channelId,
        address: session.sessionWallet.address,
        depositAmount: depositAmount,
        expiresIn: config.duration
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/market/create
 * Create a new prediction market
 */
router.post('/market/create', async (req: Request, res: Response) => {
  try {
    const { question, description, durationMinutes, yesPrice } = req.body;

    if (!question || !durationMinutes) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const market = marketManager.createMarket(
      question,
      description || '',
      durationMinutes,
      yesPrice || 0.5
    );

    res.json({
      success: true,
      market: {
        marketId: market.marketId,
        question: market.question,
        yesPrice: market.yesPrice,
        noPrice: market.noPrice,
        endTime: market.endTime,
        status: market.status
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/markets
 * Get all active markets
 */
router.get('/markets', (req: Request, res: Response) => {
  const markets = marketManager.getActiveMarkets();
  res.json({
    success: true,
    markets: markets.map(m => ({
      marketId: m.marketId,
      question: m.question,
      description: m.description,
      yesPrice: m.yesPrice,
      noPrice: m.noPrice,
      endTime: m.endTime,
      totalVolume: Number(m.totalVolume) / 1_000_000,
      status: m.status
    }))
  });
});

/**
 * GET /api/market/:marketId
 * Get specific market details
 */
router.get('/market/:marketId', (req: Request, res: Response) => {
  const market = marketManager.getMarket(req.params.marketId);
  
  if (!market) {
    return res.status(404).json({ error: 'Market not found' });
  }

  res.json({
    success: true,
    market: {
      marketId: market.marketId,
      question: market.question,
      description: market.description,
      yesPrice: market.yesPrice,
      noPrice: market.noPrice,
      createdAt: market.createdAt,
      endTime: market.endTime,
      totalVolume: Number(market.totalVolume) / 1_000_000,
      totalYesShares: Number(market.totalYesShares),
      totalNoShares: Number(market.totalNoShares),
      status: market.status,
      outcome: market.outcome
    }
  });
});

/**
 * POST /api/trade/buy-yes
 * Buy YES shares
 */
router.post('/trade/buy-yes', async (req: Request, res: Response) => {
  try {
    const { sessionId, marketId, shares } = req.body;

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    const result = await tradingEngine.buyYes(session, marketId, shares);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({
      success: true,
      trade: {
        shares: result.shares,
        cost: Number(result.cost!) / 1_000_000,
        newBalance: Number(result.newBalance!) / 1_000_000
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trade/buy-no
 * Buy NO shares
 */
router.post('/trade/buy-no', async (req: Request, res: Response) => {
  try {
    const { sessionId, marketId, shares } = req.body;

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    const result = await tradingEngine.buyNo(session, marketId, shares);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({
      success: true,
      trade: {
        shares: result.shares,
        cost: Number(result.cost!) / 1_000_000,
        newBalance: Number(result.newBalance!) / 1_000_000
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trade/sell-yes
 * Sell YES shares
 */
router.post('/trade/sell-yes', async (req: Request, res: Response) => {
  try {
    const { sessionId, marketId, shares } = req.body;

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    const result = await tradingEngine.sellYes(session, marketId, shares);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({
      success: true,
      trade: {
        shares: result.shares,
        received: Number(result.cost!) / 1_000_000,
        newBalance: Number(result.newBalance!) / 1_000_000
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trade/sell-no
 * Sell NO shares
 */
router.post('/trade/sell-no', async (req: Request, res: Response) => {
  try {
    const { sessionId, marketId, shares } = req.body;

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    const result = await tradingEngine.sellNo(session, marketId, shares);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({
      success: true,
      trade: {
        shares: result.shares,
        received: Number(result.cost!) / 1_000_000,
        newBalance: Number(result.newBalance!) / 1_000_000
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/balance/move-to-idle
 * Move funds to idle balance for yield
 */
router.post('/balance/move-to-idle', async (req: Request, res: Response) => {
  try {
    const { sessionId, amount } = req.body;

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    const amountBigInt = BigInt(Math.floor(amount * 1_000_000));
    const result = await tradingEngine.moveToIdle(session, amountBigInt);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({
      success: true,
      message: result.message
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/balance/accrue-yield
 * Accrue yield on idle balance
 */
router.post('/balance/accrue-yield', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    const result = await tradingEngine.accrueYield(session);

    res.json({
      success: true,
      yieldAccrued: Number(result.cost!) / 1_000_000
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/balance/refund
 * Request partial refund (max 25%)
 */
router.post('/balance/refund', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    const result = await tradingEngine.requestPartialRefund(session);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({
      success: true,
      refundAmount: Number(result.cost!) / 1_000_000
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/state/:sessionId
 * Get current state summary
 */
router.get('/state/:sessionId', (req: Request, res: Response) => {
  const session = sessionManager.getSession(req.params.sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  const summary = tradingEngine.getStateSummary(session);
  
  if (!summary) {
    return res.status(404).json({ error: 'State not found' });
  }

  res.json({
    success: true,
    state: summary
  });
});

/**
 * POST /api/session/close
 * Close session and settle
 */
router.post('/session/close', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    const finalBalance = await sessionManager.closeSession(sessionId);

    res.json({
      success: true,
      finalBalance: Number(finalBalance) / 1_000_000,
      message: 'Session closed. In Phase 2, funds would be settled on Sui.'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
