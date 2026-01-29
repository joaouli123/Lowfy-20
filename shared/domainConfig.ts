const isServer = typeof window === 'undefined';

function getEnv(key: string, defaultValue: string): string {
  if (isServer) {
    return process.env[key] || defaultValue;
  }
  const viteKey = `VITE_${key}`;
  return (import.meta.env?.[viteKey] as string) || defaultValue;
}

function getIsProduction(): boolean {
  if (isServer) {
    return process.env.NODE_ENV === 'production';
  }
  return import.meta.env?.PROD === true;
}

function hasCustomDomains(): boolean {
  if (isServer) {
    return !!(process.env.APP_DOMAIN || process.env.LANDING_DOMAIN || process.env.CHECKOUT_DOMAIN);
  }
  return !!(import.meta.env?.VITE_APP_DOMAIN || import.meta.env?.VITE_LANDING_DOMAIN || import.meta.env?.VITE_CHECKOUT_DOMAIN);
}

const isProduction = getIsProduction();
const useProductionDomains = isProduction || hasCustomDomains();

const domains = {
  app: getEnv('APP_DOMAIN', 'lowfy.com.br'),
  landing: getEnv('LANDING_DOMAIN', 'lowfy.com.br'),
  checkout: getEnv('CHECKOUT_DOMAIN', 'lowfy.com.br'),
} as const;

const devDomains = {
  app: 'localhost:5000',
  landing: 'localhost:5000',
  checkout: 'localhost:5000',
} as const;

const protocol = useProductionDomains ? 'https' : 'http';

export function getAppUrl(path: string = ''): string {
  const domain = useProductionDomains ? domains.app : devDomains.app;
  const cleanPath = path.startsWith('/') ? path : path ? `/${path}` : '';
  return `${protocol}://${domain}${cleanPath}`;
}

export function getLandingUrl(path: string = ''): string {
  const domain = useProductionDomains ? domains.landing : devDomains.landing;
  const cleanPath = path.startsWith('/') ? path : path ? `/${path}` : '';
  return `${protocol}://${domain}${cleanPath}`;
}

export function getCheckoutUrl(path: string = ''): string {
  const domain = useProductionDomains ? domains.checkout : devDomains.checkout;
  const cleanPath = path.startsWith('/') ? path : path ? `/${path}` : '';
  return `${protocol}://${domain}${cleanPath}`;
}

export function getClonedPageUrl(slug: string): string {
  return getCheckoutUrl(`/${slug}`);
}

export function getLoginUrl(): string {
  return getAppUrl('/auth');
}

export function getDashboardUrl(): string {
  return getAppUrl('/');
}

export function getSupportUrl(): string {
  return getAppUrl('/suporte');
}

export function getAdminUrl(): string {
  return getAppUrl('/admin');
}

export const domainConfig = {
  domains: isProduction ? domains : devDomains,
  protocol,
  isProduction,
  getAppUrl,
  getLandingUrl,
  getCheckoutUrl,
  getClonedPageUrl,
  getLoginUrl,
  getDashboardUrl,
  getSupportUrl,
  getAdminUrl,
};

export default domainConfig;
