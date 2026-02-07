import { Router } from 'express';
import marketService from '../services/MarketService';

const router = Router();

// Route to create a new prediction market
router.post('/create', async (req, res) => {
    try {
        const { sessionId, channelId, question, description, durationMinutes, initialLiquidity, creatorAddress } = req.body;
        
        console.log('Market creation request:', req.body);
        
        if (!question || !creatorAddress) {
            return res.status(400).json({ error: 'Missing required fields: question and creatorAddress' });
        }

        // 🔒 ADMIN-ONLY: Only admin wallet can create markets
        const ADMIN_WALLET = '0xFefa60F5aA4069F96b9Bf65c814DDb3A604974e1';
        if (creatorAddress.toLowerCase() !== ADMIN_WALLET.toLowerCase()) {
            return res.status(403).json({ 
                error: 'Unauthorized: Only admin can create markets',
                adminWallet: ADMIN_WALLET
            });
        }

        const market = await marketService.createMarket({
            appSessionId: sessionId || channelId || 'session_' + Date.now(), // Use sessionId or channelId
            question,
            description: description || '',
            durationMinutes: parseInt(durationMinutes) || 30,
            initialLiquidity: parseFloat(initialLiquidity) || 100,
            creatorAddress,
        });
        
        console.log('Market created successfully:', market.id);
        
        // Convert BigInt values to numbers for JSON serialization
        const serializableMarket = {
            id: market.id,
            appSessionId: market.appSessionId,
            channelId: market.channelId,
            question: market.question,
            description: market.description,
            outcomes: market.outcomes,
            creator: market.creator,
            createdAt: market.createdAt,
            endTime: market.endTime,
            status: market.status,
            totalVolume: Number(market.totalVolume),
            amm: {
                liquidity: Number(market.amm.liquidity),
                shares: {
                    YES: Number(market.amm.shares.YES),
                    NO: Number(market.amm.shares.NO)
                }
            },
            trades: market.trades?.map(t => ({
                id: t.id,
                marketId: t.marketId,
                user: t.user,
                outcome: t.outcome,
                amount: Number(t.amount),
                shares: Number(t.shares),
                price: t.price,
                timestamp: t.timestamp
            })) || [],
            positions: Array.from(market.positions.entries()).map(([key, pos]) => ({
                key,
                shares: Number(pos.shares),
                invested: Number(pos.invested)
            }))
        };
        
        res.status(201).json(serializableMarket);
    } catch (error) {
        console.error('Error creating market:', error);
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