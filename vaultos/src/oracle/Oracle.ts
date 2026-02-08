/**
 * Oracle.ts
 * 
 * Simple mock oracle for testing auto-resolution
 * Always resolves YES after market funded
 */

import { OracleInterface, OracleProof, OracleType, OracleConfig } from './OracleInterface';

export class Oracle extends OracleInterface {
    constructor() {
        const config: OracleConfig = {
            type: OracleType.MANUAL,
            network: 'base-sepolia',
            updateInterval: 60
        };
        super(config);
    }

    /**
     * Check if market should be frozen (time-based)
     */
    async shouldFreeze(marketId: string, marketEndTime: number): Promise<boolean> {
        const now = Date.now();
        return now >= marketEndTime;
    }

    /**
     * Mock outcome - always returns YES for demo
     */
    async fetchOutcome(marketId: string, marketQuestion: string): Promise<OracleProof> {
        console.log(`🎲 Mock Oracle resolving market: ${marketId}`);
        console.log(`   Question: ${marketQuestion}`);
        console.log(`   Result: YES (mock - for demo)`);
        
        const proof: OracleProof = {
            oracleType: OracleType.MANUAL,
            timestamp: Date.now(),
            outcome: 1, // YES
            signature: `mock-oracle-${marketId}-${Date.now()}`,
            metadata: {
                source: 'Oracle',
                question: marketQuestion,
                note: 'Demo mode - always resolves YES'
            }
        };
        
        return proof;
    }

    /**
     * Validate oracle proof
     */
    async validateProof(proof: OracleProof): Promise<boolean> {
        return proof.oracleType === OracleType.MANUAL && 
               proof.signature.startsWith('mock-oracle-');
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
            type: OracleType.MANUAL
        };
    }
}
