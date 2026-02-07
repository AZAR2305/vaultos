import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface Market {
  id: string;
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
  
  // 🔒 ADMIN-ONLY: Only admin wallet can create markets
  const ADMIN_WALLET = '0xFefa60F5aA4069F96b9Bf65c814DDb3A604974e1';
  const isAdmin = address?.toLowerCase() === ADMIN_WALLET.toLowerCase();
  
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newMarket, setNewMarket] = useState({
    question: '',
    description: '',
    durationMinutes: 30,
    initialLiquidity: 100, // USDC for market liquidity
  });
  const [showCreate, setShowCreate] = useState(false);
  const [session, setSession] = useState<any>(null);

  // Load session from localStorage
  useEffect(() => {
    if (address) {
      const sessionData = localStorage.getItem(`session_${address}`);
      if (sessionData) {
        setSession(JSON.parse(sessionData));
      }
    }
  }, [address]);

  // Load markets
  useEffect(() => {
    loadMarkets();
    const interval = setInterval(loadMarkets, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadMarkets = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/market');
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
    if (!newMarket.question.trim()) {
      alert('Please enter a question');
      return;
    }

    if (!isAdmin) {
      alert('Only admin wallet can create markets');
      return;
    }

    if (!session) {
      alert('Please create a Yellow Network session first (see sidebar)');
      return;
    }

    if (!address) {
      alert('Please connect your wallet');
      return;
    }

    setCreating(true);
    try {
      const marketData = {
        question: newMarket.question,
        description: newMarket.description,
        durationMinutes: newMarket.durationMinutes,
        initialLiquidity: newMarket.initialLiquidity,
        sessionId: session.sessionId,
        channelId: session.channelId,
        creatorAddress: address,
      };

      console.log('Creating market:', marketData);

      const response = await fetch('http://localhost:3000/api/market/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(marketData),
      });

      const data = await response.json();

      if (response.ok) {
        alert(`Market created successfully!`);
        setNewMarket({ 
          question: '', 
          description: '', 
          durationMinutes: 30, 
          initialLiquidity: 100,
        });
        setShowCreate(false);
        loadMarkets();
      } else {
        throw new Error(data.error || 'Failed to create market');
      }
    } catch (err: any) {
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
          <h2>Prediction Markets</h2>
          {session && (
            <div className="yellow-status">
              Session: {session.sessionId.slice(0, 12)}... | Balance: {session.depositAmount} USDC
            </div>
          )}
          {!session && <div className="yellow-status">Create a session in sidebar to start</div>}
        </div>
        {isAdmin && (
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreate(!showCreate)}
            disabled={!session || creating}
          >
            {showCreate ? 'Cancel' : 'Create Market (Admin)'}
          </button>
        )}
        {!isAdmin && (
          <div className="admin-only-notice" style={{ color: '#FFD700', fontSize: '14px' }}>
            Only admin can create markets
          </div>
        )}
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
                min="10"
                step="10"
                className="input"
              />
            </div>
          </div>
          <button onClick={createMarket} className="btn btn-primary" disabled={creating}>
            {creating ? 'Creating...' : 'Create Market'}
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
                <div className="market-status">
                  {market.status === 'open' && 'Open'}
                  {market.status === 'closed' && 'Closed'}
                  {market.status === 'resolved' && 'Resolved'}
                </div>

                <h3>{market.question}</h3>
                <p className="market-description">{market.description}</p>
                
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

                <div className="odds-bar">
                  <div className="yes-bar" style={{ width: `${odds.yes}%` }} />
                  <div className="no-bar" style={{ width: `${odds.no}%` }} />
                </div>

                <div className="market-info">
                  <span>Ends: {new Date(market.endTime).toLocaleTimeString()}</span>
                </div>
                
                {market.status === 'resolved' && (
                  <div className="outcome">
                    Outcome: <strong>{market.outcome}</strong>
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
