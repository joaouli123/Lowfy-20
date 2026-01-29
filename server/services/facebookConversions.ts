import { logger } from '../utils/logger';
import crypto from 'crypto';

const META_PIXEL_ID = '1097300724975493';
const API_VERSION = 'v21.0';

interface ConversionEventData {
  event_name: 'Purchase' | 'Lead' | 'CompleteRegistration' | 'InitiateCheckout' | 'AddToCart';
  event_time: number;
  user_data: {
    em?: string; // hashed email
    ph?: string; // hashed phone
    fn?: string; // hashed first name
    ln?: string; // hashed last name
    external_id?: string; // hashed user id
    client_ip_address?: string;
    client_user_agent?: string;
    fbc?: string; // Facebook click ID
    fbp?: string; // Facebook browser ID
  };
  custom_data?: {
    currency?: string;
    value?: number;
    content_name?: string;
    content_ids?: string[];
    content_type?: string;
    order_id?: string;
    num_items?: number;
  };
  event_source_url?: string;
  action_source: 'website' | 'email' | 'app' | 'phone_call' | 'chat' | 'physical_store' | 'system_generated' | 'other';
}

function hashData(data: string): string {
  return crypto.createHash('sha256').update(data.toLowerCase().trim()).digest('hex');
}

function normalizePhone(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  // Add Brazil country code if not present
  if (digits.startsWith('55')) {
    return digits;
  }
  return `55${digits}`;
}

export async function sendPurchaseEvent(params: {
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  userId?: string;
  value: number; // in cents
  currency?: string;
  contentName: string;
  contentIds?: string[];
  orderId?: string;
  eventSourceUrl?: string;
  // NEW: Additional parameters for better Event Match Quality (EMQ)
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbc?: string; // Facebook Click ID from _fbc cookie
  fbp?: string; // Facebook Browser ID from _fbp cookie
}): Promise<boolean> {
  const accessToken = process.env.META_ACCESS_TOKEN;
  
  if (!accessToken) {
    logger.warn('[Facebook CAPI] META_ACCESS_TOKEN not configured - skipping conversion');
    return false;
  }

  try {
    const eventTime = Math.floor(Date.now() / 1000);
    
    const userData: ConversionEventData['user_data'] = {
      em: hashData(params.email),
      external_id: params.userId ? hashData(params.userId) : undefined,
    };
    
    if (params.phone) {
      userData.ph = hashData(normalizePhone(params.phone));
    }
    
    if (params.firstName) {
      userData.fn = hashData(params.firstName);
    }
    
    if (params.lastName) {
      userData.ln = hashData(params.lastName);
    }
    
    // Add EMQ-boosting parameters (IP, User Agent, fbc, fbp)
    if (params.clientIpAddress) {
      userData.client_ip_address = params.clientIpAddress;
    }
    if (params.clientUserAgent) {
      userData.client_user_agent = params.clientUserAgent;
    }
    if (params.fbc) {
      userData.fbc = params.fbc;
    }
    if (params.fbp) {
      userData.fbp = params.fbp;
    }

    const eventData: ConversionEventData = {
      event_name: 'Purchase',
      event_time: eventTime,
      action_source: 'website',
      user_data: userData,
      custom_data: {
        currency: params.currency || 'BRL',
        value: params.value / 100, // Convert cents to currency
        content_name: params.contentName,
        content_ids: params.contentIds,
        content_type: 'product',
        order_id: params.orderId,
        num_items: 1,
      },
      event_source_url: params.eventSourceUrl,
    };

    const url = `https://graph.facebook.com/${API_VERSION}/${META_PIXEL_ID}/events`;
    
    const payload = {
      data: [eventData],
      access_token: accessToken,
    };

    logger.debug('[Facebook CAPI] Sending Purchase event', {
      email: params.email,
      value: params.value / 100,
      orderId: params.orderId,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.ok && result.events_received === 1) {
      logger.info('[Facebook CAPI] ✅ Purchase event sent successfully', {
        email: params.email,
        value: params.value / 100,
        orderId: params.orderId,
        facebookEventId: result.fbtrace_id,
      });
      return true;
    } else {
      logger.error('[Facebook CAPI] ❌ Failed to send event', {
        status: response.status,
        result,
      });
      return false;
    }
  } catch (error: any) {
    logger.error('[Facebook CAPI] ❌ Error sending Purchase event', {
      error: error.message,
      email: params.email,
    });
    return false;
  }
}

export async function sendLeadEvent(params: {
  email: string;
  phone?: string;
  firstName?: string;
  userId?: string;
  contentName?: string;
  eventSourceUrl?: string;
}): Promise<boolean> {
  const accessToken = process.env.META_ACCESS_TOKEN;
  
  if (!accessToken) {
    logger.warn('[Facebook CAPI] META_ACCESS_TOKEN not configured - skipping lead event');
    return false;
  }

  try {
    const eventTime = Math.floor(Date.now() / 1000);
    
    const userData: ConversionEventData['user_data'] = {
      em: hashData(params.email),
      external_id: params.userId ? hashData(params.userId) : undefined,
    };
    
    if (params.phone) {
      userData.ph = hashData(normalizePhone(params.phone));
    }
    
    if (params.firstName) {
      userData.fn = hashData(params.firstName);
    }

    const eventData: ConversionEventData = {
      event_name: 'Lead',
      event_time: eventTime,
      action_source: 'website',
      user_data: userData,
      custom_data: {
        content_name: params.contentName || 'Lead Capture',
      },
      event_source_url: params.eventSourceUrl,
    };

    const url = `https://graph.facebook.com/${API_VERSION}/${META_PIXEL_ID}/events`;
    
    const payload = {
      data: [eventData],
      access_token: accessToken,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.ok && result.events_received === 1) {
      logger.info('[Facebook CAPI] ✅ Lead event sent successfully', {
        email: params.email,
      });
      return true;
    } else {
      logger.error('[Facebook CAPI] ❌ Failed to send lead event', {
        status: response.status,
        result,
      });
      return false;
    }
  } catch (error: any) {
    logger.error('[Facebook CAPI] ❌ Error sending Lead event', {
      error: error.message,
    });
    return false;
  }
}
