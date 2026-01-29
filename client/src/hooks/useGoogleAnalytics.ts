// Initialize Google Analytics with User ID if authenticated
export function initGoogleAnalytics(userId?: string) {
  if (window.gtag) {
    if (userId) {
      // Send User ID to GA4 for authenticated users
      window.gtag('config', 'G-96JB3QFM0Z', { 'user_id': userId });
    } else {
      window.gtag('config', 'G-96JB3QFM0Z');
    }
  }
}

// Track page views
export function trackPageView(path: string, title?: string) {
  if (window.gtag) {
    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: title || document.title,
    });
  }
}

// Track events
export function trackEvent(eventName: string, eventParams?: Record<string, any>) {
  if (window.gtag) {
    window.gtag('event', eventName, eventParams);
  }
}

// Track e-commerce purchase
export function trackPurchase(transactionId: string, value: number, currency: string, items?: any[]) {
  if (window.gtag) {
    window.gtag('event', 'purchase', {
      transaction_id: transactionId,
      value: value,
      currency: currency,
      items: items,
    });
  }
}

// Track user login
export function trackUserLogin(userId: string) {
  if (window.gtag) {
    window.gtag('config', 'G-96JB3QFM0Z', { 'user_id': userId });
    window.gtag('event', 'login', { method: 'email' });
  }
}

// Track user signup
export function trackUserSignup() {
  if (window.gtag) {
    window.gtag('event', 'sign_up', { method: 'email' });
  }
}

// Track Google Ads conversion (Purchase)
export function trackAdConversion(conversionLabel?: string, value?: number, currency?: string, transactionId?: string) {
  if (window.gtag) {
    // If transaction ID provided, send purchase event to Google Ads
    if (transactionId) {
      // Send purchase event directly to Google Ads via send_to
      window.gtag('event', 'purchase', {
        'send_to': 'AW-17785466777/K1z9CPe0qM0bEJnf4qBC',
        'value': value,
        'currency': currency,
        'transaction_id': transactionId,
      });
    } else {
      // Fallback to conversion event for non-purchase conversions
      window.gtag('event', 'conversion', {
        'allow_custom_scripts': true,
        'send_to': `AW-17785466777${conversionLabel ? '/' + conversionLabel : ''}`,
        ...(value && { 'value': value }),
        ...(currency && { 'currency': currency }),
      });
    }
  }
}

// Track Google Ads Lead (Sign Up)
export function trackAdLead(value?: number) {
  if (window.gtag) {
    window.gtag('event', 'conversion', {
      'allow_custom_scripts': true,
      'send_to': 'AW-17785466777/MKHFCK6x_OoYEP3hm_wq',
      ...(value && { 'value': value }),
      'currency': 'BRL',
    });
  }
}

// Track Google Ads View Item (Product/Plan View)
export function trackAdViewItem(itemName: string, itemId: string, value?: number, itemCategory?: string) {
  if (window.gtag) {
    window.gtag('event', 'view_item', {
      'allow_custom_scripts': true,
      'send_to': 'AW-17785466777',
      'items': [
        {
          'item_id': itemId,
          'item_name': itemName,
          'item_category': itemCategory || 'product',
          ...(value && { 'price': value }),
        }
      ],
      'value': value,
      'currency': 'BRL',
    });
  }
}

// Track Google Ads Add to Cart
export function trackAdAddToCart(itemName: string, itemId: string, value?: number, quantity: number = 1) {
  if (window.gtag) {
    window.gtag('event', 'add_to_cart', {
      'allow_custom_scripts': true,
      'send_to': 'AW-17785466777',
      'items': [
        {
          'item_id': itemId,
          'item_name': itemName,
          'quantity': quantity,
          ...(value && { 'price': value }),
        }
      ],
      'value': value,
      'currency': 'BRL',
    });
  }
}

// Track Google Ads Begin Checkout
export function trackAdBeginCheckout(value: number, currency: string = 'BRL', itemCount: number = 1) {
  if (window.gtag) {
    window.gtag('event', 'begin_checkout', {
      'allow_custom_scripts': true,
      'send_to': 'AW-17785466777',
      'value': value,
      'currency': currency,
      'items': [{ 'quantity': itemCount }],
    });
  }
}

// Track Google Ads Abandoned Checkout
export function trackAdAbandonedCheckout(value: number, currency: string = 'BRL', itemCount: number = 1) {
  if (window.gtag) {
    // Rastreia checkout abandonado para remarketing
    window.gtag('event', 'conversion', {
      'allow_custom_scripts': true,
      'send_to': 'AW-17785466777/MKHFCK6x_5-4EJriyr0q', // Conversion label for abandoned checkout
      'value': value,
      'currency': currency,
    });
    
    // Também envia um evento de add_to_cart com o valor para remarketing
    window.gtag('event', 'view_cart', {
      'allow_custom_scripts': true,
      'send_to': 'AW-17785466777',
      'value': value,
      'currency': currency,
      'items': [{ 'quantity': itemCount }],
    });
  }
}

// Declare gtag function for TypeScript
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}
