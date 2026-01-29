import { logger } from "../utils/logger";
import axios, { AxiosInstance } from 'axios';

interface AsaasConfig {
  apiKey: string;
  environment: 'sandbox' | 'production';
}

interface CreatePaymentParams {
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
    postalCode: string;
    addressNumber: string;
    addressComplement?: string;
    mobilePhone: string;
  };
  card: {
    number: string;
    holderName: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  installmentCount?: number;
  installmentValue?: number;
  remoteIp?: string;
}

interface AsaasCustomerResponse {
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
}

interface AsaasPaymentResponse {
  id: string;
  status: string;
  billingType: string;
  value: number;
  installmentCount?: number;
  installmentValue?: number;
  transactionReceiptUrl?: string;
  invoiceUrl?: string;
  creditCard?: {
    creditCardNumber: string;
    creditCardBrand: string;
    creditCardToken: string;
  };
}

interface AsaasSimulationResponse {
  value: number;
  installmentCount: number;
  installmentValue: number;
  netValue: number;
  fee: number;
  feePercentage: number;
}

interface CreatePixTransferParams {
  sellerId: string;
  amountCents: number;
  pixKey: string;
  pixKeyType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
  description?: string;
}

interface AsaasTransferResponse {
  id: string;
  dateCreated: string;
  status: string;
  effectiveDate: string | null;
  endToEndIdentifier: string | null;
  type: string;
  value: number;
  netValue: number;
  transferFee: number;
  scheduleDate: string | null;
  authorized: boolean;
  failReason: string | null;
  transactionReceiptUrl: string | null;
  operationType: string;
  description: string;
}

interface CreateRecurringSubscriptionParams {
  subscriptionId: string;
  amountCents: number;
  cycle: 'MONTHLY' | 'YEARLY';
  description: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
    cpf: string;
    postalCode: string;
    addressNumber: string;
    addressComplement?: string;
    mobilePhone: string;
  };
  card: {
    number: string;
    holderName: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  remoteIp?: string;
}

interface AsaasSubscriptionResponse {
  id: string;
  status: string;
  billingType: string;
  value: number;
  nextDueDate: string;
  cycle: string;
  description?: string;
  creditCard?: {
    creditCardNumber: string;
    creditCardBrand: string;
    creditCardToken: string;
  };
  customer?: string;
  dateCreated?: string;
  deleted?: boolean;
  externalReference?: string;
}

interface UpdateSubscriptionParams {
  value?: number;
  nextDueDate?: string;
  cycle?: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';
  description?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  updatePendingPayments?: boolean;
  externalReference?: string;
}

interface UpdateSubscriptionCardParams {
  subscriptionId: string;
  creditCard: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone?: string;
    mobilePhone?: string;
    addressComplement?: string;
  };
  remoteIp: string;
}

interface DeleteSubscriptionResponse {
  deleted: boolean;
  id: string;
}

interface AsaasSubscriptionPaymentResponse {
  id: string;
  dateCreated: string;
  customer: string;
  subscription: string;
  paymentLink?: string;
  dueDate: string;
  value: number;
  netValue: number;
  billingType: string;
  status: string;
  description?: string;
  externalReference?: string;
  confirmedDate?: string;
  originalValue?: number;
  interestValue?: number;
  invoiceUrl?: string;
  transactionReceiptUrl?: string;
  creditCard?: {
    creditCardNumber: string;
    creditCardBrand: string;
    creditCardToken: string;
  };
}

interface AsaasSubscriptionPaymentsListResponse {
  object: string;
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: AsaasSubscriptionPaymentResponse[];
}

class AsaasService {
  private client: AxiosInstance;
  private config: AsaasConfig;
  private baseUrl: string;

