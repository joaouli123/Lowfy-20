import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Eye, Trash2, Edit, FileText, Copy, MousePointer, MoreVertical, Globe, Settings, Info, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { FeatureLockedOverlay } from "@/components/FeatureLockedOverlay";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PreSellPage {
  name: string;
  createdAt: string;
  viewCount?: number;
  clickCount?: number;
  customDomain?: string | null;
  requiresDomain?: boolean;
  isActive?: boolean;
  timeRemaining?: string | null;
  hoursRemaining?: number | null;
}

export default function PreSellDashboard() {
  const { isFeatureBlocked } = useFeatureAccess();
  const featureBlocked = isFeatureBlocked("presell-builder");
  
  const [pages, setPages] = useState<PreSellPage[]>([]);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showDomainDialog, setShowDomainDialog] = useState(false);
  const [selectedPage, setSelectedPage] = useState<PreSellPage | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [showVideoTutorialDialog, setShowVideoTutorialDialog] = useState(false);

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    try {
      const response = await fetch('/api/presell/list', {
        credentials: 'include',
        headers: { ...getAuthHeaders() }
      });
      if (response.status === 401) {
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente.",
          variant: "destructive"
        });
        window.location.href = '/login';
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setPages(data.pages || []);
      }
    } catch (error) {
    }
  };

  const createNewPage = () => {
    setLocation('/presell-builder?new=true');
  };

  const editPage = (name: string) => {
    setLocation(`/presell-builder?edit=${name}`);
  };

  const viewPage = (name: string) => {
    const slug = name.toLowerCase();
    window.open(`/presell/${slug}`, '_blank');
  };

  const copyUrl = (page: PreSellPage) => {
    const slug = page.name.toLowerCase();
    const url = page.customDomain 
      ? `https://${page.customDomain}` 
      : `${window.location.origin}/presell/${slug}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "URL copiada!",
      description: "O link foi copiado para a área de transferência.",
    });
  };
  
  const getPageUrl = (page: PreSellPage) => {
    if (page.customDomain) {
      return `https://${page.customDomain}`;
    }
    return `${window.location.origin}/presell/${page.name}`;
  };
  
  const getTruncatedUrl = (page: PreSellPage) => {
    const url = getPageUrl(page);
    if (url.length > 45) {
      return `${url.substring(0, 42)}...`;
    }
    return url;
  };

  const duplicatePage = async (name: string) => {
    try {
      const response = await fetch(`/api/presell/get/${name}`, {
        credentials: 'include',
        headers: { ...getAuthHeaders() }
      });
      if (response.status === 401) {
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente.",
          variant: "destructive"
        });
        window.location.href = '/login';
        return;
      }
      if (!response.ok) {
        throw new Error('Erro ao carregar página original');
      }

      const data = await response.json();
      const newName = `${name}-copia-${Date.now()}`;

      const saveResponse = await fetch('/api/presell/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({
          ...data.page,
          name: newName,
          slug: undefined
        })
      });

      if (saveResponse.status === 401) {
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente.",
          variant: "destructive"
        });
        window.location.href = '/login';
        return;
      }

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        throw new Error(errorData.message || 'Erro ao salvar duplicata');
      }

      const result = await saveResponse.json();

      toast({
        title: "Página duplicada!",
        description: `Cópia criada: ${result.name}`
      });

      // Aguardar um pouco para garantir que o arquivo foi salvo
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Recarregar a lista
      await loadPages();
    } catch (error: any) {
      toast({
        title: "Erro ao duplicar",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const deletePage = async (name: string) => {
    if (!confirm(`Deseja excluir a página "${name}"?`)) return;

    try {
      const response = await fetch(`/api/presell/delete/${name}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { ...getAuthHeaders() }
      });

      if (response.status === 401) {
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente.",
          variant: "destructive"
        });
        window.location.href = '/login';
        return;
      }

      if (response.ok) {
        toast({
          title: "Página excluída!",
          description: "A página foi removida com sucesso."
        });
        loadPages();
      }
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const openDomainConfig = (page: PreSellPage) => {
    setSelectedPage(page);
    setDomainInput(page.customDomain || "");
    setShowDomainDialog(true);
  };

  const saveDomainConfig = async () => {
    if (!selectedPage) return;

    try {
      const response = await fetch(`/api/presell/configure-domain/${selectedPage.name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ customDomain: domainInput.trim() })
      });

      if (response.status === 401) {
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente.",
          variant: "destructive"
        });
        window.location.href = '/login';
        return;
      }

      if (response.ok) {
        toast({
          title: "Domínio configurado!",
          description: domainInput.trim() 
            ? `Domínio ${domainInput} vinculado com sucesso.`
            : "Domínio removido da página."
        });
        setShowDomainDialog(false);
        loadPages();
      } else {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao configurar domínio",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (featureBlocked) {
    return (
      <FeatureLockedOverlay 
        featureName="Pre-Sell Builder" 
        description="Crie páginas de pré-venda de alta conversão. Disponível apenas para assinantes."
      />
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="h-8 w-8" />
              Pre-Sell Builder
            </h1>
            <p className="text-muted-foreground mt-2">
              Crie páginas de pré-venda de alta conversão
            </p>
          </div>
          <Button size="lg" onClick={createNewPage} data-testid="button-create-presell">
            <Plus className="mr-2 h-5 w-5" />
            Nova Pre-Sell
          </Button>
        </div>
      </div>

      {pages.length === 0 ? (
        <>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nenhuma Pre-Sell criada</h3>
              <p className="text-muted-foreground text-center mb-6">
                Crie sua primeira página de pré-venda clicando no botão acima
              </p>
              <Button onClick={createNewPage} data-testid="button-create-first-presell">
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeira Pre-Sell
              </Button>
            </CardContent>
          </Card>
          
          <div className="flex justify-center mt-8">
            <button 
              type="button"
              onClick={() => setShowVideoTutorialDialog(true)}
              className="text-sm text-primary hover:underline flex items-center justify-center gap-1 hover:gap-2 transition-all"
              data-testid="link-video-tutorial-presell"
            >
              <Eye className="h-4 w-4" />
              Veja como criar uma página fácil
            </button>
          </div>
        </>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Suas Páginas Pre-Sell</CardTitle>
              <CardDescription>
                Total de {pages.length} página{pages.length !== 1 ? 's' : ''} criada{pages.length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Data de Criação</TableHead>
                    <TableHead>Visualizações</TableHead>
                    <TableHead>Cliques no Botão</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pages.map((page) => (
                    <TableRow key={page.name}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{page.name}</span>
                          {page.requiresDomain && !page.customDomain && (
                            page.isActive ? (
                              <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
                                <Info className="h-3 w-3 text-amber-700 dark:text-amber-300" />
                                <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
                                  {page.timeRemaining || 'Configure domínio'}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full border border-red-300 dark:border-red-700">
                                <Info className="h-3 w-3 text-red-700 dark:text-red-300" />
                                <span className="text-xs font-medium text-red-800 dark:text-red-200">
                                  Desativada
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(page.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          <span>{page.viewCount || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MousePointer className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-primary">{page.clickCount || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code 
                            className="text-xs bg-muted px-2 py-1 rounded max-w-[300px] truncate" 
                            title={getPageUrl(page)}
                          >
                            {getTruncatedUrl(page)}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyUrl(page)}
                            className="h-7 w-7 p-0 flex-shrink-0"
                            data-testid={`button-copy-url-${page.name}`}
                            title="Copiar URL"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => editPage(page.name)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => viewPage(page.name)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver Página
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLocation(`/presell-builder?edit=${page.name}&settings=true`)}>
                              <Settings className="mr-2 h-4 w-4" />
                              Configurações de Página
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => duplicatePage(page.name)}>
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deletePage(page.name)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Apagar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          <div className="flex justify-center mt-8">
            <button 
              type="button"
              onClick={() => setShowVideoTutorialDialog(true)}
              className="text-sm text-primary hover:underline flex items-center justify-center gap-1 hover:gap-2 transition-all"
              data-testid="link-video-tutorial-presell-with-pages"
            >
              <Eye className="h-4 w-4" />
              Veja como criar uma página fácil
            </button>
          </div>
        </>
      )}

      {/* Dialog de Configuração de Domínio */}
      <Dialog open={showDomainDialog} onOpenChange={setShowDomainDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Domínio Customizado</DialogTitle>
            <DialogDescription>
              Configure um domínio personalizado para sua página de pré-venda.
              {selectedPage && (
                <span className="block mt-2 text-sm">
                  Página: <strong>{selectedPage.name}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="domain-input">Domínio Customizado</Label>
              <Input
                id="domain-input"
                data-testid="input-custom-domain"
                placeholder="exemplo: meusite.com ou subdominio.meusite.com"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para usar a URL padrão do Replit
              </p>
            </div>

            <div className="rounded-lg border p-4 bg-muted/50">
              <div className="flex gap-2 items-start">
                <Globe className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium">Como funciona:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Em <strong>desenvolvimento</strong>: configuração é salva mas a página ainda usa URL local</li>
                    <li>Em <strong>produção</strong>: após publicar seu app, o domínio configurado será usado automaticamente</li>
                    <li>Você precisa configurar o DNS do domínio apontando para seu app publicado</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDomainDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={saveDomainConfig} data-testid="button-save-domain">
              Salvar Configuração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Vídeo Tutorial - Como Criar Pre-Sell */}
      <Dialog open={showVideoTutorialDialog} onOpenChange={setShowVideoTutorialDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Como Criar uma Página Fácil</DialogTitle>
            <DialogDescription>
              Assista ao tutorial e aprenda a criar páginas de pré-venda em poucos minutos
            </DialogDescription>
          </DialogHeader>
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <video
              controls
              poster="/videos/page-creator-tutorial-thumb.jpg"
              className="w-full h-full"
              data-testid="video-tutorial-presell"
            >
              <source src="/videos/page-creator-tutorial.mp4" type="video/mp4" />
              Seu navegador não suporta o elemento de vídeo.
            </video>
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setShowVideoTutorialDialog(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}