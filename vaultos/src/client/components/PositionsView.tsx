/**
 * Positions View - Show user's current positions across all markets
 */
import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface Position {
  id: string;
  marketId: string;
  marketQuestion: string;
  outcome: 'YES' | 'NO';
  shares: number;
  totalCost: number;
  currentValue: number;
  pnl: number;
  marketStatus: string;
}

const PositionsView: React.FC = () => {
  const { address } = useAccount();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (address) {
      fetchPositions();
      
      // Refresh every 5 seconds
      const interval = setInterval(fetchPositions, 5000);
      return () => clearInterval(interval);
    }
  }, [address]);

  const fetchPositions = async () => {
    if (!address) return;

    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3000/api/positions/${address}`);
      
      if (response.ok) {
        const data = await response.json();
        setPositions(data.positions || []);
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load positions');
      }
    } catch (err) {
      console.error('Error fetching positions:', err);
      setError('Network error loading positions');
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async (position: Position) => {
    if (!address) return;

    const confirmed = window.confirm(
      `Request 25% refund for ${position.shares.toFixed(0)} ${position.outcome} shares?\n\nYou will receive: $${(position.currentValue * 0.25).toFixed(2)} USDC`
    );

    if (!confirmed) return;

    try {
      const response = await fetch('http://localhost:3000/api/positions/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId: position.marketId,
          userAddress: address,
          outcome: position.outcome
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ Refund successful!\n\nReceived: $${data.refund.refundAmount.toFixed(2)} USDC (25%)`);
        fetchPositions(); // Refresh positions
      } else {
        const errorData = await response.json();
        alert('❌ Refund failed: ' + errorData.error);
      }
    } catch (err) {
      console.error('Refund error:', err);
      alert('❌ Network error processing refund');
    }
  };

  const formatUSDC = (amount: number) => {
    return amount.toFixed(2);
  };

  const getPnLClass = (pnl: number) => {
    if (pnl > 0) return 'profit';
    if (pnl < 0) return 'loss';
    return 'neutral';
  };

  if (!address) {
    return (
      <div className="positions-container">
        <h2>📊 Your Positions</h2>
        <div className="empty-state">
          <p>Please connect your wallet to view positions</p>
        </div>
      </div>
    );
  }

  if (loading && positions.length === 0) {
    return (
      <div className="positions-container">
        <h2>📊 Your Positions</h2>
        <div className="loading-state">
          <p>Loading positions...</p>
        </div>
      </div>
    );
  }

  const totalPositionValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalCost = positions.reduce((sum, p) => sum + p.totalCost, 0);
  const totalPnL = totalPositionValue - totalCost;

  return (
    <div className="positions-container">
      <div className="positions-header">
        <h2>📊 Your Positions</h2>
        <button onClick={fetchPositions} className="btn-refresh">
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {positions.length === 0 ? (
        <div className="empty-state">
          <p>No positions yet. Start trading to see your positions here!</p>
          <p className="hint">💡 Buy YES or NO shares on any market to get started.</p>
        </div>
      ) : (
        <>
          {/* Summary Card */}
          <div className="positions-summary">
            <div className="summary-item">
              <span className="label">Total Markets:</span>
              <span className="value">{new Set(positions.map(p => p.marketId)).size}</span>
            </div>
            <div className="summary-item">
              <span className="label">Total Invested:</span>
              <span className="value">${formatUSDC(totalCost)} USDC</span>
            </div>
            <div className="summary-item">
              <span className="label">Current Value:</span>
              <span className="value">${formatUSDC(totalPositionValue)} USDC</span>
            </div>
            <div className="summary-item">
              <span className="label">Total P&L:</span>
              <span className={`value ${getPnLClass(totalPnL)}`}>
                {totalPnL >= 0 ? '+' : ''}${formatUSDC(totalPnL)} USDC
              </span>
            </div>
          </div>

          {/* Positions List */}
          <div className="positions-list">
            {positions.map((position) => (
              <div key={position.id} className="position-card">
                <div className="position-header">
                  <h3>{position.marketQuestion}</h3>
                  <span className={`badge ${position.marketStatus.toLowerCase()}`}>
                    {position.marketStatus}
                  </span>
                </div>

                <div className="position-details">
                  <div className="detail-row">
                    <span className="detail-label">Position:</span>
                    <span className={`outcome-badge ${position.outcome.toLowerCase()}`}>
                      {position.outcome}
                    </span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Shares:</span>
                    <span className="detail-value">{position.shares.toFixed(0)}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Cost Basis:</span>
                    <span className="detail-value">${formatUSDC(position.totalCost)}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Current Value:</span>
                    <span className="detail-value">${formatUSDC(position.currentValue)}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">P&L:</span>
                    <span className={`detail-value ${getPnLClass(position.pnl)}`}>
                      {position.pnl >= 0 ? '+' : ''}${formatUSDC(position.pnl)}
                      {' '}
                      ({((position.pnl / position.totalCost) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>

                {position.marketStatus === 'OPEN' && (
                  <div className="position-actions" style={{ marginTop: '15px', textAlign: 'right' }}>
                    <button 
                      onClick={() => handleRefund(position)}
                      className="btn-refund"
                      style={{
                        padding: '8px 16px',
                        background: '#FFD700',
                        color: '#000',
                        border: '2px solid #FFD700',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontFamily: 'Space Mono, monospace',
                        textTransform: 'uppercase',
                        fontSize: '0.85rem'
                      }}
                      title="Get 25% of your position value back"
                    >
                      [ REQUEST 25% REFUND ]
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default PositionsView;
