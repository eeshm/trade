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
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('WebSocket connected');
        reconnectAttempts.current = 0;
        reconnectDelay.current = 1000;

        // Authenticate if token is available
        if (token) {
          ws.send(JSON.stringify({ type: 'auth', token }));
        }

        // Resubscribe to channels
        subscriptions.current.forEach((channel) => {
          ws.send(JSON.stringify({ type: 'subscribe', channel }));
        });
      };

      ws.onmessage = handleMessage;

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast.error('WebSocket connection error');
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        wsRef.current = null;

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
    }
  }, [enabled, token, handleMessage, WS_URL]);

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

  // Connect on mount and when token changes
  useEffect(() => {
    if (enabled && token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, token, connect, disconnect]);

  // Heartbeat ping
  useEffect(() => {
    if (!enabled || !token) return;

    const interval = setInterval(() => {
      ping();
    }, 30000); // Ping every 30 seconds

    return () => clearInterval(interval);
  }, [enabled, token, ping]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    send,
    subscribe,
    unsubscribe,
    connect,
    disconnect,
  };
}
