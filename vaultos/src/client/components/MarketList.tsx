/**
 * Prediction Markets List
 * 
 * ADMIN ONLY: Market creation
 * - Only hardcoded admin wallet can create markets
 * - Regular users can only view and trade
 * 
 * Markets are created via Yellow Network:
 * - Market state stored OFF-CHAIN
 * - All trades execute OFF-CHAIN
 * - Settlement happens ON-CHAIN (Phase 2)
 */
import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

// HARDCODED ADMIN WALLET (replace with your actual admin address)
const ADMIN_WALLET = '0xYourAdminWalletAddressHere'.toLowerCase();

interface Market {
  id: string;
  marketId?: string;
  question: string;
  description?: string;
  yesPrice: number;
  noPrice: number;
  yesPool?: number;
  noPool?: number;
  totalVolume: number;
  endTime?: number;
  createdAt?: number;
}

interface MarketListProps {
  session?: any;
  onSelectMarket?: (market: Market) => void;
}

const MarketList: React.FC<MarketListProps> = ({ session, onSelectMarket }) => {
  const { address } = useAccount();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Admin market creation form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newMarket, setNewMarket] = useState({
    question: '',
    description: '',
    durationMinutes: 60,
    yesPrice: 0.5,
  });

  // Check if current user is admin
  const isAdmin = address?.toLowerCase() === ADMIN_WALLET;

  // Load markets on mount
  useEffect(() => {
    loadMarkets();
  }, []);

  const loadMarkets = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/market/list');
      if (response.ok) {
        const data = await response.json();
        setMarkets(data.markets || []);
      }
    } catch (err) {
      console.error('Error loading markets:', err);
    } finally {
      setLoading(false);
    }
  };

  const createMarket = async () => {
    if (!session) {
      setError('Please create a session first');
      return;
    }

    if (!newMarket.question.trim()) {
      setError('Market question is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/market/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          question: newMarket.question,
          description: newMarket.description,
          durationMinutes: newMarket.durationMinutes,
          yesPrice: newMarket.yesPrice,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Market created:', data);
        
        // Reset form
        setNewMarket({ question: '', description: '', durationMinutes: 60, yesPrice: 0.5 });
        setShowCreateForm(false);
        
        // Reload markets
        loadMarkets();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create market');
      }
    } catch (err) {
      console.error('Error creating market:', err);
      setError('Network error creating market');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="markets-container">
      <div className="markets-header">
        <div>
          <h1>📊 Prediction Markets</h1>
          <p className="markets-subtitle">
            <span className="badge off-chain">⚡ OFF-CHAIN</span>
            Powered by Yellow Network State Channels
          </p>
        </div>
        
        {isAdmin && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn btn-primary"
          >
            {showCreateForm ? 'Cancel' : '➕ Create Market'}
          </button>
        )}
      </div>

      {/* ADMIN ONLY: Market Creation Form */}
      {isAdmin && showCreateForm && (
        <div className="market-create-form">
          <div className="form-header">
            <span className="admin-badge">👑 ADMIN</span>
            <h3>Create New Prediction Market</h3>
          </div>
          
          <div className="form-group">
            <label>Market Question *</label>
            <input
              type="text"
              value={newMarket.question}
              onChange={(e) => setNewMarket({...newMarket, question: e.target.value})}
              placeholder="e.g., Will BTC reach $100k by end of 2026?"
              className="input input-large"
              maxLength={200}
            />
          </div>
          
          <div className="form-group">
            <label>Description (Optional)</label>
            <textarea
              value={newMarket.description}
              onChange={(e) => setNewMarket({...newMarket, description: e.target.value})}
              placeholder="Additional context or resolution criteria..."
              className="textarea"
              rows={3}
              maxLength={500}
            />
          </div>
          
          <div className="form-group">
            <label>Duration (Minutes)</label>
            <input
              type="number"
              value={newMarket.durationMinutes}
              onChange={(e) => setNewMarket({...newMarket, durationMinutes: parseInt(e.target.value)})}
              min="5"
              step="5"
              className="input"
            />
          </div>
          
          <button
            onClick={createMarket}
            disabled={loading || !newMarket.question.trim()}
            className="btn btn-success btn-large"
          >
            {loading ? '⏳ Creating...' : '🚀 Create Market'}
          </button>
          
          {error && <div className="error-message">❌ {error}</div>}
        </div>
      )}

      {/* Markets Grid */}
      <div className="markets-grid">
        {markets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>No active markets yet</p>
            {isAdmin && <p className="empty-hint">Create your first market above!</p>}
          </div>
        ) : (
          markets.map((market) => (
            <div 
              key={market.id || market.marketId} 
              className="market-card"
              onClick={() => onSelectMarket && onSelectMarket(market)}
            >
              <div className="market-question">{market.question}</div>
              
              {market.description && (
                <div className="market-description">{market.description}</div>
              )}
              
              <div className="market-prices">
                <div className="price-option yes">
                  <span className="price-label">YES</span>
                  <span className="price-value">{(market.yesPrice * 100).toFixed(1)}¢</span>
                </div>
                <div className="price-option no">
                  <span className="price-label">NO</span>
                  <span className="price-value">{(market.noPrice * 100).toFixed(1)}¢</span>
                </div>
              </div>
              
              <div className="market-stats">
                <div className="stat-item">
                  <span className="stat-label">Volume</span>
                  <span className="stat-value">${market.totalVolume?.toFixed(0) || '0'}</span>
                </div>
                {market.endTime && (
                  <div className="stat-item">
                    <span className="stat-label">Ends</span>
                    <span className="stat-value">
                      {new Date(market.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="market-badge">
                <span className="badge off-chain">⚡ OFF-CHAIN</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MarketList;
