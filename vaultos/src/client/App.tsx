import React, { useState, useEffect } from 'react';
import WalletConnect from './components/WalletConnect';
import SessionManager from './components/SessionManager';
import MarketList from './components/MarketList';
import TradePanel from './components/TradePanel';
import BalanceDisplay from './components/BalanceDisplay';

const App = () => {
  const [currentView, setCurrentView] = useState<'landing' | 'profile' | 'dashboard' | 'markets' | 'trade'>('landing');
  const [systemTime, setSystemTime] = useState('');

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      const timeStr =
        now.getHours().toString().padStart(2, '0') +
        ':' +
        now.getMinutes().toString().padStart(2, '0') +
        ':' +
        now.getSeconds().toString().padStart(2, '0');
      setSystemTime(`SYS_UP: ${timeStr} | GAS: 0 GWEI | STATUS: ONLINE`);
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app">
      {currentView === 'landing' ? (
        // LANDING PAGE - No header, full screen hero
        <div className="landing-page">
          {/* Hero Section with App Name */}
          <div className="landing-hero">
            <div className="hero-glitch">
              <p className="hero-subtitle">{'[ INITIALIZING PROTOCOL... ]'}</p>
              <h1 className="app-title">
                <span className="title-line">VAULT</span>
                <span className="title-line accent">OS</span>
              </h1>
              <p className="hero-tagline">NEXT-GEN PREDICTION MARKETS</p>
              <div className="hero-specs">
                <span>YELLOW NETWORK</span>
                <span className="separator">•</span>
                <span>ZERO GAS</span>
                <span className="separator">•</span>
                <span>INSTANT TRADES</span>
              </div>
            </div>

            {/* Navigation Cards */}
            <div className="landing-nav">
              <div className="nav-card" onClick={() => setCurrentView('markets')}>
                <div className="card-icon">📊</div>
                <h3>[MARKETS]</h3>
                <p>Browse active prediction markets</p>
              </div>
              <div className="nav-card" onClick={() => setCurrentView('trade')}>
                <div className="card-icon">💱</div>
                <h3>[TRADE]</h3>
                <p>Execute instant trades</p>
              </div>
              <div className="nav-card" onClick={() => setCurrentView('dashboard')}>
                <div className="card-icon">📈</div>
                <h3>[DASHBOARD]</h3>
                <p>View your positions & balance</p>
              </div>
              <div className="nav-card" onClick={() => setCurrentView('profile')}>
                <div className="card-icon">👤</div>
                <h3>[PROFILE]</h3>
                <p>Manage wallet & sessions</p>
              </div>
            </div>

            {/* Stats Bar */}
            <div className="stats-bar">
              <div className="stat-item">
                <div className="stat-val">&lt;100ms</div>
                <div className="stat-label">Trade Latency</div>
              </div>
              <div className="stat-item">
                <div className="stat-val">0%</div>
                <div className="stat-label">Gas Fees</div>
              </div>
              <div className="stat-item">
                <div className="stat-val">5%</div>
                <div className="stat-label">Idle APR</div>
              </div>
              <div className="stat-item">
                <div className="stat-val">25%</div>
                <div className="stat-label">Refundable</div>
              </div>
            </div>

            {/* Features */}
            <div className="features">
              <div className="feature-card">
                <h3>⚡ INSTANT TRADING</h3>
                <p>
                  Execute trades in &lt;100ms through Yellow Network's off-chain state channels. 
                  No gas fees, no waiting. Pure speed.
                </p>
              </div>
              <div className="feature-card">
                <h3>🔐 SESSION SECURITY</h3>
                <p>
                  Session keys protect your main wallet while enabling seamless trading. 
                  Your assets stay safe in your control.
                </p>
              </div>
              <div className="feature-card">
                <h3>💰 YIELD GENERATION</h3>
                <p>
                  Idle collateral automatically earns 5% APR. Your money works for you 
                  even when you're not trading.
                </p>
              </div>
              <div className="feature-card">
                <h3>🔄 PARTIAL REFUNDS</h3>
                <p>
                  Unlike traditional prediction markets, recover up to 25% of your capital 
                  before market resolution.
                </p>
              </div>
            </div>

            {/* Terminal Section */}
            <div className="terminal-section">
              <div className="terminal-row">
                <span className="prompt">{'user@vaultos:~$'}</span>
                <span className="command">query market_status --all</span>
              </div>
              <div className="terminal-row">
                <span className="output">{'> Scanning active prediction markets...'}</span>
              </div>
              <div className="terminal-row">
                <span className="output">{'[████████████████] 100% - MARKET_ENGINE: OPERATIONAL'}</span>
              </div>
              <div className="terminal-row">
                <span className="output">{'[████████████████] 100% - YELLOW_NETWORK: CONNECTED'}</span>
              </div>
              <div className="terminal-row">
                <span className="output">{'[████████████████] 100% - SUI_SETTLEMENT: ACTIVE'}</span>
              </div>
              <div className="terminal-row">
                <span className="output">{'[████████████████] 100% - WALRUS_STORAGE: SYNCED'}</span>
              </div>
              <div className="terminal-row">
                <span className="prompt">{'user@vaultos:~$'}</span>
                <span className="command">start trading_session</span>
              </div>
              <div className="terminal-row">
                <span className="output">
                  {"> Ready to trade. Connect wallet to begin... "}
                  <span className="cursor-blink">_</span>
                </span>
              </div>
            </div>

            <div style={{ marginTop: '40px', textAlign: 'left' }}>
              <h3>HOW IT WORKS:</h3>
              <ol style={{ lineHeight: '2', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <li><strong style={{ color: 'var(--accent-retro)' }}>CONNECT:</strong> Link your Web3 wallet (MetaMask, WalletConnect, etc.)</li>
                <li><strong style={{ color: 'var(--accent-retro)' }}>DEPOSIT:</strong> Create a trading session with your desired collateral amount</li>
                <li><strong style={{ color: 'var(--accent-retro)' }}>TRADE:</strong> Browse markets and trade YES/NO shares with zero gas fees</li>
                <li><strong style={{ color: 'var(--accent-retro)' }}>EARN:</strong> Move idle funds to yield generation for passive 5% APR</li>
                <li><strong style={{ color: 'var(--accent-retro)' }}>WITHDRAW:</strong> Request partial refunds anytime or close session to settle</li>
              </ol>
            </div>
          </div>
        </div>
      ) : (
        // APP VIEWS - Header + Content
        <>
          <div className="header">
            <h1>
              <span className="bracket">{'['}</span>
              VAULT<span className="accent">OS</span>
              <span className="bracket">{']'}</span>
            </h1>
            <div className="status-bar">
              <span>{systemTime}</span>
            </div>
            <nav>
              <button
                className={currentView === 'markets' ? 'active' : ''}
                onClick={() => setCurrentView('markets')}
              >
                [MARKETS]
              </button>
              <button
                className={currentView === 'trade' ? 'active' : ''}
                onClick={() => setCurrentView('trade')}
              >
                [TRADE]
              </button>
              <button
                className={currentView === 'dashboard' ? 'active' : ''}
                onClick={() => setCurrentView('dashboard')}
              >
                [DASHBOARD]
              </button>
              <button
                className={currentView === 'profile' ? 'active' : ''}
                onClick={() => setCurrentView('profile')}
              >
                [PROFILE]
              </button>
              <button
                onClick={() => setCurrentView('landing')}
                style={{ marginLeft: 'auto', borderColor: 'var(--accent-retro)' }}
              >
                [HOME]
              </button>
            </nav>
          </div>

          <div className="main-container">
            {/* Sidebar for certain views */}
            {(currentView === 'profile' || currentView === 'dashboard' || currentView === 'trade') && (
              <div className="sidebar">
                <WalletConnect />
                <SessionManager />
                <BalanceDisplay />
              </div>
            )}

            <div className="content">
              {currentView === 'profile' && (
                <div className="profile-view">
                  <h2 style={{ fontSize: '2rem', fontFamily: 'Syne, sans-serif', fontWeight: 800, textTransform: 'uppercase', marginBottom: '20px' }}>
                    Profile Settings
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>
                    {'> Manage your wallet connection and trading sessions'}
                  </p>
                </div>
              )}

              {currentView === 'dashboard' && (
                <div className="dashboard-view">
                  <h2 style={{ fontSize: '2rem', fontFamily: 'Syne, sans-serif', fontWeight: 800, textTransform: 'uppercase', marginBottom: '20px' }}>
                    Trading Dashboard
                  </h2>
                  <p style={{ color: 'var(--accent-retro)', marginBottom: '30px' }}>
                    {'[ YOUR POSITIONS & BALANCE ]'}
                  </p>
                </div>
              )}

              {currentView === 'markets' && <MarketList />}
              {currentView === 'trade' && <TradePanel />}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default App;