import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { createWalletClient, custom, type WalletClient } from 'viem';
import { baseSepolia } from 'viem/chains';
import WebSocket from 'isomorphic-ws';
import { 
  createEIP712AuthMessageSigner,
  createAuthRequestMessage,
  createAuthVerifyMessageFromChallenge,
  createAppSessionMessage,
  type CreateAppSessionParams,
} from '@erc7824/nitrolite';

const YELLOW_WS_URL = 'wss://clearnet-sandbox.yellow.com/ws';
const CLEARNODE_ADDRESS = '0x019B65A26D046d31BF7BeADDE9B30E5fA6f0A6f6';

interface YellowBalance {
  asset: string;
  balance: number;
}

interface AppSession {
  id: string;
  status: string;
}

export interface YellowNetworkState {
  connected: boolean;
  authenticated: boolean;
  balances: YellowBalance[];
  loading: boolean;
  error: string | null;
}

export function useYellowNetwork() {
  const { address } = useAccount();
  const [state, setState] = useState<YellowNetworkState>({
    connected: false,
    authenticated: false,
    balances: [],
    loading: false,
    error: null,
  });

  const [ws, setWs] = useState<WebSocket | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [sessionWallet, setSessionWallet] = useState<WalletClient | null>(null);
  const [authParams, setAuthParams] = useState<any>(null);

  // Initialize wallets
  useEffect(() => {
    if (!address || typeof window === 'undefined') return;

    const initWallets = async () => {
      try {
        // Main wallet (user's connected wallet)
        const mainWallet = createWalletClient({
          account: address,
          chain: baseSepolia,
          transport: custom((window as any).ethereum),
        });
        setWalletClient(mainWallet);

        // Session wallet (ephemeral for signing Yellow messages)
        const sessionPrivateKey = `0x${Array(64).fill(0).map(() => 
          Math.floor(Math.random() * 16).toString(16)
        ).join('')}`;
        
        const sessionClient = createWalletClient({
          account: sessionPrivateKey as `0x${string}`,
          chain: baseSepolia,
          transport: custom((window as any).ethereum),
        });
        setSessionWallet(sessionClient);
      } catch (error) {
        console.error('Failed to initialize wallets:', error);
        setState(prev => ({ ...prev, error: 'Failed to initialize wallets' }));
      }
    };

    initWallets();
  }, [address]);

  // Connect to Yellow Network
  const connect = useCallback(async () => {
    if (!walletClient || !sessionWallet || !address) {
      console.log('Waiting for wallets...');
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Create WebSocket connection
      const socket = new WebSocket(YELLOW_WS_URL);

      socket.onopen = () => {
        console.log('✅ Connected to Yellow Network');
        setState(prev => ({ ...prev, connected: true }));
        setWs(socket);
      };

      socket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setState(prev => ({ 
          ...prev, 
          error: 'Failed to connect to Yellow Network',
          loading: false 
        }));
      };

      socket.onclose = () => {
        console.log('🔌 Disconnected from Yellow Network');
        setState(prev => ({ 
          ...prev, 
          connected: false, 
          authenticated: false 
        }));
      };

      socket.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Handle authentication challenge
          if (message.res?.[1] === 'auth_challenge') {
            await handleAuthChallenge(message, socket);
          }
          
          // Handle successful authentication
          if (message.res?.[1] === 'auth_verify' && message.res?.[2] === 'ok') {
            console.log('✅ Authentication successful');
            setState(prev => ({ ...prev, authenticated: true, loading: false }));
            
            // Fetch balances after authentication
            await fetchBalances(socket);
          }

          // Handle balance updates
          if (message.res?.[1] === 'get_ledger_balances') {
            const balanceData = message.res?.[2];
            if (balanceData) {
              const balances = balanceData.map((b: any) => ({
                asset: b.asset,
                balance: parseInt(b.balance) / 1_000_000, // Convert to readable USDC
              }));
              setState(prev => ({ ...prev, balances }));
            }
          }
        } catch (error) {
          console.error('Error handling message:', error);
        }
      };

    } catch (error) {
      console.error('Connection failed:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Connection failed',
        loading: false 
      }));
    }
  }, [walletClient, sessionWallet, address]);

  // Handle authentication challenge
  const handleAuthChallenge = async (message: any, socket: WebSocket) => {
    if (!walletClient || !sessionWallet || !authParams) return;

    try {
      const challenge = message.res?.[2];
      if (!challenge) throw new Error('No challenge received');

      // Create auth verify message
      const authSigner = createEIP712AuthMessageSigner(
        walletClient,
        authParams.address
      );

      const authVerifyMsg = await createAuthVerifyMessageFromChallenge(
        authSigner,
        challenge,
        {
          address: authParams.address,
          session_key: authParams.session_key,
          application: authParams.application,
          expires_at: authParams.expires_at.toString(), // Convert BigInt to string for signing
          scope: authParams.scope,
          allowances: authParams.allowances,
        }
      );

      // Send auth verify
      socket.send(JSON.stringify(authVerifyMsg));
    } catch (error) {
      console.error('Authentication failed:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Authentication failed',
        loading: false 
      }));
    }
  };

  // Start authentication flow
  const authenticate = useCallback(async () => {
    if (!ws || !walletClient || !sessionWallet || !address) {
      console.log('Prerequisites not met for authentication');
      return;
    }

    try {
      // Build auth parameters (cache for consistency)
      const params = {
        address,
        session_key: sessionWallet.account?.address || '',
        application: 'Yellow',
        expires_at: BigInt(Math.floor(Date.now() / 1000) + 7200),
        scope: 'console',
        allowances: [
          {
            asset: 'ytest.usd',
            amount: '1000000000', // 1000 USDC max
          },
        ],
      };
      setAuthParams(params);

      // Create EIP-712 signer
      const authSigner = createEIP712AuthMessageSigner(walletClient, address);

      // Create auth request message
      const authRequestMsg = await createAuthRequestMessage(authSigner, params);

      // Send auth request
      ws.send(JSON.stringify(authRequestMsg));
      console.log('📤 Sent authentication request');
    } catch (error) {
      console.error('Authentication error:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Authentication error',
        loading: false 
      }));
    }
  }, [ws, walletClient, sessionWallet, address]);

  // Fetch user balances
  const fetchBalances = async (socket: WebSocket) => {
    const balanceMsg = {
      req: [Date.now(), 'get_ledger_balances', {}],
    };
    socket.send(JSON.stringify(balanceMsg));
  };

  // Create app session (for market creation)
  const createAppSession = useCallback(async (
    params: {
      marketName: string;
      initialLiquidity: number;
    }
  ): Promise<string> => {
    if (!ws || !sessionWallet || !address) {
      throw new Error('Not connected or authenticated');
    }

    return new Promise((resolve, reject) => {
      try {
        const sessionSigner = createEIP712AuthMessageSigner(
          sessionWallet,
          sessionWallet.account?.address || ''
        );

        const appSessionParams: CreateAppSessionParams = {
          definition: {
            application: 'Yellow',
            protocol: 'NitroRPC/0.4',
            participants: [address, CLEARNODE_ADDRESS],
            weights: [50, 50],
            quorum: 100,
            challenge_duration: 0,
            nonce: Date.now(),
          },
          allocations: [
            {
              participant: address,
              asset: 'ytest.usd',
              amount: (params.initialLiquidity * 1_000_000).toString(),
            },
          ],
        };

        createAppSessionMessage(sessionSigner, appSessionParams).then(appSessionMsg => {
          // Listen for app_session response
          const messageHandler = (event: MessageEvent) => {
            try {
              const message = JSON.parse(event.data.toString());
              
              if (message.res?.[1] === 'app_session') {
                const sessionData = message.res?.[2];
                if (sessionData?.app_session_id) {
                  ws.removeEventListener('message', messageHandler);
                  resolve(sessionData.app_session_id);
                }
              }
            } catch (error) {
              console.error('Error parsing app_session response:', error);
            }
          };

          ws.addEventListener('message', messageHandler);

          // Send the message
          ws.send(JSON.stringify(appSessionMsg));
          console.log('📤 Sent create_app_session request');

          // Timeout after 30 seconds
          setTimeout(() => {
            ws.removeEventListener('message', messageHandler);
            reject(new Error('App session creation timeout'));
          }, 30000);
        });
      } catch (error) {
        console.error('Error creating app session:', error);
        reject(error);
      }
    });
  }, [ws, sessionWallet, address]);

  // Deposit to app session (place bet)
  const depositToSession = useCallback(async (
    sessionId: string,
    amount: number
  ) => {
    if (!ws || !sessionWallet || !address) {
      throw new Error('Not connected or authenticated');
    }

    // Submit state update with deposit intent
    const depositMsg = {
      req: [
        Date.now(),
        'submit_app_state',
        {
          app_session_id: sessionId,
          intent: 'DEPOSIT',
          allocations: [
            {
              participant: address,
              asset: 'ytest.usd',
              amount: (amount * 1_000_000).toString(),
            },
          ],
        },
      ],
    };

    ws.send(JSON.stringify(depositMsg));
    console.log(`📤 Deposited ${amount} USDC to session ${sessionId}`);
  }, [ws, sessionWallet, address]);

  // Withdraw from app session (refund)
  const withdrawFromSession = useCallback(async (
    sessionId: string,
    amount: number
  ) => {
    if (!ws || !sessionWallet || !address) {
      throw new Error('Not connected or authenticated');
    }

    const withdrawMsg = {
      req: [
        Date.now(),
        'submit_app_state',
        {
          app_session_id: sessionId,
          intent: 'WITHDRAW',
          allocations: [
            {
              participant: address,
              asset: 'ytest.usd',
              amount: (amount * 1_000_000).toString(),
            },
          ],
        },
      ],
    };

    ws.send(JSON.stringify(withdrawMsg));
    console.log(`📤 Withdrew ${amount} USDC from session ${sessionId}`);
  }, [ws, sessionWallet, address]);

  // Auto-connect when wallets ready
  useEffect(() => {
    if (walletClient && sessionWallet && !state.connected) {
      connect();
    }
  }, [walletClient, sessionWallet, state.connected, connect]);

  // Auto-authenticate after connection
  useEffect(() => {
    if (state.connected && !state.authenticated && !state.loading) {
      authenticate();
    }
  }, [state.connected, state.authenticated, state.loading, authenticate]);

  return {
    ...state,
    connect,
    authenticate,
    createAppSession,
    depositToSession,
    withdrawFromSession,
  };
}
