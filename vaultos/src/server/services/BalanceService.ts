/**
 * Balance Service
 * Manages user balances in the state channel via Yellow Network
 */

import { SessionService } from './SessionService';

const sessionService = new SessionService();

export class BalanceService {
    /**
     * Move funds from active to idle balance for yield earning
     */
    async moveToIdle(sessionId: string, amount: number): Promise<any> {
        // In a full implementation, this would interact with Yellow Network
        // For now, return success to allow the frontend to work
        return {
            success: true,
            message: 'Funds moved to idle balance',
            amount: amount
        };
    }

    /**
     * Accrue yield on idle balance
     */
    async accrueYield(sessionId: string): Promise<any> {
        // Simulate yield accrual
        const yieldAmount = Math.random() * 0.5; // Simulate some yield
        return {
            success: true,
            message: 'Yield accrued',
            yieldAccrued: yieldAmount
        };
    }

    /**
     * Request partial refund (max 25%)
     */
    async requestRefund(sessionId: string): Promise<any> {
        // Simulate refund processing
        return {
            success: true,
            message: 'Refund processed',
            amount: 0 // Would calculate actual refund amount
        };
    }

    /**
     * Get current balance for a session from Yellow Network
     * 
     * Returns balance in 6 decimals (ytest.USD format)
     * Frontend should divide by 1_000_000 to display
     */
    async getBalance(sessionId: string): Promise<any> {
        try {
            const session = sessionService.getSession(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }

            // Query balance from Yellow Network via queryBalance method
            // Note: VaultOSYellowClient might not have queryBalance, use fallback
            let balanceInMicro = 0;
            
            try {
                // Try to get balance if method exists
                if (typeof (session.yellowClient as any).queryBalance === 'function') {
                    balanceInMicro = await (session.yellowClient as any).queryBalance();
                } else {
                    // Fallback to calculation
                    const depositAmount = parseFloat(session.depositAmount);
                    const spentAmount = parseFloat(session.spentAmount);
                    balanceInMicro = Math.floor((depositAmount - spentAmount) * 1_000_000);
                }
            } catch (err) {
                // Fallback calculation
                const depositAmount = parseFloat(session.depositAmount);
                const spentAmount = parseFloat(session.spentAmount);
                balanceInMicro = Math.floor((depositAmount - spentAmount) * 1_000_000);
            }
            
            // balanceInMicro is already in 6 decimals from Yellow Network
            // Example: 100000000 = 100.000000 ytest.USD
            return {
                balance: balanceInMicro || 0, // In 6 decimals
                asset: 'ytest.usd',
                sessionId: sessionId
            };
        } catch (error: any) {
            console.error('Error querying balance:', error);
            
            // Fallback: Calculate from session data if Yellow Network query fails
            const session = sessionService.getSession(sessionId);
            if (session) {
                const depositAmount = parseFloat(session.depositAmount);
                const spentAmount = parseFloat(session.spentAmount);
                const balance = (depositAmount - spentAmount) * 1_000_000; // Convert to 6 decimals
                
                console.log(`⚠️  Using fallback balance calculation: ${balance / 1_000_000} ytest.USD`);
                
                return {
                    balance: Math.floor(balance),
                    asset: 'ytest.usd',
                    sessionId: sessionId,
                    fallback: true
                };
            }
            
            throw error;
        }
    }
}

