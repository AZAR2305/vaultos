# VaultOS Architecture Overview

## Introduction

VaultOS is a prediction market trading platform that leverages state channels for instant trading and enhanced security. This document outlines the architecture of the VaultOS project, detailing its components, interactions, and design decisions.

## System Components

### 1. Server

The server is built using Node.js and Express, providing a RESTful API for client interactions. It handles session management, market creation, trade execution, and balance management.

- **Entry Point**: `src/server/index.ts`
  - Initializes the Express server and sets up middleware and routes.

- **Routes**:
  - `src/server/routes/session.ts`: Manages session creation and closure.
  - `src/server/routes/market.ts`: Handles market creation and management.
  - `src/server/routes/trade.ts`: Executes trades for buying and selling shares.
  - `src/server/routes/balance.ts`: Manages user balances, including fund transfers and refunds.
  - `src/server/routes/state.ts`: Provides the current state of user sessions, including balances and positions.

- **Services**:
  - `src/server/services/SessionService.ts`: Contains logic for session management and validation of session keys.
  - `src/server/services/MarketService.ts`: Manages the lifecycle of prediction markets.
  - `src/server/services/TradeService.ts`: Handles trade execution and user position management.
  - `src/server/services/YieldService.ts`: Manages yield calculations and accrual.

### 2. Client

The client is a React application that interacts with the server API to provide a user-friendly interface for trading.

- **Entry Point**: `src/client/main.tsx`
  - Renders the React application into the DOM.

- **Main Component**: `src/client/App.tsx`
  - Sets up the application structure and routing.

- **Components**:
  - `src/client/components/WalletConnect.tsx`: Facilitates wallet connection for users.
  - `src/client/components/SessionManager.tsx`: Manages user trading sessions.
  - `src/client/components/MarketList.tsx`: Displays active markets for trading.
  - `src/client/components/TradePanel.tsx`: Allows users to execute trades.
  - `src/client/components/BalanceDisplay.tsx`: Shows user balances and positions.

- **Hooks**:
  - `src/client/hooks/useWallet.ts`: Manages wallet connection state.
  - `src/client/hooks/useSession.ts`: Manages session state.
  - `src/client/hooks/useMarkets.ts`: Manages market data.

- **Services**:
  - `src/client/services/walletService.ts`: Interacts with the user's wallet.
  - `src/client/services/apiService.ts`: Handles API requests to the server.

### 3. Shared Types

- `src/shared/types.ts`: Contains shared TypeScript types and interfaces used across both server and client code.

## Data Flow

1. **User Interaction**: Users connect their wallets and interact with the client application.
2. **Session Management**: The client requests session creation, which the server processes, returning a session ID.
3. **Market Interaction**: Users create or join prediction markets through the client, which communicates with the server to manage market data.
4. **Trade Execution**: Trades are executed off-chain, with the server handling state updates and maintaining a record of transactions.
5. **Yield Management**: Users can move funds to earn yield, which is calculated and managed by the server.

## Security Considerations

- **Session Keys**: Each session is isolated, and session keys are used to enhance security and prevent unauthorized access.
- **State Channels**: Trades are processed off-chain using state channels, reducing latency and gas fees while maintaining a secure audit trail.

## Future Enhancements

- **Phase 2 Integration**: Future development will include integration with Sui smart contracts for on-chain settlement and real DeFi yield.
- **Frontend Improvements**: Enhancements to the client interface for better user experience and real-time updates.

## Conclusion

The VaultOS architecture is designed to provide a robust and secure prediction market trading platform. By leveraging modern technologies and best practices, it aims to deliver a seamless trading experience for users.