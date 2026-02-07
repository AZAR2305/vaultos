import React, { useState } from 'react';
import { useAccount } from 'wagmi';

interface Balance {
  active: number;
  idle: number;
  yield: number;
  total: number;
}

// MOCK BALANCE DATA
const MOCK_BALANCE: Balance = {
  active: 750.00,
  idle: 200.00,
  yield: 2.45,
  total: 952.45
};

const BalanceDisplay: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [balance] = useState<Balance>(MOCK_BALANCE);

  return (
    <div className="balance-display">
      <h2>[ BALANCE_INFO ]</h2>
      
      <div style={{ padding: '20px' }}>
        {!isConnected ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>
            {'> Connect wallet to view balance'}
          </p>
        ) : (
          <>
            <div className="balance-card">
              <div className="balance-item">
                <span>ACTIVE TRADING:</span>
                <strong>${balance.active.toFixed(2)}</strong>
              </div>
              <div className="balance-item">
                <span>IDLE (5% APR):</span>
                <strong>${balance.idle.toFixed(2)}</strong>
              </div>
              <div className="balance-item">
                <span>YIELD EARNED:</span>
                <strong style={{ color: '#4ade80' }}>+${balance.yield.toFixed(2)}</strong>
              </div>
              <div className="balance-total">
                <span>TOTAL:</span>
                <strong>${balance.total.toFixed(2)}</strong>
              </div>
            </div>

            <div className="balance-actions">
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => alert('Mock: Move funds to idle (earns 5% APR)')}
              >
                [MOVE TO IDLE]
              </button>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => alert('Mock: Request partial refund (max 25%)')}
              >
                [REQUEST REFUND]
              </button>
            </div>

            <div className="positions">
              <h3>POSITIONS</h3>
              <div className="position-item">
                <p style={{ marginBottom: '5px' }}>
                  <strong style={{ color: 'var(--accent-retro)' }}>BTC $150K Market</strong>
                </p>
                <p>YES: 100 shares @ $0.62</p>
                <p>Invested: $62.00</p>
              </div>
              <div className="position-item">
                <p style={{ marginBottom: '5px' }}>
                  <strong style={{ color: 'var(--accent-retro)' }}>ETH Upgrade Market</strong>
                </p>
                <p>YES: 50 shares @ $0.78</p>
                <p>Invested: $39.00</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BalanceDisplay;
