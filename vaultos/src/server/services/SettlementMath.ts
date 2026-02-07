/**
 * SettlementMath.ts
 * 
 * Settlement logic for prediction markets after resolution
 * Calculates payouts using winner-takes-all formula
 * 
 * Authority: Backend-only calculations (frontend never computes payouts)
 * 
 * Formula:
 * - Winner payout = (user_winning_shares / total_winning_shares) * total_pool
 * - Losers receive 0
 * 
 * Phase: Phase 1 - Market Engine & Settlement
 */

export interface Position {
    userAddress: string;
    outcome: number;
    shares: number;
    totalCost: number;
}

export interface PayoutResult {
    userAddress: string;
    payout: number;
    invested: number;
    profit: number;
}

export class SettlementMath {
    /**
     * Calculate payouts for all participants in a resolved market
     * 
     * @param positions - All user positions in the market
     * @param winningOutcome - The outcome that won (0, 1, 2, ...)
     * @param totalPool - Total volume traded in the market
     * @returns Map of userAddress -> payout amount
     */
    calculatePayouts(
        positions: Position[],
        winningOutcome: number,
        totalPool: number
    ): Map<string, PayoutResult> {
        const results = new Map<string, PayoutResult>();

        // Step 1: Calculate total winning shares
        let totalWinningShares = 0;
        positions.forEach(position => {
            if (position.outcome === winningOutcome) {
                totalWinningShares += position.shares;
            }
        });

        // Edge case: No winners (market cancelled or invalid resolution)
        if (totalWinningShares === 0) {
            console.warn('⚠️ No winning positions - refunding all participants');
            return this.calculateRefunds(positions);
        }

        // Step 2: Calculate each winner's share of the pool
        positions.forEach(position => {
            const existingResult = results.get(position.userAddress);
            const totalInvested = (existingResult?.invested || 0) + position.totalCost;

            if (position.outcome === winningOutcome) {
                // Winner: proportional share of total pool
                const shareOfPool = position.shares / totalWinningShares;
                const payout = shareOfPool * totalPool;

                results.set(position.userAddress, {
                    userAddress: position.userAddress,
                    payout: (existingResult?.payout || 0) + payout,
                    invested: totalInvested,
                    profit: ((existingResult?.payout || 0) + payout) - totalInvested,
                });
            } else {
                // Loser: receives nothing
                results.set(position.userAddress, {
                    userAddress: position.userAddress,
                    payout: existingResult?.payout || 0,
                    invested: totalInvested,
                    profit: (existingResult?.payout || 0) - totalInvested,
                });
            }
        });

        return results;
    }

    /**
     * Calculate refunds when market is cancelled or invalid
     * Returns each user's total investment
     */
    private calculateRefunds(positions: Position[]): Map<string, PayoutResult> {
        const results = new Map<string, PayoutResult>();

        positions.forEach(position => {
            const existing = results.get(position.userAddress);
            const totalInvested = (existing?.invested || 0) + position.totalCost;
            
            results.set(position.userAddress, {
                userAddress: position.userAddress,
                payout: totalInvested, // Full refund
                invested: totalInvested,
                profit: 0, // No profit in refund
            });
        });

        return results;
    }

    /**
     * Calculate expected payout for a position (before resolution)
     * Used for UI display: "If this outcome wins, you get X"
     */
    calculateExpectedPayout(
        userPosition: Position,
        allPositions: Position[],
        totalPool: number
    ): number {
        // Calculate total winning shares if this outcome wins
        let totalWinningShares = 0;
        allPositions.forEach(position => {
            if (position.outcome === userPosition.outcome) {
                totalWinningShares += position.shares;
            }
        });

        if (totalWinningShares === 0) return 0;

        const shareOfPool = userPosition.shares / totalWinningShares;
        return shareOfPool * totalPool;
    }

    /**
     * Calculate potential profit for a trade (before execution)
     * Used for UI display: "If you buy X shares and win, profit = Y"
     */
    calculatePotentialProfit(
        currentPositions: Position[],
        newShares: number,
        newCost: number,
        targetOutcome: number,
        totalPool: number
    ): { expectedPayout: number; potentialProfit: number; roi: number } {
        // Add hypothetical position
        const hypotheticalPositions = [
            ...currentPositions,
            {
                userAddress: 'hypothetical',
                outcome: targetOutcome,
                shares: newShares,
                totalCost: newCost,
            },
        ];

        const expectedPayout = this.calculateExpectedPayout(
            { userAddress: 'hypothetical', outcome: targetOutcome, shares: newShares, totalCost: newCost },
            hypotheticalPositions,
            totalPool + newCost
        );

        const potentialProfit = expectedPayout - newCost;
        const roi = newCost > 0 ? (potentialProfit / newCost) * 100 : 0;

        return {
            expectedPayout,
            potentialProfit,
            roi,
        };
    }

    /**
     * Validate settlement integrity
     * Ensures total payouts don't exceed total pool (conservation of funds)
     */
    validateSettlement(payouts: Map<string, PayoutResult>, totalPool: number): {
        valid: boolean;
        totalPayouts: number;
        difference: number;
    } {
        let totalPayouts = 0;
        payouts.forEach(result => {
            totalPayouts += result.payout;
        });

        const difference = Math.abs(totalPayouts - totalPool);
        const valid = difference < 0.01; // Allow 1 cent rounding error

        if (!valid) {
            console.error(`❌ Settlement validation failed: Total payouts (${totalPayouts}) != Total pool (${totalPool})`);
        }

        return {
            valid,
            totalPayouts,
            difference,
        };
    }

    /**
     * Generate settlement report for logging/auditing
     */
    generateSettlementReport(
        marketId: string,
        winningOutcome: number,
        payouts: Map<string, PayoutResult>,
        totalPool: number
    ): string {
        const lines: string[] = [];
        lines.push(`\n=== SETTLEMENT REPORT ===`);
        lines.push(`Market ID: ${marketId}`);
        lines.push(`Winning Outcome: ${winningOutcome}`);
        lines.push(`Total Pool: ${totalPool.toFixed(2)} USDC`);
        lines.push(`Participants: ${payouts.size}`);
        lines.push(`\n--- Payouts ---`);

        let totalPaid = 0;
        let winnersCount = 0;
        let losersCount = 0;

        payouts.forEach(result => {
            const status = result.profit > 0 ? '🏆 WIN' : result.profit < 0 ? '❌ LOSS' : '➖ BREAK-EVEN';
            lines.push(
                `${status} ${result.userAddress.slice(0, 8)}... | ` +
                `Invested: ${result.invested.toFixed(2)} | ` +
                `Payout: ${result.payout.toFixed(2)} | ` +
                `Profit: ${result.profit > 0 ? '+' : ''}${result.profit.toFixed(2)}`
            );
            totalPaid += result.payout;
            if (result.profit > 0) winnersCount++;
            else if (result.profit < 0) losersCount++;
        });

        lines.push(`\n--- Summary ---`);
        lines.push(`Winners: ${winnersCount}`);
        lines.push(`Losers: ${losersCount}`);
        lines.push(`Total Paid: ${totalPaid.toFixed(2)} USDC`);
        lines.push(`Pool Difference: ${(totalPaid - totalPool).toFixed(6)} USDC`);
        lines.push(`=========================\n`);

        return lines.join('\n');
    }
}

export default new SettlementMath();
