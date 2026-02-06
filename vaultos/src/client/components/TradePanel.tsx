import React, { useState } from 'react';
import { useAccount } from 'wagmi';

interface Market {
  id: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  category: string;
}

// MOCK MARKETS DATA for trading
const MOCK_MARKETS: Market[] = [
  {
    id: 'market_1',
    question: 'Will BTC reach $150k by end of 2026?',
    yesPrice: 0.62,
    noPrice: 0.38,
    category: 'CRYPTO'
  },
  {
    id: 'market_2',
    question: 'Will Ethereum complete Dencun upgrade by Q2 2026?',
    yesPrice: 0.78,
    noPrice: 0.22,
    category: 'CRYPTO'
  },
  {
    id: 'market_3',
    question: 'Will inflation drop below 2% in 2026?',
    yesPrice: 0.45,
    noPrice: 0.55,
    category: 'ECONOMICS'
  }
];

const TradePanel: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [markets] = useState<Market[]>(MOCK_MARKETS);
  const [selectedMarket, setSelectedMarket] = useState<string>('market_1');
  const [shares, setShares] = useState<number>(100);
  const [tradeType, setTradeType] = useState<'yes' | 'no'>('yes');
  const [tradeSuccess, setTradeSuccess] = useState<boolean>(false);

  const executeTrade = () => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    // Simulate trade execution
    setTradeSuccess(true);
    setTimeout(() => setTradeSuccess(false), 3000);
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
          <span className="prompt">{'trader@vaultos:~$'}</span>
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
          <span className="prompt">{'trader@vaultos:~$'}</span>
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
