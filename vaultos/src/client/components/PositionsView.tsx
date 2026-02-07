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
      const response = await fetch(`/api/positions/${address}`);
      
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
              </div>
            ))}
          </div>
        </>
      )}

      <style jsx>{`
        .positions-container {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .positions-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .btn-refresh {
          padding: 8px 16px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .btn-refresh:hover {
          background: #45a049;
        }

        .positions-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 30px;
          padding: 20px;
          background: #f5f5f5;
          border-radius: 8px;
        }

        .summary-item {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .summary-item .label {
          font-size: 0.9em;
          color: #666;
        }

        .summary-item .value {
          font-size: 1.2em;
          font-weight: bold;
        }

        .positions-list {
          display: grid;
          gap: 20px;
        }

        .position-card {
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .position-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 15px;
          padding-bottom: 15px;
          border-bottom: 1px solid #eee;
        }

        .position-header h3 {
          margin: 0;
          font-size: 1.1em;
          flex: 1;
        }

        .badge {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 0.85em;
          font-weight: 600;
          text-transform: uppercase;
        }

        .badge.active {
          background: #4CAF50;
          color: white;
        }

        .badge.frozen, .badge.resolved {
          background: #FF9800;
          color: white;
        }

        .badge.settled {
          background: #9E9E9E;
          color: white;
        }

        .position-details {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .detail-label {
          color: #666;
          font-size: 0.95em;
        }

        .detail-value {
          font-weight: 600;
        }

        .outcome-badge {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 0.9em;
          font-weight: 600;
        }

        .outcome-badge.yes {
          background: #4CAF50;
          color: white;
        }

        .outcome-badge.no {
          background: #f44336;
          color: white;
        }

        .profit {
          color: #4CAF50;
        }

        .loss {
          color: #f44336;
        }

        .neutral {
          color: #666;
        }

        .empty-state, .loading-state {
          text-align: center;
          padding: 60px 20px;
          color: #666;
        }

        .hint {
          margin-top: 10px;
          font-size: 0.9em;
          color: #999;
        }

        .error-message {
          padding: 12px;
          background: #ffebee;
          border: 1px solid #ef5350;
          border-radius: 4px;
          color: #c62828;
          margin-bottom: 20px;
        }
      `}</style>
    </div>
  );
};

export default PositionsView;
