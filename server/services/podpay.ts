import { logger } from "../utils/logger";
import axios, { type AxiosInstance } from 'axios';

interface PodpayConfig {
  publicKey: string;
  secretKey: string;
  withdrawKey: string;
  baseURL: string;
}

interface CreateTransactionParams {
  orderId: string;
  sellerId: string;
  buyerId: string;
  amountCents: number;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  customer: {
    name: string;
    email: string;
    phone?: string;
    cpf: string;
  };
}

interface CreateWithdrawalParams {
  sellerId: string;
  amountCents: number;
  pixKey: string;
  pixKeyType: string;
}

interface PodpayTransactionResponse {
  id: number;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: 'waiting_payment' | 'pending' | 'approved' | 'paid' | 'refused' | 'refunded' | 'cancelled' | 'chargeback';
  secureId: string;
  secureUrl: string;
  pix?: {
    qrcode: string;
    expirationDate: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface PodpayWithdrawalResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  amount: number;
  pix_key: string;
  pix_key_type: string;
}

interface PodpayBalanceResponse {
  available: number;
  pending: number;
  total: number;
}

class PodpayService {
  private client: AxiosInstance;
  private config: PodpayConfig;

  constructor(config: PodpayConfig) {
    this.config = config;
    
    // Create axios instance with Basic Auth
    const authToken = Buffer.from(`${config.publicKey}:${config.secretKey}`).toString('base64');
    
    this.client = axios.create({
      baseURL: config.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authToken}`,
      },
      timeout: 30000, // 30 seconds timeout
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('[Podpay] API Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        throw error;
      }
    );
  }

  /**
   * Create a PIX transaction for marketplace order
   */
  async createPixTransaction(params: CreateTransactionParams): Promise<PodpayTransactionResponse> {
    try {
      const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || 'your-repl-url.replit.app';
      const postbackUrl = `https://${domain}/api/webhooks/podpay`;
      
      logger.debug('[Podpay] Creating PIX transaction:', {
        orderId: params.orderId,
        amount: params.amountCents / 100,
        postbackUrl,
      });

      const response = await this.client.post('/v1/transactions', {
        amount: params.amountCents,
        currency: 'BRL',
        paymentMethod: 'pix',
        items: params.items.map(item => ({
          title: item.name,
          quantity: item.quantity,
          tangible: false,
          unitPrice: item.price,
          externalRef: '',
        })),
        customer: {
          name: params.customer.name,
          email: params.customer.email,
          phone: params.customer.phone || '',
          document: {
            type: 'cpf',
            number: params.customer.cpf,
          },
        },
        pix: {
          expiresInDays: 2,
        },
        externalRef: params.orderId,
        postbackUrl,
        metadata: JSON.stringify({
          seller_id: params.sellerId,
          buyer_id: params.buyerId,
        }),
      });

      logger.debug('[Podpay] Transaction created successfully:', response.data.id);

      return response.data;
    } catch (error: any) {
      logger.error('[Podpay] Error creating transaction:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || 
        'Falha ao criar transação PIX. Tente novamente.'
      );
    }
  }

  /**
   * Create a withdrawal (saque) to seller's PIX key
   */
  async createWithdrawal(params: CreateWithdrawalParams): Promise<PodpayWithdrawalResponse> {
    try {
      logger.debug('[Podpay] Creating withdrawal:', {
        sellerId: params.sellerId,
        amount: params.amountCents / 100,
        pixKeyType: params.pixKeyType,
      });

      const response = await this.client.post('/v1/transfers', {
        method: 'fiat',
        amount: params.amountCents,
        netPayout: false,
        pixKey: params.pixKey,
        pixKeyType: params.pixKeyType,
        description: `Saque Marketplace - Vendedor ${params.sellerId}`,
        metadata: JSON.stringify({
          seller_id: params.sellerId,
        }),
      }, {
        headers: {
          'x-withdraw-key': this.config.withdrawKey,
        },
      });

      logger.debug('[Podpay] Withdrawal created successfully:', response.data.id);

      return response.data;
    } catch (error: any) {
      logger.error('[Podpay] Error creating withdrawal:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || 
        'Falha ao processar saque. Tente novamente.'
      );
    }
  }

  /**
   * Get Podpay account balance
   */
  async getBalance(): Promise<PodpayBalanceResponse> {
    try {
      logger.debug('[Podpay] Fetching account balance');

      const response = await this.client.get('/v1/balance/available');

      logger.debug('[Podpay] Balance fetched successfully');

      return response.data;
    } catch (error: any) {
      logger.error('[Podpay] Error fetching balance:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || 
        'Falha ao consultar saldo. Tente novamente.'
      );
    }
  }

  /**
   * Check transaction status
   */
  async getTransactionStatus(transactionId: string): Promise<{ status: string }> {
    try {
      logger.debug('[Podpay] Checking transaction status:', transactionId);

      const response = await this.client.get(`/v1/transactions/${transactionId}`);

      return {
        status: response.data.status,
      };
    } catch (error: any) {
      logger.error('[Podpay] Error checking transaction status:', error.response?.data || error.message);
      throw new Error('Falha ao verificar status da transação.');
    }
  }

  /**
   * Refund a transaction (estornar venda)
   */
  async refundTransaction(transactionId: string): Promise<PodpayTransactionResponse> {
    try {
      logger.debug('[Podpay] Refunding transaction:', transactionId);

      const response = await this.client.post(`/v1/transactions/${transactionId}/refund`);

      logger.debug('[Podpay] Transaction refunded successfully:', transactionId);

      return response.data;
    } catch (error: any) {
      logger.error('[Podpay] Error refunding transaction:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || 
        'Falha ao processar reembolso. Tente novamente.'
      );
    }
  }
}

// Export singleton instance
let podpayInstance: PodpayService | null = null;

export function getPodpayService(): PodpayService {
  if (!podpayInstance) {
    const publicKey = process.env.PODPAY_PUBLIC_KEY;
    const secretKey = process.env.PODPAY_SECRET_KEY;
    const withdrawKey = process.env.PODPAY_WITHDRAW_KEY;

    if (!publicKey || !secretKey || !withdrawKey) {
      throw new Error(
        'Podpay credentials not configured. Please set PODPAY_PUBLIC_KEY, PODPAY_SECRET_KEY, and PODPAY_WITHDRAW_KEY environment variables.'
      );
    }

    podpayInstance = new PodpayService({
      publicKey,
      secretKey,
      withdrawKey,
      baseURL: process.env.PODPAY_BASE_URL || 'https://api.podpay.co',
    });
  }

  return podpayInstance;
}

/**
 * Safe getter that returns null instead of throwing when credentials are missing
 */
export function getPodpayServiceSafe(): PodpayService | null {
  try {
    return getPodpayService();
  } catch {
    return null;
  }
}

// Helper functions that wrap the singleton instance
export function createPixTransaction(params: CreateTransactionParams): Promise<PodpayTransactionResponse> {
  return getPodpayService().createPixTransaction(params);
}

export function createWithdrawal(params: CreateWithdrawalParams): Promise<PodpayWithdrawalResponse> {
  return getPodpayService().createWithdrawal(params);
}

export function getBalance(): Promise<PodpayBalanceResponse> {
  return getPodpayService().getBalance();
}

export function refundTransaction(transactionId: string): Promise<PodpayTransactionResponse> {
  return getPodpayService().refundTransaction(transactionId);
}

export default PodpayService;
