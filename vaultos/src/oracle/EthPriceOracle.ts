/**
 * EthPriceOracle.ts
 * 
 * Simple ETH price oracle using CoinGecko API for demo purposes
 * For production, use Chainlink price feeds
 * 
 * Example: "Will ETH reach $5000?" → Fetch real ETH price
 */

import { OracleInterface, OracleProof, OracleType, OracleConfig } from './OracleInterface';

export interface EthPriceCondition {
    marketId: string;
    targetPrice: number;      // e.g., 5000 for "ETH > $5000"
    operator: 'gt' | 'lt';   // greater than or less than
}

export class EthPriceOracle extends OracleInterface {
    private marketConditions: Map<string, EthPriceCondition> = new Map();
    private apiUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';

    constructor(config: OracleConfig) {
        super(config);
    }

    /**
     * Register a market with ETH price condition
     */
    registerMarket(condition: EthPriceCondition) {
        this.marketConditions.set(condition.marketId, condition);
        console.log(`📊 Registered ETH price oracle for market: ${condition.marketId}`);
        console.log(`   Condition: ETH ${condition.operator === 'gt' ? '>' : '<'} $${condition.targetPrice}`);
    }

    /**
     * Check if market should be frozen (time-based)
     */
    async shouldFreeze(marketId: string, marketEndTime: number): Promise<boolean> {
        const now = Date.now();
        return now >= marketEndTime;
    }

    /**
     * Fetch real ETH price from CoinGecko
     * Returns YES if condition met, NO otherwise
     */
    async fetchOutcome(marketId: string, marketQuestion: string): Promise<OracleProof> {
        console.log(`🔍 Fetching ETH price for market: ${marketId}`);
        
        const condition = this.marketConditions.get(marketId);
        
        // Fetch real ETH price
        const response = await fetch(this.apiUrl);
        if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.statusText}`);
        }
        
        const data = await response.json();
        const currentPrice = data.ethereum.usd;
        
        console.log(`💰 Current ETH price: $${currentPrice}`);
        
        // Determine outcome based on condition (if registered)
        let outcome: 'YES' | 'NO' = 'YES';
        
        if (condition) {
            const conditionMet = condition.operator === 'gt' 
                ? currentPrice > condition.targetPrice
                : currentPrice < condition.targetPrice;
            
            outcome = conditionMet ? 'YES' : 'NO';
            console.log(`   Target: ${condition.operator === 'gt' ? '>' : '<'} $${condition.targetPrice}`);
            console.log(`   Result: ${outcome} (condition ${conditionMet ? 'MET' : 'NOT MET'})`);
        } else {
            // No condition registered - resolve YES if price > $3000 (arbitrary default)
            outcome = currentPrice > 3000 ? 'YES' : 'NO';
            console.log(`   Using default: ETH > $3000 → ${outcome}`);
        }
        
        // Generate proof
        const proof: OracleProof = {
            oracleType: OracleType.CUSTOM,
            timestamp: Date.now(),
            outcome: outcome === 'YES' ? 1 : 0,
            signature: `eth-price-${currentPrice}-${Date.now()}`, // Demo signature
            metadata: {
                source: 'CoinGecko API',
                currentPrice,
                targetPrice: condition?.targetPrice,
                operator: condition?.operator,
                question: marketQuestion
            }
        };
        
        return proof;
    }

    /**
     * Validate oracle proof signature
     */
    async validateProof(proof: OracleProof): Promise<boolean> {
        // For demo, always valid
        // In production, verify cryptographic signature
        return proof.oracleType === OracleType.CUSTOM && 
               proof.signature.startsWith('eth-price-');
    }

    /**
     * Get current ETH price (utility method)
     */
    async getCurrentPrice(): Promise<number> {
        const response = await fetch(this.apiUrl);
        const data = await response.json();
        return data.ethereum.usd;
    }

    /**
     * Verify proof (alias for validateProof)
     */
    async verifyProof(proof: OracleProof): Promise<boolean> {
        return this.validateProof(proof);
    }

    /**
     * Get oracle status
     */
    async getStatus(): Promise<{ healthy: boolean; lastUpdate: number; type: OracleType }> {
        return {
            healthy: true,
            lastUpdate: Date.now(),
            type: OracleType.CHAINLINK
        };
    }
}
