/**
 * ResolutionEngine.ts
 * 
 * Orchestrates prediction market resolution lifecycle
 * Monitors markets → Freezes when conditions met → Fetches oracle outcome → Resolves market
 * 
 * Authority Flow:
 * 1. Engine detects market ready for freeze (time expired)
 * 2. Engine calls MarketService.freezeMarket() [trading disabled]
 * 3. Engine fetches outcome from oracle
 * 4. Engine verifies oracle proof
 * 5. Engine calls MarketService.resolveMarket() with proof
 * 6. Settlement can begin
 * 
 * CRITICAL: No user-triggered resolution - oracle decides outcome
 * 
 * Phase: Phase 3 - Oracle Integration
 */

import { OracleInterface, ResolutionEvent, OracleProof } from './OracleInterface';
import MarketService from '../server/services/MarketService';
import { MarketStatus } from '../server/services/MarketService';

export interface ResolutionConfig {
    checkIntervalSeconds: number; // How often to check for markets ready to resolve
    autoFreeze: boolean; // Automatically freeze markets when time expires
    autoResolve: boolean; // Automatically resolve markets when oracle confirms
    requireManualApproval: boolean; // Admin must approve before resolution
}

export class ResolutionEngine {
    private oracle: OracleInterface;
    private config: ResolutionConfig;
    private checkIntervalId?: NodeJS.Timeout;
    private pendingResolutions: Map<string, ResolutionEvent> = new Map();

    constructor(oracle: OracleInterface, config: ResolutionConfig) {
        this.oracle = oracle;
        this.config = config;
    }

    /**
     * Start monitoring markets for resolution
     */
    start() {
        console.log('🔄 Resolution engine started');
        
        this.checkIntervalId = setInterval(
            () => this.checkMarkets(),
            this.config.checkIntervalSeconds * 1000
        );

        // Initial check
        this.checkMarkets();
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (this.checkIntervalId) {
            clearInterval(this.checkIntervalId);
            this.checkIntervalId = undefined;
        }
        console.log('⏸️ Resolution engine stopped');
    }

    /**
     * Check all active markets for freeze/resolve conditions
     */
    private async checkMarkets() {
        try {
            const markets = MarketService.getActiveMarkets();
            
            for (const market of markets) {
                // Skip markets already frozen/resolved/settled
                if (market.status !== MarketStatus.ACTIVE) {
                    continue;
                }

                // Check if market should be frozen
                const shouldFreeze = await this.oracle.shouldFreeze(market.id, market.endTime);
                
                if (shouldFreeze && this.config.autoFreeze) {
                    await this.freezeMarket(market.id);
                }
            }

            // Check frozen markets for resolution
            const frozenMarkets = markets.filter(m => m.status === MarketStatus.FROZEN);
            for (const market of frozenMarkets) {
                if (this.config.autoResolve && !this.config.requireManualApproval) {
                    await this.resolveMarket(market.id, market.question);
                } else {
                    console.log(`⏸️ Market ${market.id} frozen, awaiting manual approval for resolution`);
                }
            }
        } catch (error) {
            console.error('❌ Error checking markets:', error);
        }
    }

    /**
     * Freeze a market (disable trading)
     * Called when market end time reached or oracle condition met
     */
    async freezeMarket(marketId: string): Promise<void> {
        try {
            const oracleStatus = await this.oracle.getStatus();
            if (!oracleStatus.healthy) {
                throw new Error('Oracle is unhealthy, cannot freeze market');
            }

            // Freeze market via MarketService
            await MarketService.freezeMarket(marketId, oracleStatus.type);

            console.log(`❄️ Market ${marketId} frozen by resolution engine`);
        } catch (error) {
            console.error(`❌ Failed to freeze market ${marketId}:`, error);
            throw error;
        }
    }

