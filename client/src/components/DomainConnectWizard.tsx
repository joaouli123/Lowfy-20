import { useState, useEffect, useRef, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Globe, Copy, Check, Loader2, ShieldCheck, AlertTriangle, Trash2, ExternalLink, RefreshCw,
} from 'lucide-react';

interface DnsRecord {
  purpose: 'routing' | 'ssl_validation' | 'ownership';
  type: 'CNAME' | 'TXT' | 'A';
  name: string;
  value: string;
  note?: string;
}

interface DomainStatus {
  found?: boolean;
  status?: string;
  statusLabel?: string;
  active?: boolean;
  ssl?: { status?: string; statusLabel?: string };
  dns?: { domain: string; isApex: boolean; isWww: boolean; routingTarget: string; records: DnsRecord[] };
}

interface Props {
  pageName: string;
  pageType: 'cloned' | 'presell';
  currentDomain?: string | null;
  onDomainChange?: (domain: string | null) => void;
}

const PURPOSE_LABEL: Record<string, string> = {
  routing: 'Roteamento (aponta o domínio para sua página)',
  ssl_validation: 'Validação do SSL (certificado HTTPS)',
  ownership: 'Comprovação de propriedade',
};

function normalizeDomainInput(raw: string): string {
  return raw.trim().replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
}

