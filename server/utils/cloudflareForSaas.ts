import { logger } from './logger';

const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4';

interface CloudflareResponse<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: string[];
  result: T;
}

interface CustomHostname {
  id: string;
  hostname: string;
  status: 'pending' | 'pending_validation' | 'pending_issuance' | 'pending_deployment' | 'active' | 'blocked' | 'deleted';
  ssl: {
    status: string;
    method: string;
    type: string;
    validation_records?: Array<{
      txt_name?: string;
      txt_value?: string;
      http_url?: string;
      http_body?: string;
    }>;
    validation_errors?: Array<{ message: string }>;
    dcv_delegation_records?: Array<{
      cname: string;
      cname_target: string;
    }>;
  };
  ownership_verification?: {
    type: string;
    name: string;
    value: string;
  };
  ownership_verification_http?: {
    http_url: string;
    http_body: string;
  };
  verification_errors?: string[];
  created_at: string;
}

interface FallbackOrigin {
  origin: string;
  status: string;
}

function getCloudflareCredentials() {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

  if (!apiToken || !zoneId) {
    throw new Error('Cloudflare credentials not configured (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID)');
  }

  return { apiToken, zoneId, accountId };
}

const CLOUDFLARE_TIMEOUT_MS = 10000; // 10 segundos de timeout

