import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface Market {
  id: string;
  question: string;
  description: string;
  status: string;
  endTime: number;
  totalVolume: string;
  channelId: string;
  odds: {
    YES: string;
    NO: string;
  };
}

interface Position {
  marketId: string;
  outcome: 'YES' | 'NO';
  shares: string;
  avgPrice: number;
}

const MarketDashboard: React.FC = () => {
  const { address, isConnected } = useAccount();
  const ADMIN_WALLET = '0xFefa60F5aA4069F96b9Bf65c814DDb3A604974e1';
  const isAdmin = address?.toLowerCase() === ADMIN_WALLET.toLowerCase();

  const [markets, setMarkets] = useState<Market[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);

  // Create market form
  const [newMarket, setNewMarket] = useState({
    question: '',
    description: '',
    durationMinutes: 60,
    initialLiquidity: 1000000, // 1 USDC in microunits
  });

  // Trade form
  const [tradeForm, setTradeForm] = useState({
    outcome: 'YES' as 'YES' | 'NO',
    amount: '',
  });

  // Load session
  useEffect(() => {
    if (address) {
      const sessionData = localStorage.getItem(`session_${address}`);
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        console.log('📂 Session loaded from localStorage:', parsed);
        setSession(parsed);
      } else {
        console.log('⚠️ No session found in localStorage for', address);
      }
    }
  }, [address]);

  // Load markets
  useEffect(() => {
    loadMarkets();
    const interval = setInterval(loadMarkets, 3000);
    return () => clearInterval(interval);
  }, []);

  // Load positions
  useEffect(() => {
    if (address) {
      loadPositions();
      const interval = setInterval(loadPositions, 5000);
      return () => clearInterval(interval);
    }
  }, [address]);

  const loadMarkets = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/market');
      if (response.ok) {
        const data = await response.json();
        setMarkets(data.markets || []);
      }
    } catch (err) {
      console.error('Error loading markets:', err);
    }
  };

  const loadPositions = async () => {
    if (!address) return;
    // TODO: Implement position loading from backend
    // For now, use localStorage
    const storedPositions = localStorage.getItem(`positions_${address}`);
    if (storedPositions) {
      setPositions(JSON.parse(storedPositions));
    }
  };

  const createMarket = async () => {
    if (!isAdmin) {
      alert('Only admin can create markets');
      return;
    }

    if (!newMarket.question.trim()) {
      alert('Please enter a market question');
      return;
    }

    console.log('🔍 Current session state:', session);
    
    if (!session || !session.sessionId) {
      alert('Please create a Yellow Network session first (check sidebar).\n\nTip: Click "Start Trading Session" to create one.');
      console.error('❌ No session found. Current session:', session);
      return;
    }

    console.log('✅ Session found, creating market with:', {
      sessionId: session.sessionId,
      channelId: session.channelId
    });

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/market/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          channelId: session.channelId,
          question: newMarket.question,
          description: newMarket.description,
          durationMinutes: newMarket.durationMinutes,
          initialLiquidity: newMarket.initialLiquidity / 1_000_000, // Convert to USDC
          creatorAddress: address,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Market created successfully!\nID: ${data.id}`);
        setNewMarket({
          question: '',
          description: '',
          durationMinutes: 60,
          initialLiquidity: 1000000,
        });
        loadMarkets();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error || 'Failed to create market'}`);
      }
    } catch (err) {
      console.error('Error creating market:', err);
      alert('Error creating market. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const executeTrade = async (marketId: string) => {
    if (!address) {
      alert('Please connect your wallet');
      return;
    }

    if (!tradeForm.amount || parseFloat(tradeForm.amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const amountMicro = Math.floor(parseFloat(tradeForm.amount) * 1_000_000);
      
      const response = await fetch(`http://localhost:3000/api/market/${marketId}/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          amount: tradeForm.amount,
          position: tradeForm.outcome,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Trade successful!\nShares: ${data.bet?.shares || 'N/A'}`);
        setTradeForm({ outcome: 'YES', amount: '' });
        loadMarkets();
        loadPositions();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error || 'Failed to execute trade'}`);
      }
    } catch (err) {
      console.error('Error executing trade:', err);
      alert('Error executing trade. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculateOdds = (market: Market) => {
    // Backend sends authoritative prices (0-1 range)
    const yesPrice = market.yesPrice || 0.5;
    const noPrice = market.noPrice || 0.5;
    
    // Convert to percentages
    return {
      yes: Math.round(yesPrice * 100),
      no: Math.round(noPrice * 100),
    };
  };

  const formatTimeRemaining = (endTime: number) => {
    const now = Date.now();
    const remaining = endTime - now;
    
    if (remaining <= 0) return 'Ended';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) return `${Math.floor(hours / 24)}d remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  return (
    <div className="market-dashboard">
      <style>{`
        .market-dashboard {
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .dashboard-header {
          margin-bottom: 30px;
        }

        .dashboard-header h2 {
          font-size: 32px;
          margin-bottom: 10px;
          color: #1a1a1a;
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-top: 20px;
        }

        .stat-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .stat-label {
          font-size: 14px;
          opacity: 0.9;
          margin-bottom: 5px;
        }

        .stat-value {
          font-size: 28px;
          font-weight: bold;
        }

        .admin-panel {
          background: #f8f9fa;
          border: 2px solid #dee2e6;
          border-radius: 12px;
          padding: 25px;
          margin-bottom: 30px;
        }

        .admin-panel h3 {
          margin-top: 0;
          color: #495057;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .form-group {
          margin-bottom: 15px;
        }

        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #495057;
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 10px;
          border: 1px solid #ced4da;
          border-radius: 6px;
          font-size: 14px;
        }

        .form-group textarea {
          min-height: 80px;
          resize: vertical;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }

        .btn-create {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
          margin-top: 10px;
        }

        .btn-create:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-create:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .markets-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }

        .market-card {
          background: white;
          border: 1px solid #dee2e6;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          transition: all 0.3s ease;
        }

        .market-card:hover {
          border-color: #667eea;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
        }

        .market-card.selected {
          border-color: #667eea;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25);
        }

        .market-question {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #1a1a1a;
        }

        .market-description {
          font-size: 14px;
          color: #6c757d;
          margin-bottom: 15px;
        }

        .market-status {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 15px;
        }

        .market-status.open {
          background: #d4edda;
          color: #155724;
        }

        .market-status.closed {
          background: #f8d7da;
          color: #721c24;
        }

        .odds-display {
          display: flex;
          gap: 10px;
          margin-bottom: 15px;
        }

        .odds-option {
          flex: 1;
          padding: 15px;
          border-radius: 8px;
          text-align: center;
        }

        .odds-option.yes {
          background: #d4edda;
          border: 2px solid #28a745;
        }

        .odds-option.no {
          background: #f8d7da;
          border: 2px solid #dc3545;
        }

        .odds-label {
          font-weight: 600;
          margin-bottom: 5px;
        }

        .odds-value {
          font-size: 24px;
          font-weight: bold;
        }

        .trade-section {
          border-top: 1px solid #dee2e6;
          padding-top: 15px;
          margin-top: 15px;
        }

        .outcome-selector {
          display: flex;
          gap: 10px;
          margin-bottom: 10px;
        }

        .outcome-btn {
          flex: 1;
          padding: 10px;
          border: 2px solid #dee2e6;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
        }

        .outcome-btn.selected.yes {
          border-color: #28a745;
          background: #d4edda;
          color: #155724;
        }

        .outcome-btn.selected.no {
          border-color: #dc3545;
          background: #f8d7da;
          color: #721c24;
        }

        .btn-trade {
          width: 100%;
          padding: 12px;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 10px;
        }

        .btn-trade.yes {
          background: #28a745;
          color: white;
        }

        .btn-trade.no {
          background: #dc3545;
          color: white;
        }

        .btn-trade:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .btn-trade:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .positions-section {
          background: white;
          border: 1px solid #dee2e6;
          border-radius: 12px;
          padding: 25px;
        }

        .positions-section h3 {
          margin-top: 0;
          color: #495057;
        }

        .position-item {
          padding: 15px;
          border-bottom: 1px solid #dee2e6;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .position-item:last-child {
          border-bottom: none;
        }

        .empty-state {
          text-align: center;
          padding: 40px;
          color: #6c757d;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: #6c757d;
        }
      `}</style>

      <div className="dashboard-header">
        <h2>🎯 Prediction Markets Dashboard</h2>
        <p>Trade on outcomes with instant settlement via Yellow Network state channels</p>

        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Total Markets</div>
            <div className="stat-value">{markets.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Your Positions</div>
            <div className="stat-value">{positions.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Session Status</div>
            <div className="stat-value">{session ? '✓ Active' : '✗ None'}</div>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="admin-panel">
          <h3>👑 Admin: Create New Market</h3>
          <div className="form-group">
            <label>Question *</label>
            <input
              type="text"
              value={newMarket.question}
              onChange={(e) => setNewMarket({ ...newMarket, question: e.target.value })}
              placeholder="Will Bitcoin reach $100k by end of 2024?"
              maxLength={200}
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={newMarket.description}
              onChange={(e) => setNewMarket({ ...newMarket, description: e.target.value })}
              placeholder="Additional details about the market..."
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Duration (minutes)</label>
              <input
                type="number"
                value={newMarket.durationMinutes}
                onChange={(e) => setNewMarket({ ...newMarket, durationMinutes: parseInt(e.target.value) || 60 })}
                min="5"
              />
            </div>
            <div className="form-group">
              <label>Initial Liquidity (µUSDC)</label>
              <input
                type="number"
                value={newMarket.initialLiquidity}
                onChange={(e) => setNewMarket({ ...newMarket, initialLiquidity: parseInt(e.target.value) || 1000000 })}
                min="100000"
                step="100000"
              />
            </div>
          </div>
          <button
            className="btn-create"
            onClick={createMarket}
            disabled={loading || !session || !newMarket.question.trim()}
          >
            {loading ? '⏳ Creating...' : '✨ Create Market'}
          </button>
          {!session && (
            <p style={{ marginTop: '10px', color: '#dc3545', fontSize: '14px' }}>
              ⚠️ Please create a Yellow Network session first (see sidebar)
            </p>
          )}
        </div>
      )}

      <h3>📊 Active Markets</h3>
      {markets.length === 0 ? (
        <div className="empty-state">
          <p>No active markets yet. {isAdmin && 'Create one above!'}</p>
        </div>
      ) : (
        <div className="markets-grid">
          {markets.map((market) => {
            const odds = calculateOdds(market);
            const isSelected = selectedMarket === market.id;

            return (
              <div
                key={market.id}
                className={`market-card ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedMarket(isSelected ? null : market.id)}
              >
                <div className="market-question">{market.question}</div>
                {market.description && (
                  <div className="market-description">{market.description}</div>
                )}
                <span className={`market-status ${market.status}`}>
                  {market.status === 'open' ? '🟢 Open' : '🔴 Closed'}
                </span>
                <div style={{ fontSize: '13px', color: '#6c757d', marginBottom: '10px' }}>
                  ⏱️ {formatTimeRemaining(market.endTime)}
                </div>

                <div className="odds-display">
                  <div className="odds-option yes">
                    <div className="odds-label">YES</div>
                    <div className="odds-value">{odds.yes}%</div>
                  </div>
                  <div className="odds-option no">
                    <div className="odds-label">NO</div>
                    <div className="odds-value">{odds.no}%</div>
                  </div>
                </div>

                <div style={{ fontSize: '13px', color: '#6c757d' }}>
                  Volume: {(parseInt(market.totalVolume) / 1_000_000).toFixed(2)} USDC
                </div>

                {isSelected && market.status === 'open' && (
                  <div className="trade-section">
                    <div className="outcome-selector">
                      <button
                        className={`outcome-btn ${tradeForm.outcome === 'YES' ? 'selected yes' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setTradeForm({ ...tradeForm, outcome: 'YES' });
                        }}
                      >
                        Buy YES
                      </button>
                      <button
                        className={`outcome-btn ${tradeForm.outcome === 'NO' ? 'selected no' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setTradeForm({ ...tradeForm, outcome: 'NO' });
                        }}
                      >
                        Buy NO
                      </button>
                    </div>
                    <input
                      type="number"
                      value={tradeForm.amount}
                      onChange={(e) => setTradeForm({ ...tradeForm, amount: e.target.value })}
                      placeholder="Amount in USDC"
                      onClick={(e) => e.stopPropagation()}
                      step="0.01"
                      min="0"
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #dee2e6' }}
                    />
                    <button
                      className={`btn-trade ${tradeForm.outcome.toLowerCase()}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        executeTrade(market.id);
                      }}
                      disabled={loading || !address}
                    >
                      {loading ? '⏳ Trading...' : `💱 Trade ${tradeForm.outcome}`}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {positions.length > 0 && (
        <div className="positions-section">
          <h3>📈 Your Positions</h3>
          {positions.map((position, index) => (
            <div key={index} className="position-item">
              <div>
                <strong>{position.outcome}</strong>
                <div style={{ fontSize: '14px', color: '#6c757d' }}>
                  Market: {position.marketId}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: '600' }}>{position.shares} shares</div>
                <div style={{ fontSize: '14px', color: '#6c757d' }}>
                  Avg: ${position.avgPrice.toFixed(4)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MarketDashboard;
