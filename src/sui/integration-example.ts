/**
 * Example: Integrating Sui Settlement with MarketService
 * 
 * This shows how to add Sui settlement to the market resolution flow
 */

import { getSuiSettlementService } from '../sui/settlement';

// Add this to resolveMarket() function in MarketService.ts
// After line: market.outcome = outcome;

async resolveMarketWithSuiSettlement(
  adminAddress: string,
  marketId: string,
  outcome: 'YES' | 'NO'
): Promise<void> {
  if (!this.isAdmin(adminAddress)) {
    throw new Error('Only admins can resolve markets');
  }

  const market = this.markets.get(marketId);
  if (!market) {
    throw new Error('Market not found');
  }

  if (market.status !== MarketStatus.CLOSED) {
    throw new Error('Market must be closed before resolution');
  }

  // Update market state
  market.status = MarketStatus.RESOLVED;
  market.outcome = outcome;
  this.markets.set(marketId, market);

  // 🔥 NEW: Submit settlement to Sui blockchain
  try {
    const suiService = getSuiSettlementService();
    const totalPool = Number(market.totalYesShares + market.totalNoShares);
    
    const txDigest = await suiService.submitSettlement({
      marketId: market.id,
      winningOutcome: outcome,
      totalPool: totalPool,
    });

    console.log('✅ Settlement recorded on Sui:', txDigest);
    console.log(`   View: https://suiscan.xyz/testnet/tx/${txDigest}`);
    
    // Optional: Store digest in market object
    (market as any).suiSettlementTx = txDigest;
    
  } catch (error) {
    console.warn('⚠️ Sui settlement failed (non-critical):', error);
    // Continue - settlement is optional for hackathon demo
    // In production, you might want to retry or queue this
  }
}

// Alternative: Add as separate function that can be called after resolution
async recordMarketSettlementOnSui(marketId: string): Promise<string> {
  const market = this.markets.get(marketId);
  if (!market) {
    throw new Error('Market not found');
  }

  if (market.status !== MarketStatus.RESOLVED || !market.outcome) {
    throw new Error('Market must be resolved first');
  }

  const suiService = getSuiSettlementService();
  const totalPool = Number(market.totalYesShares + market.totalNoShares);

  return await suiService.submitSettlement({
    marketId: market.id,
    winningOutcome: market.outcome,
    totalPool: totalPool,
  });
}
