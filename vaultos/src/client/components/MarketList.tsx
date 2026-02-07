/**
 * Prediction Markets List
 * 
 * Connected to backend API at /api/markets
 * Shows prediction market cards with retro-brutalist theme
 * Markets display YES/NO prices, volume, and timing
 */
import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface Market {
  id: string;
  marketId?: string;
  question: string;
  description?: string;
  yesPrice: number;
  noPrice: number;
  totalVolume: number;
  endTime?: string;
  category: string;
  status?: string;
  odds?: {
    YES: string;
    NO: string;
  };
}

interface MarketListProps {
  session?: any;
  onSelectMarket?: (market: Market) => void;
}

const MarketList: React.FC<MarketListProps> = ({ session, onSelectMarket }) => {
  const { address } = useAccount();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch markets from backend
  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchMarkets = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/markets');
      if (response.ok) {
        const data = await response.json();
        const formattedMarkets = data.markets.map((m: any) => ({
          id: m.id,
          marketId: m.id.toUpperCase(),
          question: m.question,
          description: m.description || '',
          yesPrice: m.odds?.YES ? parseFloat(m.odds.YES) / 100 : 0.5,
          noPrice: m.odds?.NO ? parseFloat(m.odds.NO) / 100 : 0.5,
          totalVolume: parseFloat(m.totalVolume) || 0,
          endTime: m.endTime ? new Date(m.endTime).toLocaleDateString() : 'TBD',
          category: 'PREDICTION',
          status: m.status
        }));
        setMarkets(formattedMarkets);
        setError('');
      } else {
        setError('Failed to load markets');
      }
    } catch (err) {
      console.error('Error fetching markets:', err);
      setError('Network error - showing mock data');
      // Fallback to mock data
      setMarkets(getMockMarkets());
    } finally {
      setLoading(false);
    }
  };

  const getMockMarkets = (): Market[] => [
    {
      id: 'market_1',
      marketId: 'MARKET_001',
      question: 'Will BTC reach $150k by end of 2026?',
      description: 'Bitcoin to hit $150,000 USD per coin before December 31, 2026 23:59 UTC',
      yesPrice: 0.62,
      noPrice: 0.38,
      totalVolume: 125000,
      endTime: 'Dec 31, 2026',
      category: 'CRYPTO'
    },
    {
      id: 'market_2',
      marketId: 'MARKET_002',
      question: 'Will Ethereum complete Dencun upgrade by Q2 2026?',
      description: 'Ethereum mainnet successfully deploys Dencun upgrade before June 30, 2026',
      yesPrice: 0.78,
      noPrice: 0.22,
      totalVolume: 89000,
      endTime: 'Jun 30, 2026',
      category: 'CRYPTO'
    }
  ];
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const categories = ['ALL', 'CRYPTO', 'TECH', 'ECONOMICS', 'STOCKS', 'SPACE'];
  const filteredMarkets = selectedCategory === 'ALL' 
    ? markets 
    : markets.filter(m => m.category === selectedCategory);

  return (
    <div>
      <div className="market-header">
        <div>
          <h2 style={{ 
            fontSize: '2rem', 
            fontFamily: 'Syne, sans-serif', 
            fontWeight: 800,
            textTransform: 'uppercase',
            marginBottom: '10px'
          }}>
            Active Markets
          </h2>
          <p style={{ color: 'var(--accent-retro)', fontSize: '0.85rem' }}>
            {'[ POWERED BY YELLOW NETWORK • ZERO GAS • INSTANT EXECUTION ]'}
          </p>
        </div>
      </div>

      {/* Category Filter */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '30px', 
        flexWrap: 'wrap' 
      }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
          >
            [{cat}]
          </button>
        ))}
      </div>

      {/* Markets Grid */}
      <div className="markets-grid">
        {filteredMarkets.map((market) => (
          <div 
            key={market.id} 
            className="market-card"
            onClick={() => onSelectMarket && onSelectMarket(market)}
          >
            <div className="market-card-header">
              {market.marketId} • {market.category}
            </div>
            
            <div className="market-card-body">
              <h3>{market.question}</h3>
              
              {market.description && (
                <p className="market-description">{market.description}</p>
              )}
              
              <div className="market-prices">
                <div className="price-box yes">
                  <span className="label">YES</span>
                  <span className="price">${(market.yesPrice).toFixed(2)}</span>
                </div>
                <div className="price-box no">
                  <span className="label">NO</span>
                  <span className="price">${(market.noPrice).toFixed(2)}</span>
                </div>
              </div>
              
              <div className="market-info">
                <span>VOL: ${(market.totalVolume / 1000).toFixed(0)}K</span>
                <span>END: {market.endTime}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MarketList;