export function DomainConnectWizard({ pageName, pageType, currentDomain, onDomainChange }: Props) {
  const { toast } = useToast();
  const [domain, setDomain] = useState(currentDomain || '');
  const [connectedDomain, setConnectedDomain] = useState<string | null>(currentDomain || null);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<DomainStatus | null>(null);
  const [polling, setPolling] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isActive = status?.active === true || status?.status === 'active';

  const fetchStatus = useCallback(async (d: string) => {
    try {
      const res = await apiRequest('GET', `/api/custom-domain-status/${encodeURIComponent(d)}`);
      const data = await res.json();
      setStatus(data);
      return data as DomainStatus;
    } catch {
      return null;
    }
  }, []);

  // Polling automático enquanto o domínio não está ativo
  useEffect(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (!connectedDomain || isActive) { setPolling(false); return; }
    setPolling(true);
    fetchStatus(connectedDomain);
    pollRef.current = setInterval(() => fetchStatus(connectedDomain), 8000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [connectedDomain, isActive, fetchStatus]);

  const handleConnect = async () => {
    const d = normalizeDomainInput(domain);
    if (!d || !d.includes('.')) {
      toast({ title: 'Domínio inválido', description: 'Digite um domínio válido, ex.: meusite.com.br', variant: 'destructive' });
      return;
    }
    setConnecting(true);
    try {
      const endpoint = pageType === 'presell'
        ? `/api/presell/configure-domain/${encodeURIComponent(pageName)}`
        : `/api/cloned-page/set-domain`;
      const body = pageType === 'presell' ? { customDomain: d } : { pageName, customDomain: d };
      const res = await apiRequest('POST', endpoint, body);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Falha ao conectar domínio');
      setConnectedDomain(d);
      onDomainChange?.(d);
      toast({ title: 'Domínio registrado!', description: 'Agora configure os registros DNS abaixo no seu provedor.' });
    } catch (e: any) {
      toast({ title: 'Não foi possível conectar', description: e?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setConnecting(false);
    }
  };

  const handleRemove = async () => {
    setConnecting(true);
    try {
      const endpoint = pageType === 'presell'
        ? `/api/presell/configure-domain/${encodeURIComponent(pageName)}`
        : `/api/cloned-page/set-domain`;
      const body = pageType === 'presell' ? { customDomain: '' } : { pageName, customDomain: '' };
      await apiRequest('POST', endpoint, body);
      setConnectedDomain(null);
      setStatus(null);
      setDomain('');
      onDomainChange?.(null);
      toast({ title: 'Domínio removido' });
    } catch (e: any) {
      toast({ title: 'Erro ao remover', description: e?.message, variant: 'destructive' });
    } finally {
      setConnecting(false);
    }
  };

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    });
  };

  const records = status?.dns?.records || [];
  const isApex = status?.dns?.isApex;

  // ---------- Estado: nenhum domínio conectado ----------
  if (!connectedDomain) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Globe className="w-5 h-5 text-primary" />
          <h3 className="text-base font-semibold">Conectar domínio próprio</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Use seu próprio domínio (ex.: <span className="font-medium">meusite.com.br</span>) com HTTPS automático.
        </p>
        <div className="flex gap-2">
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="meusite.com.br ou www.meusite.com.br"
            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <Button onClick={handleConnect} disabled={connecting}>
            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Conectar'}
          </Button>
        </div>
      </div>
    );
  }

  // ---------- Estado: domínio conectado (instruções + status) ----------
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="w-5 h-5 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold truncate">{connectedDomain}</p>
            <p className="text-xs text-muted-foreground">{pageType === 'presell' ? 'Pré-venda' : 'Página clonada'} · {pageName}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRemove} disabled={connecting} className="text-destructive shrink-0">
          <Trash2 className="w-4 h-4 mr-1" /> Remover
        </Button>
      </div>

      {/* Banner de status */}
      {isActive ? (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 px-3 py-2.5">
          <ShieldCheck className="w-5 h-5 text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800 dark:text-green-300">Domínio ativo com SSL</p>
            <a href={`https://${connectedDomain}`} target="_blank" rel="noreferrer" className="text-xs text-green-700 dark:text-green-400 inline-flex items-center gap-1 hover:underline">
              Abrir {connectedDomain} <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-3 py-2.5">
          {polling ? <Loader2 className="w-5 h-5 text-amber-600 animate-spin" /> : <RefreshCw className="w-5 h-5 text-amber-600" />}
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {status?.statusLabel || 'Aguardando configuração do DNS'}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Verificando automaticamente a cada 8s. Após adicionar os registros, a ativação leva de alguns minutos a algumas horas.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => connectedDomain && fetchStatus(connectedDomain)}>
            Verificar agora
          </Button>
        </div>
      )}

      {/* Instruções de DNS */}
      {!isActive && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Adicione estes registros no seu provedor de DNS:</p>
          {isApex && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <span>Você usou o domínio raiz. Se o provedor não permitir CNAME na raiz, use “CNAME flattening”/ALIAS, ou conecte <span className="font-medium">www.{connectedDomain}</span> e redirecione a raiz.</span>
            </div>
          )}
          {records.length === 0 && polling && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando registros DNS…
            </div>
          )}
          {records.map((r, i) => (
            <div key={i} className="rounded-lg border border-border overflow-hidden">
              <div className="px-3 py-1.5 bg-muted/50 text-xs font-medium text-muted-foreground border-b border-border">
                {PURPOSE_LABEL[r.purpose] || r.purpose}
              </div>
              <div className="p-3 space-y-2">
                <div className="grid grid-cols-[64px_1fr] gap-x-3 gap-y-2 items-center text-sm">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Tipo</span>
                  <span className="font-mono font-medium">{r.type}</span>

                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Nome</span>
                  <CopyField value={r.name} copied={copiedKey === `n${i}`} onCopy={() => copy(`n${i}`, r.name)} />

                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Valor</span>
                  <CopyField value={r.value} copied={copiedKey === `v${i}`} onCopy={() => copy(`v${i}`, r.value)} />
                </div>
                {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CopyField({ value, copied, onCopy }: { value: string; copied: boolean; onCopy: () => void }) {
  return (
    <button
      type="button"
      onClick={onCopy}
      title="Copiar"
      className="group flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs hover:bg-muted/60 transition-colors w-full text-left"
    >
      <span className="truncate flex-1">{value}</span>
      {copied
        ? <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
        : <Copy className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />}
    </button>
  );
}

export default DomainConnectWizard;