  constructor(config: AsaasConfig) {
    this.config = config;
    
    // URL base conforme ambiente
    // IMPORTANTE: Sandbox usa 'api-sandbox.asaas.com' (não 'sandbox.asaas.com')
    this.baseUrl = config.environment === 'production'
      ? 'https://api.asaas.com'
      : 'https://api-sandbox.asaas.com';
    
    logger.debug('[Asaas] Config:', {
      environment: config.environment,
      baseUrl: this.baseUrl,
    });

    this.client = axios.create({
      baseURL: `${this.baseUrl}/v3`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'access_token': config.apiKey,
      },
    });
  }

  /**
   * Sanitiza e valida um endereço IP remoto.
   * O header x-forwarded-for pode conter múltiplos IPs separados por vírgula.
   * Esta função extrai apenas o primeiro IP e valida o formato.
   * 
   * @param ip - IP ou lista de IPs separados por vírgula
   * @returns IP sanitizado e validado, ou '127.0.0.1' como fallback
   */
  private sanitizeRemoteIp(ip?: string): string {
    if (!ip || ip.trim() === '') {
      logger.warn('[Asaas] ⚠️ Remote IP not provided, using fallback');
      return '127.0.0.1';
    }

    // Extrair o primeiro IP se houver múltiplos (x-forwarded-for)
    const firstIp = ip.split(',')[0].trim();

    // Validação básica de formato IPv4 ou IPv6
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    
    if (ipv4Regex.test(firstIp) || ipv6Regex.test(firstIp) || firstIp === '::1') {
      // Validar ranges de IPv4 (cada octeto <= 255)
      if (ipv4Regex.test(firstIp)) {
        const octets = firstIp.split('.').map(Number);
        if (octets.some(octet => octet > 255)) {
          logger.warn('[Asaas] ⚠️ Invalid IPv4 octet value, using fallback');
          return '127.0.0.1';
        }
      }
      return firstIp;
    }

    logger.warn('[Asaas] ⚠️ Invalid IP format, using fallback:', { originalIp: ip, extracted: firstIp });
    return '127.0.0.1';
  }

  /**
   * Obter taxas conhecidas do Asaas como fallback
   * Baseado na tabela de taxas oficial: https://www.asaas.com/precos
   */
  private getKnownAsaasFees(installmentCount: number): { feePercentage: number; fixedFee: number } {
    if (installmentCount === 1) {
      return { feePercentage: 2.99, fixedFee: 0.49 };
    } else if (installmentCount >= 2 && installmentCount <= 6) {
      return { feePercentage: 3.99, fixedFee: 0.49 };
    } else {
      // 7-12 parcelas
      return { feePercentage: 4.99, fixedFee: 0.49 };
    }
  }

  /**
   * Simular venda para calcular taxas (com fallback para taxas conhecidas)
   */
  async simulatePayment(valueInCents: number, installmentCount: number = 1): Promise<AsaasSimulationResponse> {
    try {
      logger.debug('[Asaas] Simulating payment:', {
        value: valueInCents / 100,
        installments: installmentCount,
      });

      const response = await this.client.post('/payments/simulate', {
        value: valueInCents / 100,
        installmentCount: installmentCount,
        billingType: 'CREDIT_CARD',
      });

      logger.debug('[Asaas] ✅ Simulation full response:', JSON.stringify(response.data, null, 2));

      // Se a API não retornar os campos esperados, usar fallback com taxas conhecidas
      if (!response.data.fee || !response.data.netValue || !response.data.feePercentage) {
        logger.warn('[Asaas] ⚠️ Simulation API returned incomplete data, using known fee structure as fallback');
        const value = valueInCents / 100;
        const { feePercentage, fixedFee } = this.getKnownAsaasFees(installmentCount);
        const fee = (value * feePercentage / 100) + fixedFee;
        const netValue = value - fee;
        const installmentValue = value / installmentCount;

        const fallbackResponse: AsaasSimulationResponse = {
          value,
          installmentCount,
          installmentValue,
          netValue,
          fee,
          feePercentage,
        };

        logger.debug('[Asaas] ✅ Fallback simulation result:', {
          value: fallbackResponse.value,
          fee: fallbackResponse.fee,
          netValue: fallbackResponse.netValue,
          feePercentage: fallbackResponse.feePercentage,
        });

        return fallbackResponse;
      }

      logger.debug('[Asaas] ✅ Simulation result:', {
        value: response.data.value,
        fee: response.data.fee,
        netValue: response.data.netValue,
        feePercentage: response.data.feePercentage,
      });

      return response.data;
    } catch (error: any) {
      logger.error('[Asaas] ❌ Error simulating payment, using fallback:', {
        message: error.message,
        responseData: error.response?.data,
        status: error.response?.status
      });

      // Fallback completo em caso de erro na API
      const value = valueInCents / 100;
      const { feePercentage, fixedFee } = this.getKnownAsaasFees(installmentCount);
      const fee = (value * feePercentage / 100) + fixedFee;
      const netValue = value - fee;
      const installmentValue = value / installmentCount;

      return {
        value,
        installmentCount,
        installmentValue,
        netValue,
        fee,
        feePercentage,
      };
    }
  }

  /**
   * Calcular valor total com taxas repassadas ao comprador
   * Retorna o valor que o comprador deve pagar para que o vendedor receba exatamente o valor desejado
   * 
   * Usa taxas conhecidas do Asaas para calcular diretamente, sem depender da API de simulação.
   * 
   * Fórmula: netValue = grossValue * (1 - feePercentage/100) - fixedFee
   * Resolvendo: grossValue = (desiredNetValue + fixedFee) / (1 - feePercentage/100)
   */
  async calculateTotalWithFees(desiredNetValueInCents: number, installmentCount: number = 1): Promise<number> {
    try {
      logger.debug('[Asaas] 🧮 Calculating gross value to achieve net value:', {
        desiredNetValue: desiredNetValueInCents / 100,
        installments: installmentCount,
      });

      if (desiredNetValueInCents <= 0) {
        logger.error('[Asaas] ❌ Invalid desired net value:', desiredNetValueInCents);
        throw new Error('Valor desejado deve ser maior que zero');
      }

      // Obter taxas conhecidas do Asaas
      const { feePercentage, fixedFee } = this.getKnownAsaasFees(installmentCount);
      const desiredNetValue = desiredNetValueInCents / 100;

      logger.debug('[Asaas] 📊 Using known Asaas fees:', {
        feePercentage: feePercentage + '%',
        fixedFee: fixedFee.toFixed(2),
        installments: installmentCount,
      });

      // Calcular o valor bruto necessário usando a fórmula
      // netValue = grossValue * (1 - feePercentage/100) - fixedFee
      // desiredNetValue = grossValue * (1 - feePercentage/100) - fixedFee
      // grossValue = (desiredNetValue + fixedFee) / (1 - feePercentage/100)
      
      const netMultiplier = 1 - (feePercentage / 100);
      
      if (netMultiplier <= 0) {
        throw new Error('Taxa percentual inválida (>= 100%)');
      }

      const calculatedGrossValue = (desiredNetValue + fixedFee) / netMultiplier;
      const calculatedGrossValueInCents = Math.round(calculatedGrossValue * 100);

      // Validar que o cálculo está correto (retroativo)
      const expectedFee = (calculatedGrossValue * feePercentage / 100) + fixedFee;
      const expectedNetValue = calculatedGrossValue - expectedFee;
      const difference = desiredNetValue - expectedNetValue;

      logger.debug('[Asaas] 🔢 Calculation result:', {
        desiredNetValue: desiredNetValue.toFixed(2),
        calculatedGrossValue: calculatedGrossValue.toFixed(2),
        expectedFee: expectedFee.toFixed(2),
        expectedNetValue: expectedNetValue.toFixed(2),
        precision: Math.abs(difference).toFixed(4),
      });

      // Verificar precisão (deve ser < 1 centavo devido a arredondamentos)
      if (Math.abs(difference) > 0.02) {
        logger.warn('[Asaas] ⚠️ Calculation precision warning:', {
          difference: difference.toFixed(4),
          threshold: '0.02',
        });
      }

      logger.debug('[Asaas] ✅ Gross value calculated successfully!', {
        grossValue: calculatedGrossValueInCents / 100,
        netValue: expectedNetValue.toFixed(2),
        fee: expectedFee.toFixed(2),
      });

      return calculatedGrossValueInCents;
    } catch (error: any) {
      logger.error('[Asaas] ❌ Error calculating total with fees:', error);
      throw new Error('Falha ao calcular valor com taxas repassadas: ' + error.message);
    }
  }

  /**
   * Calcular juros de parcelamento repassados ao comprador
   * Compara taxa 1x (baseline) vs Nx parcelas e retorna a diferença como "juros do cartão"
   * 
   * Isso garante que:
   * - Vendedor recebe 100% do valor do produto
   * - Plataforma mantém margem de lucro estável (~7%)
   * - Comprador paga juros apenas no parcelamento (não à vista)
   * 
   * @returns {
   *   productValueCents: valor do produto,
   *   baselineTotalCents: total se fosse à vista (1x),
   *   installmentTotalCents: total com juros do parcelamento (Nx),
   *   surchargeCents: juros do parcelamento (diferença),
   *   installmentValueCents: valor de cada parcela,
   *   installmentCount: quantidade de parcelas
   * }
   */
  async calculateInstallmentSurcharge(
    productValueCents: number,
    installmentCount: number = 1
  ): Promise<{
    productValueCents: number;
    baselineTotalCents: number;
    installmentTotalCents: number;
    surchargeCents: number;
    installmentValueCents: number;
    installmentCount: number;
  }> {
    try {
      logger.debug('[Asaas] 💳 Calculating installment surcharge:', {
        productValue: productValueCents / 100,
        installments: installmentCount,
      });

      // Step 1: Calcular valor à vista (1x) - baseline
      const baselineTotalCents = await this.calculateTotalWithFees(productValueCents, 1);
      
      logger.debug('[Asaas] 📊 Baseline (1x):', {
        productValue: productValueCents / 100,
        buyerPays: baselineTotalCents / 100,
        platformFees: (baselineTotalCents - productValueCents) / 100,
      });

      // Step 2: Se for à vista, retornar sem juros
      if (installmentCount <= 1) {
        return {
          productValueCents,
          baselineTotalCents,
          installmentTotalCents: baselineTotalCents,
          surchargeCents: 0,
          installmentValueCents: baselineTotalCents,
          installmentCount: 1,
        };
      }

      // Step 3: Calcular valor parcelado (Nx)
      const installmentTotalCents = await this.calculateTotalWithFees(productValueCents, installmentCount);
      
      // Step 4: Calcular juros (diferença entre parcelado e à vista)
      const surchargeCents = installmentTotalCents - baselineTotalCents;
      
      // Step 5: Calcular valor de cada parcela
      const installmentValueCents = Math.ceil(installmentTotalCents / installmentCount);

      logger.debug('[Asaas] 💰 Installment breakdown:', {
        productValue: productValueCents / 100,
        baselineTotal: baselineTotalCents / 100,
        installmentTotal: installmentTotalCents / 100,
        cardInterest: surchargeCents / 100,
        perInstallment: installmentValueCents / 100,
        totalInstallments: installmentCount,
      });

      logger.debug('[Asaas] ✅ Platform margin maintained:', {
        baselineMargin: (baselineTotalCents - productValueCents) / 100,
        installmentMargin: (installmentTotalCents - productValueCents) / 100,
        delta: surchargeCents / 100,
      });

      return {
        productValueCents,
        baselineTotalCents,
        installmentTotalCents,
        surchargeCents,
        installmentValueCents,
        installmentCount,
      };
    } catch (error: any) {
      logger.error('[Asaas] ❌ Error calculating installment surcharge:', error);
      throw new Error('Falha ao calcular juros do parcelamento: ' + error.message);
    }
  }

  /**
   * Criar ou buscar cliente no Asaas
   */
  private async ensureCustomer(params: CreatePaymentParams): Promise<string> {
    try {
      logger.debug('[Asaas] Ensuring customer exists...');

      // Tentar buscar cliente existente pelo CPF
      const searchResponse = await this.client.get('/customers', {
        params: {
          cpfCnpj: params.customer.cpf,
          limit: 1
        }
      });

      if (searchResponse.data.data && searchResponse.data.data.length > 0) {
        const existingCustomer = searchResponse.data.data[0];
        logger.debug('[Asaas] ✅ Customer already exists:', existingCustomer.id);
        return existingCustomer.id;
      }

      // Cliente não existe, criar novo
      const createResponse = await this.client.post('/customers', {
        name: params.customer.name,
        cpfCnpj: params.customer.cpf,
        email: params.customer.email,
        phone: params.customer.phone || '',
        mobilePhone: params.customer.phone || '',
        externalReference: params.buyerId,
        notificationDisabled: true, // CRÍTICO: Desabilita emails do Asaas para novos clientes
      });

      logger.debug('[Asaas] ✅ Customer created with notifications DISABLED:', createResponse.data.id);
      return createResponse.data.id;
    } catch (error: any) {
      logger.error('[Asaas] ❌ Error ensuring customer:', {
        message: error.message,
        responseData: error.response?.data,
        status: error.response?.status
      });
      throw new Error('Erro ao criar/buscar cliente no Asaas: ' + (error.response?.data?.errors?.[0]?.description || error.message));
    }
  }

  /**
   * Criar cobrança com cartão de crédito
   * IMPORTANTE: As taxas do Asaas são automaticamente repassadas ao comprador,
   * garantindo que o vendedor receba o valor cheio do produto.
   * 
   * @param params.precalculatedTotalCents - Se fornecido, usa este valor ao invés de recalcular (otimização)
   */
  async createCreditCardPayment(
    params: CreatePaymentParams & { precalculatedTotalCents?: number }
  ): Promise<AsaasPaymentResponse> {
    try {
      const installments = params.installmentCount || 1;
      
      logger.debug('[Asaas] Starting credit card payment:', {
        orderId: params.orderId,
        originalAmount: params.amountCents / 100,
        installments: installments,
        precalculated: !!params.precalculatedTotalCents,
      });

      // Step 1: Usar valor pré-calculado OU calcular valor total COM taxas
      let totalWithFeesInCents: number;
      
      if (params.precalculatedTotalCents) {
        logger.debug('[Asaas] ⚡ Using precalculated total (optimization)');
        totalWithFeesInCents = params.precalculatedTotalCents;
      } else {
        logger.debug('[Asaas] 🧮 Calculating fees to pass to buyer...');
        totalWithFeesInCents = await this.calculateTotalWithFees(params.amountCents, installments);
      }
      
      logger.debug('[Asaas] 💵 Pricing breakdown:', {
        sellerReceives: params.amountCents / 100,
        buyerPays: totalWithFeesInCents / 100,
        feeAmount: (totalWithFeesInCents - params.amountCents) / 100,
      });

      // Step 2: Garantir que o cliente existe
      const customerId = await this.ensureCustomer(params);

      // Step 3: Preparar dados do pagamento com valor ajustado
      // IMPORTANTE: Asaas API v3 exige expiryYear com 4 dígitos (ex: "2028")
      const normalizedExpiryYear = params.card.expiryYear.length === 2 
        ? `20${params.card.expiryYear}` 
        : params.card.expiryYear;

      // Validar dados obrigatórios
      const customerPhone = params.customer.phone || '';
      
      if (!customerPhone) {
        logger.warn('[Asaas] ⚠️ Customer phone is empty - using default value');
      }

      // Sanitizar e validar IP remoto
      const sanitizedRemoteIp = this.sanitizeRemoteIp(params.remoteIp);

      // Montar creditCardHolderInfo com todos os campos obrigatórios
      // IMPORTANTE: Asaas exige postalCode e addressNumber
      const creditCardHolderInfo: any = {
        name: params.card.holderName,
        email: params.customer.email,
        cpfCnpj: params.customer.cpf,
        postalCode: params.customer.postalCode,
        addressNumber: params.customer.addressNumber,
      };

      // Adicionar phone apenas se houver valor
      if (customerPhone && customerPhone.trim()) {
        creditCardHolderInfo.phone = customerPhone;
      }

      // Adicionar mobilePhone apenas se houver valor
      if (params.customer.mobilePhone && params.customer.mobilePhone.trim()) {
        creditCardHolderInfo.mobilePhone = params.customer.mobilePhone;
      }

      // Adicionar addressComplement apenas se houver valor
      if (params.customer.addressComplement && params.customer.addressComplement.trim()) {
        creditCardHolderInfo.addressComplement = params.customer.addressComplement;
      }

      const paymentData: any = {
        customer: customerId,
        billingType: 'CREDIT_CARD',
        dueDate: new Date().toISOString().split('T')[0],
        description: `Pedido ${params.orderId}`,
        externalReference: params.orderId,
        autoNotificationDisabled: true,
        creditCard: {
          holderName: params.card.holderName,
          number: params.card.number.replace(/\s/g, ''),
          expiryMonth: params.card.expiryMonth,
          expiryYear: normalizedExpiryYear,
          ccv: params.card.ccv,
        },
        creditCardHolderInfo,
        remoteIp: sanitizedRemoteIp,
      };

      logger.debug('[Asaas] 📋 Payment data prepared:', {
        customerId,
        cardLast4: params.card.number.slice(-4),
        cardHolder: params.card.holderName,
        expiryMonth: params.card.expiryMonth,
        expiryYear: normalizedExpiryYear,
        cpf: params.customer.cpf,
        remoteIp: paymentData.remoteIp,
        hasPhone: !!customerPhone,
        hasMobilePhone: !!params.customer.mobilePhone,
        creditCardHolderInfo: {
          name: creditCardHolderInfo.name,
          email: creditCardHolderInfo.email,
          cpfCnpj: creditCardHolderInfo.cpfCnpj,
          postalCode: creditCardHolderInfo.postalCode,
          addressNumber: creditCardHolderInfo.addressNumber,
          phone: creditCardHolderInfo.phone || 'not set',
          mobilePhone: creditCardHolderInfo.mobilePhone || 'not set',
          addressComplement: creditCardHolderInfo.addressComplement || 'not set',
        }
      });

      // Adicionar informações de parcelamento
      if (installments > 1) {
        paymentData.installmentCount = installments;
        paymentData.value = totalWithFeesInCents / 100;
        paymentData.installmentValue = Number((totalWithFeesInCents / 100 / installments).toFixed(2));
      } else {
        paymentData.value = totalWithFeesInCents / 100;
      }

      logger.debug('[Asaas] Creating payment with adjusted value:', {
        customerId,
        value: paymentData.value,
        installmentCount: paymentData.installmentCount || 1,
        installmentValue: paymentData.installmentValue,
        originalProductValue: params.amountCents / 100,
      });

      // Step 4: Criar pagamento
      const response = await this.client.post('/payments', paymentData);

      logger.debug('[Asaas] ✅ Payment created:', {
        id: response.data.id,
        status: response.data.status,
        chargedValue: response.data.value,
        sellerWillReceive: params.amountCents / 100,
      });

      return response.data;
    } catch (error: any) {
      logger.error('[Asaas] ❌ Error creating payment:', {
        message: error.message,
        responseData: error.response?.data,
        status: error.response?.status,
        fullError: JSON.stringify(error.response?.data, null, 2)
      });

      if (error.response?.data?.errors) {
        logger.error('[Asaas] 🔍 All errors:', error.response.data.errors);
      }

      const errorMessage = error.response?.data?.errors?.[0]?.description || error.message;
      throw new Error(`Asaas: ${errorMessage}`);
    }
  }

  async getPaymentStatus(paymentId: string): Promise<AsaasPaymentResponse> {
    try {
      const response = await this.client.get(`/payments/${paymentId}`);
      return response.data;
    } catch (error: any) {
      logger.error('[Asaas] ❌ Error getting payment status:', {
        paymentId,
        message: error.message,
        responseData: error.response?.data,
        status: error.response?.status
      });

      const errorMessage = error.response?.data?.errors?.[0]?.description || error.message;
      throw new Error(`Asaas Get Payment: ${errorMessage}`);
    }
  }

  /**
   * Reembolsar pagamento
   * Documentação: https://docs.asaas.com/reference/estornar-cobranca
   */
  async refundPayment(paymentId: string, value?: number, description?: string): Promise<any> {
    try {
      logger.debug('[Asaas] Refunding payment:', {
        paymentId,
        value: value ? value : 'full refund',
        description,
      });

      const refundData: any = {};
      
      // Se o valor for especificado, fazer reembolso parcial
      if (value) {
        refundData.value = value;
      }
      
      if (description) {
        refundData.description = description;
      }

      const response = await this.client.post(`/payments/${paymentId}/refund`, refundData);

      logger.debug('[Asaas] ✅ Payment refunded successfully:', {
        paymentId,
        status: response.data.status,
      });

      return response.data;
    } catch (error: any) {
      logger.error('[Asaas] ❌ Error refunding payment:', {
        message: error.message,
        responseData: error.response?.data,
        status: error.response?.status
      });

      const errorMessage = error.response?.data?.errors?.[0]?.description || error.message;
      throw new Error(`Asaas: ${errorMessage}`);
    }
  }

  /**
   * Criar transferência PIX para chave PIX
   * Documentação: https://docs.asaas.com/reference/transferir-para-conta-de-outra-instituicao-ou-chave-pix
   * 
   * IMPORTANTE: Transferências PIX no Asaas são GRATUITAS! 🎉
   * Diferente do Podpay que cobra R$ 2,49 por transferência.
   */
  async createPixTransfer(params: CreatePixTransferParams): Promise<AsaasTransferResponse> {
    try {
      logger.debug('[Asaas] 💸 Creating PIX transfer:', {
        sellerId: params.sellerId,
        amount: params.amountCents / 100,
        pixKeyType: params.pixKeyType,
        pixKey: params.pixKey,
      });

      const transferData = {
        value: params.amountCents / 100, // Asaas usa valor em reais
        pixAddressKey: params.pixKey,
        pixAddressKeyType: params.pixKeyType,
        description: params.description || `Saque Marketplace - Vendedor ${params.sellerId}`,
      };

      logger.debug('[Asaas] 📤 Transfer data:', transferData);

      const response = await this.client.post('/transfers', transferData);

      logger.debug('[Asaas] ✅ PIX transfer created successfully:', {
        transferId: response.data.id,
        status: response.data.status,
        value: response.data.value,
        transferFee: response.data.transferFee,
        operationType: response.data.operationType,
      });

      return response.data;
    } catch (error: any) {
      logger.error('[Asaas] ❌ Error creating PIX transfer:', {
        message: error.message,
        responseData: error.response?.data,
        status: error.response?.status,
        fullError: JSON.stringify(error.response?.data, null, 2)
      });

      if (error.response?.data?.errors) {
        logger.error('[Asaas] 🔍 All transfer errors:', error.response.data.errors);
      }

      const errorMessage = error.response?.data?.errors?.[0]?.description || error.message;
      throw new Error(`Asaas PIX Transfer: ${errorMessage}`);
    }
  }

  /**
   * Criar assinatura recorrente com cartão de crédito
   * Documentação: https://docs.asaas.com/docs/criando-assinatura-com-cartao-de-credito
   * 
   * Diferente de createCreditCardPayment, esta função cria uma assinatura RECORRENTE
   * que será cobrada automaticamente no ciclo definido (mensal/anual).
   * 
   * IMPORTANTE: Para assinaturas Lowfy, não repassamos taxas ao assinante.
   * O valor cobrado é exatamente o valor do plano (R$99,90 ou R$360,90).
   */
  async createRecurringSubscription(params: CreateRecurringSubscriptionParams): Promise<AsaasSubscriptionResponse> {
    try {
      logger.debug('[Asaas] 🔄 Creating recurring subscription:', {
        subscriptionId: params.subscriptionId,
        amount: params.amountCents / 100,
        cycle: params.cycle,
      });

      // Step 1: Garantir que o cliente existe (sem criar duplicado)
      const customerId = await this.ensureCustomer({
        orderId: params.subscriptionId,
        sellerId: 'lowfy',
        buyerId: params.customer.email,
        amountCents: params.amountCents,
        items: [],
        customer: params.customer,
        card: params.card,
      });

      // Step 2: Normalizar ano de expiração do cartão (Asaas exige 4 dígitos)
      const normalizedExpiryYear = params.card.expiryYear.length === 2 
        ? `20${params.card.expiryYear}` 
        : params.card.expiryYear;

      // Step 3: Data da próxima cobrança (hoje para primeira cobrança imediata)
      // CRITICAL: Usar timezone de São Paulo (UTC-3) para evitar data errada à noite
      const now = new Date();
      const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // Formato YYYY-MM-DD

      // Step 4: Montar creditCardHolderInfo
      const creditCardHolderInfo: any = {
        name: params.card.holderName,
        email: params.customer.email,
        cpfCnpj: params.customer.cpf,
        postalCode: params.customer.postalCode,
        addressNumber: params.customer.addressNumber,
      };

      if (params.customer.phone && params.customer.phone.trim()) {
        creditCardHolderInfo.phone = params.customer.phone;
      }
      if (params.customer.mobilePhone && params.customer.mobilePhone.trim()) {
        creditCardHolderInfo.mobilePhone = params.customer.mobilePhone;
      }
      if (params.customer.addressComplement && params.customer.addressComplement.trim()) {
        creditCardHolderInfo.addressComplement = params.customer.addressComplement;
      }

      // Step 5: Montar dados da assinatura
      const subscriptionData: any = {
        customer: customerId,
        billingType: 'CREDIT_CARD',
        nextDueDate: today,
        value: params.amountCents / 100, // Valor em reais
        cycle: params.cycle,
        description: params.description,
        externalReference: params.subscriptionId,
        creditCard: {
          holderName: params.card.holderName,
          number: params.card.number.replace(/\s/g, ''),
          expiryMonth: params.card.expiryMonth,
          expiryYear: normalizedExpiryYear,
          ccv: params.card.ccv,
        },
        creditCardHolderInfo,
        remoteIp: this.sanitizeRemoteIp(params.remoteIp),
      };

      logger.debug('[Asaas] 📋 Subscription data prepared:', {
        customerId,
        value: subscriptionData.value,
        cycle: subscriptionData.cycle,
        cardLast4: params.card.number.slice(-4),
      });

      // Step 6: Criar assinatura via endpoint /subscriptions
      const response = await this.client.post('/subscriptions', subscriptionData);

      logger.debug('[Asaas] ✅ Recurring subscription created successfully:', {
        id: response.data.id,
        status: response.data.status,
        value: response.data.value,
        cycle: response.data.cycle,
        nextDueDate: response.data.nextDueDate,
      });

      return response.data;
    } catch (error: any) {
      logger.error('[Asaas] ❌ Error creating recurring subscription:', {
        message: error.message,
        responseData: error.response?.data,
        status: error.response?.status,
        fullError: JSON.stringify(error.response?.data, null, 2)
      });

      if (error.response?.data?.errors) {
        logger.error('[Asaas] 🔍 All subscription errors:', error.response.data.errors);
      }

      const errorMessage = error.response?.data?.errors?.[0]?.description || error.message;
      throw new Error(`Asaas Subscription: ${errorMessage}`);
    }
  }

  /**
   * Obter detalhes de uma assinatura específica
   * Documentação: https://docs.asaas.com/reference/recuperar-uma-assinatura
   * GET /subscriptions/{id}
   */
  async getSubscription(subscriptionId: string): Promise<AsaasSubscriptionResponse> {
    try {
      logger.debug('[Asaas] 🔍 Getting subscription details:', { subscriptionId });

      const response = await this.client.get(`/subscriptions/${subscriptionId}`);

      logger.debug('[Asaas] ✅ Subscription details retrieved:', {
        id: response.data.id,
        status: response.data.status,
        value: response.data.value,
        cycle: response.data.cycle,
        nextDueDate: response.data.nextDueDate,
      });

      return response.data;
    } catch (error: any) {
      logger.error('[Asaas] ❌ Error getting subscription:', {
        subscriptionId,
        message: error.message,
        responseData: error.response?.data,
        status: error.response?.status
      });

      const errorMessage = error.response?.data?.errors?.[0]?.description || error.message;
      throw new Error(`Asaas Get Subscription: ${errorMessage}`);
    }
  }

  /**
   * Atualizar uma assinatura existente
   * Documentação: https://docs.asaas.com/reference/atualizar-assinatura
   * PUT /subscriptions/{id}
   * 
   * Campos atualizáveis: value, nextDueDate, cycle, description, status, updatePendingPayments, externalReference
   */
  async updateSubscription(subscriptionId: string, data: UpdateSubscriptionParams): Promise<AsaasSubscriptionResponse> {
    try {
      logger.debug('[Asaas] 📝 Updating subscription:', {
        subscriptionId,
        updateData: data,
      });

      const response = await this.client.put(`/subscriptions/${subscriptionId}`, data);

      logger.debug('[Asaas] ✅ Subscription updated successfully:', {
        id: response.data.id,
        status: response.data.status,
        value: response.data.value,
        cycle: response.data.cycle,
        nextDueDate: response.data.nextDueDate,
      });

      return response.data;
    } catch (error: any) {
      logger.error('[Asaas] ❌ Error updating subscription:', {
        subscriptionId,
        data,
        message: error.message,
        responseData: error.response?.data,
        status: error.response?.status,
        fullError: JSON.stringify(error.response?.data, null, 2)
      });

      if (error.response?.data?.errors) {
        logger.error('[Asaas] 🔍 All update errors:', error.response.data.errors);
      }

      const errorMessage = error.response?.data?.errors?.[0]?.description || error.message;
      throw new Error(`Asaas Update Subscription: ${errorMessage}`);
    }
  }

  /**
   * Remover uma assinatura e todas as mensalidades pendentes
   * Documentação: https://docs.asaas.com/reference/remover-assinatura
   * DELETE /subscriptions/{id}
   * 
   * IMPORTANTE: Remove a assinatura e todas as cobranças pendentes associadas
   */
  async deleteSubscription(subscriptionId: string): Promise<DeleteSubscriptionResponse> {
    try {
      logger.debug('[Asaas] 🗑️ Deleting subscription:', { subscriptionId });

      const response = await this.client.delete(`/subscriptions/${subscriptionId}`);

      logger.debug('[Asaas] ✅ Subscription deleted successfully:', {
        id: response.data.id,
        deleted: response.data.deleted,
      });

      return response.data;
    } catch (error: any) {
      logger.error('[Asaas] ❌ Error deleting subscription:', {
        subscriptionId,
        message: error.message,
        responseData: error.response?.data,
        status: error.response?.status
      });

      const errorMessage = error.response?.data?.errors?.[0]?.description || error.message;
      throw new Error(`Asaas Delete Subscription: ${errorMessage}`);
    }
  }

  /**
   * Atualizar cartão de crédito de uma assinatura
   * Documentação: https://docs.asaas.com/reference/atualizar-cartao-de-credito-de-assinatura
   * PUT /subscriptions/{id}/creditCard
   * 
   * IMPORTANTE: Atualiza o cartão sem fazer nova cobrança até o próximo vencimento
   */
  async updateSubscriptionCard(params: UpdateSubscriptionCardParams): Promise<AsaasSubscriptionResponse> {
    try {
      logger.debug('[Asaas] 💳 Updating subscription credit card:', {
        subscriptionId: params.subscriptionId,
        cardLast4: params.creditCard.number.slice(-4),
        holderName: params.creditCard.holderName,
      });

      // Normalizar ano de expiração (Asaas exige 4 dígitos)
      const normalizedExpiryYear = params.creditCard.expiryYear.length === 2
        ? `20${params.creditCard.expiryYear}`
        : params.creditCard.expiryYear;

      // Montar creditCardHolderInfo
      const creditCardHolderInfo: any = {
        name: params.creditCardHolderInfo.name,
        email: params.creditCardHolderInfo.email,
        cpfCnpj: params.creditCardHolderInfo.cpfCnpj,
        postalCode: params.creditCardHolderInfo.postalCode,
        addressNumber: params.creditCardHolderInfo.addressNumber,
      };

      if (params.creditCardHolderInfo.phone && params.creditCardHolderInfo.phone.trim()) {
        creditCardHolderInfo.phone = params.creditCardHolderInfo.phone;
      }
      if (params.creditCardHolderInfo.mobilePhone && params.creditCardHolderInfo.mobilePhone.trim()) {
        creditCardHolderInfo.mobilePhone = params.creditCardHolderInfo.mobilePhone;
      }
      if (params.creditCardHolderInfo.addressComplement && params.creditCardHolderInfo.addressComplement.trim()) {
        creditCardHolderInfo.addressComplement = params.creditCardHolderInfo.addressComplement;
      }

      // Sanitizar e validar IP remoto
      const sanitizedRemoteIp = this.sanitizeRemoteIp(params.remoteIp);

      const updateData = {
        creditCard: {
          holderName: params.creditCard.holderName,
          number: params.creditCard.number.replace(/\s/g, ''),
          expiryMonth: params.creditCard.expiryMonth,
          expiryYear: normalizedExpiryYear,
          ccv: params.creditCard.ccv,
        },
        creditCardHolderInfo,
        remoteIp: sanitizedRemoteIp,
      };

      logger.debug('[Asaas] 📋 Card update data prepared:', {
        subscriptionId: params.subscriptionId,
        cardLast4: params.creditCard.number.slice(-4),
        expiryMonth: params.creditCard.expiryMonth,
        expiryYear: normalizedExpiryYear,
        holderName: params.creditCard.holderName,
        remoteIp: sanitizedRemoteIp,
      });

      const response = await this.client.put(
        `/subscriptions/${params.subscriptionId}/creditCard`,
        updateData
      );

      logger.debug('[Asaas] ✅ Subscription card updated successfully:', {
        id: response.data.id,
        status: response.data.status,
        creditCardNumber: response.data.creditCard?.creditCardNumber,
        creditCardBrand: response.data.creditCard?.creditCardBrand,
      });

      return response.data;
    } catch (error: any) {
      logger.error('[Asaas] ❌ Error updating subscription card:', {
        subscriptionId: params.subscriptionId,
        message: error.message,
        responseData: error.response?.data,
        status: error.response?.status,
        fullError: JSON.stringify(error.response?.data, null, 2)
      });

      if (error.response?.data?.errors) {
        logger.error('[Asaas] 🔍 All card update errors:', error.response.data.errors);
      }

      const errorMessage = error.response?.data?.errors?.[0]?.description || error.message;
      throw new Error(`Asaas Update Subscription Card: ${errorMessage}`);
    }
  }

  /**
   * Listar todas as cobranças de uma assinatura
   * Documentação: https://docs.asaas.com/reference/listar-cobrancas-de-uma-assinatura
   * GET /subscriptions/{id}/payments
   * 
   * Retorna lista paginada de todas as cobranças (pendentes, pagas, vencidas, etc.)
   */
  async listSubscriptionPayments(
    subscriptionId: string,
    options?: { offset?: number; limit?: number; status?: string }
  ): Promise<AsaasSubscriptionPaymentsListResponse> {
    try {
      logger.debug('[Asaas] 📋 Listing subscription payments:', {
        subscriptionId,
        options,
      });

      const params: any = {
        limit: options?.limit || 100,
        offset: options?.offset || 0,
      };

      if (options?.status) {
        params.status = options.status;
      }

      const response = await this.client.get(`/subscriptions/${subscriptionId}/payments`, { params });

      logger.debug('[Asaas] ✅ Subscription payments retrieved:', {
        subscriptionId,
        totalCount: response.data.totalCount,
        hasMore: response.data.hasMore,
        paymentsReturned: response.data.data?.length || 0,
      });

      return response.data;
    } catch (error: any) {
      logger.error('[Asaas] ❌ Error listing subscription payments:', {
        subscriptionId,
        message: error.message,
        responseData: error.response?.data,
        status: error.response?.status
      });

      const errorMessage = error.response?.data?.errors?.[0]?.description || error.message;
      throw new Error(`Asaas List Subscription Payments: ${errorMessage}`);
    }
  }

  /**
   * Normalizar status do Asaas para status interno
   */
  normalizeStatus(asaasStatus: string): 'pending' | 'approved' | 'declined' | 'refunded' | 'cancelled' {
    const statusMap: Record<string, 'pending' | 'approved' | 'declined' | 'refunded' | 'cancelled'> = {
      'PENDING': 'pending',
      'CONFIRMED': 'approved',
      'RECEIVED': 'approved',
      'RECEIVED_IN_CASH': 'approved',
      'OVERDUE': 'pending',
      'REFUNDED': 'refunded',
      'REFUND_REQUESTED': 'pending',
      'CHARGEBACK_REQUESTED': 'pending',
      'CHARGEBACK_DISPUTE': 'pending',
      'AWAITING_CHARGEBACK_REVERSAL': 'pending',
      'DUNNING_REQUESTED': 'pending',
      'DUNNING_RECEIVED': 'approved',
      'AWAITING_RISK_ANALYSIS': 'pending',
    };

    return statusMap[asaasStatus] || 'pending';
  }

  async listAllCustomers(limit: number = 100, offset: number = 0): Promise<any[]> {
    try {
      logger.debug('[Asaas] Listing customers:', { limit, offset });

      const response = await this.client.get('/customers', {
        params: {
          limit,
          offset
        }
      });

      const customers = response.data.data || [];
      logger.debug(`[Asaas] ✅ Found ${customers.length} customers`);
      
      return customers;
    } catch (error: any) {
      logger.error('[Asaas] ❌ Error listing customers:', {
        message: error.message,
        responseData: error.response?.data,
        status: error.response?.status
      });
      throw new Error('Erro ao listar clientes no Asaas: ' + (error.response?.data?.errors?.[0]?.description || error.message));
    }
  }

  async disableCustomerNotifications(customerId: string): Promise<any> {
    try {
      logger.debug('[Asaas] Disabling notifications for customer:', customerId);

      // Primeiro, buscar os dados atuais do cliente
      const getResponse = await this.client.get(`/customers/${customerId}`);
      const customer = getResponse.data;

      // Atualizar com payload completo incluindo notificationDisabled
      const response = await this.client.put(`/customers/${customerId}`, {
        ...customer,
        notificationDisabled: true
      });

      logger.debug('[Asaas] ✅ Notifications disabled for customer:', customerId);
      return response.data;
    } catch (error: any) {
      logger.error('[Asaas] ❌ Error disabling customer notifications:', {
        customerId,
        message: error.message,
        responseData: error.response?.data,
        status: error.response?.status
      });
      throw new Error('Erro ao desativar notificações do cliente no Asaas: ' + (error.response?.data?.errors?.[0]?.description || error.message));
    }
  }

  async disableAllCustomerNotifications(): Promise<{ total: number; success: number; failed: number; }> {
    try {
      logger.debug('[Asaas] Starting bulk notification disable...');

      let offset = 0;
      const limit = 100;
      let totalProcessed = 0;
      let successCount = 0;
      let failedCount = 0;
      let hasMore = true;

      while (hasMore) {
        const customers = await this.listAllCustomers(limit, offset);
        
        if (customers.length === 0) {
          hasMore = false;
          break;
        }

        for (const customer of customers) {
          try {
            await this.disableCustomerNotifications(customer.id);
            successCount++;
            logger.debug(`[Asaas] ✅ Disabled notifications for customer ${customer.id} (${customer.name})`);
          } catch (error) {
            failedCount++;
            logger.error(`[Asaas] ❌ Failed to disable notifications for customer ${customer.id}:`, error);
          }
          totalProcessed++;
        }

        offset += limit;
        
        if (customers.length < limit) {
          hasMore = false;
        }
      }

      const result = {
        total: totalProcessed,
        success: successCount,
        failed: failedCount
      };

      logger.debug('[Asaas] ✅ Bulk notification disable completed:', result);
      return result;
    } catch (error: any) {
      logger.error('[Asaas] ❌ Error in bulk notification disable:', error);
      throw new Error('Erro ao desativar notificações em lote: ' + error.message);
    }
  }
}

