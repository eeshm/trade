import axios, { AxiosInstance } from 'axios';
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
    });
 
    // Add request interceptor for auth token
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Clear token on 401
          this.clearToken();
        }
        return Promise.reject(error);
      }
    );

    // Load token from localStorage on init
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem('authToken');
      if (savedToken) {
        this.token = savedToken;
      }
    }
  }

  setToken(token: string) {
    this.token = token;
    if(typeof window !== 'undefined') {
      localStorage.setItem('authToken', token);
    }
  }

  clearToken() {
    this.token = null;
    if(typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
    }
  }

  getToken() {
    return this.token;
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
    const { token } = response.data;
    this.setToken(token);
    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/auth/logout');
    } finally {
      this.clearToken();
    }
  }

  // Order endpoints
  async placeOrder(request: PlaceOrderRequest): Promise<Order> {
    const response = await this.client.post<Order>('/orders', request);
    return response.data;
  }

  async getOrders(): Promise<Order[]> {
    const response = await this.client.get<Order[]>('/orders');
    return response.data;
  }

  async getOrder(orderId: number): Promise<Order> {
    const response = await this.client.get<Order>(`/orders/${orderId}`);
    return response.data;
  }

  // Portfolio endpoints
  async getPortfolio(): Promise<Portfolio> {
    const response = await this.client.get<Portfolio>('/portfolio');
    return response.data;
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
