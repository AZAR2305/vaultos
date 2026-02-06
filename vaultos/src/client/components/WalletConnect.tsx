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
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
                  {'> Connect Web3 wallet to access Yellow Network markets'}
                </p>
                <button 
                  onClick={() => setShowConnectors(true)}
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                >
                  [CONNECT WALLET]
                </button>
              </>
            ) : (
              <>
                <div style={{ marginBottom: '15px' }}>
                  {connectors.map((connector) => (
                    <button
                      key={connector.id}
                      onClick={() => {
                        connect({ connector });
                        setShowConnectors(false);
                      }}
                      disabled={isPending}
                      className="btn btn-primary"
                      style={{ width: '100%', marginBottom: '10px' }}
                    >
                      {connector.name}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => setShowConnectors(false)}
                  className="btn btn-secondary"
                  style={{ width: '100%' }}
                >
                  [CANCEL]
                </button>
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
            
            <button 
              onClick={() => disconnect()} 
              className="btn btn-secondary"
              style={{ width: '100%' }}
            >
              [DISCONNECT]
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default WalletConnect;