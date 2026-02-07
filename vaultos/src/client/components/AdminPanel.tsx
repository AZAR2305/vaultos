import React, { useState } from 'react';
import '../styles/admin.css';

interface AdminPanelProps {
  channelId: string;
  sessionId: string;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ channelId, sessionId }) => {
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [liquidity, setLiquidity] = useState('1000');
  const [durationDays, setDurationDays] = useState('30');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleCreateMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');

    try {
      const response = await fetch('/api/markets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          description,
          liquidity: parseFloat(liquidity) * 1_000_000, // Convert to 6 decimals
          durationDays: parseInt(durationDays),
          channelId,
          sessionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create market');
      }

      const data = await response.json();
      setSuccess(`✅ Market created successfully! ID: ${data.marketId}`);
      
      // Reset form
      setQuestion('');
      setDescription('');
      setLiquidity('1000');
      setDurationDays('30');
      
    } catch (err: any) {
      setError(err.message || 'Failed to create market');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h2>⚙️ Admin Panel</h2>
        <p className="admin-subtitle">Create and manage prediction markets</p>
      </div>

      <div className="admin-card">
        <h3>Create New Market</h3>
        
        <form onSubmit={handleCreateMarket} className="market-form">
          <div className="form-group">
            <label htmlFor="question">
              Market Question <span className="required">*</span>
            </label>
            <input
              id="question"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Will ETH reach $5000 by March 2026?"
              required
              maxLength={200}
              className="form-input"
            />
            <span className="form-hint">
              {question.length}/200 characters
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="description">
              Description (Optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional context about this market..."
              maxLength={500}
              rows={4}
              className="form-textarea"
            />
            <span className="form-hint">
              {description.length}/500 characters
            </span>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="liquidity">
                Initial Liquidity (USDC) <span className="required">*</span>
              </label>
              <input
                id="liquidity"
                type="number"
                value={liquidity}
                onChange={(e) => setLiquidity(e.target.value)}
                min="100"
                max="10000"
                step="100"
                required
                className="form-input"
              />
              <span className="form-hint">
                Controls price stability (higher = more stable)
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="duration">
                Duration (Days) <span className="required">*</span>
              </label>
              <input
                id="duration"
                type="number"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                min="1"
                max="365"
                required
                className="form-input"
              />
              <span className="form-hint">
                Market closes after this period
              </span>
            </div>
          </div>

          <div className="market-preview">
            <h4>Preview</h4>
            <div className="preview-content">
              <div className="preview-item">
                <span className="preview-label">Question:</span>
                <span className="preview-value">
                  {question || '(Not set)'}
                </span>
              </div>
              <div className="preview-item">
                <span className="preview-label">Initial Odds:</span>
                <span className="preview-value">50% YES / 50% NO</span>
              </div>
              <div className="preview-item">
                <span className="preview-label">Liquidity:</span>
                <span className="preview-value">{liquidity} USDC</span>
              </div>
              <div className="preview-item">
                <span className="preview-label">Closes:</span>
                <span className="preview-value">
                  {new Date(Date.now() + parseInt(durationDays || '30') * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {success && (
            <div className="success-message">
              {success}
            </div>
          )}

          {error && (
            <div className="error-message">
              ❌ {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-create-market"
            disabled={loading || !question}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Creating Market...
              </>
            ) : (
              <>
                <span className="btn-icon">✨</span>
                Create Market
              </>
            )}
          </button>
        </form>
      </div>

      <div className="admin-info">
        <div className="info-card">
          <div className="info-icon">💡</div>
          <div className="info-text">
            <h4>LMSR AMM</h4>
            <p>
              Markets use Logarithmic Market Scoring Rule for smooth price discovery.
              Liquidity parameter controls price sensitivity.
            </p>
          </div>
        </div>
        <div className="info-card">
          <div className="info-icon">⚡</div>
          <div className="info-text">
            <h4>Instant Settlement</h4>
            <p>
              Trades execute instantly using Yellow Network state channels.
              No gas fees or blockchain delays.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
