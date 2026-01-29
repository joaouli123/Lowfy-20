export const SYSTEM_FIXED_FEE_CENTS = 249;

export const SYSTEM_PERCENT_FEE_PIX = 2.99;
export const SYSTEM_PERCENT_FEE_CARD = 6.99;

export const SYSTEM_PERCENT_FEE = SYSTEM_PERCENT_FEE_CARD;

export const WITHDRAWAL_FEE_CENTS = 249;
export const MINIMUM_WITHDRAWAL_CENTS = 1000;

export type PaymentMethod = 'pix' | 'credit_card' | 'boleto';

interface CalculateSystemFeesOptions {
  includeWithdrawalFee?: boolean;
  paymentMethod?: PaymentMethod;
}

interface SystemFeesResult {
  grossCents: number;
  systemFixedFeeCents: number;
  systemPercentFeeCents: number;
  systemFeeCents: number;
  netCents: number;
  withdrawalFeeCents?: number;
  paymentMethod?: PaymentMethod;
}

export function getPercentFeeByPaymentMethod(paymentMethod?: PaymentMethod): number {
  switch (paymentMethod) {
    case 'pix':
      return SYSTEM_PERCENT_FEE_PIX;
    case 'credit_card':
    case 'boleto':
      return SYSTEM_PERCENT_FEE_CARD;
    default:
      return SYSTEM_PERCENT_FEE_CARD;
  }
}

export function calculateSystemFees(
  grossCents: number,
  options?: CalculateSystemFeesOptions
): SystemFeesResult {
  const paymentMethod = options?.paymentMethod;
  const percentFee = getPercentFeeByPaymentMethod(paymentMethod);
  
  const systemFixedFeeCents = SYSTEM_FIXED_FEE_CENTS;
  const systemPercentFeeCents = Math.round(grossCents * (percentFee / 100));
  const systemFeeCents = systemFixedFeeCents + systemPercentFeeCents;
  
  const withdrawalFee = options?.includeWithdrawalFee ? WITHDRAWAL_FEE_CENTS : 0;
  const netCents = Math.max(0, grossCents - systemFeeCents - withdrawalFee);
  
  const result: SystemFeesResult = {
    grossCents,
    systemFixedFeeCents,
    systemPercentFeeCents,
    systemFeeCents,
    netCents,
  };
  
  if (options?.includeWithdrawalFee) {
    result.withdrawalFeeCents = WITHDRAWAL_FEE_CENTS;
  }
  
  return result;
}

export const INSTALLMENT_FEE_PERCENT = 1.99;
export const MAX_INSTALLMENTS = 10;

export interface SimpleInstallmentCalculation {
  productValueCents: number;
  baselineTotalCents: number;
  installmentTotalCents: number;
  surchargeCents: number;
  installmentValueCents: number;
  installmentCount: number;
}

export function calculateSimpleInstallments(
  productValueCents: number,
  installmentCount: number = 1
): SimpleInstallmentCalculation {
  if (installmentCount < 1) installmentCount = 1;
  if (installmentCount > MAX_INSTALLMENTS) installmentCount = MAX_INSTALLMENTS;

  const baselineTotalCents = productValueCents;

  if (installmentCount === 1) {
    return {
      productValueCents,
      baselineTotalCents,
      installmentTotalCents: baselineTotalCents,
      surchargeCents: 0,
      installmentValueCents: baselineTotalCents,
      installmentCount: 1,
    };
  }

  const additionalInstallments = installmentCount - 1;
  const feePercent = additionalInstallments * INSTALLMENT_FEE_PERCENT;
  const surchargeAmount = Math.round(productValueCents * (feePercent / 100));
  const installmentTotal = productValueCents + surchargeAmount;
  const installmentValue = Math.ceil(installmentTotal / installmentCount);

  return {
    productValueCents,
    baselineTotalCents,
    installmentTotalCents: installmentTotal,
    surchargeCents: surchargeAmount,
    installmentValueCents: installmentValue,
    installmentCount,
  };
}

export interface FinancialIntegrityValidation {
  isValid: boolean;
  errors: string[];
}

export function validateFinancialIntegrity(data: {
  originalPriceCents: number;
  discountCents: number;
  grossAmountCents: number;
  systemFeeCents?: number;
  netAmountCents?: number;
}): FinancialIntegrityValidation {
  const errors: string[] = [];

  const expectedGross = data.originalPriceCents - data.discountCents;
  if (data.grossAmountCents !== expectedGross) {
    errors.push(
      `Valor final inválido: esperado ${expectedGross} (${data.originalPriceCents} - ${data.discountCents}), recebido ${data.grossAmountCents}`
    );
  }

  if (data.systemFeeCents !== undefined && data.netAmountCents !== undefined) {
    const expectedNet = data.grossAmountCents - data.systemFeeCents;
    if (data.netAmountCents !== expectedNet) {
      errors.push(
        `Valor líquido inválido: esperado ${expectedNet} (${data.grossAmountCents} - ${data.systemFeeCents}), recebido ${data.netAmountCents}`
      );
    }
  }

  if (data.originalPriceCents < 0) {
    errors.push('Preço original não pode ser negativo');
  }

  if (data.discountCents < 0) {
    errors.push('Desconto não pode ser negativo');
  }

  if (data.discountCents > data.originalPriceCents) {
    errors.push('Desconto não pode ser maior que o preço original');
  }

  if (data.systemFeeCents !== undefined && data.systemFeeCents < 0) {
    errors.push('Taxa do sistema não pode ser negativa');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
