import React, { useState } from 'react';

interface Market {
  id: string;
  title: string;
  status: 'OPEN' | 'FROZEN' | 'RESOLVED';
  resolvedOutcome?: 'YES' | 'NO';
}

const MarketResolutionPanel: React.FC<{ isAdmin?: boolean }> = ({ isAdmin = false }) => {
  // Mock markets data
  const [markets, setMarkets] = useState<Market[]>([
    { id: '1', title: 'BTC > $100k by EOY 2026?', status: 'OPEN' },
    { id: '2', title: 'ETH reaches $8k in Q2 2026?', status: 'OPEN' },
    { id: '3', title: 'US Inflation below 2% by Q3 2026?', status: 'FROZEN' },
    { id: '4', title: 'AGI achieved by Dec 2026?', status: 'OPEN' },
    { id: '5', title: 'Tesla stock > $500 by June 2026?', status: 'RESOLVED', resolvedOutcome: 'YES' },
    { id: '6', title: 'SpaceX Mars landing in 2026?', status: 'OPEN' }
  ]);

  const [selectedMarketId, setSelectedMarketId] = useState(markets[0].id);
  const [showResolution, setShowResolution] = useState(false);

  const selectedMarket = markets.find(m => m.id === selectedMarketId);

  // Don't render if not admin
  if (!isAdmin) {
    return null;
  }

  const handleFreeze = () => {
    setMarkets(prev => prev.map(m => 
      m.id === selectedMarketId ? { ...m, status: 'FROZEN' as const } : m
    ));
    setShowResolution(true);
  };

  const handleResolve = (outcome: 'YES' | 'NO') => {
    setMarkets(prev => prev.map(m => 
      m.id === selectedMarketId 
        ? { ...m, status: 'RESOLVED' as const, resolvedOutcome: outcome } 
        : m
    ));
    setShowResolution(false);
  };

  return (
    <div className="resolution-panel">
      <div className="panel-header">
        {'⚡ MARKET RESOLUTION CONTROL'}
        <span className="admin-badge">ADMIN</span>
      </div>

      <div className="terminal-section" style={{ marginBottom: '20px', padding: '10px', background: 'var(--bg-color)' }}>
        <div className="terminal-row">
          <span className="prompt">{'admin@vaultos:~$'}</span>
          <span className="command">access resolution_panel --auth=admin</span>
        </div>
        <div className="terminal-row">
          <span className="output" style={{ color: '#00ff41' }}>
            {'> Authorization verified. Admin controls enabled.'}
          </span>
        </div>
      </div>

      <div className="market-selector">
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
          Select Market:
        </label>
        <select 
          value={selectedMarketId} 
          onChange={(e) => {
            setSelectedMarketId(e.target.value);
            setShowResolution(false);
          }}
        >
          {markets.map(market => (
            <option key={market.id} value={market.id}>
              {market.title} [{market.status}]
            </option>
          ))}
        </select>
      </div>

      {selectedMarket && (
        <>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
              Current Status:
            </div>
            <span className={`status-indicator ${selectedMarket.status.toLowerCase()}`}>
              {selectedMarket.status}
              {selectedMarket.resolvedOutcome && ` - ${selectedMarket.resolvedOutcome} WINS`}
            </span>
          </div>

          {selectedMarket.status === 'OPEN' && (
            <div className="action-group">
              <button className="btn-freeze" onClick={handleFreeze}>
                {'[FREEZE MARKET]'}
              </button>
            </div>
          )}

          {(selectedMarket.status === 'FROZEN' || showResolution) && selectedMarket.status !== 'RESOLVED' && (
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase' }}>
                Resolve Market:
              </div>
              <div className="resolution-buttons">
                <button className="btn-yes" onClick={() => handleResolve('YES')}>
                  {'[RESOLVE: YES]'}
                </button>
                <button className="btn-no" onClick={() => handleResolve('NO')}>
                  {'[RESOLVE: NO]'}
                </button>
              </div>
            </div>
          )}

          {selectedMarket.status === 'RESOLVED' && (
            <div className="terminal-section" style={{ marginTop: '15px', padding: '12px', background: 'var(--bg-color)' }}>
              <div className="terminal-row">
                <span className="output" style={{ color: 'var(--accent-retro)' }}>
                  {'> Market resolved. Settlement complete. Payouts distributed.'}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      <div className="terminal-section" style={{ marginTop: '20px', padding: '10px', background: 'var(--bg-color)' }}>
        <div className="terminal-row">
          <span className="output" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {'> OPEN → FROZEN → RESOLVED'}
          </span>
        </div>
        <div className="terminal-row">
          <span className="output" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {'> Freeze stops trading • Resolve determines winner • Settlement auto-executes'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MarketResolutionPanel;
