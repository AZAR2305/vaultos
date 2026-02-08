import React, { useState } from 'react';
import WalletConnect from './components/WalletConnect';
import SessionManager from './components/SessionManager';
import MarketListNew from './components/MarketListNew';
import TradePanelNew from './components/TradePanelNew';
import BalanceDisplayNew from './components/BalanceDisplayNew';

const AppNew = () => {
  const [currentView, setCurrentView] = useState<'home' | 'markets' | 'trade'>('home');

  return (
    <div className="app">
      <header className="header">
        <h1>🚀 Bettify Prediction Market</h1>
        <p className="subtitle">Instant trading with Yellow Network state channels</p>
      </header>

      <div className="container">
        <div className="sidebar">
          <WalletConnect />
          <SessionManager />
          <BalanceDisplayNew />
        </div>

        <div className="main-content">
          <nav className="nav">
            <button 
              className={`nav-btn ${currentView === 'home' ? 'active' : ''}`}
              onClick={() => setCurrentView('home')}
            >
              🏠 Home
            </button>
            <button 
              className={`nav-btn ${currentView === 'markets' ? 'active' : ''}`}
              onClick={() => setCurrentView('markets')}
            >
              📊 Markets
            </button>
            <button 
              className={`nav-btn ${currentView === 'trade' ? 'active' : ''}`}
              onClick={() => setCurrentView('trade')}
            >
              💱 Trade
            </button>
          </nav>

          <div className="content">
            {currentView === 'home' && (
              <div className="home">
                <h2>Welcome to Bettify!</h2>
                <div className="features">
                  <div className="feature-card">
                    <h3>⚡ Instant Trading</h3>
                    <p>Trade with &lt;100ms latency, zero gas fees</p>
                  </div>
                  <div className="feature-card">
                    <h3>🔐 Secure Sessions</h3>
                    <p>Session keys protect your main wallet</p>
                  </div>
                  <div className="feature-card">
                    <h3>💰 Earn Yield</h3>
                    <p>Idle funds earn passive income</p>
                  </div>
                  <div className="feature-card">
                    <h3>🔄 Refundable</h3>
                    <p>Get up to 25% back anytime</p>
                  </div>
                </div>
                
                <div style={{ marginTop: '40px', textAlign: 'left', maxWidth: '800px', margin: '40px auto' }}>
                  <h3>How it works:</h3>
                  <ol style={{ lineHeight: '1.8', fontSize: '1.1rem' }}>
                    <li>Connect your wallet (MetaMask or any Web3 wallet)</li>
                    <li>Create a trading session with a deposit amount</li>
                    <li>Browse prediction markets or create your own</li>
                    <li>Trade YES/NO shares with instant execution</li>
                    <li>Move funds to idle to earn 5% APR</li>
                    <li>Request partial refund (up to 25%) anytime</li>
                    <li>Close session to settle and withdraw</li>
                  </ol>
                </div>
              </div>
            )}
            {currentView === 'markets' && <MarketListNew />}
            {currentView === 'trade' && <TradePanelNew />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppNew;
