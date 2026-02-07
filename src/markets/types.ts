/**
 * Prediction Market Domain Types
 */

export interface Market {
  id: string;
  creator: string;
  question: string;
  description: string;
  resolutionSource: string;
  closeTime: number;
  resolveTime: number;
  status: MarketStatus;
  totalYesShares: bigint;
  totalNoShares: bigint;
  totalVolume: bigint;
  outcome?: 'YES' | 'NO';
  createdAt: number;
}

export enum MarketStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  RESOLVED = 'resolved',
  DISPUTED = 'disputed',
}

export interface Position {
  userId: string;
  marketId: string;
  yesShares: bigint;
  noShares: bigint;
  averageYesPrice: number;
  averageNoPrice: number;
  realizedPnL: bigint;
}

export interface Trade {
  id: string;
  marketId: string;
  userId: string;
  position: 'YES' | 'NO';
  shares: bigint;
  price: number;
  timestamp: number;
  yellowTxId: string;
}

export interface CreateMarketParams {
  question: string;
  description: string;
  resolutionSource: string;
  closeTime: number;
  resolveTime: number;
}
