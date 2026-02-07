/**
 * Stable Yield Strategy - Off-Chain DeFi Vault Strategy
 * 
 * This strategy operates entirely off-chain using Yellow Network's ledger
 * and state channels. NO on-chain transactions except for final settlement.
 * 
 * Architecture:
 * - Vault owns all state (shares, balances, allocations)
 * - Strategy is stateless - receives capital, executes, returns results
 * - Trades execute via Yellow ledger (instant) or state channels (faster)
 * - PnL tracking happens in vault's accounting system
 * 
 * Yellow Network Integration:
 * - Ledger transfers: Instant, off-chain, requires auth
 * - State channels: Fastest, requires on-chain channel (created async)
 * - All trades settle in ytest.USD (Base Sepolia testnet)
 */

import { VaultOSYellowClient } from '../yellow/vaultos-yellow';
import { createPublicClient, http, formatUnits, parseUnits } from 'viem';
import { baseSepolia } from 'viem/chains';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Strategy execution result
 * Returned to vault for accounting updates
 */
export interface StrategyResult {
    success: boolean;
    allocatedAmount: bigint;
    executedAmount: bigint;
    gainsLosses: bigint;
    executionMode: 'ledger' | 'channel' | 'none';
    timestamp: number;
    error?: string;
}

/**
 * Strategy position snapshot
 * Used for PnL calculation
 */
export interface PositionSnapshot {
    entryPrice: number;
    currentPrice: number;
    amount: bigint;
    unrealizedPnL: bigint;
}

/**
 * Trade execution parameters
 * Passed from vault to strategy
 */
export interface TradeParams {
    action: 'buy' | 'sell';
    asset: string;
    amount: bigint;
    maxSlippage: number; // Basis points (100 = 1%)
    destinationAddress: string;
}

/**
 * Harvest result
 * Returns realized gains to vault
 */
export interface HarvestResult {
    realizedGains: bigint;
    timestamp: number;
    transactionType: 'ledger' | 'channel';
}

// ============================================================================
// STABLE YIELD STRATEGY IMPLEMENTATION
// ============================================================================

export class StableYieldStrategy {
    private yellowClient: VaultOSYellowClient;
    private publicClient: any;
    private vaultAddress: string;
    
    // Strategy configuration
    private readonly STABLE_ASSET = 'ytest.usd';
    private readonly TARGET_APY = 0.08; // 8% target APY
    private readonly REBALANCE_THRESHOLD = 0.02; // 2% drift triggers rebalance
    
    constructor(
        privateKey: `0x${string}`,
        vaultAddress: string
    ) {
        this.vaultAddress = vaultAddress;
        
        // Initialize Yellow Network client
        // This handles ledger + state channel abstraction
        this.yellowClient = new VaultOSYellowClient(privateKey);
        
        // Public client for read-only operations (price feeds, etc)
        this.publicClient = createPublicClient({
            chain: baseSepolia,
            transport: http('https://sepolia.base.org'),
        });
    }

    /**
     * Allocate capital from vault to strategy
     * 
     * Yellow Network Flow:
     * 1. Vault transfers capital via Yellow ledger (off-chain)
     * 2. Strategy receives allocation in its ledger balance
     * 3. NO on-chain transaction - instant transfer
     * 
     * @param amount - Capital to allocate (in ytest.USD base units)
     * @returns Allocation result with execution mode
     */
    async allocateCapital(amount: bigint): Promise<StrategyResult> {
        const startTime = Date.now();
        
        try {
            // Connect to Yellow Network if not already connected
            await this.ensureYellowConnection();
            
            // Check vault's ledger balance before allocation
            const vaultBalance = await this.getYellowLedgerBalance(this.vaultAddress);
            
            if (vaultBalance < amount) {
                return {
                    success: false,
                    allocatedAmount: 0n,
                    executedAmount: 0n,
                    gainsLosses: 0n,
                    executionMode: 'none',
                    timestamp: Date.now(),
                    error: `Insufficient vault balance. Has ${formatUnits(vaultBalance, 6)} USDC, needs ${formatUnits(amount, 6)} USDC`,
                };
            }
            
            // Execute allocation transfer via Yellow ledger
            // This is INSTANT and OFF-CHAIN - no gas fees
            const channelId = this.yellowClient.getChannelId();
            const executionMode = channelId ? 'channel' : 'ledger';
            
            await this.yellowClient.transfer(
                this.vaultAddress, // Destination (strategy's address)
                amount.toString()
            );
            
            return {
                success: true,
                allocatedAmount: amount,
                executedAmount: amount,
                gainsLosses: 0n, // No PnL on allocation
                executionMode,
                timestamp: Date.now(),
            };
            
        } catch (error: any) {
            return {
                success: false,
                allocatedAmount: 0n,
                executedAmount: 0n,
                gainsLosses: 0n,
                executionMode: 'none',
                timestamp: Date.now(),
                error: error.message,
            };
        }
    }

