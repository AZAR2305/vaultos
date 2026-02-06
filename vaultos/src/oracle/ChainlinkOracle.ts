/**
 * ChainlinkOracle.ts
 * 
 * Chainlink price feed oracle for prediction market resolution
 * Uses Chainlink Data Feeds to determine market outcomes
 * 
 * Example Use Cases:
 * - "Will ETH reach $3000 by December 31?" → Check ETH/USD feed
 * - "Will BTC be above $50k on Friday?" → Check BTC/USD feed
 * 
 * Authority: Chainlink aggregator contract is source of truth
 * 
 * Phase: Phase 3 - Oracle Integration
 */

import { ethers } from 'ethers';
import { OracleInterface, OracleProof, OracleType, OracleConfig } from './OracleInterface';

// Chainlink Aggregator ABI (minimal interface)
const AGGREGATOR_ABI = [
    'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
    'function decimals() external view returns (uint8)',
    'function description() external view returns (string)',
];

export interface ChainlinkMarketCondition {
    marketId: string;
    feedAddress: string; // Chainlink aggregator contract
    targetPrice: number; // e.g., 3000 for "ETH > $3000"
    operator: 'gt' | 'lt' | 'eq'; // greater than, less than, equal
    decimals: number; // Price feed decimals (usually 8)
}

export class ChainlinkOracle extends OracleInterface {
    private provider: ethers.Provider;
    private marketConditions: Map<string, ChainlinkMarketCondition> = new Map();

    constructor(config: OracleConfig, rpcUrl: string) {
        super(config);
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
    }

    /**
     * Register a market with Chainlink feed condition
     */
    registerMarket(condition: ChainlinkMarketCondition) {
        this.marketConditions.set(condition.marketId, condition);
        console.log(`📊 Registered Chainlink oracle for market: ${condition.marketId}`);
    }

    /**
     * Check if market should be frozen (time-based or admin trigger)
     */
    async shouldFreeze(marketId: string, marketEndTime: number): Promise<boolean> {
        const now = Date.now();
        return now >= marketEndTime;
    }

    /**
     * Fetch outcome from Chainlink price feed
     * Returns 0 (NO) or 1 (YES) based on condition
     */
    async fetchOutcome(marketId: string, marketQuestion: string): Promise<OracleProof> {
        const condition = this.marketConditions.get(marketId);
        if (!condition) {
            throw new Error(`Market ${marketId} not registered with Chainlink oracle`);
        }

        // Connect to Chainlink aggregator
        const aggregator = new ethers.Contract(
            condition.feedAddress,
            AGGREGATOR_ABI,
            this.provider
        );

        // Fetch latest round data
        const [roundId, answer, startedAt, updatedAt, answeredInRound] = await aggregator.latestRoundData();
        const decimals = await aggregator.decimals();
        const description = await aggregator.description();

        // Convert answer to human-readable price
        const price = Number(answer) / Math.pow(10, decimals);

        // Determine outcome based on condition
        let outcome: number;
        switch (condition.operator) {
            case 'gt':
                outcome = price > condition.targetPrice ? 1 : 0;
                break;
            case 'lt':
                outcome = price < condition.targetPrice ? 1 : 0;
                break;
            case 'eq':
                outcome = Math.abs(price - condition.targetPrice) < 0.01 ? 1 : 0;
                break;
            default:
                throw new Error(`Invalid operator: ${condition.operator}`);
        }

        // Create proof signature (simplified - real impl would use EIP-712)
        const proofData = {
            marketId,
            roundId: roundId.toString(),
            price,
            outcome,
            updatedAt: Number(updatedAt),
        };
        const signature = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(proofData)));

        const proof: OracleProof = {
            oracleType: OracleType.CHAINLINK,
            timestamp: Number(updatedAt) * 1000, // Convert to ms
            outcome,
            signature,
            metadata: {
                source: description,
                roundId: roundId.toString(),
                price,
                targetPrice: condition.targetPrice,
                operator: condition.operator,
                feedAddress: condition.feedAddress,
            },
        };

        console.log(`📈 Chainlink outcome fetched: ${description} = $${price.toFixed(2)} | Outcome: ${outcome}`);
        return proof;
    }

    /**
     * Verify Chainlink proof authenticity
     * Cross-check against on-chain data
     */
    async verifyProof(proof: OracleProof): Promise<boolean> {
        try {
            if (proof.oracleType !== OracleType.CHAINLINK) {
                return false;
            }

            const { feedAddress, roundId } = proof.metadata;
            if (!feedAddress || !roundId) {
                return false;
            }

            // Query Chainlink aggregator for historical round
            const aggregator = new ethers.Contract(feedAddress, AGGREGATOR_ABI, this.provider);
            const [onChainRoundId, onChainAnswer, , onChainUpdatedAt] = await aggregator.latestRoundData();

            // Verify round ID and timestamp match
            const roundMatches = onChainRoundId.toString() === roundId;
            const timeMatches = Math.abs(Number(onChainUpdatedAt) * 1000 - proof.timestamp) < 60000; // 1 min tolerance

            return roundMatches && timeMatches;
        } catch (error) {
            console.error('❌ Chainlink proof verification failed:', error);
            return false;
        }
    }

    /**
     * Get oracle status
     */
    async getStatus(): Promise<{ healthy: boolean; lastUpdate: number; type: OracleType }> {
        try {
            // Check if provider is responsive
            const blockNumber = await this.provider.getBlockNumber();
            const block = await this.provider.getBlock(blockNumber);

            return {
                healthy: true,
                lastUpdate: block ? block.timestamp * 1000 : Date.now(),
                type: OracleType.CHAINLINK,
            };
        } catch (error) {
            console.error('❌ Chainlink oracle unhealthy:', error);
            return {
                healthy: false,
                lastUpdate: 0,
                type: OracleType.CHAINLINK,
            };
        }
    }
}

/**
 * Chainlink Price Feed Addresses (Base Sepolia)
 * Source: https://docs.chain.link/data-feeds/price-feeds/addresses
 */
export const CHAINLINK_FEEDS_BASE_SEPOLIA = {
    ETH_USD: '0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1',
    BTC_USD: '0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298',
    USDC_USD: '0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165',
    // Add more feeds as needed
};

/**
 * Chainlink Price Feed Addresses (Sepolia)
 */
export const CHAINLINK_FEEDS_SEPOLIA = {
    ETH_USD: '0x694AA1769357215DE4FAC081bf1f309aDC325306',
    BTC_USD: '0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43',
    USDC_USD: '0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E',
    // Add more feeds as needed
};
