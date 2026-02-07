import React, { useState, useEffect } from 'react';
import WalletConnect from './components/WalletConnect';
import SessionManager from './components/SessionManager';
import MarketList from './components/MarketList';
import TradePanel from './components/TradePanel';
import BalanceDisplay from './components/BalanceDisplay';
import PositionsView from './components/PositionsView';
import LedgerBalanceCard from './components/LedgerBalanceCard';
import MarketResolutionPanel from './components/MarketResolutionPanel';
import TradeHistory from './components/TradeHistory';
import CommunityChatMonitor from './components/CommunityChatMonitor';

const App = () => {
  const [currentView, setCurrentView] = useState<'landing' | 'profile' | 'dashboard' | 'markets' | 'trade' | 'admin' | 'community'>('landing');
  const [systemTime, setSystemTime] = useState('');
  const [isAdmin, setIsAdmin] = useState(false); // Set to true for admin access

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
              <h1 className="app-title">VAULTOS</h1>
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
              <div className="nav-card market-card" onClick={() => setCurrentView('markets')}>
                <div className="market-card-header">OPTION_01 • NAVIGATE</div>
                <div className="market-card-body">
                  <h3>MARKETS</h3>
                  <p className="market-description">Browse prediction markets</p>
                </div>
              </div>
              <div className="nav-card market-card" onClick={() => setCurrentView('trade')}>
                <div className="market-card-header">OPTION_02 • NAVIGATE</div>
                <div className="market-card-body">
                  <h3>TRADE</h3>
                  <p className="market-description">Execute instant trades</p>
                </div>
              </div>
              <div className="nav-card market-card" onClick={() => setCurrentView('dashboard')}>
                <div className="market-card-header">OPTION_03 • NAVIGATE</div>
                <div className="market-card-body">
                  <h3>DASHBOARD</h3>
                  <p className="market-description">View your positions</p>
                </div>
              </div>
              <div className="nav-card market-card" onClick={() => setCurrentView('profile')}>
                <div className="market-card-header">OPTION_04 • NAVIGATE</div>
                <div className="market-card-body">
                  <h3>PROFILE</h3>
                  <p className="market-description">Manage your account</p>
                </div>
              </div>
              <div className="nav-card market-card" onClick={() => setCurrentView('community')}>
                <div className="market-card-header">OPTION_05 • NAVIGATE</div>
                <div className="market-card-body">
                  <h3>COMMUNITY</h3>
                  <p className="market-description">Join market discussions</p>
                </div>
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
          </div>
        </div>
      ) : (
        // APP VIEWS - Header + Content
        <>
          <div className="header">
            <h1 className="header-title">
              <span className="title-bracket">[</span>
              <span className="title-text">VAULTOS</span>
              <span className="title-bracket">]</span>
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
                className={currentView === 'community' ? 'active' : ''}
                onClick={() => setCurrentView('community')}
              >
                [COMMUNITY]
              </button>
              {isAdmin && (
                <button
                  className={currentView === 'admin' ? 'active' : ''}
                  onClick={() => setCurrentView('admin')}
                  style={{ borderColor: 'var(--accent-retro)', color: 'var(--accent-retro)' }}
                >
                  [ADMIN]
                </button>
              )}
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
                <LedgerBalanceCard />
              </div>
            )}

            <div className="content">
              {currentView === 'profile' && (
                <div className="profile-view">
                  {/* Profile content managed via sidebar components */}
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
                  
                  <div className="dashboard-grid">
                    {/* Positions View */}
                    <div className="dashboard-section">
                      <PositionsView />
                    </div>
                    
                    {/* Trade History */}
                    <div className="dashboard-section">
                      <TradeHistory />
                    </div>

                    {/* Community Chat */}
                    <div className="dashboard-section">
                      <CommunityChatMonitor />
                    </div>
                  </div>
                </div>
              )}

              {currentView === 'markets' && <MarketList />}
              
              {currentView === 'trade' && (
                <div>
                  <TradePanel />
                  <div style={{ marginTop: '30px' }}>
                    <TradeHistory />
                  </div>
                  <div style={{ marginTop: '30px' }}>
                    <CommunityChatMonitor />
                  </div>
                </div>
              )}

              {currentView === 'community' && (
                <div className="community-view">
                  <h2 style={{ fontSize: '2rem', fontFamily: 'Syne, sans-serif', fontWeight: 800, textTransform: 'uppercase', marginBottom: '20px' }}>
                    Community Hub
                  </h2>
                  <p style={{ color: 'var(--accent-retro)', marginBottom: '30px' }}>
                    {'[ REAL-TIME MARKET DISCUSSION ]'}
                  </p>
                  <CommunityChatMonitor />
                </div>
              )}
              
              {currentView === 'admin' && (
                <div className="admin-view">
                  <h2 style={{ fontSize: '2rem', fontFamily: 'Syne, sans-serif', fontWeight: 800, textTransform: 'uppercase', marginBottom: '20px', color: 'var(--accent-retro)' }}>
                    ⚡ ADMIN CONTROL PANEL
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>
                    {'> System administration and market resolution'}
                  </p>
                  
                  <MarketResolutionPanel isAdmin={isAdmin} />
                  
                  <div style={{ marginTop: '30px' }}>
                    <TradeHistory />
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default App;