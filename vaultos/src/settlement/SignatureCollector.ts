/**
 * SignatureCollector.ts
 * 
 * Collects cryptographic signatures from market participants
 * Required for multi-party state channel settlement on Yellow Network
 * 
 * Process:
 * 1. Market resolves → final state hash created
 * 2. Server requests signature from each participant
 * 3. Participants sign EIP-712 message with session key
 * 4. Server collects all signatures
 * 5. When threshold reached → submit to Yellow Network
 * 
 * Authority: All participants must sign to finalize settlement
 * 
 * Phase: Phase 4 - Settlement Flow
 */

import { ethers } from 'ethers';
import * as WebSocket from 'ws';
import { FinalStateHash } from './FinalStateBuilder';

type WebSocketServer = WebSocket.Server;

export interface SignatureRequest {
    marketId: string;
    stateHash: string;
    deadline: number; // Timestamp when request expires
    requiredSigners: string[]; // Addresses that must sign
}

export interface SignatureResponse {
    marketId: string;
    stateHash: string;
    signer: string; // Address of signer
    signature: string; // EIP-712 signature
    timestamp: number;
}

export interface CollectionStatus {
    marketId: string;
    totalRequired: number;
    collected: number;
    missing: string[];
    complete: boolean;
}

export class SignatureCollector {
    private pendingRequests: Map<string, SignatureRequest> = new Map(); // marketId -> request
    private collectedSignatures: Map<string, SignatureResponse[]> = new Map(); // marketId -> signatures
    private wss?: WebSocketServer;

    constructor(wss?: WebSocketServer) {
        this.wss = wss;
    }

    /**
     * Request signatures from all participants
     * Broadcasts via WebSocket to connected clients
     */
    requestSignatures(
        finalStateHash: FinalStateHash,
        participants: string[], // Addresses of all market participants
        deadlineMinutes: number = 30
    ): SignatureRequest {
        const request: SignatureRequest = {
            marketId: finalStateHash.rawState.marketId,
            stateHash: finalStateHash.stateHash,
            deadline: Date.now() + (deadlineMinutes * 60 * 1000),
            requiredSigners: participants,
        };

        this.pendingRequests.set(request.marketId, request);
        this.collectedSignatures.set(request.marketId, []);

        // Broadcast signature request via WebSocket
        if (this.wss) {
            const message = JSON.stringify({
                type: 'signature_request',
                data: {
                    marketId: request.marketId,
                    stateHash: request.stateHash,
                    deadline: request.deadline,
                    message: 'Please sign to finalize settlement',
                },
            });

            this.wss.clients.forEach((client: WebSocket.WebSocket) => {
                if (client.readyState === 1) { // WebSocket.OPEN
                    client.send(message);
                }
            });
        }

        console.log(`📝 Signature request broadcast for market: ${request.marketId}`);
        console.log(`   Required signers: ${participants.length}`);
        console.log(`   Deadline: ${new Date(request.deadline).toISOString()}`);

        return request;
    }

    /**
     * Submit a signature from a participant
     * Called when frontend/client submits signed state hash
     */
    submitSignature(response: SignatureResponse): {
        accepted: boolean;
        reason?: string;
        status: CollectionStatus;
    } {
        const request = this.pendingRequests.get(response.marketId);
        if (!request) {
            return {
                accepted: false,
                reason: 'No pending signature request for this market',
                status: this.getCollectionStatus(response.marketId),
            };
        }

        // Check deadline
        if (Date.now() > request.deadline) {
            return {
                accepted: false,
                reason: 'Signature request expired',
                status: this.getCollectionStatus(response.marketId),
            };
        }

        // Check if signer is required
        if (!request.requiredSigners.includes(response.signer)) {
            return {
                accepted: false,
                reason: 'Signer not required for this market',
                status: this.getCollectionStatus(response.marketId),
            };
        }

        // Check if already signed
        const existing = this.collectedSignatures.get(response.marketId) || [];
        if (existing.some(sig => sig.signer === response.signer)) {
            return {
                accepted: false,
                reason: 'Already submitted signature',
                status: this.getCollectionStatus(response.marketId),
            };
        }

        // Verify signature
        const isValid = this.verifySignature(response, request.stateHash);
        if (!isValid) {
            return {
                accepted: false,
                reason: 'Invalid signature',
                status: this.getCollectionStatus(response.marketId),
            };
        }

        // Add signature
        existing.push(response);
        this.collectedSignatures.set(response.marketId, existing);

        const status = this.getCollectionStatus(response.marketId);
        console.log(`✅ Signature collected: ${response.signer.slice(0, 10)}... | Market: ${response.marketId} | Progress: ${status.collected}/${status.totalRequired}`);

        // Broadcast progress update
        if (this.wss) {
            const message = JSON.stringify({
                type: 'signature_progress',
                data: status,
            });

            this.wss.clients.forEach((client: WebSocket.WebSocket) => {
                if (client.readyState === 1) { // WebSocket.OPEN
                    client.send(message);
                }
            });
        }

        return {
            accepted: true,
            status,
        };
    }

