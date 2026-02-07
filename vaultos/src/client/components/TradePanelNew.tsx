import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface Market {
  id: string;
  question: string;
  yesPool: number;
  noPool: number;
  totalPool: number;
}

const TradePanelNew: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<string>('');
  const [amount, setAmount] = useState<number>(10); // Amount in USDC
  const [outcome, setOutcome] = useState<number>(0); // 0 = YES, 1 = NO
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [session, setSession] = useState<any>(null);

  // Load session
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
    try {
      const response = await fetch('http://localhost:3000/api/market');
      if (response.ok) {
        const data = await response.json();
        setMarkets(data.markets || []);
        if (data.markets?.length > 0 && !selectedMarket) {
          setSelectedMarket(data.markets[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading markets:', err);
    }
  };

  const executeTrade = async () => {
    if (!isConnected) {
      setError('Please connect your wallet');
      return;
    }

    if (!session) {
      setError('Please create a session in the sidebar first');
      return;
    }

    // Check if user has refunded
    if (session.hasRefunded) {
      setError('You cannot trade after requesting a refund. Please create a new session.');
      return;
    }

    if (!selectedMarket) {
      setError('Please select a market');
      return;
    }

    if (amount <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('Executing trade:', {
        sessionId: session.sessionId,
        marketId: selectedMarket,
        outcome,
        amount,
      });

      const response = await fetch('http://localhost:3000/api/trade/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          marketId: selectedMarket,
          outcome,
          amount,
          maxSlippage: 0.05,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Trade failed');
      }

      alert(`Trade successful!\nShares received: ${data.trade.sharesReceived}\nCost: ${data.trade.cost.toFixed(2)} USDC\nNew balance: ${data.balance.toFixed(2)} USDC`);
      
      // Update session in localStorage
      const updatedSession = {
        ...session,
        spentAmount: (parseFloat(session.spentAmount || '0') + data.trade.cost).toString(),
      };
      setSession(updatedSession);
      localStorage.setItem(`session_${address}`, JSON.stringify(updatedSession));
      
      loadMarkets(); // Refresh to show updated pool sizes
    } catch (err: any) {
      console.error('Trade error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedMarketData = markets.find((m) => m.id === selectedMarket);
  const yesPrice = selectedMarketData 
    ? (selectedMarketData.yesPool / selectedMarketData.totalPool) 
    : 0.5;
  const noPrice = selectedMarketData
    ? (selectedMarketData.noPool / selectedMarketData.totalPool)
    : 0.5;
  
  const currentPrice = outcome === 0 ? yesPrice : noPrice;
  const estimatedShares = amount / currentPrice;

  const availableBalance = session 
    ? (parseFloat(session.depositAmount) - parseFloat(session.spentAmount || '0'))
    : 0;

  return (
    <div className="trade-panel">
      <h2>Trade on Markets</h2>

      {!session ? (
        <p className="info-message">Create a session in the sidebar to start trading</p>
      ) : markets.length === 0 ? (
        <p className="info-message">No markets available. Create one first!</p>
      ) : (
        <div className="trade-form">
          <div className="balance-info">
            <strong>Available Balance:</strong> ${availableBalance.toFixed(2)} USDC
          </div>

          <div className="input-group">
            <label>Select Market:</label>
            <select
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value)}
              className="input"
            >
              {markets.map((market) => (
                <option key={market.id} value={market.id}>
                  {market.question}
                </option>
              ))}
            </select>
          </div>

          {selectedMarketData && (
            <div className="market-prices">
              <div className="price-display">
                <span>YES Price:</span>
                <strong>${yesPrice.toFixed(4)}</strong>
              </div>
              <div className="price-display">
                <span>NO Price:</span>
                <strong>${noPrice.toFixed(4)}</strong>
              </div>
            </div>
          )}

          <div className="input-group">
            <label>Trade Type:</label>
            <div className="trade-buttons">
              <button
                className={`trade-btn ${outcome === 0 ? 'active yes' : ''}`}
                onClick={() => setOutcome(0)}
              >
                Buy YES
              </button>
              <button
                className={`trade-btn ${outcome === 1 ? 'active no' : ''}`}
                onClick={() => setOutcome(1)}
              >
                Buy NO
              </button>
            </div>
          </div>

          <div className="input-group">
            <label>Amount (USDC):</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              min="1"
              step="1"
              className="input"
              max={availableBalance}
            />
          </div>

          <div className="trade-summary">
            <p><strong>Price per share:</strong> ${currentPrice.toFixed(4)}</p>
            <p><strong>Estimated shares:</strong> {estimatedShares.toFixed(2)}</p>
            <p><strong>Total cost:</strong> ${amount.toFixed(2)} USDC</p>
          </div>

          <button
            onClick={executeTrade}
            disabled={loading || !isConnected || amount > availableBalance}
            className="btn btn-primary btn-large"
          >
            {loading ? 'Processing...' : 'Execute Trade'}
          </button>

          {error && <p className="error-message">{error}</p>}
        </div>
      )}
    </div>
  );
};

export default TradePanelNew;
