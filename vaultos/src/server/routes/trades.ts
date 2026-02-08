/**
 * Trade History API Routes
 * Returns user's trading history across all markets
 */
import { Router, Request, Response } from 'express';
import marketService from '../services/MarketService';

const router = Router();

/**
 * GET /api/trades/:address
 * Get all trades for a specific wallet address
 */
router.get('/:address', async (req: Request, res: Response) => {
    const { address } = req.params;

    if (!address) {
        return res.status(400).json({ 
            success: false,
            error: 'Wallet address is required' 
        });
    }

    try {
        // Get all active markets with full Market objects (including positions Map)
        const markets = marketService.getAllMarkets();
        
        // Collect all trades from all markets for this user
        const allTrades: any[] = [];
        
        markets.forEach((market: any) => {
            // Skip if no trades in this market
            if (!market.trades || market.trades.length === 0) {
                return;
            }

            // Get trades for this user from the trades array
            const userTrades = market.trades.filter((trade: any) => 
                trade.user && trade.user.toLowerCase() === address.toLowerCase()
            );
            
            userTrades.forEach((trade: any) => {
                allTrades.push({
                    id: trade.id,
                    marketId: market.id,
                    marketQuestion: market.question,
                    userAddress: trade.user,
                    outcome: trade.outcome,
                    shares: Number(trade.shares) / 1_000_000, // Convert bigint to decimal
                    price: trade.price,
                    totalCost: Number(trade.amount) / 1_000_000, // Convert bigint to decimal
                    timestamp: trade.timestamp,
                    txHash: trade.txHash
                });
            });
        });

        // Sort by timestamp (newest first)
        allTrades.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        res.json({
            success: true,
            trades: allTrades,
            count: allTrades.length
        });

    } catch (error: any) {
        console.error('Error fetching trade history:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch trade history'
        });
    }
});

export default router;
