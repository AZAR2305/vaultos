/**
 * Yellow Network Protocol Types (NitroRPC/0.4)
 * 
 * Complete type definitions matching the official Yellow Network protocol documentation.
 * Based on: https://docs.yellow.org/protocol/off-chain-rpc/
 * 
 * Protocol Version: NitroRPC/0.4 (Current)
 * - Intent System: OPERATE, DEPOSIT, WITHDRAW
 * - Add/remove funds from active sessions
 * - Enhanced error handling
 */

// ============================================================================
// Core Protocol Types
// ============================================================================

/**
 * State Intent (NitroRPC/0.4)
 * Indicates the purpose of a state update
 */
export enum StateIntent {
  INITIALIZE = 1,  // Channel creation
  RESIZE = 2,      // Channel allocation adjustment
  FINALIZE = 3,    // Channel closure
  OPERATE = 4,     // App session operation
  DEPOSIT = 5,     // Add funds to app session
  WITHDRAW = 6,    // Remove funds from app session
}

/**
 * Channel Status
 */
export type ChannelStatus = 'open' | 'resizing' | 'closing' | 'challenged' | 'closed';

/**
 * State Allocation
 * Defines fund distribution within a channel or app session
 */
export interface StateAllocation {
  participant: `0x${string}`;  // Participant wallet address
  asset: string;               // Asset symbol (e.g., "ytest.usd", "eth")
  amount: string;              // Amount in smallest unit (e.g., "100000000" for 100 USDC with 6 decimals)
}

/**
 * Channel Structure
 * On-chain channel parameters
 */
export interface Channel {
  participants: `0x${string}`[];  // [User, Clearnode] - order matters!
  adjudicator: `0x${string}`;     // Adjudicator contract address
  challenge: number;              // Challenge period in seconds (default: 3600)
  nonce: number;                  // Unique identifier ensuring channelId uniqueness
}

/**
 * State Structure
 * Snapshot of channel at a point in time
 */
export interface State {
  intent: StateIntent;
  version: number;               // State sequence number
  state_data: string;            // Hex-encoded state data
  allocations: StateAllocation[];
}

// ============================================================================
// Authentication Types
// ============================================================================

export interface AuthRequestParams {
  address: `0x${string}`;
  application: string;
  session_key: `0x${string}`;
  allowances: Array<{
    asset: string;
    amount: string;
  }>;
  expires_at: bigint;
  scope: string;
}

export interface AuthChallenge {
  challenge_message: string;
}

export interface SessionKey {
  address: `0x${string}`;
  allowances: Array<{
    asset: string;
    amount: string;
  }>;
  expires_at: number;
  scope: string;
}

// ============================================================================
// Channel Management Types
// ============================================================================

export interface CreateChannelParams {
  chain_id: number;
  token: `0x${string}`;
}

export interface CreateChannelResponse {
  channel_id: string;
  channel: Channel;
  state: State;
  server_signature: string;
}

export interface ResizeChannelParams {
  channel_id: string;
  allocate_amount?: string;  // Decimal string
  resize_amount?: string;    // Decimal string (positive = deposit, negative = withdraw)
  funds_destination: `0x${string}`;
}

export interface ResizeChannelResponse {
  channel_id: string;
  state: State;
  server_signature: string;
}

export interface CloseChannelParams {
  channel_id: string;
  funds_destination: `0x${string}`;
}

export interface CloseChannelResponse {
  channel_id: string;
  state: State;
  server_signature: string;
}

// ============================================================================
// Transfer Types
// ============================================================================

export interface TransferAllocation {
  asset: string;    // Lowercase asset symbol (e.g., "usdc", "eth")
  amount: string;   // Decimal string (e.g., "50.0")
}

export interface TransferParams {
  destination?: `0x${string}`;      // Recipient wallet address
  destination_user_tag?: string;   // OR recipient user tag
  allocations: TransferAllocation[];
}

export interface LedgerTransaction {
  id: number;
  tx_type: string;  // "transfer", "deposit", "withdrawal", etc.
  from_account: string;
  from_account_tag: string;
  to_account: string;
  to_account_tag: string;
  asset: string;
  amount: string;
  created_at: string;  // ISO 8601 timestamp
}

export interface TransferResponse {
  transactions: LedgerTransaction[];
}

// ============================================================================
// App Session Types (NitroRPC/0.4)
// ============================================================================

/**
 * App Session Definition for RPC
 * Matches RPCAppDefinition from nitrolite SDK
 */
export interface AppSessionDefinition {
  application: string;      // Application name (e.g., 'prediction-markets')
  protocol: string;         // Protocol version: 'NitroRPC/0.4'
  participants: `0x${string}`[];
  weights: number[];        // Integer weights for each participant
  quorum: number;           // Percentage required for consensus (0-100)
  challenge_duration: number;  // Challenge period in seconds (use 0 if no challenge)
  nonce?: number;           // Optional unique nonce for this session
}

export interface CreateAppSessionParams {
  definition: AppSessionDefinition;
  allocations: StateAllocation[];
  session_data?: string;  // Optional session-specific data
}

