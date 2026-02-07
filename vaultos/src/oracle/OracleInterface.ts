/**
 * OracleInterface.ts
 * 
 * Abstract oracle interface for prediction market resolution
 * Defines contract for different oracle implementations (Chainlink, UMA, custom)
 * 
 * Authority Pattern:
 * - ONLY oracle can freeze/resolve markets
 * - User-triggered resolution is FORBIDDEN
 * - Oracle provides cryptographic proof of outcome
 * 
 * Phase: Phase 3 - Oracle Integration
 */

export enum OracleType {
    CHAINLINK = 'chainlink',
    UMA = 'uma',
    CUSTOM = 'custom',
    MANUAL = 'manual', // Admin-only for testing
}

export interface OracleConfig {
    type: OracleType;
    network: string; // 'base-sepolia', 'sepolia', etc.
    contractAddress?: string; // For Chainlink aggregator
    apiEndpoint?: string; // For custom oracle
    updateInterval: number; // Seconds between checks
    trustedSigners?: string[]; // Addresses allowed to sign resolutions
}

export interface OracleProof {
    oracleType: OracleType;
    timestamp: number;
    outcome: number;
    signature: string; // Cryptographic signature proving authenticity
    metadata: {
        source?: string; // Data source (e.g., 'Chainlink ETH/USD')
        roundId?: string; // Chainlink round ID
        confidence?: number; // UMA confidence score
        [key: string]: any;
    };
}

export interface ResolutionEvent {
    marketId: string;
    trigger: 'time_expired' | 'oracle_update' | 'manual';
    proof: OracleProof;
}

export abstract class OracleInterface {
    protected config: OracleConfig;

    constructor(config: OracleConfig) {
        this.config = config;
    }

    /**
     * Check if market should be frozen (trading disabled)
     * Called periodically by ResolutionEngine
     */
    abstract shouldFreeze(marketId: string, marketEndTime: number): Promise<boolean>;

    /**
     * Fetch outcome data from oracle
     * Returns proof that can be verified on-chain if needed
     */
    abstract fetchOutcome(marketId: string, marketQuestion: string): Promise<OracleProof>;

    /**
     * Verify oracle proof authenticity
     * Ensures proof came from trusted source
     */
    abstract verifyProof(proof: OracleProof): Promise<boolean>;

    /**
     * Get oracle status/health
     */
    abstract getStatus(): Promise<{
        healthy: boolean;
        lastUpdate: number;
        type: OracleType;
    }>;
}
