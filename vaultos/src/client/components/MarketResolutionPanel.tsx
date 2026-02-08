import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface Market {
  id: string;
  title: string;
  status: 'OPEN' | 'FROZEN' | 'RESOLVED' | 'SETTLED';
  resolvedOutcome?: 'YES' | 'NO';
  creatorAddress?: string;
}

const MarketResolutionPanel: React.FC<{ isAdmin?: boolean }> = ({ isAdmin = false }) => {
  const { address } = useAccount();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarketId, setSelectedMarketId] = useState<string>('');
  const [showResolution, setShowResolution] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const ADMIN_WALLET = '0xFefa60F5aA4069F96b9Bf65c814DDb3A604974e1';
  const isAdminWallet = address?.toLowerCase() === ADMIN_WALLET.toLowerCase();

  // Fetch real markets from API
  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchMarkets = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/market');
      if (response.ok) {
        const data = await response.json();
        const formattedMarkets = data.markets.map((m: any) => ({
          id: m.id,
          title: m.question,
          status: m.status.toUpperCase() as 'OPEN' | 'FROZEN' | 'RESOLVED' | 'SETTLED',
          resolvedOutcome: m.winningOutcome || undefined,
          creatorAddress: m.creator
        }));
        setMarkets(formattedMarkets);
        if (formattedMarkets.length > 0 && !selectedMarketId) {
          setSelectedMarketId(formattedMarkets[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching markets:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedMarket = markets.find(m => m.id === selectedMarketId);

  // Don't render if not admin wallet
  if (!isAdminWallet) {
    return null;
  }

  const handleFreeze = async () => {
    if (!address || !selectedMarketId) return;
    
    setActionMessage('');
    setActionError('');

    try {
      const response = await fetch(`http://localhost:3000/api/market/${selectedMarketId}/freeze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callerAddress: address })
      });

      if (response.ok) {
        setActionMessage('✅ Market frozen! Trading stopped.');
        setShowResolution(true);
        fetchMarkets(); // Refresh markets
      } else {
        const error = await response.json();
        setActionError(`Failed to freeze: ${error.error}`);
      }
    } catch (err: any) {
      setActionError(`Network error: ${err.message}`);
    }
  };bettify:~$'}</span>
          <span className="command">access resolution_panel --auth=admin</span>
        </div>
        <div className="terminal-row">
          <span className="output" style={{ color: '#00ff41' }}>
            {'> Authorization verified. Admin controls enabled.'}
          </span>
        </div>
      </div>

      {actionMessage && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid #22c55e',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '20px',
          color: '#22c55e',
          fontSize: '0.9rem'
        }}>
          {actionMessage}
        </div>
      )}

      {actionError && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '20px',
          color: '#ef4444',
          fontSize: '0.9rem'
        }}>
          ❌ {actionError}
        </div>
      )}

      {loading ? (
        <div>Loading markets...</div>
      ) : markets.length === 0 ? (
        <div>No markets available</div>
      ) : (
        <>
          <div className="market-selector">
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Select Market:
            </label>
            <select 
              value={selectedMarketId} 
              onChange={(e) => {
                setSelectedMarketId(e.target.value);
                setShowResolution(false);
                setActionMessage('');
                setActionError('');
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

              {(selectedMarket.status === 'FROZEN' || showResolution) && selectedMarket.status !== 'RESOLVED' && selectedMarket.status !== 'SETTLED' && (
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
                <div className="action-group">
                  <button className="btn-settle" onClick={handleSettle} style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    textTransform: 'uppercase'
                  }}>
                    {'[SETTLE ON-CHAIN]'}
                  </button>
                </div>
              )}

              {selectedMarket.status === 'SETTLED' && (
                <div className="terminal-section" style={{ marginTop: '15px', padding: '12px', background: 'var(--bg-color)' }}>
                  <div className="terminal-row">
                    <span className="output" style={{ color: 'var(--accent-retro)' }}>
                      {'> Market settled. On-chain distribution complete. Winners paid.'}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="terminal-section" style={{ marginTop: '20px', padding: '10px', background: 'var(--bg-color)' }}>
            <div className="terminal-row">
              <span className="output" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {'> OPEN → FROZEN → RESOLVED → SETTLED'}
              </span>
            </div>
            <div className="terminal-row">
              <span className="output" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {'> Freeze stops trading • Resolve determines winner • Settle executes on-chain payouts'}
              </span>
            </div>
          </div>
        </>
      )}arkets.map(market => (
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
