import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  MessageCircle, 
  QrCode, 
  Wifi, 
  WifiOff, 
  Phone, 
  Send, 
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Smartphone,
  Activity,
  TrendingUp,
  Clock,
  Zap,
  Megaphone,
  Plus,
  Play,
  Pause,
  Square,
  Trash2,
  Upload,
  Image,
  Video,
  Music,
  Users,
  UserMinus,
  Eye,
  Edit,
  MoreVertical,
  FileText
} from "lucide-react";

interface WhatsAppStatus {
  connected: boolean;
  qrCode: string | null;
  phoneNumber: string | null;
  lastConnected: string | null;
  connecting: boolean;
  error: string | null;
}

interface QueueMetrics {
  queue: {
    length: number;
    totalEnqueued: number;
    totalSent: number;
    totalFailed: number;
    totalRetries: number;
    currentQueueLength: number;
    lastSentAt: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
    circuitBreakerOpen: boolean;
    messagesPerMinute: number;
  };
  connection: {
    connected: boolean;
    phoneNumber: string | null;
    lastConnected: string | null;
  };
}

interface WhatsappCampaign {
  id: string;
  title: string;
  message: string;
  mediaType: string | null;
  mediaUrl: string | null;
  mediaFileName: string | null;
  intervalMinSec: number;
  intervalMaxSec: number;
  optOutKeyword: string;
  optOutMessage: string | null;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
  totalRecipients: number;
  sentCount: number;
  errorCount: number;
  optOutCount: number;
  skippedCount: number;
  currentRecipientIndex: number;
  startedAt: string | null;
  completedAt: string | null;
  pausedAt: string | null;
  createdAt: string;
  stats?: {
    total: number;
    pending: number;
    sent: number;
    error: number;
    optedOut: number;
    skipped: number;
  };
}

interface WhatsappOptOut {
  id: string;
  phone: string;
  userName: string | null;
  keyword: string | null;
  sourceCampaignId: string | null;
  optedOutAt: string;
}

interface EligibleRecipient {
  recipientId?: string;
  phone: string;
  userName: string | null;
  userId?: string;
}

