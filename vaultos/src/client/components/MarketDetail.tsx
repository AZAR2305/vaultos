import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useYellowNetwork } from '../hooks/useYellowNetwork';

interface Market {
  id: string;
  appSessionId: string;
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

interface Bet {
  id: string;
  userAddress: string;
  amount: number;
  position: 'YES' | 'NO';
  timestamp: Date;
  status: 'active' | 'refunded' | 'settled';
}

export function MarketDetail() {
  const { marketId } = useParams<{ marketId: string }>();
  const { address } = useAccount();
  const navigate = useNavigate();
  const { authenticated, depositToSession, withdrawFromSession, balances } = useYellowNetwork();

  const [market, setMarket] = useState<Market | null>(null);
  const [userBets, setUserBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [betAmount, setBetAmount] = useState('');
  const [betPosition, setBetPosition] = useState<'YES' | 'NO'>('YES');
  const [placing, setPlacing] = useState(false);
  const [refunding, setRefunding] = useState(false);

  // Load market and user bets
  useEffect(() => {
    loadMarket();
    loadUserBets();

    // Real-time updates every 3 seconds
    const interval = setInterval(() => {
      loadMarket();
      loadUserBets();
    }, 3000);

    return () => clearInterval(interval);
  }, [marketId]);

  const loadMarket = async () => {
    try {
      const response = await fetch(`/api/market/${marketId}`);
      if (response.ok) {
        const data = await response.json();
        setMarket(data);
      }
    } catch (err) {
      console.error('Error loading market:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUserBets = async () => {
    if (!address) return;

    try {
      const response = await fetch(`/api/market/${marketId}/bets?user=${address}`);
      if (response.ok) {
        const data = await response.json();
        setUserBets(data.bets || []);
      }
    } catch (err) {
      console.error('Error loading user bets:', err);
    }
  };

  // Place a bet
  const handlePlaceBet = async () => {
    if (!authenticated || !market) {
      alert('Please connect to Yellow Network');
      return;
    }

    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const usdcBalance = balances.find(b => b.asset === 'ytest.usd')?.balance || 0;
    if (usdcBalance < amount) {
      alert(`Insufficient balance. You have ${usdcBalance} USDC`);
      return;
    }

    setPlacing(true);
    try {
      // Step 1: Deposit to Yellow Network app session
      console.log(`🔄 Depositing ${amount} USDC to session ${market.appSessionId}...`);
      await depositToSession(market.appSessionId, amount);

      // Step 2: Record bet in backend
      const response = await fetch(`/api/market/${marketId}/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          amount,
          position: betPosition,
        }),
      });

      if (response.ok) {
        alert(`Bet placed! ${amount} USDC on ${betPosition}`);
        setBetAmount('');
        loadMarket();
        loadUserBets();
      } else {
        throw new Error('Failed to record bet');
      }
    } catch (err: any) {
      console.error('Error placing bet:', err);
      alert(`Failed to place bet: ${err?.message || 'Unknown error'}`);
    } finally {
      setPlacing(false);
    }
  };

  // Request refund
  const handleRefund = async (bet: Bet) => {
    if (!authenticated || !market) return;

    if (market.status !== 'open') {
      alert('Cannot refund after market closes');
      return;
    }

    const confirmRefund = confirm(`Refund ${bet.amount} USDC from your ${bet.position} position?`);
    if (!confirmRefund) return;

    setRefunding(true);
    try {
      // Step 1: Withdraw from Yellow Network app session
      console.log(`🔄 Withdrawing ${bet.amount} USDC from session ${market.appSessionId}...`);
      await withdrawFromSession(market.appSessionId, bet.amount);

      // Step 2: Update backend
      const response = await fetch(`/api/market/${marketId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          betId: bet.id,
          userAddress: address,
        }),
      });

      if (response.ok) {
        alert('Refund processed!');
        loadMarket();
        loadUserBets();
      } else {
        throw new Error('Failed to process refund');
      }
    } catch (err: any) {
      console.error('Error requesting refund:', err);
      alert(`Failed to refund: ${err?.message || 'Unknown error'}`);
    } finally {
      setRefunding(false);
    }
  };

  if (loading) {
    return <div className="market-detail">Loading market...</div>;
  }

  if (!market) {
    return (
      <div className="market-detail">
        <p>Market not found</p>
        <button onClick={() => navigate('/markets')}>← Back to Markets</button>
      </div>
    );
  }

  const odds = {
    yes: market.totalPool > 0 ? Math.round((market.yesPool / market.totalPool) * 100) : 50,
    no: market.totalPool > 0 ? Math.round((market.noPool / market.totalPool) * 100) : 50,
  };

  const totalUserBets = userBets
    .filter(b => b.status === 'active')
    .reduce((sum, bet) => sum + bet.amount, 0);

  const timeRemaining = new Date(market.endTime).getTime() - Date.now();
  const hoursRemaining = Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60)));
  const minutesRemaining = Math.max(0, Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60)));

  return (
    <div className="market-detail">
      <button className="back-btn" onClick={() => navigate('/markets')}>
        ← Back to Markets
      </button>

      {/* Market Status */}
      <div className={`status-badge status-${market.status}`}>
        {market.status === 'open' && '🟢 Open'}
        {market.status === 'closed' && '🟡 Closed'}
        {market.status === 'resolved' && '🔵 Resolved'}
      </div>

      {/* Market Question */}
      <h1>{market.question}</h1>
      <p className="description">{market.description}</p>

      {/* Market Info */}
      <div className="market-meta">
        <div className="meta-item">
          <span className="label">Time Remaining:</span>
          <span className="value">
            {market.status === 'open' 
              ? `${hoursRemaining}h ${minutesRemaining}m`
              : 'Closed'}
          </span>
        </div>
        <div className="meta-item">
          <span className="label">App Session ID:</span>
          <span className="value session-id" title={market.appSessionId}>
            {market.appSessionId?.slice(0, 12)}...
          </span>
        </div>
        <div className="meta-item">
          <span className="label">Creator:</span>
          <span className="value">
            {market.creatorAddress?.slice(0, 6)}...{market.creatorAddress?.slice(-4)}
          </span>
        </div>
      </div>

      {/* Pool Information */}
      <div className="pool-section">
        <h2>Market Pools</h2>
        <div className="total-pool-large">
          <span className="label">Total Pool</span>
          <span className="amount">${market.totalPool.toFixed(2)}</span>
        </div>

        <div className="pool-grid">
          <div className="pool-card yes-card">
            <div className="pool-header">
              <span className="label">YES</span>
              <span className="odds">{odds.yes}%</span>
            </div>
            <div className="pool-amount">${market.yesPool.toFixed(2)}</div>
          </div>

          <div className="pool-card no-card">
            <div className="pool-header">
              <span className="label">NO</span>
              <span className="odds">{odds.no}%</span>
            </div>
            <div className="pool-amount">${market.noPool.toFixed(2)}</div>
          </div>
        </div>

        {/* Odds Bar */}
        <div className="odds-bar-large">
          <div className="yes-bar" style={{ width: `${odds.yes}%` }}>
            {odds.yes}% YES
          </div>
          <div className="no-bar" style={{ width: `${odds.no}%` }}>
            {odds.no}% NO
          </div>
        </div>
      </div>

      {/* Place Bet Section */}
      {market.status === 'open' && authenticated && (
        <div className="bet-section">
          <h2>Place Your Bet</h2>
          
          <div className="bet-options">
            <button
              className={`option-btn yes-btn ${betPosition === 'YES' ? 'selected' : ''}`}
              onClick={() => setBetPosition('YES')}
            >
              YES
            </button>
            <button
              className={`option-btn no-btn ${betPosition === 'NO' ? 'selected' : ''}`}
              onClick={() => setBetPosition('NO')}
            >
              NO
            </button>
          </div>

          <div className="bet-input-group">
            <label>Amount (USDC):</label>
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              min="1"
              step="1"
              placeholder="Enter amount"
              className="bet-input"
            />
          </div>

          <button 
            className="place-bet-btn"
            onClick={handlePlaceBet}
            disabled={placing || !betAmount}
          >
            {placing ? '🔄 Placing Bet...' : `Place ${betAmount || '0'} USDC on ${betPosition}`}
          </button>

          <div className="balance-info">
            Available: {balances.find(b => b.asset === 'ytest.usd')?.balance.toFixed(2) || '0'} USDC
          </div>
        </div>
      )}

      {/* User Positions */}
      {userBets.length > 0 && (
        <div className="positions-section">
          <h2>Your Positions</h2>
          <div className="total-invested">
            Total Invested: ${totalUserBets.toFixed(2)}
          </div>

          <div className="bets-list">
            {userBets.map(bet => (
              <div key={bet.id} className={`bet-card ${bet.position.toLowerCase()}-bet`}>
                <div className="bet-header">
                  <span className="bet-position">{bet.position}</span>
                  <span className="bet-status">{bet.status}</span>
                </div>
                <div className="bet-amount">${bet.amount.toFixed(2)}</div>
                <div className="bet-time">
                  {new Date(bet.timestamp).toLocaleString()}
                </div>

                {bet.status === 'active' && market.status === 'open' && (
                  <button 
                    className="refund-btn"
                    onClick={() => handleRefund(bet)}
                    disabled={refunding}
                  >
                    {refunding ? 'Processing...' : 'Request Refund'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolved Outcome */}
      {market.status === 'resolved' && (
        <div className="outcome-section">
          <h2>Final Outcome</h2>
          <div className={`outcome-card outcome-${market.outcome?.toLowerCase()}`}>
            <span className="outcome-label">Market Resolved:</span>
            <span className="outcome-value">{market.outcome}</span>
          </div>
        </div>
      )}
    </div>
  );
}