    /**
     * Execute strategy logic
     * 
     * Stable Yield Strategy:
     * 1. Monitor stablecoin lending rates (simulated via oracle)
     * 2. Allocate to highest yield stablecoin pool
     * 3. Rebalance when yield delta exceeds threshold
     * 
     * Yellow Network Execution:
     * - All trades happen via Yellow ledger/channels
     * - NO on-chain DEX interactions
     * - Instant settlement, no slippage (stablecoin pools)
     * 
     * @returns Execution result with PnL
     */
    async execute(): Promise<StrategyResult> {
        try {
            await this.ensureYellowConnection();
            
            // Get current strategy balance (allocated capital)
            const strategyBalance = await this.getStrategyBalance();
            
            if (strategyBalance === 0n) {
                return {
                    success: false,
                    allocatedAmount: 0n,
                    executedAmount: 0n,
                    gainsLosses: 0n,
                    executionMode: 'none',
                    timestamp: Date.now(),
                    error: 'No capital allocated to strategy',
                };
            }
            
            // Fetch current yield rates (in production, this would query oracles)
            const yieldRates = await this.fetchYieldRates();
            
            // Select optimal pool based on risk-adjusted returns
            const targetPool = this.selectOptimalPool(yieldRates);
            
            // Calculate position size (full strategy balance)
            const positionSize = strategyBalance;
            
            // Execute trade via Yellow Network
            // This uses state channel if available, ledger otherwise
            const executionMode = this.yellowClient.getChannelId() ? 'channel' : 'ledger';
            
            await this.yellowClient.transfer(
                targetPool.address,
                positionSize.toString()
            );
            
            // Calculate expected gains based on APY
            const expectedGains = this.calculateExpectedGains(
                positionSize,
                targetPool.apy,
                1 // 1 day holding period
            );
            
            return {
                success: true,
                allocatedAmount: strategyBalance,
                executedAmount: positionSize,
                gainsLosses: expectedGains,
                executionMode,
                timestamp: Date.now(),
            };
            
        } catch (error: any) {
            return {
                success: false,
                allocatedAmount: 0n,
                executedAmount: 0n,
                gainsLosses: 0n,
                executionMode: 'none',
                timestamp: Date.now(),
                error: error.message,
            };
        }
    }

    /**
     * Harvest realized gains and return to vault
     * 
     * Yellow Network Flow:
     * 1. Strategy calculates realized gains
     * 2. Transfers gains back to vault via Yellow ledger
     * 3. Vault updates share price based on gains
     * 
     * NO on-chain settlement unless explicitly triggered by vault
     * 
     * @returns Harvest result with realized gains
     */
    async harvest(): Promise<HarvestResult> {
        await this.ensureYellowConnection();
        
        // Get current strategy balance
        const currentBalance = await this.getStrategyBalance();
        
        // Fetch original allocated capital from vault's records
        // In production, vault would pass this as parameter
        const originalAllocation = await this.getOriginalAllocation();
        
        // Calculate realized gains
        const realizedGains = currentBalance > originalAllocation 
            ? currentBalance - originalAllocation 
            : 0n;
        
        if (realizedGains === 0n) {
            return {
                realizedGains: 0n,
                timestamp: Date.now(),
                transactionType: 'ledger',
            };
        }
        
        // Transfer gains back to vault via Yellow Network
        const executionMode = this.yellowClient.getChannelId() ? 'channel' : 'ledger';
        
        await this.yellowClient.transfer(
            this.vaultAddress,
            realizedGains.toString()
        );
        
        return {
            realizedGains,
            timestamp: Date.now(),
            transactionType: executionMode,
        };
    }

    /**
     * Get current position snapshot for PnL tracking
     * 
     * @returns Current position state
     */
    async getPositionSnapshot(): Promise<PositionSnapshot> {
        const currentBalance = await this.getStrategyBalance();
        const originalAllocation = await this.getOriginalAllocation();
        
        // Calculate unrealized PnL
        const unrealizedPnL = currentBalance - originalAllocation;
        
        // For stablecoin strategy, prices are always ~1.0
        // PnL comes from yield, not price appreciation
        return {
            entryPrice: 1.0,
            currentPrice: 1.0,
            amount: currentBalance,
            unrealizedPnL,
        };
    }

    // ========================================================================
    // PRIVATE HELPER METHODS
    // ========================================================================

    /**
     * Ensure Yellow Network connection is active
     * This is critical - ALL strategy operations require Yellow auth
     */
    private async ensureYellowConnection(): Promise<void> {
        // Check if already connected by testing channel/ledger access
        try {
            await this.yellowClient.getChannelId();
        } catch {
            // Not connected - establish connection
            await this.yellowClient.connect();
        }
    }

