/**
 * Positions Routes - User positions across all markets
 */

import express from 'express';
import marketService from '../services/MarketService';

const router = express.Router();

/**
 * Get user's positions across all markets
 * GET /api/positions/:address
 */
router.get('/:address', async (req, res) => {
    try {
        const { address } = req.params;

        if (!address) {
            return res.status(400).json({
                success: false,
                error: 'Address required'
            });
        }

        const markets = marketService.getActiveMarkets();
        const allPositions: any[] = [];

        markets.forEach(market => {
            const userPosition = market.positions.get(address.toLowerCase());
            
            if (userPosition && (userPosition.yesShares > 0 || userPosition.noShares > 0)) {
                // Calculate current values
                const yesCost = userPosition.yesShares * market.amm.getPrice('YES');
                const noCost = userPosition.noShares * market.amm.getPrice('NO');
                const currentValue = yesCost + noCost;
                const totalCost = userPosition.invested;
                const pnl = currentValue - totalCost;

                if (userPosition.yesShares > 0) {
                    allPositions.push({
                        id: `${market.id}-YES`,
                        marketId: market.id,
                        marketQuestion: market.question,
                        outcome: 'YES',
                        shares: userPosition.yesShares,
                        totalCost: yesCost,
                        currentValue: yesCost,
                        pnl: pnl * (yesCost / currentValue),
                        marketStatus: market.status,
                    });
                }

                if (userPosition.noShares > 0) {
                    allPositions.push({
                        id: `${market.id}-NO`,
                        marketId: market.id,
                        marketQuestion: market.question,
                        outcome: 'NO',
                        shares: userPosition.noShares,
                        totalCost: noCost,
                        currentValue: noCost,
                        pnl: pnl * (noCost / currentValue),
                        marketStatus: market.status,
                    });
                }
            }
        });

        res.json({
            success: true,
            positions: allPositions,
            total: allPositions.length
        });

    } catch (error: any) {
        console.error('Error fetching positions:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch positions'
        });
    }
});

/**
 * Request refund for a position
 * POST /api/positions/refund
 */
router.post('/refund', async (req, res) => {
    try {
        const { marketId, userAddress, outcome } = req.body;

        if (!marketId || !userAddress || !outcome) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: marketId, userAddress, outcome'
            });
        }

        const market = marketService.getMarket(marketId);
        if (!market) {
            return res.status(404).json({
                success: false,
                error: 'Market not found'
            });
        }

        // Check if market is still open
        if (market.status !== 'OPEN') {
            return res.status(400).json({
                success: false,
                error: 'Refunds only available for open markets'
            });
        }

        const userPosition = market.positions.get(userAddress.toLowerCase());
        if (!userPosition) {
            return res.status(404).json({
                success: false,
                error: 'No position found'
            });
        }

        const shares = outcome === 'YES' ? userPosition.yesShares : userPosition.noShares;
        if (shares <= 0) {
            return res.status(400).json({
                success: false,
                error: `No ${outcome} shares to refund`
            });
        }

        // Calculate 25% refund
        const currentPrice = market.amm.getPrice(outcome as 'YES' | 'NO');
        const fullValue = shares * currentPrice;
        const refundAmount = fullValue * 0.25; // 25% refund

        // Update position
        if (outcome === 'YES') {
            userPosition.yesShares = 0;
        } else {
            userPosition.noShares = 0;
        }

        res.json({
            success: true,
            refund: {
                shares,
                outcome,
                refundAmount,
                refundPercentage: 25
            }
        });

    } catch (error: any) {
        console.error('Error processing refund:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to process refund'
        });
    }
});

export default router;
