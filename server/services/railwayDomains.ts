import { logger } from "../utils/logger";

/**
 * Integração com a API do Railway (GraphQL) para conectar domínios próprios dos
 * clientes automaticamente: adiciona o domínio ao serviço, o Railway emite o SSL
 * e devolve os registros DNS que o cliente deve configurar.
 *
 * Requer apenas RAILWAY_API_TOKEN no ambiente (os IDs têm default do projeto atual).
 */
const RW_API = process.env.RAILWAY_API_URL || "https://backboard.railway.com/graphql/v2";
const TOKEN = process.env.RAILWAY_API_TOKEN || "";
const PROJECT_ID = process.env.RAILWAY_PROJECT_ID || "c6c29147-e6a7-48ae-bf08-e350238c8ace";
const SERVICE_ID = process.env.RAILWAY_SERVICE_ID || "7f94a4e1-181c-4705-8655-40894105d4f8";
const ENV_ID = process.env.RAILWAY_ENVIRONMENT_ID || "88d0ea35-8eb4-4039-9973-fe8c8f928c88";

export interface DnsRecord { hostlabel?: string; fqdn?: string; recordType?: string; requiredValue?: string; currentValue?: string; status?: string; purpose?: string; zone?: string; }
export interface RailwayDomain { id: string; domain: string; dnsRecords: DnsRecord[]; }

export function railwayConfigured(): boolean { return !!TOKEN; }

async function gql<T = any>(query: string, variables: any): Promise<T> {
  const r = await fetch(RW_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ query, variables }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (j.errors?.length) throw new Error(j.errors.map((e: any) => e.message).join("; "));
  if (!r.ok) throw new Error(`Railway API ${r.status}`);
  return j.data;
}

const DNS_FIELDS = `status { dnsRecords { hostlabel fqdn recordType requiredValue currentValue status purpose zone } }`;

/** Adiciona o domínio ao serviço; o Railway emite o SSL e retorna os registros DNS. */
export async function addCustomDomain(domain: string): Promise<RailwayDomain> {
  const data = await gql(
    `mutation($input: CustomDomainCreateInput!){ customDomainCreate(input:$input){ id domain ${DNS_FIELDS} } }`,
    { input: { domain, projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: SERVICE_ID } },
  );
  const c = data.customDomainCreate;
  return { id: c.id, domain: c.domain, dnsRecords: c.status?.dnsRecords || [] };
}

export async function deleteCustomDomain(id: string): Promise<void> {
  await gql(`mutation($id: String!){ customDomainDelete(id:$id) }`, { id }).catch((e) => logger.warn(`[Railway] delete domain: ${e?.message}`));
}

/** Consulta o status (DNS/cert) de um domínio já adicionado. */
export async function getDomainStatus(domain: string): Promise<RailwayDomain | null> {
  try {
    const data = await gql(
      `query($p:String!,$e:String!,$s:String!){ domains(projectId:$p, environmentId:$e, serviceId:$s){ customDomains { id domain ${DNS_FIELDS} } } }`,
      { p: PROJECT_ID, e: ENV_ID, s: SERVICE_ID },
    );
    const list = data.domains?.customDomains || [];
    const c = list.find((x: any) => (x.domain || "").toLowerCase() === domain.toLowerCase());
    return c ? { id: c.id, domain: c.domain, dnsRecords: c.status?.dnsRecords || [] } : null;
  } catch (e: any) { logger.warn(`[Railway] status: ${e?.message}`); return null; }
}
