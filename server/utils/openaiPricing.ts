export const OPENAI_PRICING: Record<string, { input?: number; output?: number; perImage?: number }> = {
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-32k': { input: 0.06, output: 0.12 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 },
  'gpt-3.5-turbo-0125': { input: 0.0005, output: 0.0015 },
  'gpt-3.5-turbo-instruct': { input: 0.0015, output: 0.002 },
  'dall-e-3-standard': { perImage: 0.04 },
  'dall-e-3-hd': { perImage: 0.08 },
  'dall-e-3-standard-hd': { perImage: 0.08 },
  'dall-e-2-1024x1024': { perImage: 0.02 },
  'dall-e-2-512x512': { perImage: 0.018 },
  'dall-e-2-256x256': { perImage: 0.016 },
  'text-embedding-3-small': { input: 0.00002, output: 0 },
  'text-embedding-3-large': { input: 0.00013, output: 0 },
  'text-embedding-ada-002': { input: 0.0001, output: 0 },
  'whisper-1': { input: 0.006, output: 0 },
  'tts-1': { input: 0.015, output: 0 },
  'tts-1-hd': { input: 0.03, output: 0 },
};

const EXCHANGE_RATE_USD_BRL = 5.0; // Taxa fixa para simplificar
const DEFAULT_EXCHANGE_RATE = EXCHANGE_RATE_USD_BRL;

export function calculateTokenCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = OPENAI_PRICING[model] || OPENAI_PRICING['gpt-4o-mini'];
  
  if (!pricing.input && !pricing.output) {
    return 0;
  }
  
  const inputCost = ((promptTokens || 0) / 1000) * (pricing.input || 0);
  const outputCost = ((completionTokens || 0) / 1000) * (pricing.output || 0);
  
  return inputCost + outputCost;
}

export function calculateImageCost(model: string, imageCount: number = 1): number {
  const pricing = OPENAI_PRICING[model];
  
  if (!pricing?.perImage) {
    return OPENAI_PRICING['dall-e-3-standard'].perImage! * imageCount;
  }
  
  return pricing.perImage * imageCount;
}

export function convertUsdToBrl(usdAmount: number, exchangeRate?: number): number {
  return usdAmount * (exchangeRate || DEFAULT_EXCHANGE_RATE);
}

export function getDefaultExchangeRate(): number {
  return DEFAULT_EXCHANGE_RATE;
}

export function getModelPricing(model: string): { input?: number; output?: number; perImage?: number } | null {
  return OPENAI_PRICING[model] || null;
}