    /**
     * Verify signature against state hash
     */
    private verifySignature(response: SignatureResponse, expectedStateHash: string): boolean {
        try {
            // Recover signer from signature
            const messageHash = ethers.keccak256(
                ethers.toUtf8Bytes(expectedStateHash)
            );
            const recoveredAddress = ethers.verifyMessage(
                ethers.getBytes(messageHash),
                response.signature
            );

            // Check if recovered address matches claimed signer
            return recoveredAddress.toLowerCase() === response.signer.toLowerCase();
        } catch (error) {
            console.error('❌ Signature verification failed:', error);
            return false;
        }
    }

    /**
     * Get collection status for a market
     */
    getCollectionStatus(marketId: string): CollectionStatus {
        const request = this.pendingRequests.get(marketId);
        if (!request) {
            return {
                marketId,
                totalRequired: 0,
                collected: 0,
                missing: [],
                complete: false,
            };
        }

        const collected = this.collectedSignatures.get(marketId) || [];
        const collectedAddresses = new Set(collected.map(sig => sig.signer.toLowerCase()));
        const missing = request.requiredSigners.filter(
            addr => !collectedAddresses.has(addr.toLowerCase())
        );

        return {
            marketId,
            totalRequired: request.requiredSigners.length,
            collected: collected.length,
            missing,
            complete: collected.length >= request.requiredSigners.length,
        };
    }

    /**
     * Get all collected signatures for a market
     * Returns null if not all signatures collected
     */
    getSignatures(marketId: string): string[] | null {
        const status = this.getCollectionStatus(marketId);
        if (!status.complete) {
            return null;
        }

        const signatures = this.collectedSignatures.get(marketId) || [];
        return signatures.map(sig => sig.signature);
    }

    /**
     * Check if collection is complete and ready for settlement
     */
    isReadyForSettlement(marketId: string): boolean {
        const status = this.getCollectionStatus(marketId);
        return status.complete && Date.now() <= (this.pendingRequests.get(marketId)?.deadline || 0);
    }

    /**
     * Cancel signature request (e.g., if resolution is disputed)
     */
    cancelRequest(marketId: string, reason: string): void {
        this.pendingRequests.delete(marketId);
        this.collectedSignatures.delete(marketId);

        if (this.wss) {
            const message = JSON.stringify({
                type: 'signature_request_cancelled',
                data: { marketId, reason },
            });

            this.wss.clients.forEach((client: WebSocket.WebSocket) => {
                if (client.readyState === 1) { // WebSocket.OPEN
                    client.send(message);
                }
            });
        }

        console.log(`❌ Signature request cancelled: ${marketId} | Reason: ${reason}`);
    }

    /**
     * Clean up expired requests
     */
    cleanupExpired(): number {
        const now = Date.now();
        let cleaned = 0;

        this.pendingRequests.forEach((request, marketId) => {
            if (now > request.deadline) {
                console.warn(`⚠️ Signature request expired: ${marketId}`);
                this.pendingRequests.delete(marketId);
                cleaned++;
            }
        });

        return cleaned;
    }

    /**
     * Get all pending signature requests
     */
    getPendingRequests(): SignatureRequest[] {
        return Array.from(this.pendingRequests.values());
    }

    /**
     * Get summary of collection progress
     */
    getSummary(): {
        totalPending: number;
        totalComplete: number;
        markets: { marketId: string; status: CollectionStatus }[];
    } {
        const markets = Array.from(this.pendingRequests.keys()).map(marketId => ({
            marketId,
            status: this.getCollectionStatus(marketId),
        }));

        return {
            totalPending: markets.filter(m => !m.status.complete).length,
            totalComplete: markets.filter(m => m.status.complete).length,
            markets,
        };
    }
}

export default new SignatureCollector();
