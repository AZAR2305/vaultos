import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface Balance {
  active: number;
  idle: number;
  yield: number;
  total: number;
}

interface Position {
  marketId: string;
  yesShares: number;
  noShares: number;
  invested: number;
}

const BalanceDisplayNew: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isConnected && address) {
      const sessionData = localStorage.getItem(`session_${address}`);
      if (sessionData) {
        loadBalance();
      }
    }
  }, [address, isConnected]);

  const loadBalance = async () => {
    if (!address) return;
    
    const sessionData = localStorage.getItem(`session_${address}`);
    if (!sessionData) return;

    const session = JSON.parse(sessionData);
    
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:3000/api/state/${session.sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setBalance(data.state.balances);
        setPositions(data.state.positions || []);
      }
    } catch (err) {
      console.error('Error loading balance:', err);
    } finally {
      setLoading(false);
    }
  };

  const moveToIdle = async () => {
    const amount = prompt('Enter amount to move to idle (earns 5% APR):');
    if (!amount || !address) return;

    const sessionData = localStorage.getItem(`session_${address}`);
    if (!sessionData) return;

    const session = JSON.parse(sessionData);

    try {
      const response = await fetch('/api/balance/move-to-idle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          amount: parseFloat(amount),
        }),
      });

      if (response.ok) {
        loadBalance();
      }
    } catch (err) {
      console.error('Error moving to idle:', err);
    }
  };

  const requestRefund = async () => {
    if (!confirm('Request partial refund (max 25%)? You will NOT be able to trade anymore after refund.')) return;
    if (!address) return;

    const sessionData = localStorage.getItem(`session_${address}`);
    if (!sessionData) return;

    const session = JSON.parse(sessionData);

    try {
      const response = await fetch('/api/balance/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Refund successful: ${data.refundAmount} USDC. You can no longer trade with this session.`);
        
        // Mark session as refunded
        const updatedSession = { ...session, hasRefunded: true };
        localStorage.setItem(`session_${address}`, JSON.stringify(updatedSession));
        
        loadBalance();
      }
    } catch (err) {
      console.error('Error requesting refund:', err);
    }
  };

  if (!isConnected) {
    return null;
  }

  return (
    <div className="balance-display">
      <h2>Balance</h2>

      {loading ? (
        <p>Loading...</p>
      ) : balance ? (
        <>
          <div className="balance-card">
            <div className="balance-item">
              <span>Active:</span>
              <strong>${balance.active.toFixed(2)}</strong>
            </div>
            <div className="balance-item">
              <span>Idle (5% APR):</span>
              <strong>${balance.idle.toFixed(2)}</strong>
            </div>
            <div className="balance-item">
              <span>Yield Earned:</span>
              <strong>${balance.yield.toFixed(2)}</strong>
            </div>
            <div className="balance-total">
              <span>Total:</span>
              <strong>${balance.total.toFixed(2)}</strong>
            </div>
          </div>

          <div className="balance-actions">
            <button onClick={moveToIdle} className="btn btn-secondary btn-sm">
              Move to Idle
            </button>
            <button onClick={requestRefund} className="btn btn-secondary btn-sm">
              Request Refund
            </button>
            <button onClick={loadBalance} className="btn btn-secondary btn-sm">
              Refresh
            </button>
          </div>

          {positions.length > 0 && (
            <div className="positions">
              <h3>Positions</h3>
              {positions.map((pos, idx) => (
                <div key={idx} className="position-item">
                  <p><strong>Market:</strong> {pos.marketId.slice(0, 15)}...</p>
                  <p>YES: {pos.yesShares} | NO: {pos.noShares}</p>
                  <p>Invested: ${pos.invested.toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="info-message">Create a session to view balance</p>
      )}
    </div>
  );
};

export default BalanceDisplayNew;
