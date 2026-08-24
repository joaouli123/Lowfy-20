import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/PageHeader";
import { ShieldCheck, ShieldAlert, Check, X, Clock, MessageCircle, Settings2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RecoveryRequest {
  id: string;
  phone: string;
  state: string;
  goal?: string | null;
  collectedName?: string | null;
  collectedEmail?: string | null;
  collectedCpf?: string | null;
  requestedNewEmail?: string | null;
  requestedNewPhone?: string | null;
  matchedUserId?: string | null;
  matchScore?: number | null;
  matchDetails?: any;
  possessionFactor?: string | null;
  riskFlags?: string[] | null;
  conversation?: Array<{ role: string; text: string; at: string }> | null;
  decision?: string | null;
  decisionReason?: string | null;
  createdAt: string;
}

interface RecoveryDetail {
  request: RecoveryRequest;
  matchedUser: {
    id: string; name: string; email: string; phone?: string | null;
    phoneVerified?: boolean; accountStatus?: string; subscriptionStatus?: string; createdAt?: string;
  } | null;
  changeRequests: Array<{ id: string; field: string; newValue: string; status: string; applyAfter?: string | null }>;
  phoneHistory: Array<{ id: string; state: string; decision?: string | null; createdAt: string }>;
}

interface RecoveryConfig {
  enabled: boolean;
  autoApproveEnabled: boolean;
  thresholdAuto: number;
  thresholdMin: number;
  maxSessionsPerDay: number;
  allowWhatsappPassword: boolean;
  tempPasswordTtlMinutes: number;
}

const maskPhone = (phone: string) => {
  const d = phone.replace(/\D/g, '');
  return d.length >= 8 ? `${d.slice(0, 4)}****${d.slice(-2)}` : phone;
};

const stateBadge = (state: string) => {
  switch (state) {
    case 'awaiting_admin': return <Badge variant="destructive" className="gap-1"><Clock className="h-3 w-3" /> Aguardando análise</Badge>;
    case 'collecting': return <Badge variant="default" className="bg-blue-500 hover:bg-blue-600 gap-1"><MessageCircle className="h-3 w-3" /> Em conversa</Badge>;
    case 'awaiting_email_otp': return <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600">Aguardando OTP</Badge>;
    case 'approved': return <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600">Aprovada</Badge>;
    case 'completed': return <Badge variant="secondary" className="gap-1"><Check className="h-3 w-3" /> Concluída</Badge>;
    case 'denied': return <Badge variant="destructive">Negada</Badge>;
    case 'expired': return <Badge variant="outline">Expirada</Badge>;
    case 'cancelled': return <Badge variant="outline">Cancelada</Badge>;
    default: return <Badge variant="outline">{state}</Badge>;
  }
};

const goalLabel = (goal?: string | null) => {
  switch (goal) {
    case 'reset_password': return 'Redefinir senha';
    case 'change_email': return 'Trocar e-mail';
    case 'change_phone': return 'Trocar telefone';
    case 'combo': return 'Múltiplas ações';
    default: return '—';
  }
};

const scoreBadge = (score?: number | null) => {
  const s = score ?? 0;
  if (s >= 55) return <Badge className="bg-emerald-500 hover:bg-emerald-600">{s}</Badge>;
  if (s >= 40) return <Badge className="bg-yellow-500 hover:bg-yellow-600">{s}</Badge>;
  return <Badge variant="destructive">{s}</Badge>;
};

const MatchIcon = ({ ok }: { ok: boolean }) => ok
  ? <Check className="h-4 w-4 text-emerald-500 inline" />
  : <X className="h-4 w-4 text-red-500 inline" />;

export default function AdminAccountRecovery() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ requests: RecoveryRequest[]; counts: Record<string, number> }>({
    queryKey: ['/api/admin/account-recovery'],
    refetchInterval: 15000,
  });

  const { data: detail } = useQuery<RecoveryDetail>({
    queryKey: ['/api/admin/account-recovery', selectedId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/admin/account-recovery/${selectedId}`);
      return res.json();
    },
    enabled: !!selectedId,
  });

  const { data: config } = useQuery<RecoveryConfig>({
    queryKey: ['/api/admin/account-recovery/config'],
  });

  const updateConfig = useMutation({
    mutationFn: async (patch: Partial<RecoveryConfig>) => {
      const res = await apiRequest('PUT', '/api/admin/account-recovery/config', patch);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/account-recovery/config'] });
      toast({ title: 'Configuração atualizada' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/admin/account-recovery/${id}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/account-recovery'] });
      toast({ title: 'Solicitação aprovada', description: 'O desfecho foi enviado ao usuário pelo WhatsApp.' });
      setSelectedId(null);
    },
    onError: (e: any) => toast({ title: 'Erro ao aprovar', description: e.message, variant: 'destructive' }),
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/admin/account-recovery/${id}/reject`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/account-recovery'] });
      toast({ title: 'Solicitação rejeitada', description: 'O usuário recebeu uma resposta genérica.' });
      setSelectedId(null);
    },
    onError: (e: any) => toast({ title: 'Erro ao rejeitar', description: e.message, variant: 'destructive' }),
  });

  const requests = data?.requests || [];
  const counts = data?.counts || {};
  const pending = requests.filter(r => r.state === 'awaiting_admin');

  const renderTable = (rows: RecoveryRequest[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Telefone</TableHead>
          <TableHead>Nome declarado</TableHead>
          <TableHead>Objetivo</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Posse</TableHead>
          <TableHead>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && (
          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma solicitação</TableCell></TableRow>
        )}
        {rows.map(r => (
          <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelectedId(r.id)} data-testid={`row-recovery-${r.id}`}>
            <TableCell className="whitespace-nowrap">{format(new Date(r.createdAt), 'dd/MM HH:mm', { locale: ptBR })}</TableCell>
            <TableCell>{maskPhone(r.phone)}</TableCell>
            <TableCell>{r.collectedName || '—'}</TableCell>
            <TableCell>{goalLabel(r.goal)}</TableCell>
            <TableCell>{scoreBadge(r.matchScore)}</TableCell>
            <TableCell>
              {r.possessionFactor === 'whatsapp_phone' && <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3 w-3" /> WhatsApp</Badge>}
              {r.possessionFactor === 'email_otp' && <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3 w-3" /> E-mail OTP</Badge>}
              {(!r.possessionFactor || r.possessionFactor === 'none') && <Badge variant="outline" className="gap-1"><ShieldAlert className="h-3 w-3" /> Nenhuma</Badge>}
            </TableCell>
            <TableCell>{stateBadge(r.state)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      <PageHeader
        title="Recuperação de Conta"
        description="Solicitações do agente de recuperação via WhatsApp"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Aguardando análise</CardTitle></CardHeader>
          <CardContent><span className="text-2xl font-bold text-red-500">{counts['awaiting_admin'] || 0}</span></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Em conversa</CardTitle></CardHeader>
          <CardContent><span className="text-2xl font-bold">{(counts['collecting'] || 0) + (counts['awaiting_email_otp'] || 0)}</span></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Concluídas</CardTitle></CardHeader>
          <CardContent><span className="text-2xl font-bold text-emerald-600">{counts['completed'] || 0}</span></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Negadas</CardTitle></CardHeader>
          <CardContent><span className="text-2xl font-bold">{counts['denied'] || 0}</span></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-recovery-pending">
            Pendentes {pending.length > 0 && <Badge variant="destructive" className="ml-2">{pending.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-recovery-all">Todas</TabsTrigger>
          <TabsTrigger value="config" data-testid="tab-recovery-config"><Settings2 className="h-4 w-4 mr-1" /> Config</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardContent className="pt-6">
              {isLoading ? <div className="animate-pulse h-32 bg-muted rounded" /> : renderTable(pending)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardContent className="pt-6">
              {isLoading ? <div className="animate-pulse h-32 bg-muted rounded" /> : renderTable(requests)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          {config && (
            <Card>
              <CardHeader>
                <CardTitle>Configurações do agente</CardTitle>
                <CardDescription>Kill-switch, limites e thresholds de aprovação automática</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 max-w-md">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Agente ativo</Label>
                    <p className="text-sm text-muted-foreground">Desligar interrompe novos atendimentos imediatamente</p>
                  </div>
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(v) => updateConfig.mutate({ enabled: v })}
                    data-testid="switch-recovery-enabled"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Aprovação automática</Label>
                    <p className="text-sm text-muted-foreground">Só com posse forte (mensagem do próprio número cadastrado)</p>
                  </div>
                  <Switch
                    checked={config.autoApproveEnabled}
                    onCheckedChange={(v) => updateConfig.mutate({ autoApproveEnabled: v })}
                    data-testid="switch-recovery-auto"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Score auto</Label>
                    <Input type="number" defaultValue={config.thresholdAuto}
                      onBlur={(e) => { const v = parseInt(e.target.value); if (Number.isInteger(v) && v !== config.thresholdAuto) updateConfig.mutate({ thresholdAuto: v }); }} />
                  </div>
                  <div>
                    <Label>Score mínimo</Label>
                    <Input type="number" defaultValue={config.thresholdMin}
                      onBlur={(e) => { const v = parseInt(e.target.value); if (Number.isInteger(v) && v !== config.thresholdMin) updateConfig.mutate({ thresholdMin: v }); }} />
                  </div>
                  <div>
                    <Label>Sessões/dia</Label>
                    <Input type="number" defaultValue={config.maxSessionsPerDay}
                      onBlur={(e) => { const v = parseInt(e.target.value); if (Number.isInteger(v) && v !== config.maxSessionsPerDay) updateConfig.mutate({ maxSessionsPerDay: v }); }} />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t pt-4">
                  <div>
                    <Label>Senha provisória pelo WhatsApp</Label>
                    <p className="text-sm text-muted-foreground">
                      Último recurso quando o link de redefinição não chega. Expira sozinha,
                      obriga trocar a senha no primeiro login e derruba todas as sessões.
                    </p>
                  </div>
                  <Switch
                    checked={config.allowWhatsappPassword}
                    onCheckedChange={(v) => updateConfig.mutate({ allowWhatsappPassword: v })}
                    data-testid="switch-recovery-temp-password"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Validade da senha provisória (min)</Label>
                    <Input type="number" defaultValue={config.tempPasswordTtlMinutes}
                      onBlur={(e) => { const v = parseInt(e.target.value); if (Number.isInteger(v) && v !== config.tempPasswordTtlMinutes) updateConfig.mutate({ tempPasswordTtlMinutes: v }); }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog de detalhe */}
      <Dialog open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Solicitação de recuperação</DialogTitle>
            <DialogDescription>
              {detail?.request && `${maskPhone(detail.request.phone)} · ${format(new Date(detail.request.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`}
            </DialogDescription>
          </DialogHeader>

          {detail && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {stateBadge(detail.request.state)}
                <Badge variant="outline">{goalLabel(detail.request.goal)}</Badge>
                {scoreBadge(detail.request.matchScore)}
                {(detail.request.riskFlags || []).map(f => (
                  <Badge key={f} variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" /> {f}</Badge>
                ))}
              </div>

              {detail.request.decisionReason && (
                <p className="text-sm text-muted-foreground">Motivo interno: {detail.request.decisionReason}</p>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Declarado vs. cadastro</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Nome:</span>
                      <span className="text-right">{detail.request.collectedName || '—'} {detail.request.matchDetails && <MatchIcon ok={(detail.request.matchDetails.nameSimilarity || 0) >= 0.7} />}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">E-mail:</span>
                      <span className="text-right break-all">{detail.request.collectedEmail || '—'} {detail.request.matchDetails && <MatchIcon ok={!!detail.request.matchDetails.emailMatch} />}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">CPF:</span>
                      <span>{detail.request.collectedCpf ? `${detail.request.collectedCpf.slice(0, 3)}.***.***-${detail.request.collectedCpf.slice(-2)}` : '—'} {detail.request.matchDetails && <MatchIcon ok={!!detail.request.matchDetails.cpfMatch} />}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Telefone:</span>
                      <span>{maskPhone(detail.request.phone)} {detail.request.matchDetails && <MatchIcon ok={!!detail.request.matchDetails.phoneMatch} />}</span>
                    </div>
                    {detail.request.matchDetails?.historyMatch !== undefined && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Histórico de compras:</span>
                        <MatchIcon ok={!!detail.request.matchDetails.historyMatch} />
                      </div>
                    )}
                    {detail.request.requestedNewEmail && (
                      <div className="flex justify-between gap-2 pt-2 border-t">
                        <span className="text-muted-foreground">Novo e-mail pedido:</span>
                        <span className="break-all font-medium">{detail.request.requestedNewEmail}</span>
                      </div>
                    )}
                    {detail.request.requestedNewPhone && (
                      <div className="flex justify-between gap-2 pt-2 border-t">
                        <span className="text-muted-foreground">Novo telefone pedido:</span>
                        <span className="font-medium">{detail.request.requestedNewPhone}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Conta associada</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {detail.matchedUser ? (
                      <>
                        <div className="flex justify-between gap-2"><span className="text-muted-foreground">Nome:</span><span>{detail.matchedUser.name}</span></div>
                        <div className="flex justify-between gap-2"><span className="text-muted-foreground">E-mail:</span><span className="break-all">{detail.matchedUser.email}</span></div>
                        <div className="flex justify-between gap-2"><span className="text-muted-foreground">Telefone:</span><span>{detail.matchedUser.phone || '—'} {detail.matchedUser.phoneVerified ? '(verificado)' : ''}</span></div>
                        <div className="flex justify-between gap-2"><span className="text-muted-foreground">Status:</span><span>{detail.matchedUser.accountStatus} / {detail.matchedUser.subscriptionStatus}</span></div>
                      </>
                    ) : (
                      <p className="text-muted-foreground">Nenhum usuário identificado com segurança.</p>
                    )}
                    {detail.phoneHistory.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-muted-foreground mb-1">Histórico deste número:</p>
                        {detail.phoneHistory.map(h => (
                          <p key={h.id} className="text-xs">{format(new Date(h.createdAt), 'dd/MM HH:mm')} — {h.state}{h.decision ? ` (${h.decision})` : ''}</p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Conversa</CardTitle></CardHeader>
                <CardContent>
                  <ScrollArea className="h-64 pr-4">
                    <div className="space-y-2">
                      {(detail.request.conversation || []).map((m, i) => (
                        <div key={i} className={`text-sm p-2 rounded-lg max-w-[85%] ${m.role === 'user' ? 'bg-muted' : 'bg-emerald-50 dark:bg-emerald-950 ml-auto'}`}>
                          <p className="text-xs text-muted-foreground mb-0.5">{m.role === 'user' ? 'Usuário' : 'Agente'} · {format(new Date(m.at), 'HH:mm')}</p>
                          <p className="whitespace-pre-wrap break-words">{m.text}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {detail.request.state === 'awaiting_admin' && (
                <div className="flex gap-3 justify-end">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" data-testid="button-recovery-reject">Rejeitar</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Rejeitar solicitação?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O solicitante receberá uma resposta genérica no WhatsApp (sem o motivo). Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => reject.mutate(detail.request.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Confirmar rejeição
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button disabled={!detail.matchedUser} data-testid="button-recovery-approve" className="bg-emerald-600 hover:bg-emerald-700">
                        Aprovar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Aprovar recuperação?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {detail.request.goal === 'change_email' && detail.request.requestedNewEmail
                            ? `O e-mail da conta de ${detail.matchedUser?.name} será alterado para ${detail.request.requestedNewEmail}.`
                            : detail.request.goal === 'change_phone' && detail.request.requestedNewPhone
                            ? `O telefone da conta de ${detail.matchedUser?.name} será alterado para ${detail.request.requestedNewPhone}.`
                            : `Um link de redefinição de senha (30 min) será enviado pelo WhatsApp para ${maskPhone(detail.request.phone)}.`}
                          {' '}Confirme que os dados conferem com o cadastro.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => approve.mutate(detail.request.id)} className="bg-emerald-600 hover:bg-emerald-700">
                          Confirmar aprovação
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