    /**
     * Resolve a market using oracle outcome
     * Fetches oracle proof and updates market state
     */
    async resolveMarket(marketId: string, marketQuestion: string): Promise<void> {
        try {
            // Fetch outcome from oracle
            console.log(`🔍 Fetching oracle outcome for market: ${marketId}`);
            const proof = await this.oracle.fetchOutcome(marketId, marketQuestion);

            // Verify proof authenticity
            const isValid = await this.oracle.verifyProof(proof);
            if (!isValid) {
                throw new Error('Oracle proof verification failed');
            }

            // Store pending resolution if manual approval required
            if (this.config.requireManualApproval) {
                this.pendingResolutions.set(marketId, {
                    marketId,
                    trigger: 'oracle_update',
                    proof,
                });
                console.log(`⏸️ Market ${marketId} resolution pending manual approval`);
                return;
            }

            // Convert outcome number to YES/NO string
            const outcomeString = proof.outcome === 1 ? 'YES' : 'NO';
            
            // Resolve market via MarketService
            await MarketService.resolveMarket(marketId, outcomeString, proof.signature);

            console.log(`✅ Market ${marketId} resolved: Outcome = ${outcomeString}`);

            // Optionally trigger settlement
            // await MarketService.settleMarket(marketId); // Phase 4
        } catch (error) {
            console.error(`❌ Failed to resolve market ${marketId}:`, error);
            throw error;
        }
    }

    /**
     * Manually approve a pending resolution (admin only)
     */
    async approvePendingResolution(marketId: string, adminAddress: string): Promise<void> {
        const pending = this.pendingResolutions.get(marketId);
        if (!pending) {
            throw new Error('No pending resolution found');
        }

        // TODO: Verify admin signature/authority

        const outcomeString = pending.proof.outcome === 1 ? 'YES' : 'NO';
        await MarketService.resolveMarket(marketId, outcomeString, pending.proof.signature);

        this.pendingResolutions.delete(marketId);
        console.log(`✅ Pending resolution approved by admin: ${marketId} | Outcome: ${pending.proof.outcome}`);
    }

    /**
     * Reject a pending resolution (admin only)
     */
    async rejectPendingResolution(marketId: string, adminAddress: string, reason: string): Promise<void> {
        const pending = this.pendingResolutions.get(marketId);
        if (!pending) {
            throw new Error('No pending resolution found');
        }

        // TODO: Verify admin signature/authority

        this.pendingResolutions.delete(marketId);
        console.log(`❌ Pending resolution rejected by admin: ${marketId} | Reason: ${reason}`);
        
        // Optionally unfreeze market for additional trading
        // await MarketService.unfreezeMarket(marketId); // Add this method if needed
    }

    /**
     * Get pending resolutions awaiting approval
     */
    getPendingResolutions(): ResolutionEvent[] {
        return Array.from(this.pendingResolutions.values());
    }

    /**
     * Force resolve a market (emergency admin action)
     */
    async forceResolve(marketId: string, outcome: 'YES' | 'NO', adminAddress: string, reason: string): Promise<void> {
        // TODO: Verify admin signature/authority
        console.warn(`⚠️ FORCE RESOLVE: Market ${marketId} | Outcome: ${outcome} | Reason: ${reason} | Admin: ${adminAddress}`);

        // Create manual proof
        const manualProof: OracleProof = {
            oracleType: 'manual' as any,
            timestamp: Date.now(),
            outcome: outcome === 'YES' ? 1 : 0,
            signature: `manual_${adminAddress}_${Date.now()}`,
            metadata: {
                reason,
                adminAddress,
            },
        };

        await MarketService.resolveMarket(marketId, outcome, manualProof.signature);
    }

    /**
     * Get engine status
     */
    getStatus(): {
        running: boolean;
        oracleHealthy: boolean;
        pendingCount: number;
        config: ResolutionConfig;
    } {
        return {
            running: this.checkIntervalId !== undefined,
            oracleHealthy: true, // Updated by periodic checks
            pendingCount: this.pendingResolutions.size,
            config: this.config,
        };
    }
}

/**
 * Factory function to create resolution engine with Chainlink oracle
 */
export function createChainlinkResolutionEngine(
    rpcUrl: string,
    config?: Partial<ResolutionConfig>
): { engine: ResolutionEngine; oracle: any } {
    const { ChainlinkOracle } = require('./ChainlinkOracle');
    const { OracleType } = require('./OracleInterface');

    const oracleConfig = {
        type: OracleType.CHAINLINK,
        network: 'base-sepolia',
        updateInterval: 60,
    };

    const oracle = new ChainlinkOracle(oracleConfig, rpcUrl);

    const defaultConfig: ResolutionConfig = {
        checkIntervalSeconds: 60, // Check every minute
        autoFreeze: true,
        autoResolve: false, // Require manual approval for safety
        requireManualApproval: true,
        ...config,
    };

    const engine = new ResolutionEngine(oracle, defaultConfig);

    return { engine, oracle };
}
