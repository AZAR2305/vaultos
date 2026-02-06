/**
 * Prediction Markets List
 * 
 * Using MOCK DATA for demonstration
 * Shows prediction market cards with retro-brutalist theme
 * Markets display YES/NO prices, volume, and timing
 */
import React, { useState } from 'react';
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
}

// MOCK PREDICTION MARKETS DATA
const MOCK_MARKETS: Market[] = [
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
  },
  {
    id: 'market_3',
    marketId: 'MARKET_003',
    question: 'Will inflation drop below 2% in 2026?',
    description: 'US CPI inflation rate falls below 2% at any point in 2026',
    yesPrice: 0.45,
    noPrice: 0.55,
    totalVolume: 234000,
    endTime: 'Dec 31, 2026',
    category: 'ECONOMICS'
  },
  {
    id: 'market_4',
    marketId: 'MARKET_004',
    question: 'AGI to be achieved by 2027?',
    description: 'Artificial General Intelligence achieved by major AI lab before 2027',
    yesPrice: 0.15,
    noPrice: 0.85,
    totalVolume: 567000,
    endTime: 'Dec 31, 2026',
    category: 'TECH'
  },
  {
    id: 'market_5',
    marketId: 'MARKET_005',
    question: 'Will Tesla stock hit $500 in 2026?',
    description: 'Tesla (TSLA) stock price reaches $500 or higher at any point in 2026',
    yesPrice: 0.34,
    noPrice: 0.66,
    totalVolume: 178000,
    endTime: 'Dec 31, 2026',
    category: 'STOCKS'
  },
  {
    id: 'market_6',
    marketId: 'MARKET_006',
    question: 'SpaceX Mars mission by 2027?',
    description: 'SpaceX launches crewed mission to Mars before December 31, 2027',
    yesPrice: 0.28,
    noPrice: 0.72,
    totalVolume: 445000,
    endTime: 'Dec 31, 2027',
    category: 'SPACE'
  }
];

interface MarketListProps {
  session?: any;
  onSelectMarket?: (market: Market) => void;
}

const MarketList: React.FC<MarketListProps> = ({ session, onSelectMarket }) => {
  const { address } = useAccount();
  const [markets] = useState<Market[]>(MOCK_MARKETS);
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
