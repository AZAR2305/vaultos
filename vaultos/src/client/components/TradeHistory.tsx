import React, { useState, useEffect } from 'react';

interface Trade {
  id: string;
  timestamp: string;
  market: string;
  type: 'BUY' | 'SELL';
  outcome: 'YES' | 'NO';
  shares: number;
  price: number;
  total: number;
}

const TradeHistory: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([
    {
      id: '1',
      timestamp: new Date(Date.now() - 300000).toLocaleTimeString(),
      market: 'BTC > $100k by EOY 2026?',
      type: 'BUY',
      outcome: 'YES',
      shares: 50,
      price: 0.72,
      total: 36.00
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 600000).toLocaleTimeString(),
      market: 'ETH reaches $8k in Q2 2026?',
      type: 'SELL',
      outcome: 'NO',
      shares: 30,
      price: 0.38,
      total: 11.40
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 900000).toLocaleTimeString(),
      market: 'AGI achieved by Dec 2026?',
      type: 'BUY',
      outcome: 'YES',
      shares: 100,
      price: 0.18,
      total: 18.00
    },
    {
      id: '4',
      timestamp: new Date(Date.now() - 1200000).toLocaleTimeString(),
      market: 'Tesla stock > $500 by June 2026?',
      type: 'BUY',
      outcome: 'NO',
      shares: 75,
      price: 0.55,
      total: 41.25
    },
    {
      id: '5',
      timestamp: new Date(Date.now() - 1500000).toLocaleTimeString(),
      market: 'BTC > $100k by EOY 2026?',
      type: 'BUY',
      outcome: 'YES',
      shares: 100,
      price: 0.65,
      total: 65.00
    }
  ]);

  const [wsConnected, setWsConnected] = useState(true);

  // Simulate WebSocket connection and real-time updates
  useEffect(() => {
    // Simulate WebSocket reconnection
    const reconnectInterval = setInterval(() => {
      setWsConnected(prev => {
        if (!prev) return true;
        return Math.random() > 0.1; // 90% chance to stay connected
      });
    }, 5000);

    // Simulate new trade updates every 15 seconds
    const tradeUpdateInterval = setInterval(() => {
      if (wsConnected && Math.random() > 0.5) {
        const mockMarkets = [
          'BTC > $100k by EOY 2026?',
          'ETH reaches $8k in Q2 2026?',
          'AGI achieved by Dec 2026?',
          'Tesla stock > $500 by June 2026?'
        ];

        const newTrade: Trade = {
          id: Date.now().toString(),
          timestamp: new Date().toLocaleTimeString(),
          market: mockMarkets[Math.floor(Math.random() * mockMarkets.length)],
          type: Math.random() > 0.5 ? 'BUY' : 'SELL',
          outcome: Math.random() > 0.5 ? 'YES' : 'NO',
          shares: Math.floor(Math.random() * 100) + 10,
          price: parseFloat((Math.random() * 0.8 + 0.1).toFixed(2)),
          total: 0
        };
        newTrade.total = parseFloat((newTrade.shares * newTrade.price).toFixed(2));

        setTrades(prev => [newTrade, ...prev].slice(0, 20)); // Keep last 20 trades
      }
    }, 15000);

    return () => {
      clearInterval(reconnectInterval);
      clearInterval(tradeUpdateInterval);
    };
  }, [wsConnected]);

  return (
    <div className="trade-history">
      <div className="history-header">
        {'[ TRADE HISTORY ]'}
        <span className="ws-indicator">
          {wsConnected ? 'LIVE' : 'RECONNECTING...'}
        </span>
      </div>

      {trades.length === 0 ? (
        <div className="empty-state">
          <div className="terminal-row">
            <span className="output">
              {'> No trades recorded yet. Start trading to see your history.'}
            </span>
          </div>
        </div>
      ) : (
        <div className="trade-list">
          {trades.map((trade) => (
            <div key={trade.id} className="trade-card">
              <div className="trade-card-header">
                <div className="trade-card-title">{trade.market}</div>
                <div className="trade-time-badge">{trade.timestamp}</div>
              </div>
              
              <div className="trade-card-body">
                <div className="trade-detail-row">
                  <span className="detail-label">TYPE:</span>
                  <span className={`trade-type-badge ${trade.type.toLowerCase()}`}>
                    {trade.type}
                  </span>
                </div>
                <div className="trade-detail-row">
                  <span className="detail-label">OUTCOME:</span>
                  <span className={`outcome-badge-small ${trade.outcome.toLowerCase()}`}>
                    {trade.outcome}
                  </span>
                </div>
                <div className="trade-detail-row">
                  <span className="detail-label">SHARES:</span>
                  <span className="detail-value">{trade.shares}</span>
                </div>
                <div className="trade-detail-row">
                  <span className="detail-label">PRICE:</span>
                  <span className="detail-value">${trade.price.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="trade-card-footer">
                <span className="total-label">TOTAL</span>
                <span className="total-value">${trade.total.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="terminal-section" style={{ marginTop: '15px', padding: '10px', background: 'var(--bg-color)' }}>
        <div className="terminal-row">
          <span className="output" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {'> Real-time updates via WebSocket • Off-chain execution • Instant settlement'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TradeHistory;
