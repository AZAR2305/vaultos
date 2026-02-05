/**
 * Yellow Network Session Manager
 * 
 * Handles OFF-CHAIN state channel creation:
 * 1. User deposits USDC → ON-CHAIN lock
 * 2. Yellow node opens state channel → OFF-CHAIN
 * 3. All trades happen OFF-CHAIN (instant, gasless)
 * 4. Close session → ON-CHAIN settlement
 * 
 * Session lifecycle:
 * - Create: Lock funds in Yellow smart contract
 * - Trade: Off-chain state updates (< 100ms)
 * - Close: Final settlement on-chain
 */
import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface Session {
  sessionId: string;
  channelId: string;
  depositAmount: string;
  createdAt: number;
  expiresAt: number;
  spentAmount: string;
  walletAddress: string;
}

interface SessionManagerProps {
  onSessionChange?: (session: Session | null) => void;
}

const SessionManager: React.FC<SessionManagerProps> = ({ onSessionChange }) => {
  const { address, isConnected } = useAccount();
  const [session, setSession] = useState<Session | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>('1000');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [creatingStep, setCreatingStep] = useState<number>(0);
  const [additionalDeposit, setAdditionalDeposit] = useState<string>('100');

  // Load existing session
  useEffect(() => {
    const loadSession = async () => {
      if (!address) return;
      
      try {
        const savedSession = localStorage.getItem(`session_${address}`);
        if (savedSession) {
          const parsed = JSON.parse(savedSession);
          // Check if session is still valid
          if (parsed.expiresAt > Date.now()) {
            setSession(parsed);
          } else {
            localStorage.removeItem(`session_${address}`);
          }
        }
      } catch (err) {
        console.error('Error loading session:', err);
      }
    };

    loadSession();
  }, [address]);

  const createSession = async () => {
    if (!address) {
      setError('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setError('');
    setCreatingStep(1);

    try {
      // Step 1: Lock funds on-chain (simulated)
      setCreatingStep(1);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Step 2: Open Yellow Network state channel
      setCreatingStep(2);
      const response = await fetch('http://localhost:3000/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          depositAmount: parseFloat(depositAmount),
        }),
      });

      if (!response.ok) throw new Error('Failed to create session');

      const data = await response.json();
      
      // Step 3: Initialize off-chain state
      setCreatingStep(3);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const sessionData = {
        ...data.session,
        spentAmount: '0',
        walletAddress: address
      };
      
      setSession(sessionData);
      if (onSessionChange) onSessionChange(sessionData);
      
      // Save to localStorage
      localStorage.setItem(`session_${address}`, JSON.stringify(sessionData));
      
      setCreatingStep(0);
    } catch (err: any) {
      setError(err.message);
      setCreatingStep(0);
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!session) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('http://localhost:3000/api/balance/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          amount: parseFloat(additionalDeposit),
        }),
      });

      if (!response.ok) throw new Error('Deposit failed');

      const data = await response.json();
      
      // Update session with new balance
      const updatedSession = {
        ...session,
        depositAmount: data.newBalance.toString()
      };
      
      setSession(updatedSession);
      if (onSessionChange) onSessionChange(updatedSession);
      localStorage.setItem(`session_${address}`, JSON.stringify(updatedSession));
      
      alert(`✅ Deposited ${additionalDeposit} USDC off-chain!`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Withdraw via API endpoint: POST /api/balance/withdraw
  // Test with: curl -X POST http://localhost:3000/api/balance/withdraw -H "Content-Type: application/json" -d '{"sessionId":"...","amount":100}'

  const closeSession = async () => {
    if (!session) return;

    setLoading(true);
    try {
      const response = await fetch('/api/session/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });

      if (!response.ok) throw new Error('Failed to close session');

      const data = await response.json();
      alert(`Session closed! Final balance: ${data.finalBalance} USDC`);
      
      setSession(null);
      if (address) {
        localStorage.removeItem(`session_${address}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="session-section">
        <div className="session-locked">
          <div className="lock-icon">🔒</div>
          <p className="lock-message">Connect wallet to start trading</p>
        </div>
      </div>
    );
  }

  return (
    <div className="session-section">
      <h2>⚡ Yellow Network Session</h2>
      
      {!session ? (
        <div className="session-create">
          <div className="yellow-flow">
            <div className="flow-badge on-chain">🔒 ON-CHAIN</div>
            <div className="flow-arrow">↓</div>
            <div className="flow-badge off-chain">⚡ OFF-CHAIN</div>
          </div>
          
          <p className="session-description">
            Create a Yellow Network state channel for instant, gasless trading
          </p>
          
          <div className="input-group">
            <label>Initial Deposit (USDC)</label>
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              min="10"
              step="10"
              className="input input-large"
              disabled={loading}
            />
          </div>
          
          {loading && creatingStep > 0 && (
            <div className="creation-steps">
              <div className={`step ${creatingStep >= 1 ? 'active' : ''}`}>
                <span className="step-icon">🔒</span>
                <span className="step-text">Locking funds on-chain...</span>
              </div>
              <div className={`step ${creatingStep >= 2 ? 'active' : ''}`}>
                <span className="step-icon">📡</span>
                <span className="step-text">Opening Yellow state channel...</span>
              </div>
              <div className={`step ${creatingStep >= 3 ? 'active' : ''}`}>
                <span className="step-icon">⚡</span>
                <span className="step-text">Initializing off-chain state...</span>
              </div>
            </div>
          )}
          
          <button
            onClick={createSession}
            disabled={loading || !depositAmount || parseFloat(depositAmount) < 10}
            className="btn btn-primary btn-large"
          >
            {loading ? '⏳ Creating Session...' : '🚀 Start Trading Session'}
          </button>
          
          <div className="session-benefits">
            <div className="benefit-item">
              <span className="benefit-icon">⚡</span>
              <span className="benefit-text">Instant trades (&lt;100ms)</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">💰</span>
              <span className="benefit-text">Zero gas fees</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">🔄</span>
              <span className="benefit-text">25% refundable</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="session-active">
          <div className="session-status">
            <div className="status-badge active">
              <span className="pulse-dot"></span>
              <span>ACTIVE SESSION</span>
            </div>
          </div>
          
          <div className="session-details">
            <div className="detail-card">
              <div className="detail-header">Channel Balance</div>
              <div className="detail-value balance-value">
                {(parseFloat(session.depositAmount) - parseFloat(session.spentAmount || '0')).toFixed(2)} <span className="currency">USDC</span>
              </div>
              <div className="detail-meta">⚡ Off-chain</div>
            </div>
            
            <div className="detail-card">
              <div className="detail-header">Session ID</div>
              <div className="detail-value small">
                {session.sessionId.slice(0, 12)}...
              </div>
            </div>
            
            <div className="detail-card">
              <div className="detail-header">Channel ID</div>
              <div className="detail-value small">
                {session.channelId.slice(0, 12)}...
              </div>
            </div>
          </div>
          
          <div className="session-actions">
            <div className="action-section">
              <h4>💰 Deposit Funds</h4>
              <div className="action-input-group">
                <input
                  type="number"
                  value={additionalDeposit}
                  onChange={(e) => setAdditionalDeposit(e.target.value)}
                  min="10"
                  step="10"
                  className="input"
                  placeholder="Amount"
                />
                <button
                  onClick={handleDeposit}
                  disabled={loading}
                  className="btn btn-success"
                >
                  Deposit
                </button>
              </div>
              <p className="action-note">
                💡 <strong>Withdraw via API:</strong> POST /api/balance/withdraw
                <br/>
                Example: <code>curl -X POST http://localhost:3000/api/balance/withdraw -H &quot;Content-Type: application/json&quot; -d &apos;&#123;&quot;sessionId&quot;:&quot;YOUR_SESSION_ID&quot;,&quot;amount&quot;:100&#125;&apos;</code>
              </p>
            </div>
          </div>
          
          <button
            onClick={closeSession}
            disabled={loading}
            className="btn btn-danger btn-block"
          >
            {loading ? 'Closing...' : '🔒 Close & Settle On-Chain'}
          </button>
          
          <div className="session-info-text">
            <p>💡 All trades happen OFF-CHAIN in Yellow Network</p>
            <p>🔒 Final settlement ON-CHAIN when you close</p>
          </div>
        </div>
      )}

      {error && <div className="error-message">❌ {error}</div>}
    </div>
  );
};

export default SessionManager;
