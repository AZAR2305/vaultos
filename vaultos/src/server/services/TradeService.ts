interface Trade {
    sessionId: string;
    marketId: string;
    shares: number;
    type: string;
    cost?: number;
    revenue?: number;
}

interface UserPosition {
    marketId: string;
    yesShares: number;
    noShares: number;
}

export class TradeService {
    private sessions: Map<string, any>;
    private markets: Map<string, any>;

    constructor() {
        this.sessions = new Map();
        this.markets = new Map();
    }

    // Helper to get market by ID
    private getMarket(marketId: string) {
        return this.markets.get(marketId);
    }

    // Helper to get session by ID
    private getSession(sessionId: string) {
        return this.sessions.get(sessionId);
    }

    // Register a market
    registerMarket(marketId: string, marketData: any) {
        this.markets.set(marketId, marketData);
    }

    // Register a session
    registerSession(sessionId: string, sessionData: any) {
        this.sessions.set(sessionId, sessionData);
    }

    async buyYesShares(sessionId: string, marketId: string, shares: number): Promise<Trade> {
        const session = this.getSession(sessionId);
        const market = this.getMarket(marketId);

        if (!session || !market) {
            throw new Error('Invalid session or market');
        }

        const cost = shares * market.yesPrice;
        if (session.activeBalance < cost) {
            throw new Error('Insufficient balance');
        }

        session.activeBalance -= cost;
        
        const position = session.positions.find((pos: UserPosition) => pos.marketId === marketId);
        if (position) {
            position.yesShares += shares;
        } else {
            session.positions.push({ marketId, yesShares: shares, noShares: 0 });
        }

        return { sessionId, marketId, shares, type: 'buy-yes', cost };
    }

    async sellYesShares(sessionId: string, marketId: string, shares: number): Promise<Trade> {
        const session = this.getSession(sessionId);
        const market = this.getMarket(marketId);

        if (!session || !market) {
            throw new Error('Invalid session or market');
        }

        const position = session.positions.find((pos: UserPosition) => pos.marketId === marketId);
        if (!position || position.yesShares < shares) {
            throw new Error('Insufficient YES shares to sell');
        }

        const revenue = shares * market.yesPrice;
        position.yesShares -= shares;
        session.activeBalance += revenue;

        return { sessionId, marketId, shares, type: 'sell-yes', revenue };
    }

    async buyNoShares(sessionId: string, marketId: string, shares: number): Promise<Trade> {
        const session = this.getSession(sessionId);
        const market = this.getMarket(marketId);

        if (!session || !market) {
            throw new Error('Invalid session or market');
        }

        const cost = shares * market.noPrice;
        if (session.activeBalance < cost) {
            throw new Error('Insufficient balance');
        }

        session.activeBalance -= cost;
        const position = session.positions.find((pos: UserPosition) => pos.marketId === marketId);
        
        if (position) {
            position.noShares += shares;
        } else {
            session.positions.push({ marketId, yesShares: 0, noShares: shares });
        }

        return { sessionId, marketId, shares, type: 'buy-no', cost };
    }
}