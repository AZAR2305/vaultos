import React from 'react';

const LedgerBalanceCard: React.FC = () => {
  // Mock ledger balance data (Yellow Network off-chain)
  const ledgerBalance = {
    total: 1250.75,
    currency: 'ytest.usd',
    available: 950.00,
    reserved: 300.75,
    pending: 0.00,
    lastUpdate: new Date().toLocaleTimeString()
  };

  return (
    <div className="window-frame ledger-balance-card">
      <div className="balance-header">
        {'[ OFF-CHAIN LEDGER BALANCE ]'}
        <br />
        <span style={{ fontSize: '0.7rem', color: 'var(--accent-retro)' }}>
          {'> Powered by Yellow Network'}
        </span>
      </div>

      <div className="balance-amount">
        {ledgerBalance.total.toFixed(2)}
      </div>
      <div className="balance-label">
        {ledgerBalance.currency.toUpperCase()}
      </div>

      <div className="balance-details">
        <div className="detail-item">
          <span className="detail-label">Available:</span>
          <span className="detail-value">${ledgerBalance.available.toFixed(2)}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Reserved:</span>
          <span className="detail-value">${ledgerBalance.reserved.toFixed(2)}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Pending:</span>
          <span className="detail-value">${ledgerBalance.pending.toFixed(2)}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Last Update:</span>
          <span className="detail-value">{ledgerBalance.lastUpdate}</span>
        </div>
      </div>

      <div className="terminal-section" style={{ marginTop: '15px', padding: '10px', background: 'var(--bg-color)' }}>
        <div className="terminal-row">
          <span className="output" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {'> Read-only display • Managed by Yellow Network state channels'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default LedgerBalanceCard;
