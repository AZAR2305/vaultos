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
  const [amount, setAmount] = useState<number>(10); // Amount in ytest.USD
  const [outcome, setOutcome] = useState<number>(0); // 0 = YES, 1 = NO
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [session, setSession] = useState<any>(null);
  const [userBalance, setUserBalance] = useState<number | null>(null);

  // Load session and balance
  useEffect(() => {
    if (address) {
      const sessionData = localStorage.getItem(`session_${address}`);
      if (sessionData) {
        const parsedSession = JSON.parse(sessionData);
        setSession(parsedSession);
        checkBalance(parsedSession.sessionId);
      }
    }
  }, [address]);

  const checkBalance = async (sessionId: string) => {
    try {
      const response = await fetch(`http://localhost:3000/api/balance/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        // Balance is in 6 decimals
        const balance = data.balance / 1_000_000;
        setUserBalance(balance);
      }
    } catch (err) {
      console.error('Error checking balance:', err);
    }
  };

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
    setError('');
    setSuccess('');
    
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

    // Balance validation
    if (userBalance !== null && amount > userBalance) {
      setError(`Insufficient balance! You have ${userBalance.toFixed(2)} ytest.USD but trying to spend ${amount.toFixed(2)} ytest.USD.`);
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

      setSuccess(`✅ Trade successful!\n\nShares received: ${data.trade.sharesReceived.toFixed(2)}\nCost: ${data.trade.cost.toFixed(2)} ytest.USD\nNew balance: ${(userBalance! - data.trade.cost).toFixed(2)} ytest.USD`);
      
      // Update balance
      setUserBalance((userBalance || 0) - data.trade.cost);
      
      // Update session in localStorage
      const updatedSession = {
        ...session,
        spentAmount: (parseFloat(session.spentAmount || '0') + data.trade.cost).toString(),
      };
      setSession(updatedSession);
      localStorage.setItem(`session_${address}`, JSON.stringify(updatedSession));
      
      loadMarkets(); // Refresh to show updated pool sizes
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(''), 5000);
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
        <div className="info-message" style={{
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid #3b82f6',
          borderRadius: '8px',
          padding: '15px',
          color: '#3b82f6',
          marginBottom: '20px'
        }}>
          ℹ️ Create a session in the sidebar to start trading
        </div>
      ) : markets.length === 0 ? (
        <div className="info-message" style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          padding: '15px',
          color: '#f59e0b',
          marginBottom: '20px'
        }}>
          ⚠️ No markets available. Create one first!
        </div>
      ) : (
        <div className="trade-form">
          {userBalance !== null && (
            <div style={{
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid #22c55e',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ color: '#22c55e', fontSize: '0.9rem' }}>💰 Available Balance: </span>
                <strong style={{ color: '#22c55e', fontSize: '1.1rem' }}>{userBalance.toFixed(2)} ytest.USD</strong>
              </div>
              <button
                onClick={() => session && checkBalance(session.sessionId)}
                style={{
                  background: 'transparent',
                  border: '1px solid #22c55e',
                  color: '#22c55e',
                  padding: '5px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.8rem'
                }}
              >
                🔄 Refresh
              </button>
            </div>
          )}

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '20px',
              color: '#ef4444',
              fontSize: '0.9rem',
              whiteSpace: 'pre-line'
            }}>
              ❌ {error}
            </div>
          )}

          {success && (
            <div style={{
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid #22c55e',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '20px',
              color: '#22c55e',
              fontSize: '0.9rem',
              whiteSpace: 'pre-line'
            }}>
              {success}
            </div>
          )}

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
            <label>Amount (ytest.USD):</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              min="1"
              step="1"
              className="input"
              max={userBalance || undefined}
              style={{
                border: userBalance !== null && amount > userBalance ? '2px solid #ef4444' : undefined
              }}
            />
            {userBalance !== null && amount > userBalance && (
              <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '5px' }}>
                ⚠️ Exceeds your balance!
              </p>
            )}
          </div>

          <div className="trade-summary">
            <p><strong>Price per share:</strong> ${currentPrice.toFixed(4)}</p>
            <p><strong>Estimated shares:</strong> {estimatedShares.toFixed(2)}</p>
            <p><strong>Total cost:</strong> ${amount.toFixed(2)} ytest.USD</p>
          </div>

          <button
            onClick={executeTrade}
            disabled={loading || !isConnected || (userBalance !== null && amount > userBalance)}
            className="btn btn-primary btn-large"
          >
            {loading ? 'Processing...' : 'Execute Trade'}
          </button>
        </div>
      )}
    </div>
  );
};

export default TradePanelNew;
