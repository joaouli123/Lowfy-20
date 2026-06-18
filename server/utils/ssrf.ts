import http from 'http';
import https from 'https';
import dns from 'dns';
import net from 'net';

/**
 * Proteção contra SSRF (Server-Side Request Forgery).
 *
 * Bloqueia requisições para endereços internos/privados (loopback, link-local,
 * faixas RFC1918, metadata de cloud, sidecar Replit, etc.). Cobre redirects e
 * DNS-rebinding usando um `lookup` customizado nos agentes HTTP/HTTPS.
 */

function ipToLong(ip: string): number {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
}

function inRange(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split('/');
  const bits = parseInt(bitsStr, 10);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipToLong(ip) & mask) === (ipToLong(range) & mask);
}

const BLOCKED_V4_RANGES = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',      // loopback
  '169.254.0.0/16',   // link-local (inclui 169.254.169.254 metadata)
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '224.0.0.0/4',      // multicast
  '240.0.0.0/4',      // reserved
];

export function isPrivateIp(ip: string): boolean {
  if (!ip) return true;

  // Normaliza IPv4 mapeado em IPv6 (ex.: ::ffff:127.0.0.1)
  const v4mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4mapped) ip = v4mapped[1];

  if (net.isIPv4(ip)) {
    return BLOCKED_V4_RANGES.some((range) => inRange(ip, range));
  }

  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;        // loopback / unspecified
    if (lower.startsWith('fe80')) return true;                 // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local
    return false;
  }

  // Não conseguiu interpretar como IP → bloquear por segurança
  return true;
}

/**
 * `lookup` customizado para agentes HTTP(S): resolve o hostname e rejeita a
 * conexão se QUALQUER endereço resolvido for privado/interno. Aplica-se a cada
 * hop de redirect, prevenindo DNS-rebinding.
 */
const guardedLookup: typeof dns.lookup = ((hostname: string, options: any, callback: any) => {
  const cb = typeof options === 'function' ? options : callback;
  const opts = typeof options === 'function' ? {} : (options || {});
  // IMPORTANTE: honrar a opção `all` que o agente HTTP do Node passa.
  // O agente moderno chama o lookup com { all: true } (Happy Eyeballs) e espera
  // um ARRAY de volta. Devolver um único endereço quebra com "Invalid IP address".
  const wantsAll = opts.all === true;

  dns.lookup(hostname, { ...opts, all: true }, (err: any, addresses: any) => {
    if (err) return cb(err);
    const list = Array.isArray(addresses)
      ? addresses
      : (addresses ? [{ address: addresses, family: opts.family || 0 }] : []);
    if (list.length === 0) {
      return cb(new Error(`Não foi possível resolver o host: ${hostname}`));
    }
    for (const entry of list) {
      if (isPrivateIp(entry.address)) {
        return cb(new Error(`SSRF bloqueado: endereço interno não permitido (${entry.address})`));
      }
    }
    if (wantsAll) {
      return cb(null, list);
    }
    const first = list[0];
    cb(null, first.address, first.family);
  }) as any;
}) as any;

export const ssrfSafeHttpAgent = new http.Agent({ lookup: guardedLookup });
export const ssrfSafeHttpsAgent = new https.Agent({ lookup: guardedLookup });

/**
 * Valida (de forma síncrona, sobre a URL) o esquema e hostname literal antes de
 * disparar a requisição. A checagem de IP resolvido acontece no `lookup`.
 * Lança Error se a URL for inválida ou claramente interna.
 */
export function assertSafePublicUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('URL inválida');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Esquema não permitido (apenas http/https)');
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  // Bloqueia hostnames internos óbvios sem depender de DNS
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    host.endsWith('.local') ||
    host === 'metadata.google.internal'
  ) {
    throw new Error('Host interno não permitido');
  }

  // Se o host já for um IP literal, validar imediatamente
  if (net.isIP(host) && isPrivateIp(host)) {
    throw new Error('Endereço interno não permitido');
  }

  return url;
}

/**
 * Opções padrão de axios para requisições a URLs controladas pelo usuário.
 */
export function ssrfSafeAxiosOptions(extra: Record<string, any> = {}) {
  return {
    httpAgent: ssrfSafeHttpAgent,
    httpsAgent: ssrfSafeHttpsAgent,
    maxRedirects: 3,
    // Limite de tamanho para evitar exaustão de memória
    maxContentLength: 25 * 1024 * 1024,
    ...extra,
  };
}
