import axios from 'axios';
import { logger } from './utils/logger';

const COMTELE_API_KEY = process.env.COMTELE_API_KEY;
const COMTELE_API_URL = process.env.COMTELE_API_URL || 'https://sms.comtele.com.br/api/v2';

interface SendSMSResponse {
  Success: boolean;
  Object?: {
    requestUniqueId: string;
  };
  Message: string;
}

/**
 * Generate a 6-digit OTP code
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send SMS via Comtele API
 * @param phone - Phone number in local format (e.g., "11999999999")
 * @param message - SMS message content
 */
export async function sendSMS(phone: string, message: string): Promise<SendSMSResponse> {
  if (!COMTELE_API_KEY) {
    throw new Error('COMTELE_API_KEY não configurada');
  }

  // Remove non-numeric characters from phone (DDD + número)
  const cleanPhone = phone.replace(/\D/g, '');

  logger.debug(`📱 Tentando enviar SMS para ${cleanPhone}`);
  logger.debug(`🔑 API Key configurada: ${COMTELE_API_KEY ? 'Sim (primeiros 8 chars: ' + COMTELE_API_KEY.substring(0, 8) + '...)' : 'Não'}`);
  logger.debug(`🌐 URL da API: ${COMTELE_API_URL}`);

  try {
    const response = await axios.post<SendSMSResponse>(
      `${COMTELE_API_URL}/send`,
      {
        Sender: 'PLR_Platform', // Internal identifier
        Receivers: cleanPhone, // DDD + número (ex: 11999999999)
        Content: message,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'auth-key': COMTELE_API_KEY,
        },
        timeout: 15000, // 15 seconds timeout
      }
    );

    if (!response.data.Success) {
      throw new Error(response.data.Message || 'Falha ao enviar SMS');
    }

    logger.info(`✅ SMS enviado para ${cleanPhone}:`, response.data.Message);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.Message || error.message;
      logger.error(`❌ Erro ao enviar SMS para ${cleanPhone}:`, errorMessage);
      throw new Error(`Falha ao enviar SMS: ${errorMessage}`);
    }
    throw error;
  }
}

/**
 * Send verification code via SMS
 * @param phone - Phone number
 * @param code - 6-digit verification code
 */
export async function sendVerificationCode(phone: string, code: string): Promise<void> {
  const message = `Lowfy - Seu código de verificação é: ${code}\n\nNão compartilhe este código com ninguém.\nVálido por 10 minutos.`;
  
  await sendSMS(phone, message);
}

/**
 * Send account activation SMS
 * @param phone - Phone number
 * @param name - User name
 */
export async function sendActivationSMS(phone: string, name: string): Promise<void> {
  const { getAppUrl } = await import('@shared/domainConfig');
  const message = `Olá ${name}! 🎉\n\nSua conta Lowfy foi ativada com sucesso!\n\nBem-vindo à plataforma. Acesse ${getAppUrl()} para começar.`;
  
  await sendSMS(phone, message);
}

/**
 * Validate Brazilian phone number format
 * @param phone - Phone number to validate
 */
export function validateBrazilianPhone(phone: string): boolean {
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Should have 10 or 11 digits (DDD + number)
  // DDD: 2 digits
  // Mobile: 9 + 8 digits = 11 total
  // Landline: 8 digits = 10 total
  return /^\d{10,11}$/.test(cleanPhone);
}
