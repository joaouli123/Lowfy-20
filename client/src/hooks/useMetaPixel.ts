declare global {
  interface Window {
    fbq: (...args: any[]) => void;
    _fbq: any;
  }
}

const META_PIXEL_ID = '1097300724975493';

export const initMetaPixel = () => {
  if (typeof window === 'undefined') return;
  if (window.fbq) return;

  const n = (window.fbq = function (...args: any[]) {
    if ((n as any).callMethod) {
      (n as any).callMethod.apply(n, args);
    } else {
      (n as any).queue.push(args);
    }
  } as any);

  if (!window._fbq) window._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = '2.0';
  n.queue = [];

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);

  window.fbq('init', META_PIXEL_ID);
  window.fbq('track', 'PageView');
};

export const trackPageView = () => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'PageView');
  }
};

export const trackViewContent = (data: {
  content_name: string;
  content_category?: string;
  content_type?: string;
  content_ids?: string[];
  value?: number;
  currency?: string;
}) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'ViewContent', {
      content_name: data.content_name,
      content_category: data.content_category || 'subscription',
      content_type: data.content_type || 'product',
      content_ids: data.content_ids,
      value: data.value,
      currency: data.currency || 'BRL',
    });
  }
};

export const trackAddToCart = (data: {
  content_name: string;
  content_ids?: string[];
  content_type?: string;
  value: number;
  currency?: string;
}) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'AddToCart', {
      content_name: data.content_name,
      content_ids: data.content_ids,
      content_type: data.content_type || 'product',
      value: data.value,
      currency: data.currency || 'BRL',
    });
  }
};

export const trackInitiateCheckout = (data: {
  content_name: string;
  content_category?: string;
  content_ids?: string[];
  num_items?: number;
  value: number;
  currency?: string;
}) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'InitiateCheckout', {
      content_name: data.content_name,
      content_category: data.content_category || 'subscription',
      content_ids: data.content_ids,
      num_items: data.num_items || 1,
      value: data.value,
      currency: data.currency || 'BRL',
    });
  }
};

export const trackAddPaymentInfo = (data?: {
  content_category?: string;
  content_ids?: string[];
  value?: number;
  currency?: string;
}) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'AddPaymentInfo', {
      content_category: data?.content_category || 'subscription',
      content_ids: data?.content_ids,
      value: data?.value,
      currency: data?.currency || 'BRL',
    });
  }
};

export const trackPurchase = (data: {
  content_name: string;
  content_ids?: string[];
  content_type?: string;
  num_items?: number;
  value: number;
  currency?: string;
  order_id?: string;
}) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'Purchase', {
      content_name: data.content_name,
      content_ids: data.content_ids,
      content_type: data.content_type || 'product',
      num_items: data.num_items || 1,
      value: data.value,
      currency: data.currency || 'BRL',
      order_id: data.order_id,
    });
  }
};

export const trackCompleteRegistration = (data?: {
  content_name?: string;
  status?: string;
  value?: number;
  currency?: string;
}) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'CompleteRegistration', {
      content_name: data?.content_name || 'User Registration',
      status: data?.status || 'completed',
      value: data?.value,
      currency: data?.currency || 'BRL',
    });
  }
};

export const trackLead = (data?: {
  content_name?: string;
  content_category?: string;
  value?: number;
  currency?: string;
}) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'Lead', {
      content_name: data?.content_name || 'Lead Capture',
      content_category: data?.content_category,
      value: data?.value,
      currency: data?.currency || 'BRL',
    });
  }
};

export const trackCustomEvent = (eventName: string, data?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('trackCustom', eventName, data);
  }
};

export const trackSubscriptionPlanView = (plan: 'mensal' | 'anual', value: number) => {
  trackViewContent({
    content_name: `Lowfy ${plan === 'mensal' ? 'Mensal' : 'Anual'}`,
    content_category: 'subscription',
    content_type: 'product',
    content_ids: [`lowfy_${plan}`],
    value: value / 100,
    currency: 'BRL',
  });
};

export const trackSubscriptionCheckoutStart = (plan: 'mensal' | 'anual', value: number) => {
  trackInitiateCheckout({
    content_name: `Lowfy ${plan === 'mensal' ? 'Mensal' : 'Anual'}`,
    content_category: 'subscription',
    content_ids: [`lowfy_${plan}`],
    value: value / 100,
    currency: 'BRL',
  });
};

export const trackSubscriptionPurchase = (plan: 'mensal' | 'anual', value: number, orderId?: string) => {
  trackPurchase({
    content_name: `Lowfy ${plan === 'mensal' ? 'Mensal' : 'Anual'}`,
    content_ids: [`lowfy_${plan}`],
    content_type: 'product',
    value: value / 100,
    currency: 'BRL',
    order_id: orderId,
  });
};

export const trackMarketplacePurchase = (productName: string, value: number, productId: string, orderId?: string) => {
  trackPurchase({
    content_name: productName,
    content_ids: [productId],
    content_type: 'product',
    value: value / 100,
    currency: 'BRL',
    order_id: orderId,
  });
};

export const trackMarketplaceCheckoutStart = (productName: string, value: number, productId: string) => {
  trackInitiateCheckout({
    content_name: productName,
    content_category: 'marketplace',
    content_ids: [productId],
    value: value / 100,
    currency: 'BRL',
  });
};

export const trackMarketplaceProductView = (productName: string, value: number, productId: string) => {
  trackViewContent({
    content_name: productName,
    content_category: 'marketplace',
    content_type: 'product',
    content_ids: [productId],
    value: value / 100,
    currency: 'BRL',
  });
};

const useMetaPixel = () => {
  return {
    init: initMetaPixel,
    trackPageView,
    trackViewContent,
    trackAddToCart,
    trackInitiateCheckout,
    trackAddPaymentInfo,
    trackPurchase,
    trackCompleteRegistration,
    trackLead,
    trackCustomEvent,
    trackSubscriptionPlanView,
    trackSubscriptionCheckoutStart,
    trackSubscriptionPurchase,
    trackMarketplacePurchase,
    trackMarketplaceCheckoutStart,
    trackMarketplaceProductView,
  };
};

export default useMetaPixel;