async function cloudflareRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  body?: any
): Promise<CloudflareResponse<T> & { httpStatus?: number; isTimeout?: boolean; isNetworkError?: boolean }> {
  const { apiToken } = getCloudflareCredentials();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLOUDFLARE_TIMEOUT_MS);

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    signal: controller.signal,
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${CLOUDFLARE_API_URL}${endpoint}`, options);
    clearTimeout(timeoutId);
    
    const data = await response.json() as CloudflareResponse<T>;

    if (!data.success) {
      logger.error(`Cloudflare API error (HTTP ${response.status}): ${JSON.stringify(data.errors)}`);
    }

    return { ...data, httpStatus: response.status };
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      logger.error(`Cloudflare API timeout após ${CLOUDFLARE_TIMEOUT_MS}ms para ${endpoint}`);
      return {
        success: false,
        errors: [{ code: 0, message: 'Timeout: Cloudflare não respondeu a tempo' }],
        messages: [],
        result: null as any,
        isTimeout: true
      };
    }
    
    logger.error(`Cloudflare API network error: ${error.message}`);
    return {
      success: false,
      errors: [{ code: 0, message: `Erro de rede: ${error.message}` }],
      messages: [],
      result: null as any,
      isNetworkError: true
    };
  }
}

export async function getFallbackOrigin(): Promise<FallbackOrigin | null> {
  const { zoneId } = getCloudflareCredentials();
  
  try {
    const response = await cloudflareRequest<FallbackOrigin>(
      `/zones/${zoneId}/custom_hostnames/fallback_origin`
    );

    if (response.success) {
      return response.result;
    }
    return null;
  } catch (error) {
    logger.error('Error getting fallback origin:', error);
    return null;
  }
}

export async function setFallbackOrigin(origin: string): Promise<boolean> {
  const { zoneId } = getCloudflareCredentials();

  try {
    const response = await cloudflareRequest<FallbackOrigin>(
      `/zones/${zoneId}/custom_hostnames/fallback_origin`,
      'PUT',
      { origin }
    );

    if (response.success) {
      logger.debug(`✅ Fallback origin set to: ${origin}`);
      return true;
    }
    
    logger.error(`Failed to set fallback origin: ${JSON.stringify(response.errors)}`);
    return false;
  } catch (error) {
    logger.error('Error setting fallback origin:', error);
    return false;
  }
}

export async function createCustomHostname(hostname: string): Promise<{
  success: boolean;
  customHostname?: CustomHostname;
  error?: string;
  cnameTarget?: string;
  validationInstructions?: {
    type: string;
    name?: string;
    value?: string;
    httpUrl?: string;
    httpBody?: string;
  };
  dcvDelegation?: {
    cname: string;
    cnameTarget: string;
  };
  ownershipVerification?: {
    txtName: string;
    txtValue: string;
  };
}> {
  const { zoneId } = getCloudflareCredentials();

  // NÃO remover www - cada subdomínio é único (www.site.com ≠ site.com)
  const normalizedHostname = hostname
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .trim();

  try {
    // IMPORTANTE: Usar method 'txt' para validação SSL
    // Isso funciona MESMO com proxy ativo (nuvem laranja) no Cloudflare do usuário.
    // O usuário precisa adicionar um registro TXT _acme-challenge.dominio
    // Após SSL emitido, o TXT pode ser removido.
    const response = await cloudflareRequest<CustomHostname>(
      `/zones/${zoneId}/custom_hostnames`,
      'POST',
      {
        hostname: normalizedHostname,
        ssl: {
          method: 'txt',
          type: 'dv',
          settings: {
            http2: 'on',
            min_tls_version: '1.2',
            tls_1_3: 'on'
          },
          bundle_method: 'ubiquitous',
          wildcard: false
        }
      }
    );

    if (response.success && response.result) {
      const result = response.result;
      
      let validationInstructions: any = null;
      
      if (result.ownership_verification) {
        validationInstructions = {
          type: 'txt',
          name: result.ownership_verification.name,
          value: result.ownership_verification.value
        };
      } else if (result.ownership_verification_http) {
        validationInstructions = {
          type: 'http',
          httpUrl: result.ownership_verification_http.http_url,
          httpBody: result.ownership_verification_http.http_body
        };
      }

      let dcvDelegation: { cname: string; cnameTarget: string } | undefined;
      if (result.ssl?.dcv_delegation_records && result.ssl.dcv_delegation_records.length > 0) {
        dcvDelegation = {
          cname: result.ssl.dcv_delegation_records[0].cname,
          cnameTarget: result.ssl.dcv_delegation_records[0].cname_target
        };
      }

      let ownershipVerification: { txtName: string; txtValue: string } | undefined;
      if (result.ownership_verification) {
        ownershipVerification = {
          txtName: result.ownership_verification.name,
          txtValue: result.ownership_verification.value
        };
      }

      logger.debug(`✅ Custom hostname created: ${normalizedHostname} (ID: ${result.id})`);

      return {
        success: true,
        customHostname: result,
        cnameTarget: 'proxy.lowfy.com.br',
        validationInstructions,
        dcvDelegation,
        ownershipVerification
      };
    }

    const errorMsg = response.errors?.[0]?.message || 'Unknown error';
    const errorCode = response.errors?.[0]?.code;
    
    // Código 1406 = Duplicate custom hostname found
    if (errorCode === 1406 || errorMsg.includes('already exists') || errorMsg.includes('Duplicate')) {
      logger.debug(`Custom hostname already exists, fetching existing: ${normalizedHostname}`);
      const existing = await getCustomHostname(normalizedHostname);
      if (existing) {
        logger.debug(`✅ Using existing custom hostname: ${normalizedHostname} (ID: ${existing.id})`);
        
        let dcvDelegation: { cname: string; cnameTarget: string } | undefined;
        if (existing.ssl?.dcv_delegation_records && existing.ssl.dcv_delegation_records.length > 0) {
          dcvDelegation = {
            cname: existing.ssl.dcv_delegation_records[0].cname,
            cnameTarget: existing.ssl.dcv_delegation_records[0].cname_target
          };
        }

        let ownershipVerification: { txtName: string; txtValue: string } | undefined;
        if (existing.ownership_verification) {
          ownershipVerification = {
            txtName: existing.ownership_verification.name,
            txtValue: existing.ownership_verification.value
          };
        }
        
        return {
          success: true,
          customHostname: existing,
          cnameTarget: 'proxy.lowfy.com.br',
          dcvDelegation,
          ownershipVerification
        };
      }
    }

    return {
      success: false,
      error: errorMsg
    };
  } catch (error: any) {
    logger.error('Error creating custom hostname:', error);
    return {
      success: false,
      error: error.message || 'Failed to create custom hostname'
    };
  }
}

export async function getCustomHostname(hostname: string): Promise<CustomHostname | null> {
  const { zoneId } = getCloudflareCredentials();

  // NÃO remover www - cada subdomínio é único (www.site.com ≠ site.com)
  const normalizedHostname = hostname
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .trim();

  try {
    const response = await cloudflareRequest<CustomHostname[]>(
      `/zones/${zoneId}/custom_hostnames?hostname=${encodeURIComponent(normalizedHostname)}`
    );

    if (response.success && response.result && response.result.length > 0) {
      return response.result[0];
    }

    return null;
  } catch (error) {
    logger.error('Error getting custom hostname:', error);
    return null;
  }
}

export async function getCustomHostnameById(id: string): Promise<CustomHostname | null> {
  const { zoneId } = getCloudflareCredentials();

  try {
    const response = await cloudflareRequest<CustomHostname>(
      `/zones/${zoneId}/custom_hostnames/${id}`
    );

    if (response.success && response.result) {
      return response.result;
    }

    return null;
  } catch (error) {
    logger.error('Error getting custom hostname by ID:', error);
    return null;
  }
}

export async function deleteCustomHostname(hostnameOrId: string): Promise<boolean> {
  const { zoneId } = getCloudflareCredentials();

  try {
    let hostnameId = hostnameOrId;

    if (!hostnameOrId.match(/^[a-f0-9-]{36}$/i)) {
      const existing = await getCustomHostname(hostnameOrId);
      if (!existing) {
        logger.debug(`Custom hostname not found: ${hostnameOrId}`);
        return true;
      }
      hostnameId = existing.id;
    }

    const response = await cloudflareRequest<{ id: string }>(
      `/zones/${zoneId}/custom_hostnames/${hostnameId}`,
      'DELETE'
    );

    if (response.success) {
      logger.debug(`✅ Custom hostname deleted: ${hostnameOrId}`);
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Error deleting custom hostname:', error);
    return false;
  }
}

export async function listCustomHostnames(page: number = 1, perPage: number = 50): Promise<{
  hostnames: CustomHostname[];
  totalCount: number;
  totalPages: number;
}> {
  const { zoneId } = getCloudflareCredentials();

  try {
    const response = await cloudflareRequest<CustomHostname[]>(
      `/zones/${zoneId}/custom_hostnames?page=${page}&per_page=${perPage}`
    );

    if (response.success && response.result) {
      return {
        hostnames: response.result,
        totalCount: response.result.length,
        totalPages: 1
      };
    }

    return { hostnames: [], totalCount: 0, totalPages: 0 };
  } catch (error) {
    logger.error('Error listing custom hostnames:', error);
    return { hostnames: [], totalCount: 0, totalPages: 0 };
  }
}

export async function refreshCustomHostnameValidation(hostnameOrId: string): Promise<CustomHostname | null> {
  const { zoneId } = getCloudflareCredentials();

  try {
    let hostnameId = hostnameOrId;

    if (!hostnameOrId.match(/^[a-f0-9-]{36}$/i)) {
      const existing = await getCustomHostname(hostnameOrId);
      if (!existing) {
        return null;
      }
      hostnameId = existing.id;
    }

    const response = await cloudflareRequest<CustomHostname>(
      `/zones/${zoneId}/custom_hostnames/${hostnameId}`,
      'PATCH',
      {
        ssl: {
          method: 'http',
          type: 'dv',
          custom_origin_server: 'proxy.lowfy.com.br',
          custom_origin_sni: 'proxy.lowfy.com.br'
        }
      }
    );

    if (response.success && response.result) {
      return response.result;
    }

    return null;
  } catch (error) {
    logger.error('Error refreshing custom hostname validation:', error);
    return null;
  }
}

export function getStatusDescription(status: string): {
  label: string;
  color: 'green' | 'yellow' | 'red' | 'blue';
  description: string;
} {
  const statuses: Record<string, { label: string; color: 'green' | 'yellow' | 'red' | 'blue'; description: string }> = {
    'active': {
      label: 'Ativo',
      color: 'green',
      description: 'Domínio funcionando com SSL'
    },
    'pending': {
      label: 'Pendente',
      color: 'yellow',
      description: 'Aguardando configuração do CNAME'
    },
    'pending_validation': {
      label: 'Validando',
      color: 'yellow',
      description: 'Validando certificado SSL'
    },
    'pending_issuance': {
      label: 'Emitindo SSL',
      color: 'yellow',
      description: 'Emitindo certificado SSL'
    },
    'pending_deployment': {
      label: 'Implantando',
      color: 'blue',
      description: 'Implantando certificado na edge'
    },
    'blocked': {
      label: 'Bloqueado',
      color: 'red',
      description: 'Validação falhou - verifique o CNAME'
    },
    'deleted': {
      label: 'Removido',
      color: 'red',
      description: 'Domínio foi removido'
    }
  };

  return statuses[status] || {
    label: status,
    color: 'yellow',
    description: 'Status desconhecido'
  };
}
