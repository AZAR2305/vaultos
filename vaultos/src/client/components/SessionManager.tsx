/**
 * Yellow Network Session Manager - MOCK VERSION
 * 
 * Demonstrates session lifecycle with mock data
 * In production: handles OFF-CHAIN state channel creation
 */
import React, { useState } from 'react';
import { useAccount } from 'wagmi';

interface Session {
  sessionId: string;
  channelId: string;
  depositAmount: string;
  createdAt: number;
  expiresAt: number;
}

interface SessionManagerProps {
  onSessionChange?: (session: Session | null) => void;
}

const SessionManager: React.FC<SessionManagerProps> = ({ onSessionChange }) => {
  const { address, isConnected } = useAccount();
  const [session, setSession] = useState<Session | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>('1000');
  const [loading, setLoading] = useState(false);

  const createSession = () => {
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }

    setLoading(true);
    
    // Simulate session creation
    setTimeout(() => {
      const newSession: Session = {
        sessionId: `session_${Date.now()}`,
        channelId: `channel_${Math.random().toString(36).substring(7)}`,
        depositAmount,
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      };
      
      setSession(newSession);
      onSessionChange && onSessionChange(newSession);
      setLoading(false);
    }, 1500);
  };

  const closeSession = () => {
    if (confirm('Close trading session and settle?')) {
      setSession(null);
      onSessionChange && onSessionChange(null);
    }
  };

  return (
    <div className="session-manager">
      <h2>[ SESSION_MANAGER ]</h2>
      
      <div style={{ padding: '20px' }}>
        {!session ? (
          <>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '15px' }}>
              {'> Create a trading session to begin'}
            </p>
            
            <div className="input-group">
              <label>DEPOSIT AMOUNT (USDC):</label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="input"
                disabled={!isConnected}
              />
            </div>

            <button
              onClick={createSession}
              disabled={loading || !isConnected}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              {loading ? '[CREATING...]' : '[CREATE SESSION]'}
            </button>

            {!isConnected && (
              <p style={{ 
                color: 'var(--text-secondary)', 
                fontSize: '0.75rem', 
                marginTop: '10px',
                textAlign: 'center'
              }}>
                {'> Connect wallet first'}
              </p>
            )}
          </>
        ) : (
          <>
            <div className="session-card">
              <p style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--accent-retro)' }}>SESSION_ID:</span>
                <br />
                <span style={{ fontSize: '0.75rem' }}>
                  {session.sessionId.substring(0, 20)}...
                </span>
              </p>
              <p style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--accent-retro)' }}>CHANNEL:</span>
                <br />
                <span style={{ fontSize: '0.75rem' }}>{session.channelId}</span>
              </p>
              <p style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--accent-retro)' }}>DEPOSIT:</span> ${session.depositAmount} USDC
              </p>
              <p style={{ fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--accent-retro)' }}>EXPIRES:</span>{' '}
                {new Date(session.expiresAt).toLocaleString()}
              </p>
            </div>

            <button
              onClick={closeSession}
              className="btn btn-secondary"
              style={{ width: '100%' }}
            >
              [CLOSE SESSION]
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default SessionManager;
