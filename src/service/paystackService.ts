import axios from "axios";
import logger from "../utils/logger";

interface PaystackConfig {
  secretKey: string;
  publicKey: string;
}

interface InitializePaymentData {
  email: string;
  amount: number; // in kobo
  reference: string;
  callback_url?: string;
  metadata?: any;
}

interface PaystackResponse {
  status: boolean;
  message: string;
  data: any;
}

class PaystackService {
  private baseURL = "https://api.paystack.co";
  private config: PaystackConfig;

  constructor(config: PaystackConfig) {
    this.config = config;
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.config.secretKey}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Initialize a payment transaction
   */
  async initializePayment(
    data: InitializePaymentData
  ): Promise<PaystackResponse> {
    try {
      const response = await axios.post(
        `${this.baseURL}/transaction/initialize`,
        data,
        { headers: this.getHeaders() }
      );

      logger.info(`Payment initialized: ${data.reference}`);
      return response.data;
    } catch (error: any) {
      logger.error(
        error.response?.data || error.message,
        "Paystack initialization error:"
      );
      throw new Error(
        error.response?.data?.message || "Payment initialization failed"
      );
    }
  }

  /**
   * Verify a payment transaction
   */
  async verifyPayment(reference: string): Promise<PaystackResponse> {
    try {
      const response = await axios.get(
        `${this.baseURL}/transaction/verify/${reference}`,
        { headers: this.getHeaders() }
      );

      logger.info(`Payment verified: ${reference}`);
      return response.data;
    } catch (error: any) {
      logger.error(
        error.response?.data || error.message,
        "Paystack verification error:"
      );
      throw new Error(
        error.response?.data?.message || "Payment verification failed"
      );
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(transactionId: string): Promise<PaystackResponse> {
    try {
      const response = await axios.get(
        `${this.baseURL}/transaction/${transactionId}`,
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error: any) {
      logger.error(
        error.response?.data || error.message,
        "Paystack transaction fetch error:"
      );
      throw new Error(
        error.response?.data?.message || "Failed to fetch transaction"
      );
    }
  }

  /**
   * List transactions with filters
   */
  async listTransactions(params?: {
    perPage?: number;
    page?: number;
    customer?: string;
    status?: string;
    from?: string;
    to?: string;
  }): Promise<PaystackResponse> {
    try {
      const queryParams = new URLSearchParams(params as any).toString();
      const response = await axios.get(
        `${this.baseURL}/transaction?${queryParams}`,
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error: any) {
      logger.error(
        error.response?.data || error.message,
        "Paystack transactions list error:"
      );
      throw new Error(
        error.response?.data?.message || "Failed to fetch transactions"
      );
    }
  }

  /**
   * Validate webhook signature
   */
  validateWebhook(payload: string, signature: string): boolean {
    const crypto = require("crypto");
    const hash = crypto
      .createHmac("sha512", this.config.secretKey)
      .update(payload)
      .digest("hex");

    return hash === signature;
  }
}

export default PaystackService;
export { PaystackConfig, InitializePaymentData, PaystackResponse };
