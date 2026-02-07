/**
 * Market Routes - Create and manage prediction markets
 */

import express from 'express';
import marketService from '../services/MarketService';
import { MarketStatus } from '../services/MarketService';

const router = express.Router();

// MarketService is now a singleton - use the imported instance

/**
 * Create a new market (Admin only)
 * POST /api/markets/create
 */
router.post('/create', async (req, res) => {
    try {
        const {
            question,
            description,
            liquidity,
            durationDays,
            channelId,
            sessionId,
            creatorAddress
        } = req.body;

        // Validation
        if (!question || !liquidity || !durationDays || !channelId || !sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: question, liquidity, durationDays, channelId, sessionId'
            });
        }

        // Admin check (customize this based on your auth logic)
        const adminAddress = '0xFefa60F5aA4069F96b9Bf65c814DDb3A604974e1';
        if (creatorAddress && creatorAddress.toLowerCase() !== adminAddress.toLowerCase()) {
            return res.status(403).json({
                success: false,
                error: 'Only admin can create markets'
            });
        }

        // Create market
        const market = await marketService.createMarket({
            appSessionId: sessionId,
            channelId: channelId,
            question,
            description: description || '',
            durationMinutes: durationDays * 24 * 60,
            initialLiquidity: liquidity / 1_000_000, // Convert from 6 decimals
            creatorAddress: creatorAddress || adminAddress,
        });

        res.json({
            success: true,
            marketId: market.id,
            market: {
                id: market.id,
                question: market.question,
                description: market.description,
                status: market.status,
                endTime: market.endTime,
                channelId: market.channelId,
            }
        });
    } catch (error: any) {
        console.error('Market creation error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create market'
        });
    }
});

/**
 * Get all markets
 * GET /api/markets
 */
router.get('/', async (req, res) => {
    try {
        const markets = marketService.getActiveMarkets();
        
        const marketsData = markets.map(market => ({
            id: market.id,
            question: market.question,
            description: market.description,
            status: market.status,
            endTime: market.endTime,
            totalVolume: market.totalVolume.toString(),
            channelId: market.channelId,
            // Get current odds
            odds: {
                YES: market.amm.shares.YES.toString(),
                NO: market.amm.shares.NO.toString()
            }
        }));

        res.json({
            success: true,
            markets: marketsData
        });
    } catch (error: any) {
        console.error('Get markets error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get markets'
        });
    }
});

/**
 * Get market by ID
 * GET /api/markets/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const market = marketService.getMarketById(id);

        if (!market) {
            return res.status(404).json({
                success: false,
                error: 'Market not found'
            });
        }

        res.json({
            success: true,
            market: {
                id: market.id,
                question: market.question,
                description: market.description,
                status: market.status,
                endTime: market.endTime,
                totalVolume: market.totalVolume.toString(),
                channelId: market.channelId,
                odds: {
                    YES: market.amm.shares.YES.toString(),
                    NO: market.amm.shares.NO.toString()
                }
            }
        });
    } catch (error: any) {
        console.error('Get market error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get market'
        });
    }
});

/**
 * Execute trade
 * POST /api/markets/:id/trade
 */
router.post('/:id/trade', async (req, res) => {
    try {
        const { id } = req.params;
        const { userAddress, outcome, amount } = req.body;

        if (!userAddress || !outcome || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userAddress, outcome, amount'
            });
        }

        if (outcome !== 'YES' && outcome !== 'NO') {
            return res.status(400).json({
                success: false,
                error: 'Invalid outcome. Must be YES or NO'
            });
        }

        const trade = await marketService.executeTrade({
            marketId: id,
            user: userAddress,
            outcome,
            amount: BigInt(amount), // Amount in 6 decimals
        });

        res.json({
            success: true,
            trade: {
                id: trade.id,
                marketId: trade.marketId,
                outcome: trade.outcome,
                shares: trade.shares.toString(),
                price: trade.price,
                timestamp: trade.timestamp,
            }
        });
    } catch (error: any) {
        console.error('Trade execution error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to execute trade'
        });
    }
});

/**
 * Get user positions
 * GET /api/markets/:id/positions/:userAddress
 */
router.get('/:id/positions/:userAddress', async (req, res) => {
    try {
        const { id, userAddress } = req.params;
        const positions = marketService.getUserPositions(id, userAddress);

        res.json({
            success: true,
            positions: positions.map(p => ({
                outcome: p.outcome,
                shares: p.shares.toString(),
                totalCost: p.totalCost.toString(),
            }))
        });
    } catch (error: any) {
        console.error('Get positions error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get positions'
        });
    }
});

export default router;
export { marketService };
