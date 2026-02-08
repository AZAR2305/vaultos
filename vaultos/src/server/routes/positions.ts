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

        const markets = marketService.getAllMarkets();
        const allPositions: any[] = [];

        markets.forEach(market => {
            // Defensive check: ensure positions Map exists
            if (!market.positions || !(market.positions instanceof Map)) {
                console.warn(`⚠️ Market ${market.id} has no positions Map`);
                return;
            }

            // Get user's YES and NO positions (keys are "address_outcome")
            const addressLower = address.toLowerCase();
            const yesPosition = market.positions.get(`${addressLower}_YES`);
            const noPosition = market.positions.get(`${addressLower}_NO`);
            
            // Calculate current prices
            const yesPrice = market.amm ? (market.amm.shares ? 
                require('../services/AmmMath').LmsrAmm.getPrice(
                    market.amm.liquidityParameter,
                    market.amm.shares.YES,
                    market.amm.shares.NO,
                    'YES'
                ) : 0.5) : 0.5;
            const noPrice = market.amm ? (market.amm.shares ? 
                require('../services/AmmMath').LmsrAmm.getPrice(
                    market.amm.liquidityParameter,
                    market.amm.shares.YES,
                    market.amm.shares.NO,
                    'NO'
                ) : 0.5) : 0.5;

            if (yesPosition && yesPosition.shares > 0n) {
                const shares = Number(yesPosition.shares) / 1_000_000; // Convert to decimal
                const totalCost = Number(yesPosition.totalCost) / 1_000_000;
                const currentValue = shares * yesPrice;
                const pnl = currentValue - totalCost;

                allPositions.push({
                    id: `${market.id}-YES`,
                    marketId: market.id,
                    marketQuestion: market.question,
                    outcome: 'YES',
                    shares: shares,
                    totalCost: totalCost,
                    currentValue: currentValue,
                    pnl: pnl,
                    marketStatus: market.status,
                });
            }

            if (noPosition && noPosition.shares > 0n) {
                const shares = Number(noPosition.shares) / 1_000_000; // Convert to decimal
                const totalCost = Number(noPosition.totalCost) / 1_000_000;
                const currentValue = shares * noPrice;
                const pnl = currentValue - totalCost;

                allPositions.push({
                    id: `${market.id}-NO`,
                    marketId: market.id,
                    marketQuestion: market.question,
                    outcome: 'NO',
                    shares: shares,
                    totalCost: totalCost,
                    currentValue: currentValue,
                    pnl: pnl,
                    marketStatus: market.status,
                });
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

        const market = marketService.getMarketById(marketId);
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
