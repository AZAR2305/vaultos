/**
 * Manual Wallet Connection Component
 * 
 * IMPORTANT: NO AUTO-CONNECT!
 * User must click "Connect Wallet" button
 * 
 * After connection:
 * - Shows wallet address
 * - Shows native balance
 * - Enables Yellow Network session creation
 */
import React, { useState } from 'react';
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';

const WalletConnect: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });
  const [showConnectors, setShowConnectors] = useState(false);

  return (
    <div className="wallet-section">
      {!isConnected ? (
        <div className="wallet-disconnected">
          <div className="wallet-icon">💼</div>
          <h3>Connect Your Wallet</h3>
          <p className="wallet-description">
            Connect your Web3 wallet to access Yellow Network prediction markets
          </p>
          
          {!showConnectors ? (
            <button 
              onClick={() => setShowConnectors(true)}
              className="btn btn-primary btn-large"
            >
              🔗 Connect Wallet
            </button>
          ) : (
            <div className="connector-list">
              {connectors.map((connector) => (
                <button
                  key={connector.id}
                  onClick={() => {
                    connect({ connector });
                    setShowConnectors(false);
                  }}
                  disabled={isPending}
                  className="connector-button"
                >
                  <span className="connector-icon">🦊</span>
                  <span>{connector.name}</span>
                </button>
              ))}
              <button 
                onClick={() => setShowConnectors(false)}
                className="btn btn-secondary btn-small"
              >
                Cancel
              </button>
            </div>
          )}
          
          <div className="wallet-features">
            <div className="feature-badge">⚡ Off-chain Trading</div>
            <div className="feature-badge">💰 Zero Gas Fees</div>
            <div className="feature-badge">🔒 Secure Sessions</div>
          </div>
        </div>
      ) : (
        <div className="wallet-connected">
          <div className="wallet-header">
            <div className="status-indicator">
              <span className="status-dot"></span>
              <span className="status-text">Connected</span>
            </div>
          </div>
          
          <div className="wallet-details">
            <div className="detail-row">
              <span className="detail-label">Address</span>
              <span className="detail-value address-value">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
            </div>
            
            {balance && (
              <div className="detail-row">
                <span className="detail-label">Balance</span>
                <span className="detail-value">
                  {parseFloat(balance.formatted).toFixed(4)} {balance.symbol}
                </span>
              </div>
            )}
          </div>
          
          <button 
            onClick={() => disconnect()} 
            className="btn btn-secondary btn-small"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export default WalletConnect;