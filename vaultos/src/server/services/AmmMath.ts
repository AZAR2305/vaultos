/**
 * AMM Math: Logarithmic Market Scoring Rule (LMSR)
 * 
 * LMSR is designed specifically for prediction markets:
 * - Smooth odds updates
 * - Infinite liquidity feel
 * - Bounded loss for market maker
 * 
 * References:
 * - Hanson, Robin. "Logarithmic market scoring rules for modular combinatorial information aggregation."
 * - Used by: Augur, Gnosis, Polymarket
 */

const PRECISION = 1_000_000n; // 6 decimal places

export interface AmmState {
    liquidityParameter: bigint; // b parameter (higher = more stable prices)
    shares: {
        YES: bigint;
        NO: bigint;
    };
}

export interface AmmResult {
    cost: bigint;           // Amount user pays
    newShares: {
        YES: bigint;
        NO: bigint;
    };
    priceAfter: number;     // Price after trade (0-1)
    slippage: number;       // Price impact (0-1)
}

export class LmsrAmm {
    /**
     * Calculate cost to buy shares using LMSR
     * 
     * Formula: C(q) = b * ln(Σ exp(q_i / b))
     * 
     * Cost = C(q_after) - C(q_before)
     */
    static calculateCost(
        state: AmmState,
        outcome: 'YES' | 'NO',
        sharesToBuy: bigint
    ): AmmResult {
        const b = state.liquidityParameter;
        
        // Current state
        const currentShares = { ...state.shares };
        
        // New state after purchase
        const newShares = { ...currentShares };
        newShares[outcome] += sharesToBuy;

        // Calculate cost using LMSR formula
        const costBefore = this.costFunction(b, currentShares.YES, currentShares.NO);
        const costAfter = this.costFunction(b, newShares.YES, newShares.NO);
        
        const cost = costAfter - costBefore;

        // Calculate price after (probability)
        const priceAfter = this.getPrice(b, newShares.YES, newShares.NO, outcome);

        // Calculate slippage (price impact)
        const priceBefore = this.getPrice(b, currentShares.YES, currentShares.NO, outcome);
        const slippage = Math.abs(priceAfter - priceBefore);

        return {
            cost,
            newShares,
            priceAfter,
            slippage,
        };
    }

    /**
     * LMSR Cost Function: C(q) = b * ln(exp(q_YES/b) + exp(q_NO/b))
     */
    private static costFunction(b: bigint, qYes: bigint, qNo: bigint): bigint {
        // Convert to floating point for calculation
        const bNum = Number(b) / Number(PRECISION);
        const qYesNum = Number(qYes) / Number(PRECISION);
        const qNoNum = Number(qNo) / Number(PRECISION);

        // C(q) = b * ln(exp(q_YES/b) + exp(q_NO/b))
        const expYes = Math.exp(qYesNum / bNum);
        const expNo = Math.exp(qNoNum / bNum);
        const sum = expYes + expNo;
        const cost = bNum * Math.log(sum);

        // Convert back to bigint
        return BigInt(Math.floor(cost * Number(PRECISION)));
    }

    /**
     * Calculate instantaneous price (probability) for an outcome
     * 
     * Price = exp(q_i / b) / Σ exp(q_j / b)
     */
    static getPrice(
        b: bigint,
        qYes: bigint,
        qNo: bigint,
        outcome: 'YES' | 'NO'
    ): number {
        const bNum = Number(b) / Number(PRECISION);
        const qYesNum = Number(qYes) / Number(PRECISION);
        const qNoNum = Number(qNo) / Number(PRECISION);

        const expYes = Math.exp(qYesNum / bNum);
        const expNo = Math.exp(qNoNum / bNum);
        const sum = expYes + expNo;

        return outcome === 'YES' ? expYes / sum : expNo / sum;
    }

    /**
     * Get current odds for both outcomes
     */
    static getOdds(state: AmmState): { YES: number; NO: number } {
        const yesPrice = this.getPrice(
            state.liquidityParameter,
            state.shares.YES,
            state.shares.NO,
            'YES'
        );

        return {
            YES: yesPrice,
            NO: 1 - yesPrice,
        };
    }

    /**
     * Calculate shares to issue for a given cost
     * (Inverse of calculateCost - used for "buy X USDC worth of shares")
     */
    static calculateSharesForCost(
        state: AmmState,
        outcome: 'YES' | 'NO',
        costAmount: bigint
    ): bigint {
        const b = state.liquidityParameter;
        
        // Binary search to find shares amount
        let low = 0n;
        let high = costAmount * 100n; // Upper bound
        let bestShares = 0n;

        while (low <= high) {
            const mid = (low + high) / 2n;
            const result = this.calculateCost(state, outcome, mid);

            if (result.cost <= costAmount) {
                bestShares = mid;
                low = mid + 1n;
            } else {
                high = mid - 1n;
            }
        }

        return bestShares;
    }

    /**
     * Initialize AMM state for new market
     * 
     * @param liquidityAmount - Creator's initial liquidity deposit
     * @returns Initial AMM state with calibrated b parameter
     */
    static initializeMarket(liquidityAmount: bigint): AmmState {
        // b parameter controls price sensitivity
        // Higher b = more stable prices, lower b = more volatile
        // Rule of thumb: b ≈ liquidity / ln(outcomes)
        const b = (liquidityAmount * PRECISION) / 1_000_000n; // Calibrated for 2 outcomes

        return {
            liquidityParameter: b,
            shares: {
                YES: 0n,
                NO: 0n,
            },
        };
    }

    /**
     * Validate trade (slippage protection)
     */
    static validateTrade(
        result: AmmResult,
        maxSlippage: number = 0.05 // 5% max slippage
    ): boolean {
        return result.slippage <= maxSlippage;
    }
}

/**
 * Helper: Convert USDC amount (6 decimals) to AMM precision
 */
export function toAmmAmount(usdcAmount: number | bigint): bigint {
    if (typeof usdcAmount === 'number') {
        // Convert number to microUSDC (multiply by 1M for 6 decimals)
        return BigInt(Math.floor(usdcAmount * 1_000_000));
    }
    return usdcAmount; // Both use 6 decimals
}

/**
 * Helper: Convert AMM amount to USDC (6 decimals)
 */
export function fromAmmAmount(ammAmount: bigint): number {
    return Number(ammAmount) / 1_000_000;
}

/**
 * Format odds as percentage
 */
export function formatOdds(probability: number): string {
    return `${(probability * 100).toFixed(1)}%`;
}

/**
 * Calculate implied probability from decimal odds
 */
export function decimalOddsToProb(odds: number): number {
    return 1 / odds;
}

/**
 * Calculate decimal odds from probability
 */
export function probToDecimalOdds(probability: number): number {
    return 1 / probability;
}
