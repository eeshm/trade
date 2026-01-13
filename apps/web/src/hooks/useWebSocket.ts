import { useEffect, useRef, useCallback } from 'react';
import { useTradingStore } from '@/store/trading';
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

  const tradingStore = useTradingStore();
  const subscriptions = useRef<Set<WSChannel>>(new Set());

  const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

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

      ws.onmessage = handleMessage;

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

        // Only show error toast for unexpected closures (not code 1000 = normal closure)
        // Code 1006 (abnormal closure) is common and will be handled by reconnection
        if (event.code !== 1000 && event.code !== 1001 && reconnectAttempts.current === 0) {
          // Only show on first disconnect, not during reconnection attempts
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
  }, [enabled, token, WS_URL]); // Removed handleMessage from deps to prevent reconnections

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

  // Heartbeat ping
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      ping();
    }, 30000); // Ping every 30 seconds

    return () => clearInterval(interval);
  }, [enabled, ping]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    send,
    subscribe,
    unsubscribe,
    connect,
    disconnect,
  };
}
