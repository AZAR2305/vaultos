import React, { useState } from 'react';
import '../styles/yellow-connect.css';

interface YellowConnectProps {
  walletAddress: string;
  onConnected: (channelId: string, sessionId: string, balance: string) => void;
}

const YellowConnect: React.FC<YellowConnectProps> = ({ walletAddress, onConnected }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleConnect = async () => {
    setLoading(true);
    setStatus('Creating sandbox channel...');
    setError('');

    try {
      // Step 1: Create channel
      setStatus('🏗️ Creating Yellow Network channel...');
      const channelResponse = await fetch('/api/yellow/create-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });

      if (!channelResponse.ok) {
        throw new Error('Channel creation failed');
      }

      const channelData = await channelResponse.json();
      const channelId = channelData.channelId;
      
      setStatus(`✅ Channel created: ${channelId.slice(0, 10)}...`);
      
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 2: Create session
      setStatus('🔐 Creating session...');
      const sessionResponse = await fetch('/api/yellow/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, channelId }),
      });

      if (!sessionResponse.ok) {
        throw new Error('Session creation failed');
      }

      const sessionData = await sessionResponse.json();
      const sessionId = sessionData.sessionId;
      
      setStatus(`✅ Session created: ${sessionId.slice(0, 10)}...`);
      
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: Get balance
      setStatus('💰 Fetching balance...');
      const balanceResponse = await fetch(`/api/yellow/balance?address=${walletAddress}`);
      
      if (!balanceResponse.ok) {
        throw new Error('Balance fetch failed');
      }

      const balanceData = await balanceResponse.json();
      const balance = balanceData.balance || '60'; // Default from ledger
      
      setStatus('✅ Connected to Yellow Network!');
      
      await new Promise(resolve => setTimeout(resolve, 500));

      // Notify parent component
      onConnected(channelId, sessionId, balance);
      
    } catch (err: any) {
      console.error('Yellow Network connection error:', err);
      setError(err.message || 'Failed to connect to Yellow Network');
      setLoading(false);
    }
  };

  return (
    <div className="yellow-connect-card">
      <div className="yellow-icon">⚡</div>
      <h2>Connect to Yellow Network</h2>
      <p className="yellow-subtitle">
        Create a session channel for instant trading
      </p>

      <div className="yellow-info">
        <div className="info-box">
          <div className="info-icon">🌐</div>
          <div className="info-content">
            <h4>Layer 3 State Channels</h4>
            <p>Off-chain trading with instant finality</p>
          </div>
        </div>
        <div className="info-box">
          <div className="info-icon">⚡</div>
          <div className="info-content">
            <h4>Zero Gas Fees</h4>
            <p>Trade without paying network fees</p>
          </div>
        </div>
        <div className="info-box">
          <div className="info-icon">🔐</div>
          <div className="info-content">
            <h4>Secure Sessions</h4>
            <p>Session keys protect your main wallet</p>
          </div>
        </div>
      </div>

      <div className="yellow-wallet">
        <span className="wallet-label">Connected Wallet:</span>
        <code className="wallet-address-code">
          {walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}
        </code>
      </div>

      {status && !error && (
        <div className="status-message">
          {status}
        </div>
      )}

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      <button
        className="btn-yellow-connect"
        onClick={handleConnect}
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="spinner"></span>
            Connecting...
          </>
        ) : (
          <>
            <span className="btn-icon">⚡</span>
            Create Session Channel
          </>
        )}
      </button>

      <div className="yellow-note">
        <p>
          <strong>Note:</strong> This will create a sandbox channel using your ledger balance (60 ytest.USD).
          No on-chain transaction or gas fees required.
        </p>
      </div>
    </div>
  );
};

export default YellowConnect;
