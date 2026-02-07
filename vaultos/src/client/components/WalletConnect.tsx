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
    <div className="wallet-connect">
      <h2>[ WALLET_LINK ]</h2>
      
      <div style={{ padding: '20px' }}>
        {!isConnected ? (
          <>
            {!showConnectors ? (
              <>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px', textAlign: 'center' }}>
                  {'> Connect Web3 wallet to access Yellow Network markets'}
                </p>
                <div className="compact-options">
                  <div 
                    onClick={() => setShowConnectors(true)}
                    className="option-card clickable"
                  >
                    <div className="option-label">[CONNECT WALLET]</div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="compact-options" style={{ marginBottom: '15px' }}>
                  {connectors.map((connector) => (
                    <div
                      key={connector.id}
                      onClick={() => {
                        if (!isPending) {
                          connect({ connector });
                          setShowConnectors(false);
                        }
                      }}
                      className={`option-card clickable ${isPending ? 'disabled' : ''}`}
                    >
                      <div className="option-label">{connector.name}</div>
                    </div>
                  ))}
                </div>
                <div className="compact-options">
                  <div 
                    onClick={() => setShowConnectors(false)}
                    className="option-card clickable secondary"
                  >
                    <div className="option-label">[CANCEL]</div>
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div style={{ marginBottom: '20px' }}>
              <p style={{ color: 'var(--accent-retro)', fontSize: '0.75rem', marginBottom: '5px' }}>
                STATUS: CONNECTED
              </p>
              <p className="wallet-address" style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>
                {address?.slice(0, 8)}...{address?.slice(-6)}
              </p>
            </div>
            
            {balance && (
              <div style={{ 
                background: 'var(--bg-color)', 
                border: '2px solid var(--border-color)', 
                padding: '10px',
                marginBottom: '15px'
              }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  BALANCE:
                </p>
                <p style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--accent-retro)' }}>
                  {parseFloat(balance.formatted).toFixed(4)} {balance.symbol}
                </p>
              </div>
            )}
            
            <div className="compact-options">
              <div 
                onClick={() => disconnect()}
                className="option-card clickable secondary"
              >
                <div className="option-label">[DISCONNECT]</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WalletConnect;