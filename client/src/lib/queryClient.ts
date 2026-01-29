import { QueryClient, QueryFunction } from "@tanstack/react-query";

export class SubscriptionExpiredError extends Error {
  code: string;
  daysExpired: number;
  
  constructor(message: string, daysExpired: number = 0) {
    super(message);
    this.name = 'SubscriptionExpiredError';
    this.code = 'SUBSCRIPTION_EXPIRED';
    this.daysExpired = daysExpired;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  body?: any,
  customOptions?: RequestInit
): Promise<Response> {
  const token = localStorage.getItem('auth_token');

  const headers: Record<string, string> = {
    ...(customOptions?.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Only add Content-Type for non-FormData bodies
  if (!(body instanceof FormData) && body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const options: RequestInit = {
    method,
    headers,
    credentials: 'include',
    ...customOptions,
  };

  if (body !== undefined) {
    options.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (response.status === 401) {
    const isLoginOrRegister = url.includes('/api/auth/login') || url.includes('/api/auth/register');
    
    if (!isLoginOrRegister) {
      localStorage.removeItem('auth_token');
      window.location.href = '/';
    }
    
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Não autorizado');
  }

  if (response.status === 403) {
    const errorData = await response.json().catch(() => ({}));
    if (errorData.code === 'SUBSCRIPTION_EXPIRED') {
      throw new SubscriptionExpiredError(
        errorData.message || 'Sua assinatura expirou',
        errorData.daysExpired || 0
      );
    }
    throw new Error(errorData.message || 'Acesso negado');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Erro ${response.status}`);
  }

  return response;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Build URL from queryKey - first element is the base path, subsequent elements can be objects with query params
    let url = queryKey[0] as string;
    
    // Check if there are additional elements in queryKey (could be params object)
    if (queryKey.length > 1) {
      const params = queryKey[1];
      if (typeof params === 'object' && params !== null) {
        // Convert object to query string
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined && value !== null && value !== '') {
            searchParams.append(key, String(value));
          }
        }
        const queryString = searchParams.toString();
        if (queryString) {
          url = `${url}?${queryString}`;
        }
      } else if (typeof params === 'string' || typeof params === 'number') {
        // If it's a simple value, treat it as part of the path
        url = `${url}/${params}`;
      }
    }

    const res = await fetch(url, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    if (res.status === 403) {
      const errorData = await res.json().catch(() => ({}));
      if (errorData.code === 'SUBSCRIPTION_EXPIRED') {
        throw new SubscriptionExpiredError(
          errorData.message || 'Sua assinatura expirou',
          errorData.daysExpired || 0
        );
      }
      throw new Error(errorData.message || 'Acesso negado');
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 5 * 60 * 1000, // 5 minutos - cache mais longo para melhor performance
      gcTime: 30 * 60 * 1000, // 30 minutos - manter dados em cache por mais tempo
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: false,
    },
  },
});