export interface CreateAppSessionResponse {
  app_session_id: string;
  state: State;
  server_signature: string;
}

export interface SubmitAppStateParams {
  app_session_id: string;
  intent: StateIntent.OPERATE | StateIntent.DEPOSIT | StateIntent.WITHDRAW;
  app_data: string;
  allocations: StateAllocation[];
}

export interface SubmitAppStateResponse {
  app_session_id: string;
  state: State;
  signatures: string[];  // All participant signatures
}

export interface CloseAppSessionParams {
  app_session_id: string;
  final_allocations: StateAllocation[];
}

export interface CloseAppSessionResponse {
  app_session_id: string;
  state: State;
  server_signature: string;
}

export interface AppSession {
  app_session_id: string;
  app_definition: `0x${string}`;
  participants: `0x${string}`[];
  state: State;
  status: 'active' | 'closing' | 'closed';
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Query Types
// ============================================================================

export interface RPCConfig {
  version: string;
  protocol_version: string;
  networks: RPCNetworkInfo[];
  assets: RPCAsset[];
  app_definitions: AppDefinition[];
  features: string[];
}

export interface RPCNetworkInfo {
  chain_id: number;
  name: string;
  rpc_url: string;
  custody_address: `0x${string}`;
  adjudicator_address: `0x${string}`;
  challenge_duration: number;
}

export interface RPCAsset {
  symbol: string;
  name: string;
  chain_id: number;
  token: `0x${string}`;
  decimals: number;
  is_native: boolean;
}

export interface AppDefinition {
  address: `0x${string}`;
  name: string;
  description: string;
  version: string;
  chain_id: number;
}

export interface ChannelInfo {
  channel_id: string;
  chain_id: number;
  token: `0x${string}`;
  status: ChannelStatus;
  expected_deposit: string;
  actual_deposit: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface LedgerBalance {
  asset: string;
  available: string;   // Available for trading/transfers
  locked: string;      // Locked in channels/sessions
  total: string;       // Total balance
}

export interface LedgerEntry {
  id: number;
  account_id: string;
  account_type: number;  // 1000=asset, 2000=liability, etc.
  asset: string;
  participant: `0x${string}`;
  credit: string;   // Positive value or "0.0"
  debit: string;    // Positive value or "0.0"
  created_at: string;
}

// ============================================================================
// Notification Types (Server-to-Client)
// ============================================================================

export interface BalanceUpdateNotification {
  method: 'bu';
  params: {
    asset: string;
    available: string;
    locked: string;
    total: string;
  };
}

export interface ChannelUpdateNotification {
  method: 'cu';
  params: {
    channel_id: string;
    status: ChannelStatus;
    version: number;
    expected_deposit: string;
    actual_deposit: string;
  };
}

export interface TransferNotification {
  method: 'tr';
  params: LedgerTransaction;
}

export interface AppSessionUpdateNotification {
  method: 'asu';
  params: {
    app_session_id: string;
    status: 'active' | 'closing' | 'closed';
    version: number;
    state: State;
  };
}

export type Notification = 
  | BalanceUpdateNotification
  | ChannelUpdateNotification
  | TransferNotification
  | AppSessionUpdateNotification;

// ============================================================================
// RPC Message Types
// ============================================================================

/**
 * Compact message format: [requestId, method, params, timestamp]
 */
export type RPCRequest = [
  number,           // requestId
  string,           // method
  any,              // params
  number            // timestamp
];

export type RPCResponse = {
  res: [
    number,         // requestId
    string,         // method
    any             // result
  ];
} | {
  error: {
    code?: number;
    message: string;
    data?: any;
  };
};

// ============================================================================
// Error Types
// ============================================================================

export interface RPCError {
  message: string;
  code?: string;
  details?: any;
}

// ============================================================================
// Query Method Parameter Types
// ============================================================================

export interface GetChannelsParams {
  wallet?: `0x${string}`;
  chain_id?: number;
  status?: ChannelStatus;
}

export interface GetAppSessionsParams {
  wallet?: `0x${string}`;
  app_definition?: `0x${string}`;
  status?: 'active' | 'closing' | 'closed';
}

export interface GetLedgerBalancesParams {
  wallet: `0x${string}`;
  asset?: string;
}

export interface GetLedgerTransactionsParams {
  account_id?: string;
  asset?: string;
  tx_type?: string;
  offset?: number;
  limit?: number;
  sort?: 'asc' | 'desc';
}

export interface GetLedgerEntriesParams {
  account_id?: string;
  wallet?: `0x${string}`;
  asset?: string;
  offset?: number;
  limit?: number;
  sort?: 'asc' | 'desc';
}

// ============================================================================
// Client Configuration
// ============================================================================

export interface YellowClientConfig {
  privateKey: `0x${string}`;
  clearnodeUrl: string;
  rpcUrl?: string;
  chainId?: number;
}

export interface YellowSessionConfig {
  allowanceAmount: string;
  expiresInSeconds: number;
  scope: string;
  application: string;
}
