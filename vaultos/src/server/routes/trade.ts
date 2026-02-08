import { Router } from 'express';
import { SessionService } from '../services/SessionService';
import MarketService from '../services/MarketService';

const router = Router();
const sessionService = new SessionService();

/**
 * AUTHORITATIVE TRADE API
 * Frontend sends INTENT only → Backend calculates everything
 * 
 * OLD (INSECURE):
 * POST { marketId, yesPool: 1000, noPool: 800, userAmount: 100 }
 * 
 * NEW (SECURE):
 * POST { marketId, outcome: 1, amount: 100, maxSlippage: 0.05 }
 */

// Execute trade (unified endpoint for all outcomes)
router.post('/execute', async (req, res) => {
    const { sessionId, marketId, outcome, amount, maxSlippage = 0.05 } = req.body;
    
    try {
        // Validation
        if (!sessionId || !marketId || outcome === undefined || !amount) {
            return res.status(400).json({ 
                error: 'Missing required fields: sessionId, marketId, outcome, amount' 
            });
        }

        // Get session
        const session = sessionService.getSession(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Check balance
        const currentBalance = parseFloat(session.depositAmount) - parseFloat(session.spentAmount);
        if (amount > currentBalance) {
            return res.status(400).json({ 
                error: 'Insufficient balance',
                balance: currentBalance,
                required: amount
            });
        }

        // Execute trade (AUTHORITATIVE backend calculation)
        const trade = await MarketService.executeTrade({
            marketId,
            userAddress: session.walletAddress,
            outcome,
            amount,
            maxSlippage,
        });

        // Update session spent amount
        sessionService.updateSpentAmount(sessionId, trade.cost);

        const newBalance = currentBalance - trade.cost;

        console.log(`✅ Trade executed: ${trade.sharesReceived} shares of outcome ${outcome} for ${trade.cost.toFixed(2)} ytest.USD`);

        res.json({
            success: true,
            trade: {
                id: trade.id,
                outcome,
                amount: trade.amount,
                cost: trade.cost,
                sharesReceived: trade.sharesReceived,
                price: trade.price,
                timestamp: trade.timestamp,
            },
            balance: newBalance,
        });
    } catch (error: any) {
        console.error('❌ Trade execution error:', error);
        res.status(500).json({ 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Refund position (partial exit with 25% refund)
router.post('/refund', async (req, res) => {
    const { sessionId, marketId, outcome } = req.body;
    
    try {
        // Validation
        if (!sessionId || !marketId || !outcome) {
            return res.status(400).json({ 
                error: 'Missing required fields: sessionId, marketId, outcome' 
            });
        }

        // Get session
        const session = sessionService.getSession(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Execute refund (returns 25% of original cost)
        const result = await MarketService.refundPosition(
            marketId,
            session.walletAddress,
            outcome
        );

        // Convert BigInt to numbers for response
        const refundAmount = Number(result.refundAmount) / 1000000; // Back to ytest.USD
        const sharesReturned = Number(result.sharesReturned) / 1000000;
        const penalty = Number(result.penalty) / 1000000;

        // Update session balance (credit refund)
        const currentBalance = parseFloat(session.depositAmount) - parseFloat(session.spentAmount);
        const newBalance = currentBalance + refundAmount;

        console.log(`✅ Refund processed: ${refundAmount.toFixed(2)} ytest.USD returned (25% of cost)`);
        console.log(`   Penalty: ${penalty.toFixed(2)} ytest.USD (75% stays in pool)`);

        res.json({
            success: true,
            refund: {
                refundAmount,      // 25% back to user
                sharesReturned,    // Shares returned to AMM
                penalty,           // 75% penalty
                outcome,
                timestamp: new Date().toISOString(),
            },
            balance: newBalance,
            message: `Refunded ${refundAmount.toFixed(2)} ytest.USD (25% of your cost). ${penalty.toFixed(2)} ytest.USD penalty stays in pool.`
        });
    } catch (error: any) {
        console.error('❌ Refund error:', error);
        res.status(500).json({ 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Get user positions for a market
router.get('/positions/:marketId', async (req, res) => {
    const { marketId } = req.params;
    const { userAddress } = req.query;

    try {
        if (!userAddress || typeof userAddress !== 'string') {
            return res.status(400).json({ error: 'Missing userAddress query parameter' });
        }

        const positions = MarketService.getUserPositions(marketId, userAddress);

        res.json({
            success: true,
            positions,
        });
    } catch (error: any) {
        console.error('❌ Get positions error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user trades for a market
router.get('/trades/:marketId', async (req, res) => {
    const { marketId } = req.params;
    const { userAddress } = req.query;

    try {
        if (!userAddress || typeof userAddress !== 'string') {
            return res.status(400).json({ error: 'Missing userAddress query parameter' });
        }

        const trades = MarketService.getUserTrades(marketId, userAddress);

        res.json({
            success: true,
            trades,
        });
    } catch (error: any) {
        console.error('❌ Get trades error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get market statistics (authoritative prices/volumes)
router.get('/stats/:marketId', async (req, res) => {
    const { marketId } = req.params;

    try {
        const stats = MarketService.getMarketStats(marketId);
        if (!stats) {
            return res.status(404).json({ error: 'Market not found' });
        }

        res.json({
            success: true,
            stats,
        });
    } catch (error: any) {
        console.error('❌ Get stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user winnings (after market resolution)
router.get('/winnings/:marketId', async (req, res) => {
    const { marketId } = req.params;
    const { userAddress } = req.query;

    try {
        if (!userAddress || typeof userAddress !== 'string') {
            return res.status(400).json({ error: 'Missing userAddress query parameter' });
        }

        const winnings = MarketService.getUserWinnings(marketId, userAddress);

        res.json({
            success: true,
            winnings,
        });
    } catch (error: any) {
        console.error('❌ Get winnings error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
