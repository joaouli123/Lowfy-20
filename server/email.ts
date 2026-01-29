import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './utils/logger';
import { getAppUrl, getAdminUrl, getLoginUrl, getDashboardUrl, getSupportUrl, getCheckoutUrl } from '@shared/domainConfig';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: parseInt(process.env.SMTP_PORT || '587') === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  rateDelta: 1000,
  rateLimit: 10,
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 60000,
});

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  retries?: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Verificar se SMTP está funcionando no startup
export async function verifySmtpConnection(): Promise<boolean> {
  try {
    logger.info('🔍 [SMTP] Verificando conexão com o servidor de email...');
    await transporter.verify();
    logger.info('✅ [SMTP] Conexão verificada com sucesso!');
    return true;
  } catch (error: any) {
    logger.error('❌ [SMTP] ERRO CRÍTICO: Falha na conexão SMTP!', {
      error: error.message,
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER ? '✅ Configurado' : '❌ Não configurado',
      pass: process.env.SMTP_PASSWORD ? '✅ Configurado' : '❌ Não configurado',
    });
    return false;
  }
}

export async function sendEmail({ to, subject, html, retries = 0 }: SendEmailParams): Promise<{ success: boolean; messageId?: string }> {
  try {
    logger.info('📧 [EMAIL] Tentando enviar email para:', to);
    logger.debug('📧 [EMAIL] Assunto:', subject);
    logger.debug('📧 [EMAIL] SMTP Config:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER ? '✅ Configurado' : '❌ Não configurado',
      pass: process.env.SMTP_PASSWORD ? '✅ Configurado' : '❌ Não configurado',
    });
    
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'Plataforma'}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });

    logger.info('✅ [EMAIL] Email enviado com sucesso!', { 
      messageId: info.messageId, 
      to, 
      subject 
    });
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    const isRetryable = 
      error.code === 'ECONNECTION' || 
      error.code === 'ETIMEDOUT' || 
      error.code === 'ECONNRESET' ||
      error.code === 'ESOCKET' ||
      error.responseCode === 421 ||
      error.responseCode === 450 ||
      error.responseCode === 451;
    
    if (isRetryable && retries < MAX_RETRIES) {
      logger.warn(`⚠️ [EMAIL] Erro temporário ao enviar email (tentativa ${retries + 1}/${MAX_RETRIES}):`, {
        to,
        error: error.message,
        code: error.code,
      });
      
      await delay(RETRY_DELAY_MS * (retries + 1));
      return sendEmail({ to, subject, html, retries: retries + 1 });
    }
    
    logger.error('❌ [EMAIL] ERRO ao enviar email:', {
      to,
      subject,
      error: error.message,
      code: error.code,
      response: error.response,
      stack: error.stack,
      retries,
    });
    throw error;
  }
}

// Helper: CSS base para todos os emails
function getEmailBaseStyles(): string {
  return `
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background-color: #f5f5f5;
      }
      .container {
        max-width: 600px;
        margin: 40px auto;
        background-color: #ffffff;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }
      .header {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        padding: 40px 20px;
        text-align: center;
      }
      .logo-text {
        color: #ffffff;
        margin: 0;
        font-size: 48px;
        font-weight: 600;
        font-family: 'Poppins', sans-serif;
        letter-spacing: -1px;
      }
      .content {
        padding: 40px 30px;
      }
      .greeting {
        font-size: 16px;
        color: #374151;
        margin-bottom: 20px;
      }
      .message {
        font-size: 15px;
        color: #4b5563;
        line-height: 1.6;
        margin-bottom: 20px;
      }
      .info-box {
        background-color: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 20px;
        margin: 25px 0;
      }
      .info-box p {
        margin: 8px 0;
        font-size: 15px;
        color: #4b5563;
      }
      .info-label {
        font-weight: 600;
        color: #1f2937;
      }
      .button-container {
        text-align: center;
        margin: 30px 0;
      }
      .button {
        display: inline-block;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: #ffffff !important;
        text-decoration: none;
        padding: 14px 32px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 16px;
      }
      .highlight-box {
        background-color: #ecfdf5;
        border: 2px solid #10b981;
        border-radius: 8px;
        padding: 20px;
        text-align: center;
        margin: 25px 0;
      }
      .highlight-value {
        font-size: 24px;
        font-weight: 700;
        color: #047857;
      }
      .footer {
        background-color: #f9fafb;
        padding: 20px 30px;
        text-align: center;
        border-top: 1px solid #e5e7eb;
      }
      .social-icons {
        margin-bottom: 15px;
        text-align: center;
      }
      .social-icons a {
        display: inline-block;
        margin: 0 10px;
        text-decoration: none;
      }
      .social-icons img {
        width: 32px;
        height: 32px;
        display: block;
        border: 0;
      }
      .footer p {
        color: #6b7280;
        font-size: 13px;
        margin: 5px 0;
      }
    </style>
  `;
}

// Helper: Rodapé com redes sociais
function getEmailFooter(): string {
  return `
    <div class="footer">
      <div class="social-icons">
        <a href="https://www.facebook.com/people/Lowfy/61551759668769/" target="_blank" title="Facebook" style="text-decoration: none; display: inline-block; margin: 0 10px;">
          <img src="https://img.icons8.com/color/48/facebook-new.png" alt="Facebook" width="32" height="32" style="display: block; border: 0;" />
        </a>
        <a href="https://www.instagram.com/lowfybr/" target="_blank" title="Instagram" style="text-decoration: none; display: inline-block; margin: 0 10px;">
          <img src="https://img.icons8.com/fluency/48/instagram-new.png" alt="Instagram" width="32" height="32" style="display: block; border: 0;" />
        </a>
        <a href="https://www.youtube.com/@lowfy_plrs" target="_blank" title="YouTube" style="text-decoration: none; display: inline-block; margin: 0 10px;">
          <img src="https://img.icons8.com/color/48/youtube-play.png" alt="YouTube" width="32" height="32" style="display: block; border: 0;" />
        </a>
      </div>
      <p>Este é um email automático. Por favor, não responda.</p>
      <p>© ${new Date().getFullYear()} Lowfy - Todos os direitos reservados</p>
    </div>
  `;
}