// Singleton instance
let asaasServiceInstance: AsaasService | null = null;

export function getAsaasService(): AsaasService {
  if (!asaasServiceInstance) {
    const apiKey = process.env.ASAAS_TOKEN;
    
    if (!apiKey) {
      throw new Error('ASAAS_TOKEN não configurado nas variáveis de ambiente');
    }

    // Detectar ambiente
    const environment = (process.env.ASAAS_ENVIRONMENT as 'sandbox' | 'production') || 'production';

    asaasServiceInstance = new AsaasService({
      apiKey,
      environment,
    });
  }

  return asaasServiceInstance;
}

// Export helper functions
export function createCreditCardPayment(params: CreatePaymentParams): Promise<AsaasPaymentResponse> {
  return getAsaasService().createCreditCardPayment(params);
}

export function getPaymentStatus(paymentId: string): Promise<AsaasPaymentResponse> {
  return getAsaasService().getPaymentStatus(paymentId);
}

export function simulatePayment(valueInCents: number, installmentCount: number = 1): Promise<AsaasSimulationResponse> {
  return getAsaasService().simulatePayment(valueInCents, installmentCount);
}

export function calculateTotalWithFees(valueInCents: number, installmentCount: number = 1): Promise<number> {
  return getAsaasService().calculateTotalWithFees(valueInCents, installmentCount);
}

