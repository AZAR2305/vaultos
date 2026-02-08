import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { API_URL } from '../config/api';

interface Market {
  id: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  category: string;
  status?: string;
}

const TradePanel: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarket, setSelectedMarket] = useState<string>('');
  const [shares, setShares] = useState<number>(100);
  const [tradeType, setTradeType] = useState<'yes' | 'no'>('yes');
  const [tradeSuccess, setTradeSuccess] = useState<boolean>(false);

  // Fetch markets from backend
  useEffect(() => {
    fetchMarkets();
  }, []);

  const fetchMarkets = async () => {
    try {
      const response = await fetch(`${API_URL}/api/markets`);
      if (response.ok) {
        const data = await response.json();
        const formattedMarkets = data.markets.map((m: any) => ({
          id: m.id,
          question: m.question,
          yesPrice: m.odds?.YES ? parseFloat(m.odds.YES) / 100 : 0.5,
          noPrice: m.odds?.NO ? parseFloat(m.odds.NO) / 100 : 0.5,
          category: 'PREDICTION',
          status: m.status
        }));
        setMarkets(formattedMarkets);
        if (formattedMarkets.length > 0) {
          setSelectedMarket(formattedMarkets[0].id);
        }
      } else {
        console.error('Failed to fetch markets:', response.status);
        setMarkets([]);
      }
    } catch (err) {
      console.error('Error fetching markets:', err);
      setMarkets([]);
    } finally {
      setLoading(false);
    }
  };

  const executeTrade = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    if (!address) {
      alert('No wallet address found');
      return;
    }

    // Get session from localStorage
    const sessionData = localStorage.getItem(`session_${address}`);
    if (!sessionData) {
      alert('No active session. Please create a session first.');
      return;
    }

    const session = JSON.parse(sessionData);

    try {
      const response = await fetch(`${API_URL}/api/markets/${selectedMarket}/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          outcome: tradeType.toUpperCase(),
          amount: totalCost * 1000000, // Convert to microunits
          sessionId: session.sessionId
        })
      });

      if (response.ok) {
        const data = await response.json();
        setTradeSuccess(true);
        alert(`✅ Trade executed!\n\nYou bought ${shares} ${tradeType.toUpperCase()} shares\nCost: $${totalCost.toFixed(2)} USDC`);
        setTimeout(() => setTradeSuccess(false), 3000);
      } else {
        const errorData = await response.json();
        alert('❌ Trade failed: ' + errorData.error);
      }
    } catch (err) {
      console.error('Trade error:', err);
      alert('❌ Network error executing trade');
    }
  };

  const selectedMarketData = markets.find((m) => m.id === selectedMarket);
  const price = selectedMarketData 
    ? (tradeType === 'yes' ? selectedMarketData.yesPrice : selectedMarketData.noPrice)
    : 0;
  const totalCost = shares * price;

  return (
    <div className="trade-panel">
      <h2 style={{ 
        fontSize: '2rem', 
        fontFamily: 'Syne, sans-serif', 
        fontWeight: 800,
        textTransform: 'uppercase',
        marginBottom: '10px'
      }}>
        Trade Execution
      </h2>
      <p style={{ color: 'var(--accent-retro)', fontSize: '0.85rem', marginBottom: '30px' }}>
        {'[ INSTANT • GASLESS • OFF-CHAIN ]'}
      </p>

      {/* Terminal-style selection */}
      <div className="terminal-section" style={{ marginBottom: '20px' }}>
        <div className="terminal-row">
          <span className="prompt">{'trader@bettify:~$'}</span>
          <span className="command">select market</span>
        </div>
        <div className="terminal-row">
          <span className="output">{'> Scanning available markets...'}</span>
        </div>
      </div>

      <div className="trade-form">
        <div className="input-group">
          <label>SELECT MARKET:</label>
          <select
            value={selectedMarket}
            onChange={(e) => setSelectedMarket(e.target.value)}
            className="input"
          >
            {markets.map((market) => (
              <option key={market.id} value={market.id}>
                [{market.category}] {market.question}
              </option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label>TRADE TYPE:</label>
          <div className="trade-buttons">
            <button
              className={`trade-btn ${tradeType === 'yes' ? 'active yes' : ''}`}
              onClick={() => setTradeType('yes')}
            >
              [BUY YES]
            </button>
            <button
              className={`trade-btn ${tradeType === 'no' ? 'active no' : ''}`}
              onClick={() => setTradeType('no')}
            >
              [BUY NO]
            </button>
          </div>
        </div>

        <div className="input-group">
          <label>NUMBER OF SHARES:</label>
          <input
            type="number"
            value={shares}
            onChange={(e) => setShares(parseInt(e.target.value) || 0)}
            min="1"
            className="input"
          />
        </div>

        <div className="trade-summary">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            padding: '10px 0',
            borderBottom: '1px solid var(--border-color)'
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>PRICE PER SHARE:</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>
              ${price.toFixed(2)}
            </span>
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            padding: '10px 0'
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>TOTAL COST:</span>
            <span style={{ color: 'var(--accent-retro)', fontWeight: '700', fontSize: '1.2rem' }}>
              ${totalCost.toFixed(2)} USDC
            </span>
          </div>
        </div>

        {tradeSuccess && (
          <div style={{
            background: 'rgba(74, 222, 128, 0.1)',
            border: '2px solid #4ade80',
            padding: '15px',
            marginBottom: '15px',
            color: '#4ade80',
            textAlign: 'center',
            fontWeight: '700'
          }}>
            ✓ TRADE EXECUTED SUCCESSFULLY • {shares} SHARES @ ${price.toFixed(2)}
          </div>
        )}

        <button
          onClick={executeTrade}
          disabled={!isConnected}
          className="btn btn-primary"
          style={{ width: '100%', fontSize: '1rem' }}
        >
          {!isConnected ? '[CONNECT WALLET FIRST]' : `[EXECUTE TRADE]`}
        </button>

        {!isConnected && (
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
            textAlign: 'center',
            marginTop: '10px'
          }}>
            {'> Connect your wallet to start trading'}
          </p>
        )}
      </div>

      {/* Terminal output */}
      <div className="terminal-section" style={{ marginTop: '30px' }}>
        <div className="terminal-row">
          <span className="prompt">{'trader@bettify:~$'}</span>
          <span className="command">status</span>
        </div>
        <div className="terminal-row">
          <span className="output">
            {`> MARKET: ${selectedMarketData?.question.substring(0, 50)}...`}
          </span>
        </div>
        <div className="terminal-row">
          <span className="output">
            {`> POSITION: ${tradeType.toUpperCase()} x${shares} shares`}
          </span>
        </div>
        <div className="terminal-row">
          <span className="output">
            {`> COST: $${totalCost.toFixed(2)} USDC`}
          </span>
        </div>
        <div className="terminal-row">
          <span className="output">
            {'> EXECUTION: <100ms latency • 0 gas fees'}
            <span className="cursor-blink">_</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default TradePanel;
