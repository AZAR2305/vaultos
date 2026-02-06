import { Router } from 'express';
import marketService from '../services/MarketService';

const router = Router();

// Route to create a new prediction market
router.post('/create', async (req, res) => {
    try {
        const { appSessionId, question, description, durationMinutes, initialLiquidity, creatorAddress } = req.body;
        
        if (!appSessionId || !question || !creatorAddress) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const market = await marketService.createMarket({
            appSessionId,
            question,
            description,
            durationMinutes: parseInt(durationMinutes) || 30,
            initialLiquidity: parseFloat(initialLiquidity) || 10,
            creatorAddress,
        });
        
        res.status(201).json(market);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route to get all active markets
router.get('/', async (req, res) => {
    try {
        const markets = marketService.getActiveMarkets();
        res.status(200).json({ markets });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route to get market details by ID
router.get('/:marketId', async (req, res) => {
    try {
        const { marketId } = req.params;
        const market = marketService.getMarketById(marketId);
        
        if (market) {
            res.status(200).json(market);
        } else {
            res.status(404).json({ error: 'Market not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route to place a bet
router.post('/:marketId/bet', async (req, res) => {
    try {
        const { marketId } = req.params;
        const { userAddress, amount, position } = req.body;

        if (!userAddress || !amount || !position) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (!['YES', 'NO'].includes(position)) {
            return res.status(400).json({ error: 'Position must be YES or NO' });
        }

        const bet = await marketService.placeBet({
            marketId,
            userAddress,
            amount: parseFloat(amount),
            position,
        });

        res.status(201).json({ success: true, bet });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Route to get user's bets for a market
router.get('/:marketId/bets', async (req, res) => {
    try {
        const { marketId } = req.params;
        const { user } = req.query;

        if (!user) {
            return res.status(400).json({ error: 'User address required' });
        }

        const bets = marketService.getUserBets(marketId, user as string);
        res.status(200).json({ bets });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route to request refund
router.post('/:marketId/refund', async (req, res) => {
    try {
        const { betId, userAddress } = req.body;

        if (!betId || !userAddress) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const bet = await marketService.refund(betId, userAddress);
        res.status(200).json({ success: true, bet });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Route to resolve market
router.post('/:marketId/resolve', async (req, res) => {
    try {
        const { marketId } = req.params;
        const { outcome, callerAddress } = req.body;

        if (!outcome || !callerAddress) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (!['YES', 'NO'].includes(outcome)) {
            return res.status(400).json({ error: 'Outcome must be YES or NO' });
        }

        const market = await marketService.resolveMarket(marketId, outcome, callerAddress);
        res.status(200).json({ success: true, market });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Route to calculate user winnings
router.get('/:marketId/winnings', async (req, res) => {
    try {
        const { marketId } = req.params;
        const { user } = req.query;

        if (!user) {
            return res.status(400).json({ error: 'User address required' });
        }

        const winnings = marketService.calculateWinnings(marketId, user as string);
        res.status(200).json(winnings);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Export the router
export default router;