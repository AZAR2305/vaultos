import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';

/**
 * Sui Settlement Service
 * 
 * Commits final market resolutions to Sui blockchain for:
 * - Transparent verification
 * - Trustless payout tracking
 * - On-chain settlement record
 */

export interface MarketSettlement {
  marketId: string;
  winningOutcome: 'YES' | 'NO';
  totalPool: number;
}

export class SuiSettlementService {
  private client: SuiClient;
  private keypair: Ed25519Keypair;
  private packageId: string;

  constructor() {
    // Initialize Sui client (testnet)
    this.client = new SuiClient({ url: getFullnodeUrl('testnet') });
    
    // Load admin keypair from environment
    const privateKey = process.env.SUI_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('SUI_PRIVATE_KEY not found in environment');
    }
    
    // Decode base64 private key to Uint8Array
    // Sui keystore format includes a 1-byte flag, so we skip it to get the raw 32-byte key
    const keyBytes = Buffer.from(privateKey, 'base64');
    const secretKey = keyBytes.slice(1); // Skip the flag byte
    this.keypair = Ed25519Keypair.fromSecretKey(secretKey);
    
    // Package ID (set after deployment)
    this.packageId = process.env.SUI_PACKAGE_ID || '';
    if (!this.packageId) {
      console.warn('⚠️ SUI_PACKAGE_ID not set - settlements will fail until contract is deployed');
    }
  }

  /**
   * Submit a market settlement to Sui blockchain
   */
  async submitSettlement(settlement: MarketSettlement): Promise<string> {
    if (!this.packageId) {
      throw new Error('Sui contract not deployed yet. Run: npm run sui:deploy');
    }

    try {
      const tx = new TransactionBlock();

      // Convert market ID to bytes
      const marketIdBytes = Array.from(Buffer.from(settlement.marketId));
      
      // Convert outcome to number (1 = YES, 0 = NO)
      const outcomeValue = settlement.winningOutcome === 'YES' ? 1 : 0;

      // Call the create_settlement function
      tx.moveCall({
        target: `${this.packageId}::prediction_settlement::create_settlement`,
        arguments: [
          tx.pure(marketIdBytes),
          tx.pure(outcomeValue),
          tx.pure(settlement.totalPool),
        ],
      });

      // Execute transaction
      const result = await this.client.signAndExecuteTransactionBlock({
        signer: this.keypair,
        transactionBlock: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      console.log('✅ Settlement submitted to Sui:', {
        digest: result.digest,
        marketId: settlement.marketId,
        outcome: settlement.winningOutcome,
      });

      return result.digest;
    } catch (error) {
      console.error('❌ Failed to submit settlement to Sui:', error);
      throw error;
    }
  }

  /**
   * Get settlement object for a market (for verification)
   */
  async getSettlement(objectId: string) {
    try {
      const object = await this.client.getObject({
        id: objectId,
        options: {
          showContent: true,
        },
      });

      return object;
    } catch (error) {
      console.error('Failed to fetch settlement:', error);
      throw error;
    }
  }

  /**
   * Get admin address (for funding)
   */
  getAdminAddress(): string {
    return this.keypair.getPublicKey().toSuiAddress();
  }
}

// Singleton instance
let suiSettlementService: SuiSettlementService | null = null;

export function getSuiSettlementService(): SuiSettlementService {
  if (!suiSettlementService) {
    suiSettlementService = new SuiSettlementService();
  }
  return suiSettlementService;
}