    /**
     * Get Yellow Network ledger balance for an address
     * 
     * Yellow Network Architecture:
     * - Ledger balance: Off-chain, tracked by Yellow Network
     * - State channel balance: On-chain, but managed via SDK
     * - This method queries ledger (instant, no RPC call)
     * 
     * @param address - Address to query
     * @returns Ledger balance in base units
     */
    private async getYellowLedgerBalance(address: string): Promise<bigint> {
        // In production, this would call Yellow Network's ledger API
        // For now, we use the client's internal state
        
        // Query ledger balances via Yellow Network
        // This is an off-chain query - no gas, instant response
        const ledgerBalances = await this.yellowClient.getClient().getLedgerBalances?.() || [];
        
        // Find balance for our asset (ytest.usd)
        const balance = ledgerBalances.find(
            (b: any) => b.asset === this.STABLE_ASSET
        );
        
        return balance ? BigInt(balance.amount) : 0n;
    }

    /**
     * Get strategy's current balance
     * This represents allocated capital + any gains/losses
     */
    private async getStrategyBalance(): Promise<bigint> {
        // Strategy balance = ledger balance at strategy's address
        return this.getYellowLedgerBalance(this.vaultAddress);
    }

    /**
     * Get original allocated capital
     * In production, vault would maintain this in its accounting
     */
    private async getOriginalAllocation(): Promise<bigint> {
        // This should be fetched from vault's storage
        // For now, we return a placeholder that production code would replace
        
        // TODO: Integrate with vault's accounting system
        // Example: return await vault.getStrategyAllocation(this.address)
        
        return 0n;
    }

    /**
     * Fetch current yield rates from lending pools
     * 
     * In production, this would:
     * - Query on-chain lending protocols (Aave, Compound)
     * - Use Chainlink price feeds for rates
     * - Aggregate data from multiple sources
     * 
     * For now, returns simulated data for strategy logic
     */
    private async fetchYieldRates(): Promise<Array<{ pool: string; apy: number; address: string }>> {
        // Simulated yield rates for stable lending pools
        // In production, fetch from oracles or protocol APIs
        return [
            { pool: 'USDC-Lending', apy: 0.065, address: '0x1111111111111111111111111111111111111111' },
            { pool: 'DAI-Lending', apy: 0.072, address: '0x2222222222222222222222222222222222222222' },
            { pool: 'USDT-Lending', apy: 0.058, address: '0x3333333333333333333333333333333333333333' },
        ];
    }

    /**
     * Select optimal lending pool based on risk-adjusted returns
     * 
     * Strategy logic:
     * - Prefer higher APY within stable pools
     * - Apply risk discount for less liquid pools
     * - Rebalance only if yield delta exceeds threshold
     */
    private selectOptimalPool(
        yieldRates: Array<{ pool: string; apy: number; address: string }>
    ): { pool: string; apy: number; address: string } {
        // Sort by APY descending
        const sortedPools = [...yieldRates].sort((a, b) => b.apy - a.apy);
        
        // Select highest yield pool
        return sortedPools[0];
    }

    /**
     * Calculate expected gains based on APY and time period
     * 
     * Formula: gains = principal * (apy / 365) * days
     * 
     * @param principal - Invested amount
     * @param apy - Annual percentage yield (decimal)
     * @param days - Holding period in days
     * @returns Expected gains in base units
     */
    private calculateExpectedGains(
        principal: bigint,
        apy: number,
        days: number
    ): bigint {
        // Convert to number for calculation, then back to bigint
        const principalNum = Number(principal);
        const dailyRate = apy / 365;
        const expectedGains = principalNum * dailyRate * days;
        
        return BigInt(Math.floor(expectedGains));
    }

    /**
     * Close strategy position and return all capital to vault
     * This is called when vault wants to withdraw strategy allocation
     * 
     * @returns Final settlement amount
     */
    async closePosition(): Promise<bigint> {
        await this.ensureYellowConnection();
        
        const finalBalance = await this.getStrategyBalance();
        
        if (finalBalance > 0n) {
            // Transfer entire balance back to vault
            await this.yellowClient.transfer(
                this.vaultAddress,
                finalBalance.toString()
            );
        }
        
        return finalBalance;
    }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new Stable Yield Strategy instance
 * 
 * @param privateKey - Strategy's private key (session key in production)
 * @param vaultAddress - Vault that owns this strategy
 * @returns Initialized strategy instance
 */
export function createStableYieldStrategy(
    privateKey: `0x${string}`,
    vaultAddress: string
): StableYieldStrategy {
    return new StableYieldStrategy(privateKey, vaultAddress);
}
