import { useEffect, useRef, useCallback, useState } from 'react';
import { useTradingStore } from '@/store/trading';
import { env } from '@/lib/env';
import {
  WSMessage,
  WSPriceMessage,
  WSOrderFilledMessage,
  WSPortfolioMessage,
} from '@/types';
import { toast } from 'sonner';

type WSChannel = 'prices' | 'orders' | 'portfolio';

interface UseWebSocketProps {
  token?: string | null;
  enabled?: boolean;
}

export function useWebSocket({ token, enabled = true }: UseWebSocketProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = useRef(1000);
  const hasConnectedOnce = useRef(false); // Track if we've ever connected
  const [isConnected, setIsConnected] = useState(false);

  const tradingStore = useTradingStore();
  const subscriptions = useRef<Set<WSChannel>>(new Set());

  const WS_URL = env.WS_URL;

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message: WSMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'auth':
            const authMsg = message as WSMessage & { success: boolean };
            if (!authMsg.success) {
              console.error('WebSocket auth failed');
              toast.error('WebSocket authentication failed');
            }
            break;

          case 'price':
            const priceMsg = message as unknown as WSPriceMessage;
            tradingStore.setPrice(priceMsg.symbol, {
              symbol: priceMsg.symbol,
              price: priceMsg.price,
              updatedAt: priceMsg.timestamp,
            });
            break;

          case 'order_filled':
            const orderMsg = message as unknown as WSOrderFilledMessage;
            tradingStore.updateOrder(orderMsg.orderId, {
              status: 'filled',
              executedPrice: orderMsg.executedPrice,
              executedSize: orderMsg.executedSize,
              feesApplied: orderMsg.fee,
            });
            toast.success(`Order ${orderMsg.orderId} filled!`);
            break;

          case 'portfolio':
            const portfolioMsg = message as unknown as WSPortfolioMessage;
            tradingStore.setBalances(portfolioMsg.balances);
            tradingStore.setPositions(portfolioMsg.positions);
            break;

          case 'subscribed':
            console.log(`Subscribed to ${(message as any).channel}`);
            break;

          case 'unsubscribed':
            console.log(`Unsubscribed from ${(message as any).channel}`);
            break;

          case 'pong':
            // Heartbeat response
            break;

          default:
            console.warn('Unknown WebSocket message type:', message.type);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    },
    [tradingStore]
  );

  // Use ref to avoid stale closure in WebSocket handlers
  const handleMessageRef = useRef(handleMessage);
  handleMessageRef.current = handleMessage;

  const connect = useCallback(() => {
    // Prevent multiple simultaneous connections
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        hasConnectedOnce.current = true; // Mark that we've successfully connected
        reconnectAttempts.current = 0;
        reconnectDelay.current = 1000;

        // Authenticate if token is available
        if (token) {
          try {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'auth', token }));
            }
          } catch (error) {
            console.error('Failed to send auth message:', error);
          }
        }

        // Resubscribe to channels
        subscriptions.current.forEach((channel) => {
          try {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'subscribe', channel }));
            }
          } catch (error) {
            console.error(`Failed to send subscribe message for ${channel}:`, error);
          }
        });
      };

      ws.onmessage = (event) => handleMessageRef.current(event);

      ws.onerror = (error) => {
        // Only log errors, don't show toast for already-closed connections
        // The onclose handler will handle user notification if needed
        if (ws.readyState !== WebSocket.CLOSED) {
          console.error('WebSocket error:', error);
        } else {
          console.warn('WebSocket error on closed connection (normal):', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected', { code: event.code, reason: event.reason, wasClean: event.wasClean });
        wsRef.current = null;
        setIsConnected(false);

        // Only show error toast if:
        // 1. We had successfully connected before (not initial page load)
        // 2. It's an unexpected closure (not normal close codes)
        // 3. It's the first disconnect (not during reconnection attempts)
        if (hasConnectedOnce.current && event.code !== 1000 && event.code !== 1001 && reconnectAttempts.current === 0) {
          toast.error('WebSocket connection lost. Reconnecting...');
        }

        // Attempt to reconnect
        if (
          enabled &&
          reconnectAttempts.current < maxReconnectAttempts
        ) {
          reconnectAttempts.current++;
          const delay = Math.min(
            reconnectDelay.current * Math.pow(2, reconnectAttempts.current - 1),
            30000
          );
          console.log(`Reconnecting in ${delay}ms...`);
          setTimeout(connect, delay);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      toast.error('Failed to connect to WebSocket server');
    }
  }, [enabled, token, WS_URL]); // handleMessage uses ref pattern to avoid stale closures

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const send = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not open');
    }
  }, []);

  const subscribe = useCallback(
    (channel: WSChannel) => {
      subscriptions.current.add(channel);
      send({ type: 'subscribe', channel });
    },
    [send]
  );

  const unsubscribe = useCallback(
    (channel: WSChannel) => {
      subscriptions.current.delete(channel);
      send({ type: 'unsubscribe', channel });
    },
    [send]
  );
  
  // Recieve "pong" responses
  const ping = useCallback(() => {
    send({ type: 'ping' });
  }, [send]);

  // Connect on mount when enabled
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  // Send auth when token becomes available (after hydration from localStorage)
  // This handles the case where WebSocket connects before token is loaded
  useEffect(() => {
    if (token && wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'auth', token }));
        console.log('Sent late auth after hydration');
      } catch (error) {
        console.error('Failed to send late auth:', error);
      }
    }
  }, [token]);

  // Heartbeat ping
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      ping();
    }, 30000); // Ping every 30 seconds

    return () => clearInterval(interval);
  }, [enabled, ping]);

  return {
    isConnected,
    send,
    subscribe,
    unsubscribe,
    connect,
    disconnect,
  };
}