export function generateWelcomeEmailTemplate(name: string, email: string): string {
  const loginUrl = getLoginUrl();

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Olá, <strong>${name}</strong>!</p>
          
          <p class="message">
            🎉 Seja bem-vindo à Lowfy! Sua conta foi criada e ativada com sucesso.
          </p>

          <p class="message">
            Agora você tem acesso completo à nossa plataforma com todos os recursos disponíveis. Comece a explorar agora mesmo!
          </p>

          <div class="button-container">
            <a href="${loginUrl}" class="button">Acessar sua Conta</a>
          </div>

          <div class="info-box">
            <p><span class="info-label">Email de acesso:</span> ${email}</p>
          </div>

          <p class="message">
            Se você tiver qualquer dúvida ou precisar de ajuda, nossa equipe de suporte está sempre à disposição.
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

export function generatePasswordResetTemplate(name: string, resetToken: string) {
  const resetUrl = getAppUrl(`/reset-password?token=${resetToken}`);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Olá, <strong>${name}</strong>!</p>
          
          <p class="message">
            🔒 Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha:
          </p>

          <div class="button-container">
            <a href="${resetUrl}" class="button">Redefinir Senha</a>
          </div>

          <p class="message">
            Se você não solicitou esta alteração, ignore este email. Sua senha permanecerá inalterada.
          </p>

          <p class="message" style="font-size: 13px; color: #6b7280;">
            ⚠️ Este link expira em 1 hora por segurança.
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

export function generate2FAEmailTemplateWithCID(name: string, code: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          padding: 40px 20px;
          text-align: center;
        }
        .logo-text {
          color: #ffffff;
          margin: 0;
          font-size: 48px;
          font-weight: 700;
          font-family: 'Poppins', sans-serif;
          letter-spacing: -1px;
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 16px;
          color: #374151;
          margin-bottom: 20px;
        }
        .message {
          font-size: 15px;
          color: #4b5563;
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .code-box {
          background-color: #f9fafb;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          padding: 25px;
          text-align: center;
          margin: 30px 0;
        }
        .code {
          font-size: 36px;
          font-weight: 700;
          letter-spacing: 8px;
          color: #047857;
          font-family: 'Courier New', monospace;
        }
        .code-label {
          font-size: 13px;
          color: #6b7280;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .warning {
          background-color: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .warning p {
          margin: 0;
          font-size: 14px;
          color: #92400e;
        }
        .footer {
          background-color: #f9fafb;
          padding: 20px 30px;
          text-align: center;
          border-top: 1px solid #e5e7eb;
        }
        .social-icons {
          margin-bottom: 15px;
          text-align: center;
        }
        .social-icons a {
          display: inline-block;
          margin: 0 10px;
          text-decoration: none;
        }
        .social-icons img {
          width: 32px;
          height: 32px;
          display: block;
          border: 0;
        }
        .footer p {
          color: #6b7280;
          font-size: 13px;
          margin: 5px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Olá, <strong>${name}</strong>!</p>

          <p class="message">
            Você está tentando acessar sua conta. Por segurança, utilize o código de verificação abaixo para concluir seu login:
          </p>

          <div class="code-box">
            <div class="code-label">Código de Verificação</div>
            <div class="code">${code}</div>
          </div>

          <p class="message">
            Este código é válido por <strong>10 minutos</strong> e pode ser usado apenas uma vez.
          </p>

          <div class="warning">
            <p>
              <strong>Importante:</strong> Se você não solicitou este código, ignore este email. Sua conta permanece segura.
            </p>
          </div>
        </div>

        <div class="footer">
          <div class="social-icons">
            <a href="https://www.facebook.com/people/Lowfy/61551759668769/" target="_blank" title="Facebook" style="text-decoration: none; display: inline-block; margin: 0 10px;">
              <img src="https://img.icons8.com/color/48/facebook-new.png" alt="Facebook" width="32" height="32" style="display: block; border: 0;" />
            </a>
            <a href="https://www.instagram.com/lowfybr/" target="_blank" title="Instagram" style="text-decoration: none; display: inline-block; margin: 0 10px;">
              <img src="https://img.icons8.com/fluency/48/instagram-new.png" alt="Instagram" width="32" height="32" style="display: block; border: 0;" />
            </a>
            <a href="https://www.youtube.com/@lowfy_plrs" target="_blank" title="YouTube" style="text-decoration: none; display: inline-block; margin: 0 10px;">
              <img src="https://img.icons8.com/color/48/youtube-play.png" alt="YouTube" width="32" height="32" style="display: block; border: 0;" />
            </a>
          </div>
          <p>Este é um email automático. Por favor, não responda.</p>
          <p>© ${new Date().getFullYear()} Lowfy - Todos os direitos reservados</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function send2FACode(email: string, name: string, code: string) {
  const html = generate2FAEmailTemplateWithCID(name, code);
  try {
    const result = await sendEmail({
      to: email,
      subject: 'Código de Verificação - Login',
      html,
    });
    if (!result.success) {
      logger.error('❌ [2FA EMAIL] Falha ao enviar código 2FA para:', { email, reason: 'sendEmail retornou success: false' });
    }
    return result;
  } catch (error: any) {
    logger.error('❌ [2FA EMAIL] ERRO CRÍTICO ao enviar código 2FA:', {
      email,
      errorMessage: error.message,
      errorCode: error.code,
      errorResponse: error.response,
      stack: error.stack,
    });
    throw error;
  }
}

export function generateSaleConfirmedEmail(
  vendorName: string,
  buyerName: string,
  productName: string,
  saleValue: number,
  orderNumber: string,
  saleDate?: Date,
  paymentMethod?: string
): string {
  const formattedValue = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(saleValue);

  const formattedDate = saleDate 
    ? new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(saleDate)
    : '';

  const paymentMethodLabel = paymentMethod === 'pix' ? 'PIX' : 'Cartão de Crédito';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Olá, <strong>${vendorName}</strong>!</p>
          
          <p class="message">
            🎉 Parabéns! Você acabou de realizar uma venda no marketplace Lowfy!
          </p>

          <div class="highlight-box">
            <p class="message" style="margin: 0 0 10px 0; font-size: 14px; color: #047857;">Valor da Venda</p>
            <p class="highlight-value">${formattedValue}</p>
          </div>

          <div class="info-box">
            <p><span class="info-label">Produto:</span> ${productName}</p>
            <p><span class="info-label">Comprador:</span> ${buyerName}</p>
            ${paymentMethod ? `<p><span class="info-label">Forma de Pagamento:</span> ${paymentMethodLabel}</p>` : ''}
            <p><span class="info-label">Número do Pedido:</span> ${orderNumber}</p>
            ${saleDate ? `<p><span class="info-label">Data da Venda:</span> ${formattedDate}</p>` : ''}
          </div>

          <p class="message">
            O valor já foi creditado em sua conta e estará disponível para saque conforme as políticas da plataforma.
          </p>

          <p class="message">
            Continue criando produtos incríveis! 🚀
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

export function generatePurchaseConfirmedEmail(
  buyerName: string,
  productName: string,
  orderValue: number,
  orderNumber: string,
  downloadLink?: string,
  purchaseDate?: Date,
  paymentMethod?: string
): string {
  const formattedValue = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(orderValue);

  const formattedDate = purchaseDate 
    ? new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(purchaseDate)
    : '';

  const paymentMethodLabel = paymentMethod === 'pix' ? 'PIX' : 'Cartão de Crédito';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Olá, <strong>${buyerName}</strong>!</p>
          
          <p class="message">
            ✅ Sua compra foi confirmada e o pagamento foi aprovado com sucesso!
          </p>

          <div class="info-box">
            <p><span class="info-label">Produto:</span> ${productName}</p>
            <p><span class="info-label">Valor:</span> ${formattedValue}</p>
            ${paymentMethod ? `<p><span class="info-label">Forma de Pagamento:</span> ${paymentMethodLabel}</p>` : ''}
            <p><span class="info-label">Número do Pedido:</span> ${orderNumber}</p>
            ${purchaseDate ? `<p><span class="info-label">Data da Compra:</span> ${formattedDate}</p>` : ''}
          </div>

          ${downloadLink ? `
            <p class="message">
              Seu produto está pronto para download! Clique no botão abaixo para acessar:
            </p>

            <div class="button-container">
              <a href="${downloadLink}" class="button">Baixar Produto</a>
            </div>
          ` : `
            <p class="message">
              Você já tem acesso ao produto adquirido. Acesse sua conta para visualizar.
            </p>
          `}

          <p class="message">
            Obrigado por comprar na Lowfy! 💚
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

export function generateRefundRequestedVendorEmail(
  vendorName: string,
  buyerName: string,
  productName: string,
  orderNumber: string,
  refundValue: number,
  paymentMethod?: string,
  refundRequestedAt?: Date,
  refundReason?: string
): string {
  const formattedValue = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(refundValue);

  const paymentMethodLabel = paymentMethod === 'pix' ? 'PIX' : 'Cartão de Crédito';

  const formattedRequestDate = refundRequestedAt 
    ? new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(refundRequestedAt)
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Olá, <strong>${vendorName}</strong>,</p>
          
          <p class="message">
            ℹ️ Um reembolso foi solicitado para um de seus produtos.
          </p>

          <div class="info-box">
            <p><span class="info-label">Produto:</span> ${productName}</p>
            <p><span class="info-label">Comprador:</span> ${buyerName}</p>
            ${paymentMethod ? `<p><span class="info-label">Forma de Pagamento:</span> ${paymentMethodLabel}</p>` : ''}
            <p><span class="info-label">Número do Pedido:</span> ${orderNumber}</p>
            <p><span class="info-label">Valor do Reembolso:</span> ${formattedValue}</p>
            ${refundRequestedAt ? `<p><span class="info-label">Data da Solicitação:</span> ${formattedRequestDate}</p>` : ''}
          </div>

          ${refundReason ? `
            <div class="info-box" style="background-color: #fffbeb; border-color: #fef3c7;">
              <p style="margin-bottom: 8px;"><span class="info-label">Motivo da Solicitação:</span></p>
              <p style="margin: 0; color: #78350f; white-space: pre-wrap;">${refundReason}</p>
            </div>
          ` : ''}

          <p class="message">
            O reembolso está sendo processado e o valor será debitado de sua conta conforme as políticas da plataforma.
          </p>

          <p class="message">
            Se você tiver alguma dúvida, entre em contato com nosso suporte.
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

export function generateRefundRequestedBuyerEmail(
  buyerName: string,
  productName: string,
  orderNumber: string,
  refundValue: number,
  paymentMethod?: string,
  refundRequestedAt?: Date,
  refundReason?: string
): string {
  const formattedValue = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(refundValue);

  const paymentMethodLabel = paymentMethod === 'pix' ? 'PIX' : 'Cartão de Crédito';

  const formattedRequestDate = refundRequestedAt 
    ? new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(refundRequestedAt)
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Olá, <strong>${buyerName}</strong>,</p>
          
          <p class="message">
            ✅ Sua solicitação de reembolso foi recebida e está sendo processada.
          </p>

          <div class="info-box">
            <p><span class="info-label">Produto:</span> ${productName}</p>
            ${paymentMethod ? `<p><span class="info-label">Forma de Pagamento:</span> ${paymentMethodLabel}</p>` : ''}
            <p><span class="info-label">Número do Pedido:</span> ${orderNumber}</p>
            <p><span class="info-label">Valor do Reembolso:</span> ${formattedValue}</p>
            ${refundRequestedAt ? `<p><span class="info-label">Data da Solicitação:</span> ${formattedRequestDate}</p>` : ''}
          </div>

          ${refundReason ? `
            <div class="info-box" style="background-color: #fffbeb; border-color: #fef3c7;">
              <p style="margin-bottom: 8px;"><span class="info-label">Motivo da Solicitação:</span></p>
              <p style="margin: 0; color: #78350f; white-space: pre-wrap;">${refundReason}</p>
            </div>
          ` : ''}

          <p class="message">
            O reembolso será processado em até 7 dias úteis e o valor será devolvido para sua forma de pagamento original.
          </p>

          <p class="message">
            Acompanhe o status do seu reembolso através da sua conta na plataforma.
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

export function generateRefundAdminEmail(
  orderNumber: string,
  productTitle: string,
  buyerName: string,
  buyerEmail: string,
  sellerName: string,
  sellerEmail: string,
  refundValue: number,
  isAutoProcessed: boolean,
  refundReason?: string,
  paymentMethod?: string,
  refundRequestedAt?: Date
): string {
  const formattedValue = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(refundValue);

  const paymentMethodLabel = paymentMethod === 'pix' ? 'PIX' : 'Cartão de Crédito';

  const formattedRequestDate = refundRequestedAt 
    ? new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(refundRequestedAt)
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Olá, <strong>Admin</strong>!</p>
          
          <p class="message">
            🔔 ${isAutoProcessed ? 'Um reembolso foi processado automaticamente.' : 'Uma nova solicitação de reembolso foi registrada.'}
          </p>

          <div class="info-box">
            <p><span class="info-label">Número do Pedido:</span> ${orderNumber}</p>
            <p><span class="info-label">Produto:</span> ${productTitle}</p>
            <p><span class="info-label">Comprador:</span> ${buyerName} (${buyerEmail})</p>
            <p><span class="info-label">Vendedor:</span> ${sellerName} (${sellerEmail})</p>
            <p><span class="info-label">Valor do Reembolso:</span> ${formattedValue}</p>
            ${paymentMethod ? `<p><span class="info-label">Forma de Pagamento:</span> ${paymentMethodLabel}</p>` : ''}
            ${refundRequestedAt ? `<p><span class="info-label">Data da Solicitação:</span> ${formattedRequestDate}</p>` : ''}
            <p><span class="info-label">Status:</span> ${isAutoProcessed ? '✅ Processado automaticamente' : '⏳ Aguardando processamento manual'}</p>
          </div>

          ${refundReason ? `
            <div class="info-box" style="background-color: #fffbeb; border-color: #fef3c7;">
              <p style="margin-bottom: 8px;"><span class="info-label">Motivo da Solicitação:</span></p>
              <p style="margin: 0; color: #78350f; white-space: pre-wrap;">${refundReason}</p>
            </div>
          ` : ''}

          ${!isAutoProcessed ? `
            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0; color: #856404; font-size: 15px;">
                ⚠️ <strong>Ação Necessária:</strong> Este reembolso requer processamento manual. Acesse o painel administrativo para aprovar.
              </p>
            </div>
          ` : `
            <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0; color: #155724; font-size: 15px;">
                ✅ <strong>Nenhuma ação necessária.</strong> O reembolso foi processado automaticamente pelo gateway de pagamento.
              </p>
            </div>
          `}

          <p class="message">
            Este é um email automático da plataforma Lowfy Marketplace.
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

export function generateReferralSuccessEmail(
  referrerName: string,
  referredName: string,
  bonusValue: number
): string {
  const formattedValue = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(bonusValue);

  // Calculate release date (8 days from now)
  const releaseDate = new Date();
  releaseDate.setDate(releaseDate.getDate() + 8);
  const formattedReleaseDate = new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(releaseDate);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Olá, <strong>${referrerName}</strong>!</p>
          
          <p class="message">
            🎉 Excelente notícia! Alguém se cadastrou usando seu link de indicação!
          </p>

          <div class="highlight-box">
            <p class="message" style="margin: 0 0 10px 0; font-size: 14px; color: #047857;">💰 Comissão de Indicação</p>
            <p class="highlight-value">${formattedValue}</p>
          </div>

          <div class="info-box">
            <p><span class="info-label">Indicado:</span> ${referredName}</p>
            <p><span class="info-label">Comissão (50%):</span> ${formattedValue}</p>
            <p><span class="info-label">Liberado para saque em:</span> <strong>${formattedReleaseDate}</strong></p>
          </div>

          <div style="background-color: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; color: #1565c0; font-size: 14px;">
              ℹ️ <strong>Período de Segurança:</strong> O saldo fica retido por 8 dias antes de estar disponível para saque. Isso protege contra possíveis fraudes.
            </p>
          </div>

          <p class="message">
            Assim que o período de segurança terminar, você poderá sacar via PIX quando quiser, sem taxas adicionais da Lowfy!
          </p>

          <p class="message">
            Continue compartilhando seu link de indicação e ganhe mais bônus! 🚀
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

export function generateWithdrawalRequestedEmail(
  userName: string,
  grossAmount: number,
  feeCents: number,
  netAmount: number,
  accountInfo: string
): string {
  const formattedGross = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(grossAmount);

  const formattedFee = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(feeCents / 100);

  const formattedNet = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(netAmount);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Olá, <strong>${userName}</strong>!</p>
          
          <p class="message">
            💰 Sua solicitação de saque foi recebida e está sendo processada!
          </p>

          <div class="highlight-box">
            <p class="message" style="margin: 0 0 10px 0; font-size: 14px; color: #047857;">Valor Líquido a Receber</p>
            <p class="highlight-value">${formattedNet}</p>
          </div>

          <div class="info-box">
            <p><span class="info-label">Valor Solicitado:</span> ${formattedGross}</p>
            <p><span class="info-label">Taxa de Processamento:</span> - ${formattedFee}</p>
            <p style="border-top: 1px solid #e5e7eb; margin-top: 10px; padding-top: 10px; font-weight: bold;">
              <span class="info-label">Valor a Receber:</span> ${formattedNet}
            </p>
          </div>

          <div class="info-box">
            <p><span class="info-label">Conta de Destino:</span> ${accountInfo}</p>
            <p><span class="info-label">Status:</span> Em processamento</p>
          </div>

          <p class="message">
            O valor será transferido para sua conta PIX em até 2 dias úteis. Você receberá uma confirmação quando o pagamento for concluído.
          </p>

          <p class="message">
            Obrigado por fazer parte da Lowfy! 💚
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

export function generateWithdrawalProcessedEmail(
  userName: string,
  withdrawalValue: number,
  accountInfo: string
): string {
  const formattedValue = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(withdrawalValue);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Olá, <strong>${userName}</strong>!</p>
          
          <p class="message">
            ✅ Seu saque foi processado com sucesso!
          </p>

          <div class="highlight-box">
            <p class="message" style="margin: 0 0 10px 0; font-size: 14px; color: #047857;">Valor do Saque</p>
            <p class="highlight-value">${formattedValue}</p>
          </div>

          <div class="info-box">
            <p><span class="info-label">Conta de Destino:</span> ${accountInfo}</p>
            <p><span class="info-label">Valor:</span> ${formattedValue}</p>
          </div>

          <p class="message">
            O valor foi transferido para sua conta PIX. Obrigado por fazer parte da Lowfy!
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

export function generateMarketplaceReferralEmail(
  referrerName: string,
  productName: string,
  commissionValue: number
): string {
  const formattedValue = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(commissionValue);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Olá, <strong>${referrerName}</strong>!</p>
          
          <p class="message">
            🎉 Você ganhou uma comissão por indicação do marketplace!
          </p>

          <div class="highlight-box">
            <p class="message" style="margin: 0 0 10px 0; font-size: 14px; color: #047857;">Comissão Recebida</p>
            <p class="highlight-value">${formattedValue}</p>
          </div>

          <div class="info-box">
            <p><span class="info-label">Produto Indicado:</span> ${productName}</p>
            <p><span class="info-label">Comissão:</span> ${formattedValue}</p>
          </div>

          <p class="message">
            O valor da comissão já foi creditado em sua conta e está disponível para saque.
          </p>

          <p class="message">
            Continue divulgando produtos do marketplace e ganhe mais comissões! 🚀
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

export function generateSyncReportTemplate(result: SyncResult, date: Date) {
  const dateStr = date.toLocaleString('pt-BR', { 
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'full', 
    timeStyle: 'short' 
  });

  const statusIcon = result.success ? '✅' : '❌';
  const statusText = result.success ? 'Sucesso' : 'Erro';
  const statusColor = result.success ? '#10b981' : '#ef4444';

  const hasNewContent = result.pluginsCount > 0 || result.coursesCount > 0 || result.templatesCount > 0;
  const totalFiles = result.pluginsCount + result.coursesCount + result.templatesCount;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background-color: #f0f9f4;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, ${statusColor} 0%, ${statusColor}dd 100%);
          padding: 40px 20px;
          text-align: center;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .status-icon {
          font-size: 48px;
          margin-bottom: 10px;
        }
        .content {
          padding: 40px 30px;
        }
        .info-box {
          background-color: #f9fafb;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .info-item {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .info-item:last-child {
          border-bottom: none;
        }
        .info-label {
          color: #6b7280;
          font-weight: 500;
        }
        .info-value {
          color: #1f2937;
          font-weight: 600;
        }
        .summary {
          background-color: ${result.success ? '#f0fdf4' : '#fef2f2'};
          border: 2px solid ${statusColor};
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
          text-align: center;
        }
        .summary h3 {
          color: ${statusColor};
          margin: 0 0 10px 0;
          font-size: 18px;
        }
        .summary p {
          color: #4b5563;
          margin: 5px 0;
          font-size: 14px;
        }
        .error-box {
          background-color: #fef2f2;
          border-left: 4px solid #ef4444;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .error-box p {
          color: #991b1b;
          margin: 0;
          font-size: 14px;
        }
        .footer {
          background-color: #f9fafb;
          padding: 30px;
          text-align: center;
          border-top: 1px solid #e5e7eb;
        }
        .footer p {
          color: #6b7280;
          font-size: 14px;
          margin: 5px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="status-icon">${statusIcon}</div>
          <h1>Relatório de Sincronização</h1>
        </div>

        <div class="content">
          <div class="info-box">
            <div class="info-item">
              <span class="info-label">📅 Data/Hora</span>
              <span class="info-value">${dateStr}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Status</span>
              <span class="info-value" style="color: ${statusColor};">${statusText}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Total de Arquivos</span>
              <span class="info-value">${totalFiles}</span>
            </div>
          </div>

          ${result.success ? `
            <div class="summary">
              <h3>${hasNewContent ? '🎉 Sincronização Realizada' : '📋 Nenhum Conteúdo Novo'}</h3>
              <p>
                ${hasNewContent 
                  ? 'O cache foi atualizado com sucesso!' 
                  : 'Não houve alterações desde a última sincronização.'}
              </p>
            </div>

            <div class="info-box">
              <div class="info-item">
                <span class="info-label">📦 Plugins</span>
                <span class="info-value">${result.pluginsCount} ${result.pluginsCount === 1 ? 'arquivo' : 'arquivos'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">📄 Templates</span>
                <span class="info-value">${result.templatesCount} ${result.templatesCount === 1 ? 'arquivo' : 'arquivos'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">📚 Cursos</span>
                <span class="info-value">${result.coursesCount} ${result.coursesCount === 1 ? 'arquivo' : 'arquivos'}</span>
              </div>
            </div>
          ` : `
            <div class="error-box">
              <p>
                <strong>❌ Erro durante a sincronização:</strong><br>
                ${result.error || 'Erro desconhecido. Verifique os logs do servidor.'}
              </p>
            </div>
          `}
        </div>

        <div class="footer">
          <p><strong>Sistema de Sincronização Automática</strong></p>
          <p>Este é um email automático, por favor não responda.</p>
          <p style="font-size: 12px; color: #9ca3af;">
            Sincronizações agendadas: Toda segunda-feira às 03:00
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ==================== SUBSCRIPTION EMAIL TEMPLATES ====================

/**
 * Email de assinatura confirmada (Boas-vindas + Dados de acesso)
 * Disparado imediatamente após a compra
 */
export function generateSubscriptionConfirmedEmail(
  name: string,
  email: string,
  paymentMethod: 'credit_card' | 'pix' | 'boleto',
  planType: 'mensal' | 'anual',
  amount: number,
  nextPaymentDate?: string,
  purchaseDate?: string | Date
): string {
  const loginUrl = getLoginUrl();
  
  const paymentMethodLabel = {
    credit_card: 'Cartão de Crédito',
    pix: 'PIX',
    boleto: 'Boleto Bancário'
  }[paymentMethod];

  const planLabel = planType === 'anual' ? 'Anual' : 'Mensal';
  const formattedAmount = amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  
  const formatSafeDate = (dateStr?: string | Date): string => {
    if (!dateStr) return 'N/A';
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  };
  
  const formatSafeDateTime = (dateStr?: string | Date): string => {
    if (!dateStr) {
      const now = new Date();
      return `${now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} às ${now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}`;
    }
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(date.getTime())) {
      const now = new Date();
      return `${now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} às ${now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}`;
    }
    return `${date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} às ${date.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}`;
  };
  
  const formattedNextDate = formatSafeDate(nextPaymentDate);
  const formattedPurchaseDate = formatSafeDateTime(purchaseDate);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Olá, <strong>${name}</strong>!</p>
          
          <p class="message">
            🎉 Sua assinatura foi confirmada com sucesso! Agora você tem acesso completo a todas as ferramentas, cursos e recursos da plataforma Lowfy.
          </p>

          <div class="button-container">
            <a href="${loginUrl}" class="button">Acessar sua Conta</a>
          </div>

          <div class="info-box">
            <p><span class="info-label">Email de acesso:</span> ${email}</p>
            <p><span class="info-label">Plano:</span> ${planLabel}</p>
            <p><span class="info-label">Forma de pagamento:</span> ${paymentMethodLabel}</p>
            <p><span class="info-label">Valor:</span> ${formattedAmount}</p>
            <p><span class="info-label">Data da compra:</span> ${formattedPurchaseDate}</p>
            <p><span class="info-label">Próxima cobrança:</span> ${formattedNextDate}</p>
          </div>

          <p class="message">
            ${paymentMethod === 'credit_card' 
              ? 'Sua assinatura será renovada automaticamente. Você receberá um email de confirmação a cada renovação.'
              : 'Como você pagou via ' + paymentMethodLabel + ', será necessário renovar manualmente. Enviaremos lembretes antes do vencimento.'}
          </p>

          <p class="message">
            Se você tiver qualquer dúvida ou precisar de ajuda, nossa equipe de suporte está sempre à disposição.
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

/**
 * Email de assinatura renovada
 * Disparado quando a cobrança recorrente ocorre com sucesso
 */
export function generateSubscriptionRenewedEmail(
  name: string,
  planType: 'mensal' | 'anual',
  amount: number,
  currentPeriod: number,
  nextPaymentDate?: string
): string {
  const loginUrl = getLoginUrl();
  
  const planLabel = planType === 'anual' ? 'Anual' : 'Mensal';
  const formattedAmount = amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formattedNextDate = nextPaymentDate ? new Date(nextPaymentDate).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'N/A';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Olá, <strong>${name}</strong>!</p>
          
          <p class="message">
            ✅ Sua assinatura foi renovada com sucesso! Obrigado por continuar conosco.
          </p>

          <div class="button-container">
            <a href="${loginUrl}" class="button">Acessar Plataforma</a>
          </div>

          <div class="info-box">
            <p><span class="info-label">Período atual:</span> ${currentPeriod}º mês</p>
            <p><span class="info-label">Plano:</span> ${planLabel}</p>
            <p><span class="info-label">Valor cobrado:</span> ${formattedAmount}</p>
            <p><span class="info-label">Próxima renovação:</span> ${formattedNextDate}</p>
          </div>

          <p class="message">
            Seu acesso a todas as ferramentas e cursos permanece ativo. Aproveite!
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

/**
 * Email de assinatura cancelada
 * Disparado quando o usuário cancela a assinatura
 */
export function generateSubscriptionCanceledEmail(
  name: string,
  accessUntilDate: string,
  reason?: string
): string {
  const checkoutUrl = getCheckoutUrl('/assinatura/checkout?plan=mensal');
  
  const formattedAccessDate = new Date(accessUntilDate).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Olá, <strong>${name}</strong>!</p>
          
          <p class="message">
            Recebemos a solicitação de cancelamento da sua assinatura.
          </p>

          <div class="info-box">
            <p><span class="info-label">Acesso até:</span> ${formattedAccessDate}</p>
            ${reason ? `<p><span class="info-label">Motivo:</span> ${reason}</p>` : ''}
          </div>

          <p class="message">
            Sentiremos sua falta! Se mudar de ideia, você pode reativar sua assinatura a qualquer momento clicando no botão abaixo.
          </p>

          <div class="button-container">
            <a href="${checkoutUrl}" class="button">Reativar Assinatura</a>
          </div>

          <p class="message" style="font-size: 13px; color: #6b7280;">
            ⚠️ Após a data de acesso, suas páginas criadas serão mantidas por mais 10 dias antes de serem excluídas.
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

/**
 * Email de aviso de expiração PIX (Régua de 4 dias)
 * Enviado nos dias -4, -3, -2, -1 antes do vencimento
 */
export function generatePixExpirationWarningEmail(
  name: string,
  daysRemaining: number,
  expirationDate: string,
  checkoutUrl: string
): string {
  const formattedDate = new Date(expirationDate).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const urgencyText = daysRemaining === 1 
    ? '⚠️ Último dia!' 
    : daysRemaining === 0 
      ? '🚨 Expira hoje!' 
      : `📅 Faltam ${daysRemaining} dias`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Olá, <strong>${name}</strong>!</p>
          
          <p class="message">
            ${urgencyText} para sua assinatura expirar!
          </p>

          <div class="info-box">
            <p><span class="info-label">Data de vencimento:</span> ${formattedDate}</p>
          </div>

          <p class="message">
            Como você pagou via PIX, é necessário renovar manualmente para continuar tendo acesso a todas as ferramentas, cursos e recursos da plataforma.
          </p>

          <div class="button-container">
            <a href="${checkoutUrl}" class="button">Renovar Agora</a>
          </div>

          <p class="message" style="font-size: 13px; color: #6b7280;">
            ${daysRemaining <= 1 
              ? '⚠️ Após o vencimento, seu acesso será suspenso imediatamente.' 
              : 'Renove antes do vencimento para não perder o acesso às suas ferramentas e páginas.'}
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

/**
 * Email de retenção/perda de dados
 * Enviado quando a assinatura expira e o usuário tem páginas criadas
 */
export function generateRetentionEmail(
  name: string,
  pagesCount: number,
  deletionDate: string,
  checkoutUrl: string
): string {
  const formattedDeletionDate = new Date(deletionDate).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Olá, <strong>${name}</strong>!</p>
          
          <p class="message">
            🚨 Sua assinatura expirou e você possui ${pagesCount} página${pagesCount > 1 ? 's' : ''} criada${pagesCount > 1 ? 's' : ''} na plataforma.
          </p>

          <div class="info-box">
            <p><span class="info-label">Páginas criadas:</span> ${pagesCount}</p>
            <p><span class="info-label">Data limite para renovação:</span> ${formattedDeletionDate}</p>
          </div>

          <p class="message">
            ⚠️ Se você não renovar sua assinatura até a data limite, suas páginas serão excluídas permanentemente.
          </p>

          <div class="button-container">
            <a href="${checkoutUrl}" class="button">Renovar e Salvar Minhas Páginas</a>
          </div>

          <p class="message" style="font-size: 13px; color: #6b7280;">
            Após a exclusão, não será possível recuperar suas páginas.
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

/**
 * Email de falha na renovação (cartão recusado)
 */
export function generateSubscriptionRenewalFailedEmail(
  name: string,
  retryDate?: string,
  checkoutUrl?: string
): string {
  const defaultCheckoutUrl = checkoutUrl || getCheckoutUrl('/assinatura/checkout?plan=mensal');
  const formattedRetryDate = retryDate ? new Date(retryDate).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : null;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Olá, <strong>${name}</strong>!</p>
          
          <p class="message">
            ❌ Não conseguimos processar a cobrança da sua assinatura.
          </p>

          <div class="info-box">
            <p><span class="info-label">Possíveis causas:</span></p>
            <p>• Cartão expirado ou bloqueado</p>
            <p>• Saldo/limite insuficiente</p>
            <p>• Dados do cartão desatualizados</p>
            ${formattedRetryDate ? `<p><span class="info-label">Próxima tentativa:</span> ${formattedRetryDate}</p>` : ''}
          </div>

          <p class="message">
            Para evitar a interrupção do seu acesso, atualize suas informações de pagamento clicando no botão abaixo.
          </p>

          <div class="button-container">
            <a href="${defaultCheckoutUrl}" class="button">Atualizar Pagamento</a>
          </div>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

/**
 * Email de ativação de assinatura (Boas-vindas com link para criar senha)
 * Disparado após pagamento confirmado para novos assinantes
 */
export function generateSubscriptionActivationEmail(
  name: string,
  email: string,
  activationToken: string,
  planType: 'mensal' | 'anual',
  amount: number,
  paymentMethod: 'credit_card' | 'pix'
): string {
  const activationUrl = getAppUrl(`/ativar-conta?token=${activationToken}`);
  
  const planLabel = planType === 'anual' ? 'Anual' : 'Mensal';
  const formattedAmount = amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const paymentMethodLabel = paymentMethod === 'credit_card' ? 'Cartão de Crédito' : 'PIX';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Olá, <strong>${name}</strong>!</p>
          
          <p class="message">
            🎉 Seu pagamento foi confirmado com sucesso! Agora você faz parte da Lowfy e tem acesso completo a todas as nossas ferramentas, cursos e recursos.
          </p>

          <p class="message">
            Para começar a usar a plataforma, você precisa criar sua senha de acesso clicando no botão abaixo:
          </p>

          <div class="button-container">
            <a href="${activationUrl}" class="button">Ativar Minha Conta</a>
          </div>

          <div class="info-box">
            <p><span class="info-label">Email de acesso:</span> ${email}</p>
            <p><span class="info-label">Plano:</span> ${planLabel}</p>
            <p><span class="info-label">Valor:</span> ${formattedAmount}</p>
            <p><span class="info-label">Forma de pagamento:</span> ${paymentMethodLabel}</p>
          </div>

          <p class="message" style="font-size: 13px; color: #6b7280;">
            ⚠️ Este link é válido por 7 dias. Se você não criou esta conta, ignore este email.
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

/**
 * Email de pagamento aguardando (PIX gerado)
 * Disparado quando o PIX é gerado mas ainda não foi pago
 */
export function generateSubscriptionPaymentAwaitingEmail(
  name: string,
  planType: 'mensal' | 'anual',
  amount: number,
  pixExpiresAt?: string
): string {
  const planLabel = planType === 'anual' ? 'Anual' : 'Mensal';
  const formattedAmount = amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formattedExpiry = pixExpiresAt ? new Date(pixExpiresAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'N/A';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Olá, <strong>${name}</strong>!</p>
          
          <p class="message">
            ⏳ Seu pedido de assinatura foi criado! Estamos aguardando a confirmação do pagamento via PIX.
          </p>

          <div class="info-box">
            <p><span class="info-label">Plano:</span> ${planLabel}</p>
            <p><span class="info-label">Valor:</span> ${formattedAmount}</p>
            <p><span class="info-label">Expira em:</span> ${formattedExpiry}</p>
          </div>

          <p class="message">
            Assim que o pagamento for confirmado, você receberá um email com o link para ativar sua conta.
          </p>

          <p class="message" style="font-size: 13px; color: #6b7280;">
            💡 Dica: O pagamento via PIX é processado automaticamente em até 2 minutos após a confirmação pelo banco.
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

/**
 * Email de solicitação de reembolso recebida
 * Disparado quando o usuário solicita reembolso
 */
export function generateRefundRequestEmail(
  name: string,
  amount: number,
  paymentMethod: string
): string {
  const formattedAmount = amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const paymentMethodLabel = paymentMethod === 'credit_card' ? 'Cartão de Crédito' : 
                              paymentMethod === 'pix' ? 'PIX' : paymentMethod;
  
  const processingMessage = paymentMethod === 'credit_card'
    ? 'Seu reembolso será processado dentro do prazo estimado. Você receberá um email de confirmação assim que o valor for creditado.'
    : 'Seu reembolso será processado dentro do prazo estimado.';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Olá, <strong>${name}</strong>!</p>
          
          <p class="message">
            ✅ Sua solicitação de reembolso foi recebida com sucesso.
          </p>

          <div class="info-box">
            <p><span class="info-label">Valor:</span> ${formattedAmount}</p>
            <p><span class="info-label">Forma de pagamento:</span> ${paymentMethodLabel}</p>
          </div>

          <p class="message">
            ${processingMessage}
          </p>

          <p class="message" style="font-size: 13px; color: #6b7280;">
            💬 Se tiver dúvidas, entre em contato com nosso suporte pelo email suporte@lowfy.com.br
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

/**
 * Email de notificação para admin sobre nova solicitação de reembolso
 * Disparado quando usuário solicita reembolso PIX (requer processamento manual)
 */
export function generateAdminRefundNotificationEmail(
  userName: string,
  userEmail: string,
  amount: number,
  paymentMethod: string,
  reason: string
): string {
  const formattedAmount = amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const requestDate = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
          <p style="color: #ef4444; font-weight: bold;">AÇÃO REQUERIDA</p>
        </div>

        <div class="content">
          <p class="greeting">Nova solicitação de reembolso ${paymentMethod}</p>
          
          <p class="message">
            🔔 Uma nova solicitação de reembolso foi recebida e será processada em breve.
          </p>

          <div class="info-box">
            <p><span class="info-label">Usuário:</span> ${userName}</p>
            <p><span class="info-label">Email:</span> ${userEmail}</p>
            <p><span class="info-label">Valor:</span> ${formattedAmount}</p>
            <p><span class="info-label">Método:</span> ${paymentMethod}</p>
            <p><span class="info-label">Data da solicitação:</span> ${requestDate}</p>
            <p><span class="info-label">Motivo:</span> ${reason}</p>
          </div>

          <p class="message">
            ⚠️ Por favor, acesse o painel administrativo para processar este reembolso.
          </p>

          <div class="button-container">
            <a href="${getAdminUrl()}/subscription-refunds" class="button">Acessar Painel de Reembolsos</a>
          </div>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

/**
 * Email de confirmação de reembolso concluído
 * Disparado quando o reembolso é processado com sucesso
 */
export function generateRefundCompletedEmail(
  name: string,
  amount: number,
  paymentMethod: string
): string {
  const formattedAmount = amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const paymentMethodLabel = paymentMethod === 'credit_card' ? 'Cartão de Crédito' : 
                              paymentMethod === 'pix' ? 'PIX' : paymentMethod;
  
  const processingMessage = paymentMethod === 'credit_card'
    ? 'O valor foi estornado para o seu cartão e deverá aparecer na sua próxima fatura.'
    : 'O valor foi transferido via PIX para a conta informada.';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Olá, <strong>${name}</strong>!</p>
          
          <p class="message">
            💸 Seu reembolso foi processado com sucesso!
          </p>

          <div class="info-box">
            <p><span class="info-label">Valor reembolsado:</span> ${formattedAmount}</p>
            <p><span class="info-label">Forma de pagamento:</span> ${paymentMethodLabel}</p>
          </div>

          <p class="message">
            ${processingMessage}
          </p>

          <p class="message">
            Sentimos muito por sua decisão de cancelar. Se mudar de ideia, você será sempre bem-vindo(a) de volta à Lowfy!
          </p>

          <p class="message" style="font-size: 13px; color: #6b7280;">
            💬 Se tiver dúvidas, entre em contato com nosso suporte pelo email suporte@lowfy.com.br
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

// ==================== CHECKOUT RECOVERY EMAILS ====================
// Sistema de 4 emails persuasivos para recuperação de checkouts abandonados

/**
 * Email 1 - 15 minutos após abandonar o checkout
 * Tom: Amigável e prestativo, oferece ajuda
 */
export function generateCheckoutRecoveryEmail1(
  name: string,
  plan: 'mensal' | 'anual',
  checkoutUrl: string
): string {
  const planLabel = plan === 'anual' ? 'Anual' : 'Mensal';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
      <style>
        .urgency-banner {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          padding: 12px 20px;
          text-align: center;
          font-weight: 600;
          font-size: 14px;
        }
        .benefit-list {
          background-color: #f0fdf4;
          border-left: 4px solid #10b981;
          padding: 20px;
          margin: 20px 0;
        }
        .benefit-list ul {
          margin: 0;
          padding-left: 20px;
        }
        .benefit-list li {
          margin: 8px 0;
          color: #047857;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Oi, <strong>${name}</strong>! 👋</p>
          
          <p class="message">
            Notamos que você estava quase finalizando sua assinatura <strong>${planLabel}</strong> da Lowfy, mas algo aconteceu...
          </p>

          <p class="message">
            <strong>Você teve algum problema técnico?</strong> Ficou com alguma dúvida? Estamos aqui para ajudar!
          </p>

          <div class="benefit-list">
            <p style="margin: 0 0 10px 0; font-weight: 600; color: #047857;">✨ O que você vai ter acesso:</p>
            <ul>
              <li>🔨 Criador de páginas profissionais ilimitado</li>
              <li>🤖 +39 ferramentas de IA premium integradas</li>
              <li>📋 Clonador de página para replicar campanhas vencedoras</li>
              <li>⚙️ Pacote de +150 automações N8N prontas para usar</li>
              <li>🔌 Diversos plugins WordPress premium</li>
              <li>📚 Templates exclusivos de alta conversão</li>
              <li>🎓 Cursos completos de marketing digital</li>
              <li>👥 Comunidade ativa de empreendedores</li>
              <li>🎯 Suporte prioritário 24/7</li>
              <li>➕ E muito mais...</li>
            </ul>
          </div>

          <p class="message">
            Seu carrinho ainda está <strong>esperando por você</strong>. Clique no botão abaixo para retomar de onde parou:
          </p>

          <div class="button-container">
            <a href="${checkoutUrl}" class="button">Continuar minha Assinatura</a>
          </div>

          <p class="message" style="font-size: 13px; color: #6b7280;">
            Se precisar de ajuda, é só responder este email ou entrar em contato com nosso suporte. Estamos sempre aqui para você! 💚
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

/**
 * Email 2 - Na manhã do dia seguinte
 * Tom: Urgência moderada, foco nos benefícios
 */
export function generateCheckoutRecoveryEmail2(
  name: string,
  plan: 'mensal' | 'anual',
  checkoutUrl: string
): string {
  const planLabel = plan === 'anual' ? 'Anual' : 'Mensal';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
      <style>
        .highlight-box-yellow {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border: 2px solid #f59e0b;
          border-radius: 8px;
          padding: 25px;
          text-align: center;
          margin: 25px 0;
        }
        .testimonial-box {
          background-color: #f8fafc;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
          border-left: 4px solid #10b981;
        }
        .testimonial-text {
          font-style: italic;
          color: #4b5563;
          margin-bottom: 10px;
        }
        .testimonial-author {
          font-weight: 600;
          color: #047857;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Bom dia, <strong>${name}</strong>! ☀️</p>
          
          <p class="message">
            Ontem você estava a <strong>um passo</strong> de transformar seu negócio digital. Seu pedido do plano <strong>${planLabel}</strong> ainda está reservado!
          </p>

          <div class="highlight-box-yellow">
            <p style="margin: 0; font-size: 18px; font-weight: 700; color: #92400e;">
              🚀 Enquanto você espera, seus concorrentes já estão vendendo...
            </p>
          </div>

          <p class="message">
            <strong>Sabia que a maioria das pessoas que adiam decisões importantes acaba perdendo oportunidades?</strong>
          </p>

          <p class="message">
            A Lowfy já ajudou milhares de empreendedores a criar páginas que vendem, sem precisar de conhecimento técnico.
          </p>

          <div class="testimonial-box">
            <p class="testimonial-text">
              "Antes eu assinava 3 ferramentas separadas e gastava quase R$ 900 por mês. Com a Lowfy, tenho acesso a mais de 30 ferramentas pagando apenas R$ 99,90! No começo parecia bom demais pra ser verdade, mas confiei e hoje economizo uma fortuna todo mês. E isso sem contar todos os outros recursos que sozinhos já valeriam muito mais!"
            </p>
            <p class="testimonial-author">— Carla M., Empreendedora Digital</p>
          </div>

          <p class="message">
            <strong>Não deixe para depois o que pode mudar sua vida hoje.</strong>
          </p>

          <div class="button-container">
            <a href="${checkoutUrl}" class="button">Garantir Minha Vaga Agora</a>
          </div>

          <p class="message" style="font-size: 13px; color: #6b7280;">
            Qualquer dúvida, estamos aqui para ajudar. Só responder este email! 💚
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

/**
 * Email 3 - Na noite do dia seguinte
 * Tom: Escassez e medo de perder
 */
export function generateCheckoutRecoveryEmail3(
  name: string,
  plan: 'mensal' | 'anual',
  checkoutUrl: string
): string {
  const planLabel = plan === 'anual' ? 'Anual' : 'Mensal';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
      <style>
        .warning-box {
          background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
          border: 2px solid #ef4444;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          margin: 25px 0;
        }
        .comparison-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        .comparison-table th {
          background-color: #f3f4f6;
          padding: 12px;
          text-align: left;
          border-bottom: 2px solid #e5e7eb;
        }
        .comparison-table td {
          padding: 12px;
          border-bottom: 1px solid #e5e7eb;
        }
        .check-icon { color: #10b981; }
        .x-icon { color: #ef4444; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting"><strong>${name}</strong>, preciso ser sincero com você...</p>
          
          <div class="warning-box">
            <p style="margin: 0; font-size: 16px; font-weight: 700; color: #dc2626;">
              ⏰ Seu carrinho vai expirar em breve!
            </p>
          </div>

          <p class="message">
            Você iniciou a assinatura do plano <strong>${planLabel}</strong> mas não finalizou. Entendo que talvez você tenha tido dúvidas ou imprevistos...
          </p>

          <p class="message">
            <strong>Mas deixa eu te mostrar o que você está deixando passar:</strong>
          </p>

          <table class="comparison-table">
            <tr>
              <th>Sem Lowfy</th>
              <th>Com Lowfy</th>
            </tr>
            <tr>
              <td><span class="x-icon">✗</span> Páginas amadoras que não convertem</td>
              <td><span class="check-icon">✓</span> Páginas profissionais de alta conversão</td>
            </tr>
            <tr>
              <td><span class="x-icon">✗</span> Precisa criar tudo do zero</td>
              <td><span class="check-icon">✓</span> +150 PLRs com estrutura pronta e validada</td>
            </tr>
            <tr>
              <td><span class="x-icon">✗</span> Horas aprendendo ferramentas complexas</td>
              <td><span class="check-icon">✓</span> Cria páginas em minutos, sem código</td>
            </tr>
            <tr>
              <td><span class="x-icon">✗</span> Processos manuais e lentos</td>
              <td><span class="check-icon">✓</span> +150 automações N8N prontas para usar</td>
            </tr>
            <tr>
              <td><span class="x-icon">✗</span> IA limitada e cara</td>
              <td><span class="check-icon">✓</span> +39 ferramentas de IA premium integradas</td>
            </tr>
            <tr>
              <td><span class="x-icon">✗</span> Precisa comprar plugins separados</td>
              <td><span class="check-icon">✓</span> Diversos plugins WordPress premium inclusos</td>
            </tr>
            <tr>
              <td><span class="x-icon">✗</span> Sozinho, sem suporte</td>
              <td><span class="check-icon">✓</span> Comunidade ativa + suporte 24/7</td>
            </tr>
            <tr>
              <td><span class="x-icon">✗</span> Pagar caro em cada ferramenta</td>
              <td><span class="check-icon">✓</span> Tudo em um só lugar por um preço justo</td>
            </tr>
            <tr>
              <td><span class="x-icon">✗</span> Clonador de página? Impossível!</td>
              <td><span class="check-icon">✓</span> Clonador de página para replicar sucesso</td>
            </tr>
          </table>

          <p class="message" style="margin-top: 25px; background-color: #fef3c7; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b;">
            <strong>Resumindo:</strong> Você vai ter acesso a +39 ferramentas de IA, +150 automações N8N, PLRs estruturados, clonador de página, plugins premium, templates, cursos e muito mais!
          </p>

          <p class="message">
            <strong>Não deixe que o medo ou a procrastinação roubem seu sucesso.</strong>
          </p>

          <div class="button-container">
            <a href="${checkoutUrl}" class="button">Finalizar Minha Assinatura</a>
          </div>

          <p class="message" style="font-size: 13px; color: #6b7280;">
            Se tiver qualquer dúvida, responda este email. Estamos aqui para te ajudar a ter sucesso! 💚
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

/**
 * Email 4 - No dia seguinte com SUPER DESCONTO de 50%
 * Tom: Última chance + oferta irresistível
 */
export function generateCheckoutRecoveryEmail4WithDiscount(
  name: string,
  plan: 'mensal' | 'anual',
  originalAmount: number,
  discountCode: string,
  checkoutUrlWithDiscount: string
): string {
  const planLabel = plan === 'anual' ? 'Anual' : 'Mensal';
  const discountedAmount = originalAmount / 2;
  
  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
      <style>
        .mega-discount-banner {
          background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
          color: white;
          padding: 20px;
          text-align: center;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.9; }
        }
        .discount-badge {
          display: inline-block;
          background: #fef08a;
          color: #92400e;
          font-size: 32px;
          font-weight: 900;
          padding: 15px 30px;
          border-radius: 12px;
          margin: 10px 0;
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        .price-comparison {
          background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
          border: 3px solid #10b981;
          border-radius: 12px;
          padding: 25px;
          text-align: center;
          margin: 25px 0;
        }
        .original-price {
          text-decoration: line-through;
          color: #9ca3af;
          font-size: 20px;
        }
        .new-price {
          font-size: 36px;
          font-weight: 900;
          color: #047857;
        }
        .coupon-code {
          background: #1f2937;
          color: #10b981;
          font-family: monospace;
          font-size: 24px;
          font-weight: 700;
          padding: 15px 25px;
          border-radius: 8px;
          display: inline-block;
          margin: 15px 0;
          letter-spacing: 2px;
        }
        .countdown-text {
          background: #fef3c7;
          border: 2px dashed #f59e0b;
          padding: 15px;
          border-radius: 8px;
          text-align: center;
          margin: 20px 0;
          font-weight: 600;
          color: #92400e;
        }
        .button-mega {
          display: inline-block;
          background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
          color: #ffffff !important;
          text-decoration: none;
          padding: 18px 45px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 18px;
          box-shadow: 0 6px 20px rgba(220, 38, 38, 0.4);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="mega-discount-banner">
          <p style="margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">🔥 ÚLTIMA CHANCE - OFERTA EXCLUSIVA 🔥</p>
          <div class="discount-badge">50% OFF</div>
          <p style="margin: 0; font-size: 16px;">Só para você que quase fechou conosco!</p>
        </div>

        <div class="content">
          <p class="greeting"><strong>${name}</strong>, isso é SÉRIO! 🚨</p>
          
          <p class="message">
            Eu <strong>NÃO DEVERIA</strong> estar fazendo isso... Mas como você demonstrou interesse real na Lowfy, decidi liberar uma oferta que <strong>NUNCA fizemos antes:</strong>
          </p>

          <div class="price-comparison">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">Plano ${planLabel}</p>
            <p class="original-price">De: ${formatCurrency(originalAmount)}</p>
            <p class="new-price">Por apenas: ${formatCurrency(discountedAmount)}</p>
            <p style="margin: 10px 0 0 0; color: #047857; font-weight: 600;">
              Você economiza: ${formatCurrency(originalAmount - discountedAmount)}
            </p>
          </div>

          <p class="message" style="text-align: center; font-weight: 600;">
            Use o código abaixo no checkout:
          </p>

          <div style="text-align: center;">
            <div class="coupon-code">${discountCode}</div>
          </div>

          <div class="countdown-text">
            ⏳ ATENÇÃO: Esta oferta expira em <strong>24 HORAS</strong> e NÃO será enviada novamente!
          </div>

          <p class="message">
            <strong>Por que estou fazendo isso?</strong>
          </p>

          <p class="message">
            Porque acredito que você merece ter as melhores ferramentas para transformar seu negócio digital. E quando você vir os resultados, vai entender que esse investimento valeu cada centavo.
          </p>

          <div class="button-container">
            <a href="${checkoutUrlWithDiscount}" class="button-mega">QUERO MEU DESCONTO DE 50%</a>
          </div>

          <p class="message" style="font-size: 14px; text-align: center; margin-top: 25px;">
            ⚡ <strong>Garantia de 7 dias:</strong> Se não gostar, devolvemos 100% do seu dinheiro. Sem perguntas.
          </p>

          <p class="message" style="font-size: 13px; color: #6b7280; text-align: center;">
            Esta é sua última chance. Depois disso, o preço volta ao normal e você terá perdido esta oportunidade única.
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}
export function generateProductBlockedEmail(sellerName: string, productTitle: string, blockReason: string): string {
  const dashboardUrl = getAppUrl('/marketplace/meus-produtos');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
      <style>
        .alert-box { background-color: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 25px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><h1 class="logo-text">lowfy</h1></div>
        <div class="content">
          <p class="greeting">Olá, <strong>${sellerName}</strong>!</p>
          <div class="alert-box">
            <p style="margin: 0; font-size: 15px; color: #b45309;"><strong>⚠️ AVISO:</strong> Seu produto foi bloqueado por violar as políticas.</p>
          </div>
          <p class="message">Seu produto <strong>"${productTitle}"</strong> foi removido da vitrine pública após análise pela equipe de moderação.</p>
          <div class="info-box">
            <p style="margin: 0;"><span class="info-label">Produto:</span> ${productTitle}</p>
            <p style="margin: 8px 0 0 0;"><span class="info-label">Motivo:</span></p>
            <p style="margin: 8px 0 0 0; color: #dc2626; font-weight: 600;">${blockReason}</p>
          </div>
          <p class="message"><strong>O que acontece:</strong></p>
          <ul style="color: #4b5563; font-size: 15px; line-height: 1.8; margin: 15px 0; padding-left: 20px;">
            <li>✗ Produto removido da vitrine pública</li>
            <li>✓ Ainda acessível em seu painel</li>
          </ul>
          <div class="button-container"><a href="${dashboardUrl}" class="button">VER MEUS PRODUTOS</a></div>
        </div>
        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

export function generateSupportTicketCreatedUserEmail(
  userName: string,
  subject: string,
  message: string,
  ticketId: string
): string {
  const supportUrl = getSupportUrl();

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">Olá, <strong>${userName}</strong>!</p>
          
          <p class="message">
            ✅ Recebemos seu ticket de suporte e nossa equipe já está trabalhando para ajudá-lo.
          </p>

          <div class="info-box">
            <p><span class="info-label">Número do Ticket:</span> #${ticketId.substring(0, 8).toUpperCase()}</p>
            <p><span class="info-label">Assunto:</span> ${subject}</p>
            <p style="margin-top: 12px;"><span class="info-label">Sua mensagem:</span></p>
            <p style="margin-top: 8px; background: #f3f4f6; padding: 12px; border-radius: 6px; white-space: pre-wrap;">${message.length > 300 ? message.substring(0, 300) + '...' : message}</p>
          </div>

          <p class="message">
            Nosso tempo médio de resposta é de <strong>24 horas úteis</strong>. Você receberá uma notificação assim que tivermos uma atualização.
          </p>

          <div class="button-container">
            <a href="${supportUrl}" class="button">Ver Meus Tickets</a>
          </div>

          <p class="message" style="font-size: 13px; color: #6b7280;">
            Enquanto aguarda, você pode consultar nossa base de conhecimento ou explorar os tutoriais disponíveis na plataforma.
          </p>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

export function generateSupportTicketCreatedAdminEmail(
  userName: string,
  userEmail: string,
  subject: string,
  message: string,
  ticketId: string,
  priority: string = 'medium'
): string {
  const adminUrl = getAdminUrl() + '/comunidade';

  const priorityColors: Record<string, { bg: string; text: string; label: string }> = {
    low: { bg: '#f0fdf4', text: '#166534', label: 'Baixa' },
    medium: { bg: '#fefce8', text: '#854d0e', label: 'Média' },
    high: { bg: '#fef2f2', text: '#dc2626', label: 'Alta' }
  };

  const priorityStyle = priorityColors[priority] || priorityColors.medium;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailBaseStyles()}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-text">lowfy</h1>
        </div>

        <div class="content">
          <p class="greeting">🎫 <strong>Novo Ticket de Suporte</strong></p>
          
          <p class="message">
            Um novo ticket foi aberto e aguarda atendimento.
          </p>

          <div class="info-box">
            <p><span class="info-label">Ticket ID:</span> #${ticketId.substring(0, 8).toUpperCase()}</p>
            <p><span class="info-label">Usuário:</span> ${userName}</p>
            <p><span class="info-label">Email:</span> ${userEmail}</p>
            <p>
              <span class="info-label">Prioridade:</span> 
              <span style="background: ${priorityStyle.bg}; color: ${priorityStyle.text}; padding: 2px 8px; border-radius: 4px; font-weight: 600;">
                ${priorityStyle.label}
              </span>
            </p>
            <p><span class="info-label">Assunto:</span> ${subject}</p>
            <p style="margin-top: 12px;"><span class="info-label">Mensagem:</span></p>
            <p style="margin-top: 8px; background: #f3f4f6; padding: 12px; border-radius: 6px; white-space: pre-wrap;">${message}</p>
          </div>

          <div class="button-container">
            <a href="${adminUrl}" class="button">Gerenciar Tickets</a>
          </div>
        </div>

        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

export async function sendSupportTicketNotifications(
  userName: string,
  userEmail: string,
  subject: string,
  message: string,
  ticketId: string,
  priority: string = 'medium',
  adminEmail?: string
) {
  const userHtml = generateSupportTicketCreatedUserEmail(userName, subject, message, ticketId);
  await sendEmail({
    to: userEmail,
    subject: `Ticket #${ticketId.substring(0, 8).toUpperCase()} - Recebemos sua solicitação`,
    html: userHtml,
  });

  if (adminEmail) {
    const adminHtml = generateSupportTicketCreatedAdminEmail(
      userName,
      userEmail,
      subject,
      message,
      ticketId,
      priority
    );
    await sendEmail({
      to: adminEmail,
      subject: `🎫 Novo Ticket: ${subject}`,
      html: adminHtml,
    });
  }
}
