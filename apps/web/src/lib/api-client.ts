import axios, { AxiosInstance } from 'axios';
import { env } from './env';
import { useAuthStore } from '@/store/auth';
import {
  AuthNonceRequest,
  AuthNonceResponse,
  AuthLoginRequest,
  AuthLoginResponse,
  PlaceOrderRequest,
  Order,
  Portfolio,
  PriceData,
  MarketStatus,
} from '../types';

const API_BASE_URL = env.API_URL;

// Helper to get token from auth store (works outside React components)
const getAuthToken = () => useAuthStore.getState().token;
const clearAuthState = () => useAuthStore.getState().logout();

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
    });
 
    // Add request interceptor for auth token - reads from auth store
    this.client.interceptors.request.use((config) => {
      const token = getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Clear auth state on 401
          clearAuthState();
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async getNonce(walletAddress: string): Promise<AuthNonceResponse> {
    const response = await this.client.post<AuthNonceResponse>(
      '/auth/nonce',
      { walletAddress } as AuthNonceRequest
    );
    return response.data;
  }

  async login(request: AuthLoginRequest): Promise<AuthLoginResponse> {
    const response = await this.client.post<AuthLoginResponse>(
      '/auth/login',
      request
    );
    // Token is stored by the calling code via useAuthStore.setUser()
    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/auth/logout');
    } finally {
      // Auth state is cleared by the calling code or 401 interceptor
    }
  }

  // Order endpoints
  async placeOrder(request: PlaceOrderRequest): Promise<Order> {
    const response = await this.client.post<{ 
      success: boolean; 
      orderId: number; 
      executedSize: string; 
      executedPrice: string; 
      feesApplied: string; 
      status: string;
      createdAt?: string;
      updatedAt?: string;
    }>('/orders', request);
    
    // API returns partial order data, merge with request data
    const { success, ...apiOrderData } = response.data;
    
    // Build complete order object with request data
    const order: Order = {
      orderId: apiOrderData.orderId,
      side: request.side,
      status: apiOrderData.status as 'pending' | 'filled' | 'rejected',
      baseAsset: request.baseAsset,
      quoteAsset: request.quoteAsset,
      requestedSize: request.requestedSize,
      executedPrice: apiOrderData.executedPrice,
      executedSize: apiOrderData.executedSize,
      feesApplied: apiOrderData.feesApplied,
      createdAt: apiOrderData.createdAt || new Date().toISOString(),
      updatedAt: apiOrderData.updatedAt || new Date().toISOString(),
    };
    
    return order;
  }

  async getOrders(): Promise<Order[]> {
    const response = await this.client.get<{ success: boolean; orders: Order[] }>('/orders');
    return response.data.orders;
  }

  async getOrder(orderId: number): Promise<Order> {
    const response = await this.client.get<{ success: boolean; order: Order }>(`/orders/${orderId}`);
    return response.data.order;
  }

  // Portfolio endpoints
  async getPortfolio(): Promise<Portfolio> {
    const response = await this.client.get<{ success: boolean; portfolio: Portfolio }>('/portfolio');
    return response.data.portfolio;
  }

  // Market endpoints
  async getPrice(symbol: string): Promise<PriceData> {
    const response = await this.client.get<PriceData>(`/market/price/${symbol}`);
    return response.data;
  }

  async getMarketStatus(): Promise<MarketStatus> {
    const response = await this.client.get<MarketStatus>('/market/status');
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<{ ok: boolean }> {
    const response = await this.client.get<{ ok: boolean }>('/health');
    return response.data;
  }
}

export const apiClient = new ApiClient();
