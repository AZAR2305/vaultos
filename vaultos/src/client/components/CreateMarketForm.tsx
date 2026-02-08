/**
 * Create Market Form
 * Allows admins to create new prediction markets
 */
import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface CreateMarketFormProps {
  onMarketCreated?: () => void;
  onCancel?: () => void;
}

const CreateMarketForm: React.FC<CreateMarketFormProps> = ({ onMarketCreated, onCancel }) => {
  const { address } = useAccount();
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [endDate, setEndDate] = useState('');
  const [liquidity, setLiquidity] = useState('10');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);

  // Check balance when component mounts
  useEffect(() => {
    if (address) {
      checkBalance();
    }
  }, [address]);

  const checkBalance = async () => {
    if (!address) return;
    
    try {
      setCheckingBalance(true);
      const sessionKey = `session_${address}`;
      const savedSession = localStorage.getItem(sessionKey);
      
      if (!savedSession) {
        setUserBalance(null);
        return;
      }
      
      const session = JSON.parse(savedSession);
      
      // Query balance from backend
      const response = await fetch(`http://localhost:3000/api/balance/${session.sessionId}`);
      if (response.ok) {
        const data = await response.json();
        // Balance is in 6 decimals, convert to regular number
        const balance = data.balance / 1_000_000;
        setUserBalance(balance);
      }
    } catch (err) {
      console.error('Error checking balance:', err);
    } finally {
      setCheckingBalance(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!address) {
      setError('Please connect your wallet');
      return;
    }

    if (!question || !endDate) {
      setError('Question and end date are required');
      return;
    }

    const liquidityAmount = parseFloat(liquidity);
    if (userBalance !== null && liquidityAmount > userBalance) {
      setError(`Insufficient balance! You have ${userBalance.toFixed(2)} ytest.USD but need ${liquidityAmount.toFixed(2)} ytest.USD to create this market.`);
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Get or create session first
      const sessionKey = `session_${address}`;
      const savedSession = localStorage.getItem(sessionKey);
      
      if (!savedSession) {
        setError('Please create a Yellow Network session first (in sidebar)');
        setLoading(false);
        return;
      }

      const session = JSON.parse(savedSession);

      // Calculate duration in days from end date
      const now = new Date();
      const end = new Date(endDate);
      const durationMs = end.getTime() - now.getTime();
      const durationDays = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60 * 24)));

      // Convert liquidity to 6 decimals (USDC format)
      const liquidityWith6Decimals = parseFloat(liquidity) * 1_000_000;

      const response = await fetch('http://localhost:3000/api/markets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          channelId: session.channelId,
          question,
          description,
          durationDays: durationDays,
          liquidity: liquidityWith6Decimals,
          creatorAddress: address
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(`✅ Market created successfully!\n\nMarket ID: ${data.marketId}\nQuestion: ${question}\nLiquidity: ${liquidity} ytest.USD transferred to clearnode`);
        
        // Reset form
        setQuestion('');
        setDescription('');
        setEndDate('');
        setLiquidity('10');
        
        // Refresh balance
        checkBalance();
        
        if (onMarketCreated) {
          setTimeout(() => onMarketCreated(), 2000);
        }
      } else {
        setError(data.error || 'Failed to create market');
      }
    } catch (err) {
      console.error('Error creating market:', err);
      setError('Network error. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '2px solid var(--accent-retro)',
      borderRadius: '8px',
      padding: '30px',
      maxWidth: '600px',
      margin: '20px auto'
    }}>
      <h2 style={{
        fontSize: '1.5rem',
        color: 'var(--accent-retro)',
        marginBottom: '20px',
        fontFamily: 'Space Mono, monospace',
        textTransform: 'uppercase'
      }}>
        [ CREATE NEW MARKET ]
      </h2>

      {checkingBalance && (
        <div style={{
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid #3b82f6',
          borderRadius: '4px',
          padding: '10px',
          marginBottom: '20px',
          color: '#3b82f6',
          fontSize: '0.9rem'
        }}>
          🔄 Checking your balance...
        </div>
      )}

      {userBalance !== null && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid #22c55e',
          borderRadius: '4px',
          padding: '10px',
          marginBottom: '20px',
          color: '#22c55e',
          fontSize: '0.9rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>💰 Your Balance: <strong>{userBalance.toFixed(2)} ytest.USD</strong></span>
          <button
            type="button"
            onClick={checkBalance}
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
          borderRadius: '4px',
          padding: '10px',
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
          borderRadius: '4px',
          padding: '10px',
          marginBottom: '20px',
          color: '#22c55e',
          fontSize: '0.9rem',
          whiteSpace: 'pre-line'
        }}>
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            color: 'var(--accent-retro)',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            marginBottom: '8px',
            fontFamily: 'Space Mono, monospace',
            textTransform: 'uppercase'
          }}>
            Market Question *
          </label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g., Will BTC reach $150k by December 2026?"
            required
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--card-border)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
              fontFamily: 'inherit'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            color: 'var(--accent-retro)',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            marginBottom: '8px',
            fontFamily: 'Space Mono, monospace',
            textTransform: 'uppercase'
          }}>
            Description (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Additional details about resolution criteria..."
            rows={3}
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--card-border)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            color: 'var(--accent-retro)',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            marginBottom: '8px',
            fontFamily: 'Space Mono, monospace',
            textTransform: 'uppercase'
          }}>
            End Date & Time *
          </label>
          <input
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            min={new Date().toISOString().slice(0, 16)}
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--card-border)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
              fontFamily: 'inherit'
            }}
          />
        </div>

        <div style={{ marginBottom: '30px' }}>
          <label style={{
            display: 'block',
            color: 'var(--accent-retro)',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            marginBottom: '8px',
            fontFamily: 'Space Mono, monospace',
            textTransform: 'uppercase'
          }}>
            Initial Liquidity (ytest.USD)
          </label>
          <input
            type="number"
            value={liquidity}
            onChange={(e) => setLiquidity(e.target.value)}
            min="10"
            step="10"
            required
            max={userBalance || undefined}
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: parseFloat(liquidity) > (userBalance || Infinity) ? '2px solid #ef4444' : '1px solid var(--card-border)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
              fontFamily: 'inherit'
            }}
          />
          <p style={{
            color: parseFloat(liquidity) > (userBalance || Infinity) ? '#ef4444' : 'var(--text-secondary)',
            fontSize: '0.75rem',
            marginTop: '5px',
            fontStyle: 'italic'
          }}>
            {parseFloat(liquidity) > (userBalance || Infinity) 
              ? `⚠️ Exceeds your balance of ${userBalance?.toFixed(2)} ytest.USD!`
              : 'Minimum 10 ytest.USD. Higher liquidity = better pricing.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '15px' }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              flex: 1,
              padding: '14px',
              background: loading ? 'var(--text-secondary)' : 'var(--accent-retro)',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.95rem',
              fontWeight: 'bold',
              fontFamily: 'Space Mono, monospace',
              textTransform: 'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {loading ? '[CREATING...]' : '[CREATE MARKET]'}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              style={{
                flex: 1,
                padding: '14px',
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '2px solid var(--text-secondary)',
                borderRadius: '4px',
                fontSize: '0.95rem',
                fontWeight: 'bold',
                fontFamily: 'Space Mono, monospace',
                textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              [CANCEL]
            </button>
          )}
        </div>
      </form>

      <div style={{
        marginTop: '20px',
        padding: '15px',
        background: 'rgba(255, 215, 0, 0.05)',
        border: '1px solid rgba(255, 215, 0, 0.2)',
        borderRadius: '4px',
        fontSize: '0.8rem',
        color: 'var(--text-secondary)'
      }}>
        <strong style={{ color: 'var(--accent-retro)' }}>ℹ️ Requirements:</strong>
        <ul style={{ marginTop: '8px', marginLeft: '20px', lineHeight: '1.8' }}>
          <li>Connect wallet first</li>
          <li>Create Yellow Network session (in sidebar)</li>
          <li>Market uses LMSR AMM for pricing</li>
          <li>Trading opens immediately after creation</li>
        </ul>
      </div>
    </div>
  );
};

export default CreateMarketForm;
