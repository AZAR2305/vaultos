/**
 * SubmitSettlement.ts
 * 
 * Submits final settlement to Yellow Network for on-chain execution
 * Coordinates the complete settlement flow from resolution to blockchain
 * 
 * Settlement Flow:
 * 1. Market resolved → freezeMarket() → resolveMarket()
 * 2. Build final state hash → FinalStateBuilder
 * 3. Request signatures from participants → SignatureCollector
 * 4. All signatures collected → submit to Yellow Network
 * 5. Yellow Network validates → on-chain transfer execution
 * 6. MarketService.settleMarket() marks complete
 * 
 * Authority: Yellow Network adjudicator validates state + signatures
 * 
 * Phase: Phase 4 - Settlement Flow
 */

import { ethers } from 'ethers';
import FinalStateBuilder, { FinalStateHash, FinalState } from './FinalStateBuilder';
import SignatureCollector from './SignatureCollector';
import SettlementMath from '../server/services/SettlementMath';
import MarketService, { Market } from '../server/services/MarketService';

export interface SettlementResult {
    success: boolean;
    txHash?: string;
    error?: string;
    finalState: FinalState;
    signatures: string[];
    submittedAt: number;
}

export class SubmitSettlement {
    private provider: ethers.Provider;
    private signer: ethers.Wallet;

    constructor(
        rpcUrl: string,
        privateKey: string // Server wallet for submitting transactions
    ) {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.signer = new ethers.Wallet(privateKey, this.provider);
    }