export function calculateInstallmentSurcharge(
  productValueCents: number,
  installmentCount: number = 1
): Promise<{
  productValueCents: number;
  baselineTotalCents: number;
  installmentTotalCents: number;
  surchargeCents: number;
  installmentValueCents: number;
  installmentCount: number;
}> {
  return getAsaasService().calculateInstallmentSurcharge(productValueCents, installmentCount);
}

export function refundPayment(paymentId: string, value?: number, description?: string): Promise<any> {
  return getAsaasService().refundPayment(paymentId, value, description);
}

export function createPixTransfer(params: CreatePixTransferParams): Promise<AsaasTransferResponse> {
  return getAsaasService().createPixTransfer(params);
}

export function createRecurringSubscription(params: CreateRecurringSubscriptionParams): Promise<AsaasSubscriptionResponse> {
  return getAsaasService().createRecurringSubscription(params);
}

export function getSubscription(subscriptionId: string): Promise<AsaasSubscriptionResponse> {
  return getAsaasService().getSubscription(subscriptionId);
}

export function updateSubscription(subscriptionId: string, data: UpdateSubscriptionParams): Promise<AsaasSubscriptionResponse> {
  return getAsaasService().updateSubscription(subscriptionId, data);
}

export function deleteSubscription(subscriptionId: string): Promise<DeleteSubscriptionResponse> {
  return getAsaasService().deleteSubscription(subscriptionId);
}

export function updateSubscriptionCard(params: UpdateSubscriptionCardParams): Promise<AsaasSubscriptionResponse> {
  return getAsaasService().updateSubscriptionCard(params);
}

export function listSubscriptionPayments(
  subscriptionId: string,
  options?: { offset?: number; limit?: number; status?: string }
): Promise<AsaasSubscriptionPaymentsListResponse> {
  return getAsaasService().listSubscriptionPayments(subscriptionId, options);
}

export function getAsaasServiceSafe(): AsaasService | null {
  try {
    return getAsaasService();
  } catch {
    return null;
  }
}

export default AsaasService;