export default function AdminWhatsApp() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("conexao");
  const [testPhone, setTestPhone] = useState("");
  const [isPolling, setIsPolling] = useState(false);
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [showCampaignDetails, setShowCampaignDetails] = useState<string | null>(null);
  const [showOptOuts, setShowOptOuts] = useState(false);
  const [showSelectRecipients, setShowSelectRecipients] = useState<string | null>(null);
  const [showTestMessage, setShowTestMessage] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [selectAllRecipients, setSelectAllRecipients] = useState(true);
  const [testMessagePhone, setTestMessagePhone] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [newBlockPhone, setNewBlockPhone] = useState("");
  const [newBlockName, setNewBlockName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [campaignForm, setCampaignForm] = useState({
    title: "",
    message: "",
    mediaType: null as string | null,
    mediaUrl: null as string | null,
    mediaFileName: null as string | null,
    imageUrl: null as string | null,
    imageFileName: null as string | null,
    videoUrl: null as string | null,
    videoFileName: null as string | null,
    audioUrl: null as string | null,
    audioFileName: null as string | null,
    documentUrl: null as string | null,
    documentFileName: null as string | null,
    intervalMinSec: 30,
    intervalMaxSec: 60,
    optOutKeyword: "SAIR",
    optOutMessage: "Para não receber mais mensagens de campanhas, responda: SAIR",
  });
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const { data: status, isLoading, refetch } = useQuery<WhatsAppStatus>({
    queryKey: ['/api/admin/whatsapp/status'],
    refetchInterval: isPolling ? 2000 : false,
  });

  const { data: metrics } = useQuery<QueueMetrics>({
    queryKey: ['/api/admin/whatsapp/metrics'],
    refetchInterval: 5000,
  });

  const { data: campaigns, refetch: refetchCampaigns } = useQuery<WhatsappCampaign[]>({
    queryKey: ['/api/admin/whatsapp/campaigns'],
    refetchInterval: 5000,
  });

  const { data: eligibleRecipients } = useQuery<{ count: number; recipients: EligibleRecipient[] }>({
    queryKey: ['/api/admin/whatsapp/eligible-recipients'],
  });

  const { data: optOuts, refetch: refetchOptOuts, isLoading: optOutsLoading } = useQuery<WhatsappOptOut[]>({
    queryKey: ['/api/admin/whatsapp/opt-outs'],
    enabled: activeTab === 'bloqueados',
  });

  const { data: campaignDetails, refetch: refetchCampaignDetails } = useQuery<WhatsappCampaign>({
    queryKey: ['/api/admin/whatsapp/campaigns', showCampaignDetails],
    enabled: !!showCampaignDetails,
    refetchInterval: showCampaignDetails ? 3000 : false,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/whatsapp/connect');
      return res;
    },
    onSuccess: () => {
      setIsPolling(true);
      toast({
        title: "Conectando...",
        description: "Aguarde o QR Code aparecer para escanear.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/whatsapp/status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao conectar",
        description: error.message || "Não foi possível iniciar a conexão",
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/whatsapp/disconnect');
      return res;
    },
    onSuccess: () => {
      setIsPolling(false);
      toast({
        title: "Desconectado",
        description: "WhatsApp foi desconectado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/whatsapp/status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao desconectar",
        description: error.message || "Não foi possível desconectar",
        variant: "destructive",
      });
    },
  });

  const forceReconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/whatsapp/force-reconnect');
      return res;
    },
    onSuccess: () => {
      setIsPolling(true);
      toast({
        title: "Reconectando...",
        description: "Sessão anterior foi limpa. Aguarde o QR Code aparecer.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/whatsapp/status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao reconectar",
        description: error.message || "Não foi possível forçar reconexão",
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await apiRequest('POST', '/api/admin/whatsapp/test', { phone });
      return res;
    },
    onSuccess: () => {
      toast({
        title: "Mensagem enviada!",
        description: "A mensagem de teste foi enviada com sucesso.",
      });
      setTestPhone("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar",
        description: error.message || "Não foi possível enviar a mensagem",
        variant: "destructive",
      });
    },
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (data: typeof campaignForm) => {
      const res = await apiRequest('POST', '/api/admin/whatsapp/campaigns', data);
      return res;
    },
    onSuccess: () => {
      toast({ title: "Campanha criada!", description: "A campanha foi criada com sucesso." });
      setShowCreateCampaign(false);
      setCampaignForm({
        title: "",
        message: "",
        mediaType: null,
        mediaUrl: null,
        mediaFileName: null,
        imageUrl: null,
        imageFileName: null,
        videoUrl: null,
        videoFileName: null,
        audioUrl: null,
        audioFileName: null,
        documentUrl: null,
        documentFileName: null,
        intervalMinSec: 30,
        intervalMaxSec: 60,
        optOutKeyword: "SAIR",
        optOutMessage: "Para não receber mais mensagens de campanhas, responda: SAIR",
      });
      refetchCampaigns();
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message || "Erro ao criar campanha", variant: "destructive" });
    },
  });

  const startCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/admin/whatsapp/campaigns/${id}/start`);
      return res;
    },
    onSuccess: () => {
      toast({ title: "Campanha iniciada!", description: "O envio das mensagens foi iniciado." });
      refetchCampaigns();
      if (showCampaignDetails) refetchCampaignDetails();
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message || "Erro ao iniciar campanha", variant: "destructive" });
    },
  });

  const pauseCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/admin/whatsapp/campaigns/${id}/pause`);
      return res;
    },
    onSuccess: () => {
      toast({ title: "Campanha pausada", description: "O envio foi pausado." });
      refetchCampaigns();
      if (showCampaignDetails) refetchCampaignDetails();
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message || "Erro ao pausar", variant: "destructive" });
    },
  });

  const resumeCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/admin/whatsapp/campaigns/${id}/resume`);
      return res;
    },
    onSuccess: () => {
      toast({ title: "Campanha retomada", description: "O envio foi retomado." });
      refetchCampaigns();
      if (showCampaignDetails) refetchCampaignDetails();
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message || "Erro ao retomar", variant: "destructive" });
    },
  });

  const cancelCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/admin/whatsapp/campaigns/${id}/cancel`);
      return res;
    },
    onSuccess: () => {
      toast({ title: "Campanha cancelada", description: "A campanha foi cancelada." });
      refetchCampaigns();
      setShowCampaignDetails(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message || "Erro ao cancelar", variant: "destructive" });
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/admin/whatsapp/campaigns/${id}`);
      return res;
    },
    onSuccess: () => {
      toast({ title: "Campanha excluída", description: "A campanha foi excluída." });
      refetchCampaigns();
      setShowCampaignDetails(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message || "Erro ao excluir", variant: "destructive" });
    },
  });

  const uploadMediaMutation = useMutation({
    mutationFn: async ({ file, type }: { file: File; type: 'image' | 'video' | 'audio' | 'document' }) => {
      const formData = new FormData();
      formData.append('media', file);
      formData.append('type', type);
      const res = await fetch('/api/admin/whatsapp/campaigns/upload-media', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erro ao fazer upload');
      const data = await res.json();
      return { ...data, requestedType: type };
    },
    onSuccess: (data) => {
      const urlField = `${data.requestedType}Url` as keyof typeof campaignForm;
      const fileNameField = `${data.requestedType}FileName` as keyof typeof campaignForm;
      setCampaignForm(prev => ({
        ...prev,
        [urlField]: data.url,
        [fileNameField]: data.fileName,
      }));
      const typeLabels = { image: 'Imagem', video: 'Vídeo', audio: 'Áudio', document: 'Documento' };
      toast({ title: "Upload concluído!", description: `${typeLabels[data.requestedType as keyof typeof typeLabels]} enviado com sucesso.` });
    },
    onError: (error: any) => {
      toast({ title: "Erro no upload", description: error.message || "Erro ao enviar arquivo", variant: "destructive" });
    },
  });

  const deleteOptOutMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/admin/whatsapp/opt-outs/${id}`);
      return res;
    },
    onSuccess: () => {
      toast({ title: "Exclusão removida", description: "O número foi removido da lista de bloqueio." });
      refetchOptOuts();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/whatsapp/eligible-recipients'] });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message || "Erro ao remover", variant: "destructive" });
    },
  });

  const addOptOutMutation = useMutation({
    mutationFn: async (data: { phone: string; userName?: string }) => {
      const res = await apiRequest('POST', '/api/admin/whatsapp/opt-outs', data);
      return res;
    },
    onSuccess: () => {
      toast({ title: "Número bloqueado", description: "O número foi adicionado à lista de bloqueio." });
      setNewBlockPhone("");
      setNewBlockName("");
      refetchOptOuts();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/whatsapp/eligible-recipients'] });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message || "Erro ao adicionar bloqueio", variant: "destructive" });
    },
  });

  const testCampaignMessageMutation = useMutation({
    mutationFn: async (data: { 
      phone: string; 
      message: string; 
      optOutMessage?: string | null;
      imageUrl?: string | null;
      imageFileName?: string | null;
      videoUrl?: string | null;
      videoFileName?: string | null;
      audioUrl?: string | null;
      audioFileName?: string | null;
      documentUrl?: string | null;
      documentFileName?: string | null;
      mediaType?: string | null; 
      mediaUrl?: string | null;
    }) => {
      const res = await apiRequest('POST', '/api/admin/whatsapp/campaigns/test-message', data);
      return res;
    },
    onSuccess: () => {
      toast({ title: "Mensagem enviada!", description: "A mensagem de teste foi enviada com sucesso." });
      setTestMessagePhone("");
      setShowTestMessage(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao enviar", description: error.message || "Não foi possível enviar a mensagem de teste", variant: "destructive" });
    },
  });

  const setRecipientsMutation = useMutation({
    mutationFn: async ({ campaignId, selectAll, recipientIds }: { campaignId: string; selectAll: boolean; recipientIds: string[] }) => {
      const res = await apiRequest('POST', `/api/admin/whatsapp/campaigns/${campaignId}/set-recipients`, { selectAll, recipientIds });
      return res;
    },
    onSuccess: (data: any) => {
      toast({ title: "Destinatários definidos!", description: data.message || "Destinatários foram configurados com sucesso." });
      setShowSelectRecipients(null);
      setSelectedRecipients([]);
      setSelectAllRecipients(true);
      refetchCampaigns();
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message || "Erro ao definir destinatários", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (status?.connected) {
      setIsPolling(false);
    }
  }, [status?.connected]);

  const formatPhone = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const getStatusBadge = (campaignStatus: string) => {
    switch (campaignStatus) {
      case 'draft':
        return <Badge variant="secondary"><FileText className="h-3 w-3 mr-1" />Rascunho</Badge>;
      case 'running':
        return <Badge className="bg-green-500"><Play className="h-3 w-3 mr-1" />Em execução</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-500"><Pause className="h-3 w-3 mr-1" />Pausada</Badge>;
      case 'completed':
        return <Badge className="bg-blue-500"><CheckCircle2 className="h-3 w-3 mr-1" />Concluída</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Cancelada</Badge>;
      default:
        return <Badge variant="secondary">{campaignStatus}</Badge>;
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMediaMutation.mutate({ file, type: 'image' });
  };
  
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMediaMutation.mutate({ file, type: 'video' });
  };
  
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMediaMutation.mutate({ file, type: 'audio' });
  };
  
  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMediaMutation.mutate({ file, type: 'document' });
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMediaMutation.mutate({ file, type: 'image' });
  };
  
  const clearMedia = (type: 'image' | 'video' | 'audio' | 'document') => {
    setCampaignForm(prev => ({
      ...prev,
      [`${type}Url`]: null,
      [`${type}FileName`]: null,
    }));
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-8 w-8 text-green-500" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">WhatsApp</h1>
            <p className="text-muted-foreground">Conexão e campanhas de WhatsApp</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => refetch()}
          data-testid="button-refresh-status"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="conexao" data-testid="tab-conexao">
            <Wifi className="h-4 w-4 mr-2" />
            Conexão
          </TabsTrigger>
          <TabsTrigger value="campanhas" data-testid="tab-campanhas">
            <Megaphone className="h-4 w-4 mr-2" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="bloqueados" data-testid="tab-bloqueados">
            <UserMinus className="h-4 w-4 mr-2" />
            Bloqueados {optOuts?.length ? `(${optOuts.length})` : ''}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conexao" className="space-y-6 mt-6">
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Na Fila</p>
                      <p className="text-2xl font-bold" data-testid="text-queue-length">{metrics.queue.length}</p>
                    </div>
                    <Clock className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Enviadas</p>
                      <p className="text-2xl font-bold text-green-600" data-testid="text-total-sent">{metrics.queue.totalSent}</p>
                    </div>
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Falharam</p>
                      <p className="text-2xl font-bold text-red-600" data-testid="text-total-failed">{metrics.queue.totalFailed}</p>
                    </div>
                    <XCircle className="h-8 w-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Msgs/min</p>
                      <p className="text-2xl font-bold" data-testid="text-msgs-per-minute">{metrics.queue.messagesPerMinute}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {metrics?.queue.circuitBreakerOpen && (
            <Alert variant="destructive">
              <Zap className="h-4 w-4" />
              <AlertTitle>Circuit Breaker Ativo</AlertTitle>
              <AlertDescription>
                O sistema detectou muitas falhas consecutivas. Os envios estão pausados temporariamente.
                {metrics.queue.lastError && <div className="mt-2 text-sm">Último erro: {metrics.queue.lastError}</div>}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  Conexão WhatsApp
                </CardTitle>
                <CardDescription>
                  Escaneie o QR Code com seu WhatsApp para conectar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${status?.connected ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    {status?.connected ? (
                      <Wifi className="h-6 w-6 text-green-500" />
                    ) : status?.connecting ? (
                      <Loader2 className="h-6 w-6 text-yellow-500 animate-spin" />
                    ) : (
                      <WifiOff className="h-6 w-6 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Status:</span>
                      {status?.connected ? (
                        <Badge variant="default" className="bg-green-500" data-testid="badge-status-connected">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Conectado
                        </Badge>
                      ) : status?.connecting ? (
                        <Badge variant="secondary" className="bg-yellow-500 text-white" data-testid="badge-status-connecting">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Conectando...
                        </Badge>
                      ) : (
                        <Badge variant="secondary" data-testid="badge-status-disconnected">
                          <XCircle className="h-3 w-3 mr-1" />
                          Desconectado
                        </Badge>
                      )}
                    </div>
                    {status?.phoneNumber && (
                      <p className="text-sm text-muted-foreground mt-1">
                        <Phone className="h-3 w-3 inline mr-1" />
                        +55 {status.phoneNumber}
                      </p>
                    )}
                  </div>
                </div>

                {status?.error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>
                      {status.error.includes('Outra sessão') ? 'Conflito de Sessão' : 'Erro'}
                    </AlertTitle>
                    <AlertDescription>
                      {status.error}
                      {status.error.includes('Outra sessão') && (
                        <div className="mt-2 text-sm">
                          <strong>Como resolver:</strong>
                          <ol className="list-decimal list-inside mt-1 space-y-1">
                            <li>Feche o WhatsApp Web em outros navegadores/computadores</li>
                            <li>No celular: Configurações → Dispositivos Vinculados → Desconecte sessões extras</li>
                            <li>Clique em "Forçar Nova Conexão" abaixo</li>
                          </ol>
                        </div>
                      )}
                      <div className="mt-3">
                        <Button
                          onClick={() => forceReconnectMutation.mutate()}
                          disabled={forceReconnectMutation.isPending}
                          variant="outline"
                          size="sm"
                          className="border-red-300 text-red-700 hover:bg-red-50"
                          data-testid="button-force-reconnect"
                        >
                          {forceReconnectMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          Forçar Nova Conexão
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {status?.qrCode && !status?.connected && (
                  <div className="flex flex-col items-center justify-center p-4 bg-white rounded-lg border">
                    <img 
                      src={status.qrCode} 
                      alt="QR Code WhatsApp" 
                      className="w-64 h-64"
                      data-testid="img-qrcode"
                    />
                    <p className="text-sm text-muted-foreground mt-4 text-center">
                      Abra o WhatsApp no seu celular, vá em{' '}
                      <strong>Configurações &gt; Dispositivos Vinculados</strong>{' '}
                      e escaneie este código
                    </p>
                  </div>
                )}

                {!status?.qrCode && !status?.connected && !status?.connecting && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Smartphone className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">
                      Clique em "Conectar" para gerar o QR Code
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  {!status?.connected ? (
                    <Button 
                      onClick={() => connectMutation.mutate()}
                      disabled={connectMutation.isPending || status?.connecting}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      data-testid="button-connect"
                    >
                      {connectMutation.isPending || status?.connecting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <QrCode className="h-4 w-4 mr-2" />
                      )}
                      {status?.connecting ? 'Aguardando QR Code...' : 'Conectar WhatsApp'}
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => disconnectMutation.mutate()}
                      disabled={disconnectMutation.isPending}
                      variant="destructive"
                      className="flex-1"
                      data-testid="button-disconnect"
                    >
                      {disconnectMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <WifiOff className="h-4 w-4 mr-2" />
                      )}
                      Desconectar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Teste de Envio
                </CardTitle>
                <CardDescription>
                  Envie uma mensagem de teste para verificar a conexão
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!status?.connected ? (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>WhatsApp não conectado</AlertTitle>
                    <AlertDescription>
                      Conecte o WhatsApp primeiro para enviar mensagens.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="test-phone">Número para teste</Label>
                      <Input
                        id="test-phone"
                        placeholder="(11) 99999-9999"
                        value={testPhone}
                        onChange={(e) => setTestPhone(formatPhone(e.target.value))}
                        data-testid="input-test-phone"
                      />
                    </div>

                    <Button 
                      onClick={() => testMutation.mutate(testPhone.replace(/\D/g, ''))}
                      disabled={testMutation.isPending || testPhone.replace(/\D/g, '').length < 10}
                      className="w-full"
                      data-testid="button-send-test"
                    >
                      {testMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Enviar Mensagem de Teste
                    </Button>
                  </>
                )}

                <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertTitle className="text-yellow-700 dark:text-yellow-400">Importante</AlertTitle>
                  <AlertDescription className="text-yellow-600 dark:text-yellow-300">
                    Mantenha seu celular conectado à internet para que o WhatsApp funcione.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="campanhas" className="space-y-6 mt-6">
          {!status?.connected && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>WhatsApp não conectado</AlertTitle>
              <AlertDescription>
                Conecte o WhatsApp na aba "Conexão" antes de criar campanhas.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {eligibleRecipients?.count || 0} destinatários elegíveis
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOptOuts(true)}
                data-testid="button-view-opt-outs"
              >
                <UserMinus className="h-4 w-4 mr-2" />
                Lista de Exclusões
              </Button>
            </div>
            <Button
              onClick={() => setShowCreateCampaign(true)}
              disabled={!status?.connected}
              data-testid="button-create-campaign"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Campanha
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Campanhas</CardTitle>
              <CardDescription>
                Gerencie suas campanhas de WhatsApp em massa
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!campaigns || campaigns.length === 0 ? (
                <div className="text-center py-12">
                  <Megaphone className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma campanha criada ainda</p>
                  <Button 
                    className="mt-4" 
                    onClick={() => setShowCreateCampaign(true)}
                    disabled={!status?.connected}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeira Campanha
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progresso</TableHead>
                      <TableHead>Enviadas</TableHead>
                      <TableHead>Erros</TableHead>
                      <TableHead>Exclusões</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((campaign) => (
                      <TableRow key={campaign.id} data-testid={`row-campaign-${campaign.id}`}>
                        <TableCell className="font-medium">{campaign.title}</TableCell>
                        <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                        <TableCell>
                          {campaign.totalRecipients > 0 ? (
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={(campaign.sentCount + campaign.errorCount + campaign.skippedCount) / campaign.totalRecipients * 100} 
                                className="w-20 h-2"
                              />
                              <span className="text-xs text-muted-foreground">
                                {campaign.sentCount + campaign.errorCount + campaign.skippedCount}/{campaign.totalRecipients}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-green-600">{campaign.sentCount}</TableCell>
                        <TableCell className="text-red-600">{campaign.errorCount}</TableCell>
                        <TableCell className="text-yellow-600">{campaign.optOutCount}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowCampaignDetails(campaign.id)}
                              data-testid={`button-view-campaign-${campaign.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {campaign.status === 'draft' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setShowSelectRecipients(campaign.id)}
                                  title="Selecionar destinatários"
                                  data-testid={`button-select-recipients-${campaign.id}`}
                                >
                                  <Users className="h-4 w-4 text-blue-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => startCampaignMutation.mutate(campaign.id)}
                                  disabled={!status?.connected || campaign.totalRecipients === 0}
                                  title={campaign.totalRecipients === 0 ? "Selecione destinatários primeiro" : "Iniciar campanha"}
                                  data-testid={`button-start-campaign-${campaign.id}`}
                                >
                                  <Play className="h-4 w-4 text-green-600" />
                                </Button>
                              </>
                            )}
                            {campaign.status === 'running' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => pauseCampaignMutation.mutate(campaign.id)}
                                data-testid={`button-pause-campaign-${campaign.id}`}
                              >
                                <Pause className="h-4 w-4 text-yellow-600" />
                              </Button>
                            )}
                            {campaign.status === 'paused' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => resumeCampaignMutation.mutate(campaign.id)}
                                disabled={!status?.connected}
                                data-testid={`button-resume-campaign-${campaign.id}`}
                              >
                                <Play className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                            {(campaign.status === 'draft' || campaign.status === 'completed' || campaign.status === 'cancelled') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteCampaignMutation.mutate(campaign.id)}
                                data-testid={`button-delete-campaign-${campaign.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bloqueados" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UserMinus className="h-5 w-5" />
                    Lista de Bloqueio
                  </CardTitle>
                  <CardDescription>
                    Números que optaram por não receber campanhas. Eles serão automaticamente ignorados nos disparos.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {optOuts?.length || 0} bloqueados
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 p-4 bg-muted rounded-lg">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="new-block-phone">Telefone</Label>
                  <Input
                    id="new-block-phone"
                    placeholder="(11) 99999-9999"
                    value={newBlockPhone}
                    onChange={(e) => setNewBlockPhone(formatPhone(e.target.value))}
                    data-testid="input-new-block-phone"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="new-block-name">Nome (opcional)</Label>
                  <Input
                    id="new-block-name"
                    placeholder="Nome do contato"
                    value={newBlockName}
                    onChange={(e) => setNewBlockName(e.target.value)}
                    data-testid="input-new-block-name"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() => addOptOutMutation.mutate({ 
                      phone: newBlockPhone.replace(/\D/g, ''), 
                      userName: newBlockName || undefined 
                    })}
                    disabled={addOptOutMutation.isPending || newBlockPhone.replace(/\D/g, '').length < 10}
                    data-testid="button-add-block"
                  >
                    {addOptOutMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Bloquear
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {optOutsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : !optOuts || optOuts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserMinus className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum número bloqueado</p>
                  <p className="text-sm">Os contatos que responderem a palavra-chave de opt-out aparecerão aqui automaticamente</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="w-[80px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {optOuts.map((optOut) => (
                        <TableRow key={optOut.id} data-testid={`row-optout-${optOut.id}`}>
                          <TableCell className="font-mono">{optOut.phone}</TableCell>
                          <TableCell>{optOut.userName || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {optOut.keyword === 'MANUAL' ? 'Manual' : optOut.keyword || 'Automático'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(optOut.optedOutAt).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteOptOutMutation.mutate(optOut.id)}
                              disabled={deleteOptOutMutation.isPending}
                              data-testid={`button-unblock-${optOut.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Como funciona o bloqueio automático?</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Quando um contato responde com a palavra-chave (ex: SAIR), ele é automaticamente adicionado aqui</li>
                <li>Contatos bloqueados são automaticamente ignorados em todos os disparos de campanha</li>
                <li>Você pode adicionar ou remover contatos manualmente a qualquer momento</li>
                <li>O contador de destinatários elegíveis já exclui automaticamente os bloqueados</li>
              </ul>
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>

      <Dialog open={showCreateCampaign} onOpenChange={setShowCreateCampaign}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Campanha</DialogTitle>
            <DialogDescription>
              Crie uma campanha para enviar mensagens em massa
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="campaign-title">Título da Campanha</Label>
              <Input
                id="campaign-title"
                placeholder="Ex: Black Friday 2024"
                value={campaignForm.title}
                onChange={(e) => setCampaignForm(prev => ({ ...prev, title: e.target.value }))}
                data-testid="input-campaign-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaign-message">Mensagem</Label>
              <Textarea
                id="campaign-message"
                placeholder="Digite a mensagem que será enviada..."
                rows={4}
                value={campaignForm.message}
                onChange={(e) => setCampaignForm(prev => ({ ...prev, message: e.target.value }))}
                data-testid="input-campaign-message"
              />
            </div>

            <div className="space-y-4">
              <Label>Anexos (opcionais - pode enviar todos juntos)</Label>
              
              <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
              <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={handleVideoUpload} />
              <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={handleAudioUpload} />
              <input type="file" ref={documentInputRef} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar" onChange={handleDocumentUpload} />
              
              <div className="grid grid-cols-2 gap-3">
                <div className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Image className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Imagem</span>
                    </div>
                    {campaignForm.imageUrl && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => clearMedia('image')} data-testid="button-clear-image">
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {campaignForm.imageFileName ? (
                    <Badge variant="secondary" className="text-xs truncate max-w-full">{campaignForm.imageFileName}</Badge>
                  ) : (
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => imageInputRef.current?.click()} disabled={uploadMediaMutation.isPending} data-testid="button-upload-image">
                      <Upload className="h-3 w-3 mr-1" />Selecionar
                    </Button>
                  )}
                </div>

                <div className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Video className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium">Vídeo</span>
                    </div>
                    {campaignForm.videoUrl && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => clearMedia('video')} data-testid="button-clear-video">
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {campaignForm.videoFileName ? (
                    <Badge variant="secondary" className="text-xs truncate max-w-full">{campaignForm.videoFileName}</Badge>
                  ) : (
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => videoInputRef.current?.click()} disabled={uploadMediaMutation.isPending} data-testid="button-upload-video">
                      <Upload className="h-3 w-3 mr-1" />Selecionar
                    </Button>
                  )}
                </div>

                <div className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Music className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">Áudio</span>
                    </div>
                    {campaignForm.audioUrl && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => clearMedia('audio')} data-testid="button-clear-audio">
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {campaignForm.audioFileName ? (
                    <Badge variant="secondary" className="text-xs truncate max-w-full">{campaignForm.audioFileName}</Badge>
                  ) : (
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => audioInputRef.current?.click()} disabled={uploadMediaMutation.isPending} data-testid="button-upload-audio">
                      <Upload className="h-3 w-3 mr-1" />Selecionar
                    </Button>
                  )}
                </div>

                <div className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium">Documento</span>
                    </div>
                    {campaignForm.documentUrl && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => clearMedia('document')} data-testid="button-clear-document">
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {campaignForm.documentFileName ? (
                    <Badge variant="secondary" className="text-xs truncate max-w-full">{campaignForm.documentFileName}</Badge>
                  ) : (
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => documentInputRef.current?.click()} disabled={uploadMediaMutation.isPending} data-testid="button-upload-document">
                      <Upload className="h-3 w-3 mr-1" />Selecionar
                    </Button>
                  )}
                </div>
              </div>
              
              {uploadMediaMutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando arquivo...
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                Você pode anexar até 4 tipos de arquivo (imagem + vídeo + áudio + documento) e todos serão enviados na mesma mensagem.
              </p>
            </div>

            <div className="space-y-4">
              <Label>Intervalo entre mensagens</Label>
              <div className="px-2">
                <Slider
                  value={[campaignForm.intervalMinSec, campaignForm.intervalMaxSec]}
                  min={20}
                  max={120}
                  step={5}
                  onValueChange={(values) => setCampaignForm(prev => ({ 
                    ...prev, 
                    intervalMinSec: values[0], 
                    intervalMaxSec: values[1] 
                  }))}
                  data-testid="slider-interval"
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                {campaignForm.intervalMinSec}s - {campaignForm.intervalMaxSec}s entre cada mensagem
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="opt-out-keyword">Palavra-chave para sair</Label>
              <Input
                id="opt-out-keyword"
                placeholder="SAIR"
                value={campaignForm.optOutKeyword}
                onChange={(e) => setCampaignForm(prev => ({ ...prev, optOutKeyword: e.target.value.toUpperCase() }))}
                data-testid="input-opt-out-keyword"
              />
              <p className="text-xs text-muted-foreground">
                Se o usuário responder com essa palavra, ele será removido automaticamente
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="opt-out-message">Mensagem de descadastramento</Label>
              <Textarea
                id="opt-out-message"
                rows={2}
                value={campaignForm.optOutMessage || ""}
                onChange={(e) => setCampaignForm(prev => ({ ...prev, optOutMessage: e.target.value }))}
                data-testid="input-opt-out-message"
              />
              <p className="text-xs text-muted-foreground">
                Esta mensagem será adicionada ao final de cada mensagem
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowCreateCampaign(false)}>
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowTestMessage(true)}
              disabled={!campaignForm.message || !status?.connected}
              data-testid="button-test-message"
            >
              <Send className="h-4 w-4 mr-2" />
              Testar Mensagem
            </Button>
            <Button
              onClick={() => createCampaignMutation.mutate(campaignForm)}
              disabled={!campaignForm.title || !campaignForm.message || createCampaignMutation.isPending}
              data-testid="button-save-campaign"
            >
              {createCampaignMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Criar Campanha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showCampaignDetails} onOpenChange={() => setShowCampaignDetails(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{campaignDetails?.title}</DialogTitle>
            <DialogDescription>
              Detalhes e progresso da campanha
            </DialogDescription>
          </DialogHeader>

          {campaignDetails && (
            <div className="space-y-6 py-4">
              <div className="flex items-center justify-between">
                {getStatusBadge(campaignDetails.status)}
                <div className="flex items-center gap-2">
                  {campaignDetails.status === 'draft' && (
                    <Button
                      size="sm"
                      onClick={() => startCampaignMutation.mutate(campaignDetails.id)}
                      disabled={!status?.connected}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Iniciar
                    </Button>
                  )}
                  {campaignDetails.status === 'running' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => pauseCampaignMutation.mutate(campaignDetails.id)}
                    >
                      <Pause className="h-4 w-4 mr-2" />
                      Pausar
                    </Button>
                  )}
                  {campaignDetails.status === 'paused' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => resumeCampaignMutation.mutate(campaignDetails.id)}
                        disabled={!status?.connected}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Retomar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => cancelCampaignMutation.mutate(campaignDetails.id)}
                      >
                        <Square className="h-4 w-4 mr-2" />
                        Cancelar
                      </Button>
                    </>
                  )}
                  {campaignDetails.status === 'running' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => cancelCampaignMutation.mutate(campaignDetails.id)}
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{campaignDetails.stats?.total || campaignDetails.totalRecipients}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Enviadas</p>
                    <p className="text-2xl font-bold text-green-600">{campaignDetails.stats?.sent || campaignDetails.sentCount}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Erros</p>
                    <p className="text-2xl font-bold text-red-600">{campaignDetails.stats?.error || campaignDetails.errorCount}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Exclusões</p>
                    <p className="text-2xl font-bold text-yellow-600">{campaignDetails.stats?.optedOut || campaignDetails.optOutCount}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Pendentes</p>
                    <p className="text-2xl font-bold text-blue-600">{campaignDetails.stats?.pending || 0}</p>
                  </CardContent>
                </Card>
              </div>

              {campaignDetails.totalRecipients > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Progresso</span>
                    <span className="text-sm font-medium">
                      {Math.round(((campaignDetails.sentCount + campaignDetails.errorCount + campaignDetails.skippedCount) / campaignDetails.totalRecipients) * 100)}%
                    </span>
                  </div>
                  <Progress 
                    value={((campaignDetails.sentCount + campaignDetails.errorCount + campaignDetails.skippedCount) / campaignDetails.totalRecipients) * 100} 
                    className="h-3"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Mensagem</Label>
                <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm">
                  {campaignDetails.message}
                </div>
              </div>

              {campaignDetails.mediaUrl && (
                <div className="space-y-2">
                  <Label>Anexo</Label>
                  <Badge variant="secondary">
                    {campaignDetails.mediaType === 'image' && <Image className="h-3 w-3 mr-1" />}
                    {campaignDetails.mediaType === 'video' && <Video className="h-3 w-3 mr-1" />}
                    {campaignDetails.mediaType === 'audio' && <Music className="h-3 w-3 mr-1" />}
                    {campaignDetails.mediaFileName || campaignDetails.mediaType}
                  </Badge>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Intervalo: </span>
                  <span>{campaignDetails.intervalMinSec}s - {campaignDetails.intervalMaxSec}s</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Palavra de saída: </span>
                  <Badge variant="outline">{campaignDetails.optOutKeyword}</Badge>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showOptOuts} onOpenChange={setShowOptOuts}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lista de Exclusões</DialogTitle>
            <DialogDescription>
              Números que optaram por não receber mais campanhas
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {!optOuts || optOuts.length === 0 ? (
              <div className="text-center py-12">
                <UserMinus className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma exclusão registrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Palavra-chave</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {optOuts.map((optOut) => (
                    <TableRow key={optOut.id} data-testid={`row-opt-out-${optOut.id}`}>
                      <TableCell>{optOut.phone}</TableCell>
                      <TableCell>{optOut.userName || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{optOut.keyword || '-'}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(optOut.optedOutAt).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteOptOutMutation.mutate(optOut.id)}
                          data-testid={`button-delete-opt-out-${optOut.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showTestMessage} onOpenChange={setShowTestMessage}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Testar Mensagem da Campanha</DialogTitle>
            <DialogDescription>
              Envie a mensagem para um número de teste antes de iniciar a campanha
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="test-campaign-phone">Número para teste</Label>
              <Input
                id="test-campaign-phone"
                placeholder="(11) 99999-9999"
                value={testMessagePhone}
                onChange={(e) => setTestMessagePhone(formatPhone(e.target.value))}
                data-testid="input-test-campaign-phone"
              />
            </div>

            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div>
                <Label className="text-sm text-muted-foreground">1. Mensagem principal:</Label>
                <div className="mt-1 whitespace-pre-wrap text-sm border-l-2 border-primary pl-2">
                  {campaignForm.message}
                </div>
              </div>
              
              {(campaignForm.imageFileName || campaignForm.videoFileName || campaignForm.audioFileName || campaignForm.documentFileName) && (
                <div>
                  <Label className="text-sm text-muted-foreground">2. Anexos:</Label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {campaignForm.imageFileName && (
                      <Badge variant="secondary"><Image className="h-3 w-3 mr-1" />{campaignForm.imageFileName}</Badge>
                    )}
                    {campaignForm.videoFileName && (
                      <Badge variant="secondary"><Video className="h-3 w-3 mr-1" />{campaignForm.videoFileName}</Badge>
                    )}
                    {campaignForm.audioFileName && (
                      <Badge variant="secondary"><Music className="h-3 w-3 mr-1" />{campaignForm.audioFileName}</Badge>
                    )}
                    {campaignForm.documentFileName && (
                      <Badge variant="secondary"><FileText className="h-3 w-3 mr-1" />{campaignForm.documentFileName}</Badge>
                    )}
                  </div>
                </div>
              )}
              
              {campaignForm.optOutMessage && (
                <div>
                  <Label className="text-sm text-muted-foreground">
                    {(campaignForm.imageFileName || campaignForm.videoFileName || campaignForm.audioFileName || campaignForm.documentFileName) ? '3.' : '2.'} Mensagem de descadastro (enviada por último):
                  </Label>
                  <div className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground border-l-2 border-orange-400 pl-2">
                    {campaignForm.optOutMessage}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestMessage(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => testCampaignMessageMutation.mutate({
                phone: testMessagePhone.replace(/\D/g, ''),
                message: campaignForm.message,
                optOutMessage: campaignForm.optOutMessage,
                imageUrl: campaignForm.imageUrl,
                imageFileName: campaignForm.imageFileName,
                videoUrl: campaignForm.videoUrl,
                videoFileName: campaignForm.videoFileName,
                audioUrl: campaignForm.audioUrl,
                audioFileName: campaignForm.audioFileName,
                documentUrl: campaignForm.documentUrl,
                documentFileName: campaignForm.documentFileName,
              })}
              disabled={testCampaignMessageMutation.isPending || testMessagePhone.replace(/\D/g, '').length < 10}
              data-testid="button-send-test-campaign-message"
            >
              {testCampaignMessageMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar Teste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showSelectRecipients} onOpenChange={() => setShowSelectRecipients(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Selecionar Destinatários</DialogTitle>
            <DialogDescription>
              Escolha quais contatos receberão a campanha
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              <Button
                variant={selectAllRecipients ? "default" : "outline"}
                onClick={() => {
                  setSelectAllRecipients(true);
                  setSelectedRecipients([]);
                }}
                data-testid="button-select-all"
              >
                <Users className="h-4 w-4 mr-2" />
                Todos ({eligibleRecipients?.count || 0})
              </Button>
              <Button
                variant={!selectAllRecipients ? "default" : "outline"}
                onClick={() => setSelectAllRecipients(false)}
                data-testid="button-select-specific"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Selecionar específicos
              </Button>
            </div>

            {!selectAllRecipients && (
              <>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Buscar por nome ou telefone..."
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    data-testid="input-recipient-search"
                  />
                  <Badge variant="secondary">
                    {selectedRecipients.length} selecionados
                  </Badge>
                </div>

                <ScrollArea className="h-[300px] border rounded-lg p-2">
                  <div className="space-y-1">
                    {eligibleRecipients?.recipients
                      ?.filter(r => 
                        !recipientSearch || 
                        r.phone.includes(recipientSearch) || 
                        (r.userName?.toLowerCase().includes(recipientSearch.toLowerCase()))
                      )
                      .map((recipient) => {
                        const recipientId = recipient.recipientId || recipient.phone;
                        const isSelected = selectedRecipients.includes(recipientId);
                        return (
                          <div
                            key={recipientId}
                            className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-muted ${isSelected ? 'bg-primary/10' : ''}`}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedRecipients(prev => prev.filter(id => id !== recipientId));
                              } else {
                                setSelectedRecipients(prev => [...prev, recipientId]);
                              }
                            }}
                            data-testid={`row-recipient-${recipientId}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                                {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{recipient.userName || 'Sem nome'}</p>
                                <p className="text-xs text-muted-foreground">{recipient.phone}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSelectRecipients(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (showSelectRecipients) {
                  setRecipientsMutation.mutate({
                    campaignId: showSelectRecipients,
                    selectAll: selectAllRecipients,
                    recipientIds: selectedRecipients,
                  });
                }
              }}
              disabled={setRecipientsMutation.isPending || (!selectAllRecipients && selectedRecipients.length === 0)}
              data-testid="button-confirm-recipients"
            >
              {setRecipientsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Confirmar {selectAllRecipients ? `Todos (${eligibleRecipients?.count || 0})` : `${selectedRecipients.length} selecionados`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