    /**
     * Complete settlement flow for a resolved market
     * Orchestrates: Build state → Collect signatures → Submit on-chain
     */
    async settleMarket(marketId: string): Promise<SettlementResult> {
        try {
            // Step 1: Get market and validate status
            const market = MarketService.getMarketById(marketId);
            if (!market) {
                throw new Error('Market not found');
            }
            if (market.status !== 'RESOLVED') {
                throw new Error(`Market not resolved: ${market.status}`);
            }
            if (market.winningOutcome === undefined) {
                throw new Error('Winning outcome not determined');
            }

            console.log(`🔄 Starting settlement for market: ${marketId}`);

            // Step 2: Calculate payouts
            const positions = this.extractPositions(market);
            const payouts = SettlementMath.calculatePayouts(
                positions,
                market.winningOutcome,
                market.ammState.totalVolume
            );

            // Validate settlement integrity
            const validation = SettlementMath.validateSettlement(payouts, market.ammState.totalVolume);
            if (!validation.valid) {
                throw new Error(`Settlement validation failed: Difference = ${validation.difference}`);
            }

            // Step 3: Build final state hash
            const finalState = FinalStateBuilder.buildFinalState(
                marketId,
                market.appSessionId,
                market.winningOutcome,
                payouts,
                market.ammState.totalVolume,
                market.resolvedAt || Date.now()
            );

            const finalStateHash = FinalStateBuilder.hashFinalState(finalState);
            console.log(`🔐 Final state hash: ${finalStateHash.stateHash}`);

            // Verify state hash integrity
            const stateVerification = FinalStateBuilder.verifyStateHash(finalStateHash);
            if (!stateVerification.valid) {
                throw new Error(`State hash verification failed: ${stateVerification.errors.join(', ')}`);
            }

            // Step 4: Request signatures from participants
            const participants = Array.from(payouts.keys());
            SignatureCollector.requestSignatures(finalStateHash, participants, 30);

            // Wait for signatures (in production, this would be event-driven)
            const signatures = await this.waitForSignatures(marketId, 30 * 60 * 1000); // 30 min timeout
            if (!signatures || signatures.length < participants.length) {
                throw new Error('Failed to collect all signatures');
            }

            console.log(`✅ All signatures collected: ${signatures.length}/${participants.length}`);

            // Step 5: Submit to Yellow Network
            const txHash = await this.submitToYellowNetwork(finalStateHash, signatures);

            // Step 6: Mark market as settled
            await MarketService.settleMarket(marketId);

            // Generate settlement report
            const report = SettlementMath.generateSettlementReport(
                marketId,
                market.winningOutcome,
                payouts,
                market.ammState.totalVolume
            );
            console.log(report);

            return {
                success: true,
                txHash,
                finalState,
                signatures,
                submittedAt: Date.now(),
            };
        } catch (error) {
            console.error(`❌ Settlement failed for market ${marketId}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                finalState: {} as FinalState,
                signatures: [],
                submittedAt: Date.now(),
            };
        }
    }

    /**
     * Extract positions from market for settlement calculation
     */
    private extractPositions(market: Market): any[] {
        const positions: any[] = [];

        market.positions.forEach((position, key) => {
            const [userAddress, outcomeStr] = key.split('_');
            const outcome = parseInt(outcomeStr);

            positions.push({
                userAddress,
                outcome,
                shares: position.shares,
                totalCost: position.totalCost,
            });
        });

        return positions;
    }

    /**
     * Wait for all required signatures
     * In production, use event emitter or Promise-based approach
     */
    private async waitForSignatures(marketId: string, timeoutMs: number): Promise<string[] | null> {
        const startTime = Date.now();
        const pollInterval = 5000; // Check every 5 seconds

        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                // Check if ready
                if (SignatureCollector.isReadyForSettlement(marketId)) {
                    clearInterval(checkInterval);
                    const signatures = SignatureCollector.getSignatures(marketId);
                    resolve(signatures);
                    return;
                }

                // Check timeout
                if (Date.now() - startTime > timeoutMs) {
                    clearInterval(checkInterval);
                    const status = SignatureCollector.getCollectionStatus(marketId);
                    console.warn(`⏱️ Signature collection timeout: ${status.collected}/${status.totalRequired} collected`);
                    resolve(null);
                }
            }, pollInterval);
        });
    }

    /**
     * Submit final state + signatures to Yellow Network
     * 
     * Yellow Network Settlement Process:
     * 1. Server submits state hash + participant signatures to adjudicator
     * 2. Adjudicator contract validates signatures on-chain
     * 3. Smart contract executes token transfers according to payouts
     * 4. Channel closed, funds distributed
     */
    private async submitToYellowNetwork(
        finalStateHash: FinalStateHash,
        signatures: string[]
    ): Promise<string> {
        console.log('📡 Submitting settlement to Yellow Network...');

        // Generate settlement transaction
        const settlementTx = FinalStateBuilder.generateSettlementTx(finalStateHash, signatures);

        // TODO: Replace with actual Yellow Network adjudicator address
        // This would come from Yellow Network SDK or documentation
        const adjudicatorAddress = settlementTx.to; // Placeholder

        // In production, use Yellow Network SDK for settlement submission
        // For now, simulate with direct contract call
        try {
            // Estimate gas
            const gasEstimate = await this.provider.estimateGas({
                to: settlementTx.to,
                data: settlementTx.data,
                value: settlementTx.value,
                from: await this.signer.getAddress(),
            });

            // Submit transaction
            const tx = await this.signer.sendTransaction({
                to: settlementTx.to,
                data: settlementTx.data,
                value: settlementTx.value,
                gasLimit: gasEstimate * 120n / 100n, // 20% buffer
            });

            console.log(`📤 Settlement transaction submitted: ${tx.hash}`);
            console.log('   Waiting for confirmation...');

            // Wait for confirmation
            const receipt = await tx.wait();

            if (receipt?.status === 1) {
                console.log(`✅ Settlement confirmed on-chain: ${tx.hash}`);
                return tx.hash;
            } else {
                throw new Error('Transaction reverted');
            }
        } catch (error) {
            console.error('❌ On-chain settlement failed:', error);
            throw error;
        }
    }

    /**
     * Emergency settlement bypass (admin only)
     * Used when signature collection fails but payout is determined
     */
    async forceSettlement(
        marketId: string,
        adminSignature: string
    ): Promise<SettlementResult> {
        console.warn(`⚠️ FORCE SETTLEMENT INITIATED: ${marketId}`);

        // TODO: Verify admin signature
        // TODO: Create special settlement transaction with admin override

        // This would use a different smart contract function that accepts
        // admin signature instead of participant signatures

        throw new Error('Force settlement not implemented - requires admin authorization');
    }

    /**
     * Get settlement status for a market
     */
    getSettlementStatus(marketId: string): {
        stage: 'pending' | 'collecting_signatures' | 'submitting' | 'confirmed' | 'failed';
        progress: number; // 0-100%
        details: string;
    } {
        const market = MarketService.getMarketById(marketId);
        if (!market) {
            return {
                stage: 'failed',
                progress: 0,
                details: 'Market not found',
            };
        }

        if (market.status === 'SETTLED') {
            return {
                stage: 'confirmed',
                progress: 100,
                details: 'Settlement confirmed on-chain',
            };
        }

        if (market.status !== 'RESOLVED') {
            return {
                stage: 'pending',
                progress: 0,
                details: `Market status: ${market.status}`,
            };
        }

        // Check signature collection
        const sigStatus = SignatureCollector.getCollectionStatus(marketId);
        if (!sigStatus.complete) {
            const progress = (sigStatus.collected / sigStatus.totalRequired) * 50; // 0-50% during collection
            return {
                stage: 'collecting_signatures',
                progress,
                details: `Collecting signatures: ${sigStatus.collected}/${sigStatus.totalRequired}`,
            };
        }

        return {
            stage: 'submitting',
            progress: 75,
            details: 'Submitting to Yellow Network...',
        };
    }
}

export default SubmitSettlement;
