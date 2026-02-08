import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import YellowConnect from './components/YellowConnect';
import MarketList from './components/MarketList';
import TradePanel from './components/TradePanel';
import AdminPanel from './components/AdminPanel';
import './styles/theme.css';

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  
  const [yellowConnected, setYellowConnected] = useState(false);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [currentView, setCurrentView] = useState<'markets' | 'trade' | 'admin'>('markets');
  
  // Check if user is admin (you can customize this logic)
  const isAdmin = address === '0xFefa60F5aA4069F96b9Bf65c814DDb3A604974e1'; // Your wallet

  useEffect(() => {
    if (!isConnected) {
      setYellowConnected(false);
      setChannelId(null);
      setSessionId(null);
    }
  }, [isConnected]);

  const handleWalletConnect = async () => {
    try {
      connect({ connector: injected() });
    } catch (error) {
      console.error('Wallet connection failed:', error);
    }
  };

  const handleYellowConnect = async (channel: string, session: string, bal: string) => {
    setYellowConnected(true);
    setChannelId(channel);
    setSessionId(session);
    setBalance(bal);
  };

  const handleDisconnect = () => {
    disconnect();
    setYellowConnected(false);
    setChannelId(null);
    setSessionId(null);
    setBalance('0');
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="logo">
              <span className="logo-icon">⚡</span>
              Bettify
            </h1>
            <span className="subtitle">Instant Prediction Markets</span>
          </div>
          
          <div className="header-right">
            {isConnected ? (
              <>
                <div className="wallet-info">
                  <div className="wallet-badge">
                    <span className="wallet-icon">👛</span>
                    <span className="wallet-address">
                      {address?.slice(0, 6)}...{address?.slice(-4)}
                    </span>
                  </div>
                  {yellowConnected && (
                    <div className="balance-badge">
                      <span className="balance-icon">💰</span>
                      <span className="balance-amount">{balance} USDC</span>
                    </div>
                  )}
                </div>
                <button className="btn-disconnect" onClick={handleDisconnect}>
                  Disconnect
                </button>
              </>
            ) : (
              <button className="btn-connect" onClick={handleWalletConnect}>
                <span className="btn-icon">🔗</span>
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container">
        {!isConnected ? (
          // Welcome Screen
          <div className="welcome-screen">
            <div className="welcome-card">
              <div className="welcome-icon">🚀</div>
              <h2>Welcome to Bettify</h2>
              <p className="welcome-subtitle">
                Trade on prediction markets with instant execution and zero gas fees
              </p>
              
              <div className="features-grid">
                <div className="feature-item">
                  <div className="feature-icon">⚡</div>
                  <h3>Instant Trading</h3>
                  <p>Execute trades in &lt;100ms with no gas fees</p>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">🔐</div>
                  <h3>Secure Sessions</h3>
                  <p>Session keys protect your main wallet</p>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">📊</div>
                  <h3>LMSR AMM</h3>
                  <p>Dynamic odds with proven market maker</p>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">🌐</div>
                  <h3>Yellow Network</h3>
                  <p>Layer 3 state channels for scalability</p>
                </div>
              </div>

              <button className="btn-primary btn-large" onClick={handleWalletConnect}>
                <span className="btn-icon">🔗</span>
                Connect Wallet to Start
              </button>

              <div className="how-it-works">
                <h3>How It Works</h3>
                <ol>
                  <li>Connect your wallet (MetaMask or any Web3 wallet)</li>
                  <li>Create Yellow Network session with channel</li>
                  <li>Browse markets or create your own (admin only)</li>
                  <li>Trade YES/NO shares with instant execution</li>
                  <li>Track positions and settle winnings</li>
                </ol>
              </div>
            </div>
          </div>
        ) : !yellowConnected ? (
          // Yellow Network Connection
          <div className="yellow-connect-screen">
            <YellowConnect
              walletAddress={address!}
              onConnected={handleYellowConnect}
            />
          </div>
        ) : (
          // Main App
          <div className="main-app">
            {/* Sidebar */}
            <aside className="sidebar">
              <div className="connection-status">
                <div className="status-item">
                  <span className="status-icon connected">●</span>
                  <span className="status-label">Wallet Connected</span>
                </div>
                <div className="status-item">
                  <span className="status-icon connected">●</span>
                  <span className="status-label">Yellow Network</span>
                </div>
              </div>

              <div className="session-info">
                <h3>Session Info</h3>
                <div className="info-item">
                  <span className="info-label">Channel ID:</span>
                  <span className="info-value" title={channelId || ''}>
                    {channelId?.slice(0, 10)}...
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Session:</span>
                  <span className="info-value" title={sessionId || ''}>
                    {sessionId?.slice(0, 10)}...
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Balance:</span>
                  <span className="info-value balance">{balance} USDC</span>
                </div>
              </div>

              <nav className="sidebar-nav">
                <button
                  className={`nav-btn ${currentView === 'markets' ? 'active' : ''}`}
                  onClick={() => setCurrentView('markets')}
                >
                  <span className="nav-icon">📊</span>
                  <span className="nav-label">Markets</span>
                </button>
                <button
                  className={`nav-btn ${currentView === 'trade' ? 'active' : ''}`}
                  onClick={() => setCurrentView('trade')}
                >
                  <span className="nav-icon">💱</span>
                  <span className="nav-label">Trade</span>
                </button>
                {isAdmin && (
                  <button
                    className={`nav-btn ${currentView === 'admin' ? 'active' : ''}`}
                    onClick={() => setCurrentView('admin')}
                  >
                    <span className="nav-icon">⚙️</span>
                    <span className="nav-label">Admin</span>
                  </button>
                )}
              </nav>
            </aside>

            {/* Main Content */}
            <main className="main-content">
              {currentView === 'markets' && (
                <MarketListNew />
              )}
              {currentView === 'trade' && (
                <TradePanelNew />
              )}
              {currentView === 'admin' && isAdmin && (
                <AdminPanel
                  channelId={channelId!}
                  sessionId={sessionId!}
                />
              )}
            </main>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <p>Powered by Yellow Network • LMSR AMM • Base Sepolia Testnet</p>
          <p className="footer-links">
            <a href="https://yellow.org" target="_blank" rel="noopener noreferrer">
              Yellow Network
            </a>
            {' • '}
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
