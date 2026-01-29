const isDev = process.env.NODE_ENV !== 'production';

const sanitizeArgs = (args: any[]): any[] => {
  return args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      const sanitized = { ...arg };
      const sensitiveKeys = ['password', 'token', 'secret', 'accessToken', 'refreshToken', 'apiKey', 'pixKey', 'cpf', 'creditCard', 'cvv'];
      for (const key of sensitiveKeys) {
        if (key in sanitized) {
          sanitized[key] = '[REDACTED]';
        }
      }
      return sanitized;
    }
    return arg;
  });
};

export const logger = {
  info: (...args: any[]) => {
    if (isDev) {
      console.log('[INFO]', ...args);
    }
  },
  error: (...args: any[]) => {
    const sanitized = sanitizeArgs(args);
    console.error('[ERROR]', new Date().toISOString(), ...sanitized);
  },
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn('[WARN]', ...args);
    } else {
      const sanitized = sanitizeArgs(args);
      console.warn('[WARN]', new Date().toISOString(), ...sanitized);
    }
  },
  debug: (...args: any[]) => {
    if (isDev) {
      console.log('[DEBUG]', ...args);
    }
  }
};
