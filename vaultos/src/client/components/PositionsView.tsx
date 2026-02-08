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

interface PositionsViewProps {
  session?: any; // Session object with sessionId
}

const PositionsView: React.FC<PositionsViewProps> = ({ session }) => {
  const { address } = useAccount();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refundSuccess, setRefundSuccess] = useState('');
  const [refundError, setRefundError] = useState('');

  useEffect(() => {
    if (address) {
      fetchPositions();
      
      // Refresh every 5 seconds
      const interval = setInterval(fetchPositions, 5000);
      return () => clearInterval(interval);
    } else {
      // Clear positions when wallet disconnects
      setPositions([]);
      setLoading(false);
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
    setRefundError('');
    setRefundSuccess('');
    
    if (!address || !session || !session.sessionId) {
      setRefundError('Please connect your wallet and create a session first');
      return;
    }

    const refundAmount = position.totalCost * 0.25; // 25% of original cost
    const penalty = position.totalCost * 0.75; // 75% penalty

    const confirmed = window.confirm(
      `Request 25% refund for ${position.shares.toFixed(0)} ${position.outcome} shares?\n\nOriginal cost: $${position.totalCost.toFixed(2)} ytest.USD\nYou will receive: $${refundAmount.toFixed(2)} ytest.USD (25%)\nPenalty: $${penalty.toFixed(2)} ytest.USD (75% stays in pool)\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const response = await fetch('http://localhost:3000/api/trade/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          marketId: position.marketId,
          outcome: position.outcome
        })
      });

      if (response.ok) {
        const data = await response.json();
        setRefundSuccess(`Refund successful! Received: $${data.refund.refundAmount.toFixed(2)} ytest.USD (25%). Penalty: $${data.refund.penalty.toFixed(2)} ytest.USD (75%). ${data.message}`);
        fetchPositions(); // Refresh positions
        
        // Clear success message after 5 seconds
        setTimeout(() => setRefundSuccess(''), 5000);
      } else {
        const errorData = await response.json();
        setRefundError('Refund failed: ' + errorData.error);
      }
    } catch (err) {
      console.error('Refund error:', err);
      setRefundError('Network error processing refund');
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

      {refundSuccess && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid #22c55e',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '20px',
          color: '#22c55e',
          fontSize: '0.9rem'
        }}>
          ✅ {refundSuccess}
        </div>
      )}

      {refundError && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '20px',
          color: '#ef4444',
          fontSize: '0.9rem'
        }}>
          ❌ {refundError}
        </div>
      )}

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
              <span className="value">${formatUSDC(totalCost)} ytest.USD</span>
            </div>
            <div className="summary-item">
              <span className="label">Current Value:</span>
              <span className="value">${formatUSDC(totalPositionValue)} ytest.USD</span>
            </div>
            <div className="summary-item">
              <span className="label">Total P&L:</span>
              <span className={`value ${getPnLClass(totalPnL)}`}>
                {totalPnL >= 0 ? '+' : ''}${formatUSDC(totalPnL)} ytest.USD
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

                {/* WIN/LOSS/REFUND CALCULATIONS */}
                <div style={{ 
                  marginTop: '20px', 
                  padding: '15px', 
                  background: 'rgba(255, 215, 0, 0.05)',
                  border: '1px solid rgba(255, 215, 0, 0.2)',
                  borderRadius: '4px'
                }}>
                  <h4 style={{ 
                    color: 'var(--accent-retro)', 
                    fontSize: '0.9rem', 
                    marginBottom: '12px',
                    fontFamily: 'Space Mono, monospace',
                    textTransform: 'uppercase'
                  }}>
                    [ PAYOUT SCENARIOS ]
                  </h4>
                  
                  <div style={{ fontSize: '0.85rem', lineHeight: '1.8' }}>
                    {/* WIN SCENARIO */}
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ color: '#4ade80', fontWeight: 'bold', marginBottom: '4px' }}>
                        ✅ IF YOU WIN (Market resolves to {position.outcome}):
                      </div>
                      <div style={{ paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                        <div>• You get: ${position.shares.toFixed(2)} ytest.USD (full payout)</div>
                        <div>• Profit: <span style={{ color: '#4ade80', fontWeight: 'bold' }}>+${(position.shares - position.totalCost).toFixed(2)} ytest.USD</span></div>
                        <div>• Return: <span style={{ color: '#4ade80' }}>+{(((position.shares - position.totalCost) / position.totalCost) * 100).toFixed(1)}%</span></div>
                      </div>
                    </div>

                    {/* LOSE SCENARIO */}
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ color: '#ef4444', fontWeight: 'bold', marginBottom: '4px' }}>
                        ❌ IF YOU LOSE (Market resolves to {position.outcome === 'YES' ? 'NO' : 'YES'}):
                      </div>
                      <div style={{ paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                        <div>• You get: $0.00 ytest.USD</div>
                        <div>• Loss: <span style={{ color: '#ef4444', fontWeight: 'bold' }}>-${position.totalCost.toFixed(2)} ytest.USD</span></div>
                        <div>• Return: <span style={{ color: '#ef4444' }}>-100%</span></div>
                      </div>
                    </div>

                    {/* REFUND SCENARIO */}
                    {position.marketStatus === 'active' && (
                      <div>
                        <div style={{ color: 'var(--accent-retro)', fontWeight: 'bold', marginBottom: '4px' }}>
                          💰 IF YOU REFUND NOW (25% early exit):
                        </div>
                        <div style={{ paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                          <div>• Original cost: ${position.totalCost.toFixed(2)} ytest.USD</div>
                          <div>• Refund (25%): <span style={{ color: 'var(--accent-retro)', fontWeight: 'bold' }}>${(position.totalCost * 0.25).toFixed(2)} ytest.USD</span></div>
                          <div>• Penalty (75%): <span style={{ color: '#ef4444' }}>-${(position.totalCost * 0.75).toFixed(2)} ytest.USD stays in pool</span></div>
                          <div>• Net loss: <span style={{ color: '#ef4444' }}>-${(position.totalCost * 0.75).toFixed(2)} ytest.USD</span></div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>
                            ℹ️ Refund available only while market is ACTIVE
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {position.marketStatus === 'active' && (
                  <div className="position-actions" style={{ marginTop: '15px', textAlign: 'right' }}>
                    <button 
                      onClick={() => handleRefund(position)}
                      className="btn-refund"
                      style={{
                        padding: '8px 16px',
                        background: session && session.sessionId ? '#FFD700' : '#666',
                        color: '#000',
                        border: session && session.sessionId ? '2px solid #FFD700' : '2px solid #666',
                        borderRadius: '4px',
                        cursor: session && session.sessionId ? 'pointer' : 'not-allowed',
                        fontWeight: 'bold',
                        fontFamily: 'Space Mono, monospace',
                        textTransform: 'uppercase',
                        fontSize: '0.85rem',
                        opacity: session && session.sessionId ? 1 : 0.5
                      }}
                      title={session && session.sessionId ? "Get 25% of your original cost back" : "Connect wallet and create session first"}
                      disabled={!session || !session.sessionId}
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
