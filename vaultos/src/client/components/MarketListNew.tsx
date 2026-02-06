import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useYellowNetwork } from '../hooks/useYellowNetwork';

interface Market {
  id: string;
  appSessionId: string; // Yellow Network app session ID - CRITICAL!
  question: string;
  description: string;
  yesPool: number;
  noPool: number;
  totalPool: number;
  endTime: number;
  status: 'open' | 'closed' | 'resolved';
  outcome?: 'YES' | 'NO';
  creatorAddress: string;
}

const MarketListNew: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { connected: yellowConnected, authenticated, createAppSession, balances } = useYellowNetwork();
  
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newMarket, setNewMarket] = useState({
    question: '',
    description: '',
    durationMinutes: 30,
    initialLiquidity: 10, // USDC to allocate to app session
  });
  const [showCreate, setShowCreate] = useState(false);

  // Real-time market updates every 5 seconds
  useEffect(() => {
    loadMarkets();
    const interval = setInterval(loadMarkets, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadMarkets = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/markets');
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
    if (!newMarket.question) {
      alert('Please enter a question');
      return;
    }

    if (!yellowConnected || !authenticated) {
      alert('Please connect to Yellow Network first');
      return;
    }

    // Check sufficient balance
    const usdcBalance = balances.find(b => b.asset === 'ytest.usd')?.balance || 0;
    if (usdcBalance < newMarket.initialLiquidity) {
      alert(`Insufficient balance. You have ${usdcBalance} USDC, need ${newMarket.initialLiquidity} USDC`);
      return;
    }

    setCreating(true);
    try {
      // Step 1: Create Yellow Network app session
      console.log('🔄 Creating Yellow Network app session...');
      const appSessionId = await createAppSession({
        marketName: newMarket.question,
        initialLiquidity: newMarket.initialLiquidity,
      });
      console.log(`✅ App session created: ${appSessionId}`);

      // Step 2: Store market in backend with app session ID
      const marketData = {
        ...newMarket,
        appSessionId, // ← CRITICAL: Store the Yellow session ID
        creatorAddress: address,
      };

      const response = await fetch('/api/market/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(marketData),
      });

      if (response.ok) {
        alert(`Market created successfully! Session ID: ${appSessionId}`);
        setNewMarket({ 
          question: '', 
          description: '', 
          durationMinutes: 30, 
          initialLiquidity: 10 
        });
        setShowCreate(false);
        loadMarkets(); // Refresh market list
      } else {
        throw new Error('Failed to store market in database');
      }
    } catch (err) {
      console.error('Error creating market:', err);
      alert(`Failed to create market: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="market-list">
      <div className="market-header">
        <div>
          <h2>📊 Prediction Markets</h2>
          {yellowConnected && authenticated && (
            <div className="yellow-status">
              ✅ Connected to Yellow Network | Balance: {balances.find(b => b.asset === 'ytest.usd')?.balance.toFixed(2) || '0'} USDC
            </div>
          )}
          {!yellowConnected && <div className="yellow-status">🔄 Connecting to Yellow Network...</div>}
          {yellowConnected && !authenticated && <div className="yellow-status">🔑 Authenticating...</div>}
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreate(!showCreate)}
          disabled={!authenticated || creating}
        >
          {showCreate ? 'Cancel' : '➕ Create Market'}
        </button>
      </div>

      {showCreate && (
        <div className="create-market-form">
          <h3>Create New Market</h3>
          <div className="input-group">
            <label>Question:</label>
            <input
              type="text"
              value={newMarket.question}
              onChange={(e) => setNewMarket({ ...newMarket, question: e.target.value })}
              placeholder="Will BTC reach $150k by June 2026?"
              className="input"
            />
          </div>
          <div className="input-group">
            <label>Description:</label>
            <textarea
              value={newMarket.description}
              onChange={(e) => setNewMarket({ ...newMarket, description: e.target.value })}
              placeholder="Market resolves YES if..."
              className="input"
              rows={3}
            />
          </div>
          <div className="input-row">
            <div className="input-group">
              <label>Duration (minutes):</label>
              <input
                type="number"
                value={newMarket.durationMinutes}
                onChange={(e) => setNewMarket({ ...newMarket, durationMinutes: parseInt(e.target.value) })}
                min="5"
                className="input"
              />
            </div>
            <div className="input-group">
              <label>Initial Liquidity (USDC):</label>
              <input
                type="number"
                value={newMarket.initialLiquidity}
                onChange={(e) => setNewMarket({ ...newMarket, initialLiquidity: parseFloat(e.target.value) })}
                min="1"
                step="1"
                className="input"
              />
            </div>
          </div>
          <button onClick={createMarket} className="btn btn-primary" disabled={creating}>
            {creating ? '🔄 Creating...' : '🚀 Create Market'}
          </button>
        </div>
      )}

      {loading ? (
        <p>Loading markets...</p>
      ) : markets.length === 0 ? (
        <div className="empty-state">
          <p>No markets yet. Create the first one!</p>
        </div>
      ) : (
        <div className="markets-grid">
          {markets.map((market) => {
            const odds = {
              yes: market.totalPool > 0 ? Math.round((market.yesPool / market.totalPool) * 100) : 50,
              no: market.totalPool > 0 ? Math.round((market.noPool / market.totalPool) * 100) : 50,
            };
            
            return (
              <div key={market.id} className={`market-card ${market.status}`}>
                {/* Status Badge */}
                <div className="market-status">
                  {market.status === 'open' && '🟢 Open'}
                  {market.status === 'closed' && '🟡 Closed'}
                  {market.status === 'resolved' && '🔵 Resolved'}
                </div>

                <h3>{market.question}</h3>
                <p className="market-description">{market.description}</p>
                
                {/* Pool Information */}
                <div className="pool-info">
                  <div className="total-pool">
                    <span className="label">Total Pool</span>
                    <span className="value">${market.totalPool.toFixed(2)}</span>
                  </div>
                  
                  <div className="pool-breakdown">
                    <div className="yes-pool">
                      <span className="label">YES</span>
                      <span className="amount">${market.yesPool.toFixed(2)}</span>
                      <span className="percentage">{odds.yes}%</span>
                    </div>
                    <div className="no-pool">
                      <span className="label">NO</span>
                      <span className="amount">${market.noPool.toFixed(2)}</span>
                      <span className="percentage">{odds.no}%</span>
                    </div>
                  </div>
                </div>

                {/* Odds Bar */}
                <div className="odds-bar">
                  <div className="yes-bar" style={{ width: `${odds.yes}%` }} />
                  <div className="no-bar" style={{ width: `${odds.no}%` }} />
                </div>

                <div className="market-info">
                  <span>⏱️ Ends: {new Date(market.endTime).toLocaleTimeString()}</span>
                  <span className="session-id" title={market.appSessionId}>
                    📡 Session: {market.appSessionId?.slice(0, 8) || 'N/A'}...
                  </span>
                </div>
                
                {market.status === 'resolved' && (
                  <div className="outcome">
                    ✅ Outcome: <strong>{market.outcome}</strong>
                  </div>
                )}
                
                <div className="creator-info">
                  Created by {market.creatorAddress?.slice(0, 6)}...{market.creatorAddress?.slice(-4)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MarketListNew;
