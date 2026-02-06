/**
 * FinalStateBuilder.ts
 * 
 * Builds final state hash for Yellow Network settlement
 * Creates cryptographic commitment to resolved market state
 * 
 * Settlement Flow (Yellow Network State Channel):
 * 1. Market resolved with outcome
 * 2. Build final state: { marketId, outcome, payouts, timestamp }
 * 3. Hash state using keccak256
 * 4. Collect signatures from all participants
 * 5. Submit state + signatures to Yellow Network adjudicator
 * 6. On-chain contract validates and distributes funds
 * 
 * Phase: Phase 4 - Settlement Flow
 */

import { ethers } from 'ethers';
import { PayoutResult } from '../server/services/SettlementMath';

export interface FinalState {
    marketId: string;
    appSessionId: string; // Yellow Network session ID
    winningOutcome: number;
    payouts: Map<string, number>; // userAddress -> payout amount
    totalPool: number;
    resolvedAt: number;
    nonce: number; // Prevents replay attacks
}

export interface FinalStateHash {
    stateHash: string; // keccak256 hash
    rawState: FinalState;
    encodedData: string; // ABI-encoded for on-chain verification
}

export class FinalStateBuilder {
    /**
     * Build final state from resolved market
     */
    buildFinalState(
        marketId: string,
        appSessionId: string,
        winningOutcome: number,
        payouts: Map<string, PayoutResult>,
        totalPool: number,
        resolvedAt: number
    ): FinalState {
        // Convert PayoutResult map to simple payout amounts
        const payoutAmounts = new Map<string, number>();
        payouts.forEach((result, address) => {
            payoutAmounts.set(address, result.payout);
        });

        const finalState: FinalState = {
            marketId,
            appSessionId,
            winningOutcome,
            payouts: payoutAmounts,
            totalPool,
            resolvedAt,
            nonce: Date.now(), // Simple nonce using timestamp
        };

        return finalState;
    }

    /**
     * Hash final state for cryptographic commitment
     * Uses EIP-712 structured data hashing for compatibility with Yellow Network
     */
    hashFinalState(finalState: FinalState): FinalStateHash {
        // Convert payouts map to sorted array for deterministic encoding
        const payoutEntries = Array.from(finalState.payouts.entries()).sort((a, b) => 
            a[0].localeCompare(b[0])
        );

        const addresses = payoutEntries.map(([addr]) => addr);
        const amounts = payoutEntries.map(([, amount]) => 
            ethers.parseUnits(amount.toFixed(6), 6) // Convert to ytest.usd units (6 decimals)
        );

        // ABI encode state for on-chain verification
        const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
            [
                'bytes32', // marketId (as bytes32)
                'bytes32', // appSessionId (as bytes32)
                'uint256', // winningOutcome
                'address[]', // payout addresses
                'uint256[]', // payout amounts
                'uint256', // totalPool
                'uint256', // resolvedAt
                'uint256', // nonce
            ],
            [
                ethers.id(finalState.marketId), // Convert string to bytes32
                ethers.id(finalState.appSessionId),
                finalState.winningOutcome,
                addresses,
                amounts,
                ethers.parseUnits(finalState.totalPool.toFixed(6), 6),
                finalState.resolvedAt,
                finalState.nonce,
            ]
        );

        // Hash encoded data
        const stateHash = ethers.keccak256(encodedData);

        console.log(`🔐 Final state hash: ${stateHash}`);
        console.log(`📦 Encoded data length: ${encodedData.length} bytes`);

        return {
            stateHash,
            rawState: finalState,
            encodedData,
        };
    }

    /**
     * Create EIP-712 typed data for signing
     * Yellow Network participants sign this to approve settlement
     */
    createEIP712TypedData(stateHash: string, chainId: number): any {
        return {
            types: {
                EIP712Domain: [
                    { name: 'name', type: 'string' },
                    { name: 'version', type: 'string' },
                    { name: 'chainId', type: 'uint256' },
                ],
                FinalState: [
                    { name: 'stateHash', type: 'bytes32' },
                    { name: 'timestamp', type: 'uint256' },
                ],
            },
            domain: {
                name: 'VaultOS Prediction Market',
                version: '1',
                chainId,
            },
            primaryType: 'FinalState',
            message: {
                stateHash,
                timestamp: Date.now(),
            },
        };
    }

    /**
     * Verify state hash integrity (before submission)
     */
    verifyStateHash(finalStateHash: FinalStateHash): {
        valid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        // Check payouts sum to total pool
        let payoutSum = 0;
        finalStateHash.rawState.payouts.forEach(amount => {
            payoutSum += amount;
        });

        const difference = Math.abs(payoutSum - finalStateHash.rawState.totalPool);
        if (difference > 0.01) {
            errors.push(`Payout sum (${payoutSum}) != Total pool (${finalStateHash.rawState.totalPool})`);
        }

        // Check all payout addresses are valid
        finalStateHash.rawState.payouts.forEach((amount, address) => {
            if (!ethers.isAddress(address)) {
                errors.push(`Invalid address: ${address}`);
            }
            if (amount < 0) {
                errors.push(`Negative payout for ${address}: ${amount}`);
            }
        });

        // Check timestamp is reasonable
        const now = Date.now();
        if (finalStateHash.rawState.resolvedAt > now) {
            errors.push('Resolved timestamp is in the future');
        }
        if (finalStateHash.rawState.resolvedAt < now - 86400000) {
            errors.push('Resolved timestamp is more than 24 hours old');
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Generate settlement transaction data for Yellow Network
     * This will be submitted to the adjudicator contract
     */
    generateSettlementTx(
        finalStateHash: FinalStateHash,
        signatures: string[]
    ): {
        to: string; // Adjudicator contract address
        data: string; // Transaction calldata
        value: string; // ETH value (usually 0)
    } {
        // Yellow Network adjudicator contract (placeholder)
        const adjudicatorAddress = '0x0000000000000000000000000000000000000000'; // TODO: Get from Yellow Network

        // ABI encode settlement function call
        const iface = new ethers.Interface([
            'function settleChannel(bytes32 stateHash, bytes memory encodedState, bytes[] memory signatures)',
        ]);

        const calldata = iface.encodeFunctionData('settleChannel', [
            finalStateHash.stateHash,
            finalStateHash.encodedData,
            signatures,
        ]);

        return {
            to: adjudicatorAddress,
            data: calldata,
            value: '0',
        };
    }

    /**
     * Format settlement summary for logging
     */
    formatSettlementSummary(finalStateHash: FinalStateHash): string {
        const lines: string[] = [];
        lines.push('\n=== SETTLEMENT SUMMARY ===');
        lines.push(`Market ID: ${finalStateHash.rawState.marketId}`);
        lines.push(`App Session: ${finalStateHash.rawState.appSessionId}`);
        lines.push(`Winning Outcome: ${finalStateHash.rawState.winningOutcome}`);
        lines.push(`Total Pool: ${finalStateHash.rawState.totalPool.toFixed(2)} USDC`);
        lines.push(`Participants: ${finalStateHash.rawState.payouts.size}`);
        lines.push(`State Hash: ${finalStateHash.stateHash}`);
        lines.push(`Nonce: ${finalStateHash.rawState.nonce}`);
        lines.push('\n--- Payouts ---');

        finalStateHash.rawState.payouts.forEach((amount, address) => {
            lines.push(`${address}: ${amount.toFixed(2)} USDC`);
        });

        lines.push('=========================\n');
        return lines.join('\n');
    }
}

export default new FinalStateBuilder();
