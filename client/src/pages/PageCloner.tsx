import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Copy, Download, Globe, Save, Edit, Image as ImageIcon, Link as LinkIcon, ExternalLink, Trash2, Settings, FileCode, CheckCircle, Info, Sparkles, Eye, Plus, X, Play, ArrowRight, ArrowLeft, Loader2, Check, AlertCircle, RefreshCw } from "lucide-react";
import confetti from "canvas-confetti";
import { domainConfig } from "@shared/domainConfig";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { FeatureLockedOverlay } from "@/components/FeatureLockedOverlay";
import { SEO, seoConfig } from "@/components/SEO";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreVertical } from "lucide-react";

// Função para extrair o nome correto do host para DNS
// Para subdomínios: retorna o subdomínio (ex: "lp" de "lp.example.com.br")
// Para apex domains: retorna "@"
function getDnsHostName(domain: string | null | undefined): string {
  if (!domain) return '@';
  
  const parts = domain.toLowerCase().split('.');
  
  // Detecta TLDs compostos (.com.br, .org.br, .net.br, etc.)
  const isCompositeTld = parts.length >= 2 && 
    ['br', 'ar', 'mx', 'uk', 'au', 'nz', 'za', 'in', 'jp'].includes(parts[parts.length - 1]);
  
  // Para TLDs compostos (ex: .com.br): apex tem 3 partes, subdomínio tem 4+
  // Para TLDs simples (ex: .com): apex tem 2 partes, subdomínio tem 3+
  const apexPartsCount = isCompositeTld ? 3 : 2;
  
  if (parts.length > apexPartsCount) {
    // É um subdomínio - retorna a primeira parte (ex: "lp" ou "www")
    return parts[0];
  }
  
  // É um apex domain
  return '@';
}

export default function PageCloner() {
  const { isFeatureBlocked } = useFeatureAccess();
  const featureBlocked = isFeatureBlocked("clonador");
  
  const [url, setUrl] = useState("");
  const [html, setHtml] = useState("");
  const [editedHtml, setEditedHtml] = useState("");
  const [pageName, setPageName] = useState("");
  const [isEditingExisting, setIsEditingExisting] = useState(false); // State to track if editing an existing page
  const [selectedElement, setSelectedElement] = useState<{
    type: 'text' | 'link' | 'image';
    content: string;
    xpath: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savedPages, setSavedPages] = useState<{ 
    name: string; 
    createdAt?: string; 
    viewCount?: number; 
    originalName?: string;
    requiresDomain?: boolean;
    customDomain?: string | null;
    timeRemaining?: string | null;
    isActive?: boolean;
  }[]>([]);
  const [showTrackingDialog, setShowTrackingDialog] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [showDomainDialog, setShowDomainDialog] = useState(false);
  const [showVideoTutorialDialog, setShowVideoTutorialDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [domainPageName, setDomainPageName] = useState("");
  const [pixelCode, setPixelCode] = useState("");
  const [pageToClone, setPageToClone] = useState("");
  const [clonedPageName, setClonedPageName] = useState("");
  const [newPageName, setNewPageName] = useState("");
  const [removeOldPixels, setRemoveOldPixels] = useState(false);
  const [deactivateOtherScripts, setDeactivateOtherScripts] = useState(true);
  const [enableHeadCode, setEnableHeadCode] = useState(false);
  const [headCode, setHeadCode] = useState("");
  const [enableBodyCode, setEnableBodyCode] = useState(false);
  const [bodyCode, setBodyCode] = useState("");
  const [enableFooterCode, setEnableFooterCode] = useState(false);
  const [footerCode, setFooterCode] = useState("");
  const [isSavingDomain, setIsSavingDomain] = useState(false);
  const [domainStatus, setDomainStatus] = useState<'idle' | 'pending' | 'active' | 'error'>('idle');
  const [isVerifyingDomain, setIsVerifyingDomain] = useState(false);
  const [txtRecords, setTxtRecords] = useState<Array<{name: string; value: string; type: string}>>([]);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoFavicon, setSeoFavicon] = useState("");
  const [seoOgImage, setSeoOgImage] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();
  const [editingImage, setEditingImage] = useState<{ element: HTMLImageElement | null; oldUrl: string; newUrl: string } | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [clonedHtml, setClonedHtml] = useState<string>(''); // State to hold the HTML content being edited
  const [saving, setSaving] = useState<boolean>(false); // State to manage saving process
  const [editMode, setEditMode] = useState<boolean>(true); // State to toggle edit mode
  const [pageStatus, setPageStatus] = useState<{
    requiresDomain: boolean;
    customDomain: string | null;
    timeRemaining: string | null;
    hoursRemaining: number | null;
    isExpired: boolean;
    isActive: boolean;
  } | null>(null);

  // Carregar status da página (domínio, tempo restante, etc.)
  useEffect(() => {
    const loadPageStatus = async () => {
      if (!currentPage) {
        setPageStatus(null);
        return;
      }

      try {
        const response = await fetch(`/api/cloned-page/status/${currentPage}`, {
          credentials: 'include',
          headers: { ...getAuthHeaders() }
        });
        if (response.status === 401) {
          toast({
            title: "Sessão expirada",
            description: "Por favor, faça login novamente.",
            variant: "destructive",
          });
          window.location.href = '/login';
          return;
        }
        if (response.ok) {
          const data = await response.json();
          setPageStatus(data);
          if (data.customDomain) {
            setCustomDomain(data.customDomain);
          }
        }
      } catch (error) {
      }
    };

    loadPageStatus();
  }, [currentPage]);

  // Carregar tracking codes salvos quando a página mudar OU quando o dialog abrir
  useEffect(() => {
    const loadTrackingMetadata = async () => {
      if (!currentPage || !showTrackingDialog) return;

      try {
        const response = await fetch(`/api/get-tracking-metadata/${currentPage}`, {
          credentials: 'include',
          headers: { ...getAuthHeaders() }
        });

        if (response.status === 401) {
          toast({
            title: "Sessão expirada",
            description: "Por favor, faça login novamente.",
            variant: "destructive",
          });
          window.location.href = '/login';
          return;
        }

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        if (data.trackingCodes) {
          // Carregar códigos salvos - preservar valores existentes se metadata for null
          const hasHeadCode = data.trackingCodes.head && data.trackingCodes.head.trim() !== '';
          const hasBodyCode = data.trackingCodes.body && data.trackingCodes.body.trim() !== '';
          const hasFooterCode = data.trackingCodes.footer && data.trackingCodes.footer.trim() !== '';

          // Atualizar estados com os valores do servidor
          setEnableHeadCode(hasHeadCode);
          if (hasHeadCode) {
            setHeadCode(data.trackingCodes.head);
          } else {
            setHeadCode('');
          }

          setEnableBodyCode(hasBodyCode);
          if (hasBodyCode) {
            setBodyCode(data.trackingCodes.body);
          } else {
            setBodyCode('');
          }

          setEnableFooterCode(hasFooterCode);
          if (hasFooterCode) {
            setFooterCode(data.trackingCodes.footer);
          } else {
            setFooterCode('');
          }

          setRemoveOldPixels(data.removeOldPixels || false);
          setDeactivateOtherScripts(data.deactivateOtherScripts || false);
        }
      } catch (error) {
      }
    };

    loadTrackingMetadata();
  }, [currentPage, showTrackingDialog]);

  // Carregar lista de páginas salvas
  useEffect(() => {
    loadSavedPages();
  }, []);

  // Recarregar lista quando a página receber foco (usuário volta da edição)
  useEffect(() => {
    const handleFocus = () => {
      loadSavedPages();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);


  const loadSavedPages = async () => {
    try {
      const response = await fetch("/api/list-cloned-pages", {
        credentials: 'include',
        headers: { ...getAuthHeaders() }
      });
      if (response.status === 401) {
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente.",
          variant: "destructive",
        });
        window.location.href = '/login';
        return;
      }
      const data = await response.json();
      if (response.ok) {
        // Ordenar por createdAt decrescente (mais recentes primeiro)
        const sortedPages = (data.pages || []).sort((a: any, b: any) => {
          if (!a.createdAt || !b.createdAt) return 0;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        setSavedPages(sortedPages);
      }
    } catch (error) {
    }
  };

  const openPreviewPage = () => {
    if (!editedHtml) {
      toast({
        title: "Erro",
        description: "Nenhuma página clonada para visualizar. Salve a página primeiro.",
        variant: "destructive",
      });
      return;
    }

    // Para visualizar, a página precisa estar salva primeiro
    toast({
      title: "Salve a página primeiro",
      description: "Clique em 'Salvar e Editar' para abrir o editor",
      variant: "destructive",
    });
  };

  const clonePage = async () => {
    if (!url) {
      toast({
        title: "Erro",
        description: "Digite a URL da página",
        variant: "destructive",
      });
      return;
    }

    // Validar URL básica
    try {
      new URL(url);
    } catch {
      toast({
        title: "URL Inválida",
        description: "Por favor, insira uma URL válida (ex: https://exemplo.com)",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/clone-page", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ url }),
      });

      if (response.status === 401) {
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente.",
          variant: "destructive",
        });
        window.location.href = '/login';
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao clonar página");
      }

      setHtml(data.html);
      setEditedHtml(data.html);
      setClonedHtml(data.html); // Initialize clonedHtml with the fetched HTML
      setIsEditingExisting(false);

      // Abrir modal para digitar o nome
      setNewPageName("");
      setShowNameDialog(true);
    } catch (error: any) {
      toast({
        title: "Erro ao clonar",
        description: error.message || "Não foi possível clonar a página",
        variant: "destructive",
      });
    }
  };

  const saveAndOpenEditor = async () => {
    if (!newPageName) {
      toast({
        title: "Erro",
        description: "Digite um nome para a página",
        variant: "destructive",
      });
      return;
    }

    try {
      // Salvar a página
      const response = await fetch("/api/save-cloned-page", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ 
          name: newPageName,
          html: editedHtml,
          originalName: newPageName // Salva o nome original
        }),
      });

      if (response.status === 401) {
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente.",
          variant: "destructive",
        });
        window.location.href = '/login';
        return;
      }

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      toast({
        title: "Página Salva!",
        description: "Abrindo editor em nova guia...",
      });

      // Fechar modal e abrir editor
      setShowNameDialog(false);
      setNewPageName("");
      setUrl("");
      setHtml("");
      setEditedHtml("");
      setClonedHtml(""); // Clear clonedHtml state

      // Recarregar lista
      loadSavedPages();

      // Abrir editor em nova guia com o nome da página (busca do servidor)
      const sessionId = `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setTimeout(() => {
        window.open(`/clonador/preview?session=${encodeURIComponent(sessionId)}&page=${encodeURIComponent(data.name)}`, '_blank');
      }, 100);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const savePage = async () => {
    if (!pageName) {
      toast({
        title: "Erro",
        description: "Digite um nome para a página",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(isEditingExisting ? "/api/update-cloned-page" : "/api/save-cloned-page", { // Conditional endpoint
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ 
          name: pageName,
          html: editedHtml 
        }),
      });

      if (response.status === 401) {
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente.",
          variant: "destructive",
        });
        window.location.href = '/login';
        return;
      }

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      toast({
        title: isEditingExisting ? "Alterações Salvas!" : "Página Salva!",
        description: `Acesse em: ${window.location.origin}/pages/${pageName}`,
      });

      // Limpar inputs
      setPageName("");
      setHtml("");
      setEditedHtml("");
      setIsEditingExisting(false); // Reset editing state

      // Recarregar lista após pequeno delay
      setTimeout(() => {
        loadSavedPages();
      }, 300);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deletePage = async (name: string) => {
    if (!confirm(`Deseja excluir a página "${name}"?`)) return;

    try {
      const response = await fetch(`/api/delete-cloned-page/${name}`, {
        method: "DELETE",
        credentials: 'include',
        headers: { ...getAuthHeaders() }
      });

      if (response.status === 401) {
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente.",
          variant: "destructive",
        });
        window.location.href = '/login';
        return;
      }

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      toast({
        title: "Página Excluída!",
        description: `A página "${name}" foi removida.`,
      });

      await loadSavedPages();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const editPage = async (name: string) => {
    // Gerar ID único para esta sessão de edição
    const sessionId = `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    toast({
      title: "Abrindo Editor!",
      description: "A página será aberta em uma nova aba para edição.",
    });

    // Abrir editor direto - o HTML será buscado do servidor
    window.open(`/clonador/preview?session=${encodeURIComponent(sessionId)}&page=${encodeURIComponent(name)}`, '_blank');
  };

  const startClonePage = (pageName: string) => {
    setPageToClone(pageName);
    setClonedPageName("");
    setShowCloneDialog(true);
  };

  const cloneExistingPage = async () => {
    if (!clonedPageName) {
      toast({
        title: "Erro",
        description: "Digite um nome para a página clonada",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/get-cloned-page/${pageToClone}`, {
        credentials: 'include',
        headers: { ...getAuthHeaders() }
      });

      if (response.status === 401) {
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente.",
          variant: "destructive",
        });
        window.location.href = '/login';
        return;
      }

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      // Salvar a nova página com o novo nome
      const saveResponse = await fetch("/api/save-cloned-page", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ 
          name: clonedPageName,
          html: data.html,
          originalName: clonedPageName, // Salva o nome original da página clonada
          isCloned: true // Marcar como página duplicada que requer domínio
        }),
      });

      if (saveResponse.status === 401) {
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente.",
          variant: "destructive",
        });
        window.location.href = '/login';
        return;
      }

      const saveData = await saveResponse.json();

      if (!saveResponse.ok) throw new Error(saveData.message);

      toast({
        title: "Página Clonada!",
        description: "Abrindo editor em nova guia...",
      });

      // Gerar ID único para edição
      const sessionId = `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Fechar modal e abrir editor (HTML será buscado do servidor)
      setShowCloneDialog(false);
      loadSavedPages();
      window.open(`/clonador/preview?session=${encodeURIComponent(sessionId)}&page=${encodeURIComponent(saveData.name)}`, '_blank');
    } catch (error: any) {
      toast({
        title: "Erro ao clonar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const [isProcessing, setIsProcessing] = useState(false);

  const installPixel = async () => {

    if (!currentPage) {
      toast({
        title: "Erro",
        description: "Selecione uma página",
        variant: "destructive",
      });
      return;
    }

    // Verificar se pelo menos uma ação será executada
    const hasHeadCodeToInsert = enableHeadCode && headCode.trim();
    const hasBodyCodeToInsert = enableBodyCode && bodyCode.trim();
    const hasFooterCodeToInsert = enableFooterCode && footerCode.trim();
    const hasAnyCodeToInsert = hasHeadCodeToInsert || hasBodyCodeToInsert || hasFooterCodeToInsert;
    const hasAnyAction = hasAnyCodeToInsert || removeOldPixels || deactivateOtherScripts;

    if (!hasAnyAction) {
      toast({
        title: "Nenhuma ação selecionada",
        description: "Adicione códigos de rastreamento ou ative as opções de limpeza",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const payload = { 
        pageName: currentPage,
        trackingCode: JSON.stringify({
          head: hasHeadCodeToInsert ? headCode : null,
          body: hasBodyCodeToInsert ? bodyCode : null,
          footer: hasFooterCodeToInsert ? footerCode : null,
        }),
        removeOldPixels,
        deactivateOtherScripts
      };

      const response = await fetch(`/api/inject-tracking-fast`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente.",
          variant: "destructive",
        });
        window.location.href = '/login';
        return;
      }

      const data = await response.json();

      if (!response.ok) throw new Error(data.message || 'Erro ao processar');

      // Montar mensagem baseada nas configurações
      let successMessage = "";
      const actions = [];
      
      if (hasAnyCodeToInsert) {
        actions.push("Scripts instalados");
      }
      if (removeOldPixels) {
        actions.push("Pixels antigos removidos");
      }
      if (deactivateOtherScripts) {
        actions.push("Scripts não essenciais desativados");
      }
      
      successMessage = actions.join(", ") + "!";

      toast({
        title: "✅ Configurações Aplicadas!",
        description: successMessage,
      });

      setShowTrackingDialog(false);
      setHeadCode("");
      setBodyCode("");
      setFooterCode("");
    } catch (error: any) {
      toast({
        title: "Erro ao instalar scripts",
        description: error.message || "Erro desconhecido ao processar",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const saveDomain = async () => {
    if (!currentPage) {
      toast({
        title: "Erro",
        description: "Selecione uma página",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/cloned-page/set-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({
          pageName: currentPage,
          customDomain: customDomain.trim()
        }),
      });

      if (response.status === 401) {
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente.",
          variant: "destructive",
        });
        window.location.href = '/login';
        return;
      }

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      toast({
        title: "✅ Domínio Configurado!",
        description: data.message,
      });

      // Recarregar status da página
      const statusResponse = await fetch(`/api/cloned-page/status/${currentPage}`, {
        credentials: 'include',
        headers: { ...getAuthHeaders() }
      });
      if (statusResponse.status === 401) {
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente.",
          variant: "destructive",
        });
        window.location.href = '/login';
        return;
      }
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        setPageStatus(statusData);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao configurar domínio",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const copyPageLink = (name: string) => {
    const page = savedPages.find(p => p.name === name);
    const link = page?.customDomain 
      ? `https://${page.customDomain}`
      : `${window.location.origin}/pages/${name}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link Copiado!",
      description: page?.customDomain 
        ? `Link ${page.customDomain} copiado`
        : "Link copiado para área de transferência",
    });
  };

  const openDomainConfig = (pageName: string) => {
    const page = savedPages.find(p => p.name === pageName);
    setDomainPageName(pageName);
    setCustomDomain(page?.customDomain || "");
    setDomainStatus('idle');
    setTxtRecords([]);
    setShowDomainDialog(true);
  };

  const copyToClipboardDns = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: `${label} copiado para área de transferência.`,
    });
  };

  const saveDomainConfig = async () => {
    if (!domainPageName) return;

    if (!customDomain.trim()) {
      toast({
        title: "Digite um domínio",
        description: "O domínio é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingDomain(true);
    try {
      const response = await fetch(`/api/cloned-page/set-domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ 
          pageName: domainPageName, 
          customDomain: customDomain.trim() 
        })
      });

      if (response.status === 401) {
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente.",
          variant: "destructive",
        });
        window.location.href = '/login';
        return;
      }

      if (response.ok) {
        toast({
          title: "Domínio salvo!",
          description: `Domínio ${customDomain} configurado.`
        });
        await loadSavedPages();
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
    } finally {
      setIsSavingDomain(false);
    }
  };

  const [domainMessage, setDomainMessage] = useState<string>('');
  const [sslStatus, setSslStatus] = useState<string>('');
  const [cloudflareUnavailable, setCloudflareUnavailable] = useState<boolean>(false);
  const verifyDomainRef = useRef<string>(''); // Proteção contra race conditions

  const handleVerifyDomain = async () => {
    if (!customDomain) return;
    if (isVerifyingDomain) return; // Previne duplo clique
    
    const currentDomain = customDomain.trim();
    verifyDomainRef.current = currentDomain; // Marca qual domínio está sendo verificado
    
    setIsVerifyingDomain(true);
    setDomainMessage('');
    setSslStatus('');
    setCloudflareUnavailable(false);
    
    try {
      const res = await fetch(`/api/custom-domains/${encodeURIComponent(currentDomain)}/check`, {
        credentials: 'include',
        headers: { ...getAuthHeaders() },
      });
      
      // Ignora resposta se o domínio mudou durante a requisição
      if (verifyDomainRef.current !== currentDomain) {
        return;
      }
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Falha na verificação');
      }
      
      const data = await res.json();
      
      // Ignora resposta se o domínio mudou durante a requisição
      if (verifyDomainRef.current !== currentDomain) {
        return;
      }
      
      // Tratamento de Cloudflare indisponível
      if (data.cloudflareUnavailable) {
        setCloudflareUnavailable(true);
        setDomainStatus('error');
        setDomainMessage(data.message || 'Cloudflare indisponível. Tente novamente.');
        return;
      }
      
      // Tratamento de erro do Cloudflare (usando cache)
      if (data.cloudflareError) {
        setDomainStatus('pending');
        setDomainMessage(data.message || 'Usando status em cache. Tente verificar novamente.');
        if (data.ssl) {
          setSslStatus(`SSL: ${data.ssl.statusLabel}`);
        }
        return;
      }
      
      // Verificação REAL: só é ativo se isFullyActive = true
      if (data.isFullyActive) {
        setDomainStatus('active');
        setDomainMessage(data.message || 'Domínio ativo e funcionando!');
      } else if (data.needsSync) {
        setDomainStatus('error');
        setDomainMessage(data.message || 'Domínio precisa ser reconfigurado. Salve a página novamente.');
      } else if (!data.found) {
        setDomainStatus('error');
        setDomainMessage(data.message || 'Domínio não encontrado. Configure o CNAME primeiro.');
      } else if (data.status === 'blocked') {
        setDomainStatus('error');
        setDomainMessage(data.message || 'Domínio bloqueado. Verifique as configurações de DNS.');
      } else {
        // Status pendente ou em progresso
        setDomainStatus('pending');
        setDomainMessage(data.message || 'Aguarde a ativação do SSL...');
      }
      
      if (data.ssl) {
        setSslStatus(`SSL: ${data.ssl.statusLabel || data.ssl.status}`);
      }
      
      // Store txtRecords from API for display
      if (data.txtRecords && Array.isArray(data.txtRecords)) {
        setTxtRecords(data.txtRecords);
      } else {
        setTxtRecords([]);
      }
    } catch (err: any) {
      // Ignora erro se o domínio mudou durante a requisição
      if (verifyDomainRef.current !== currentDomain) {
        return;
      }
      setDomainStatus('error');
      setDomainMessage(err.message || 'Erro ao verificar. Tente novamente.');
    } finally {
      if (verifyDomainRef.current === currentDomain) {
        setIsVerifyingDomain(false);
      }
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(editedHtml);
    toast({
      title: "Copiado!",
      description: "HTML copiado para área de transferência",
    });
  };

  const downloadHtml = () => {
    const blob = new Blob([editedHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pageName || 'pagina'}.html`;
    a.click();
  };

  const getElementXPath = (element: Element): string => {
    if (element.id) return `//*[@id="${element.id}"]`;

    const parts: string[] = [];
    let current: Element | null = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 0;
      let sibling = current.previousSibling;

      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === current.nodeName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }

      const tagName = current.nodeName.toLowerCase();
      const part = index > 0 ? `${tagName}[${index + 1}]` : tagName;
      parts.unshift(part);

      current = current.parentElement;
    }

    return '/' + parts.join('/');
  };

  const setupEditMode = () => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentDocument) return;

    const doc = iframe.contentDocument;

    // Adicionar estilos para highlight
    const style = doc.createElement('style');
    style.textContent = `
      .edit-highlight { outline: 2px dashed #3b82f6 !important; cursor: pointer !important; }
      .edit-highlight:hover { outline: 2px solid #2563eb !important; background-color: rgba(59, 130, 246, 0.1) !important; }
    `;
    doc.head.appendChild(style);

    // Adicionar listeners
    const elements = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, img, button, div');

    elements.forEach(el => {
      el.classList.add('edit-highlight');

      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const target = e.target as HTMLElement;

        if (target.tagName === 'IMG') {
          setSelectedElement({
            type: 'image',
            content: target.getAttribute('src') || '',
            xpath: getElementXPath(target)
          });
          setEditValue(target.getAttribute('src') || '');
        } else if (target.tagName === 'A') {
          setSelectedElement({
            type: 'link',
            content: target.getAttribute('href') || '',
            xpath: getElementXPath(target)
          });
          setEditValue(target.getAttribute('href') || '');
        } else {
          setSelectedElement({
            type: 'text',
            content: target.innerText || '',
            xpath: getElementXPath(target)
          });
          setEditValue(target.innerText || '');
        }
      });
    });
  };

  const applyEdit = () => {
    if (!selectedElement || !iframeRef.current?.contentDocument) return;

    const doc = iframeRef.current.contentDocument;
    const xpath = selectedElement.xpath;

    // Função para avaliar XPath
    const getElementByXPath = (path: string) => {
      const result = doc.evaluate(path, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue as HTMLElement;
    };

    const element = getElementByXPath(xpath);

    if (element) {
      if (selectedElement.type === 'text') {
        element.innerText = editValue;
      } else if (selectedElement.type === 'link') {
        element.setAttribute('href', editValue);
      } else if (selectedElement.type === 'image') {
        element.setAttribute('src', editValue);
        // Aplicar CSS para evitar repetição e garantir ajuste adequado
        const imgElement = element as HTMLImageElement;
        imgElement.style.objectFit = 'cover';
        imgElement.style.width = '100%';
        imgElement.style.height = '100%';
        // Trigger a visual update for the image if src changes
        imgElement.style.opacity = '0';
        setTimeout(() => {
          imgElement.style.opacity = '1';
        }, 50);
      }

      // Atualizar HTML editado
      setEditedHtml(doc.documentElement.outerHTML);
      setClonedHtml(doc.documentElement.outerHTML); // Also update clonedHtml

      toast({
        title: "Alteração aplicada!",
        description: "Elemento atualizado com sucesso",
      });
    }

    setSelectedElement(null);
    setEditValue("");
  };

  const handleImageDoubleClick = (img: HTMLImageElement) => {
    if (editMode) {
      const currentSrc = img.src;

      setEditingImage({
        element: img,
        oldUrl: currentSrc,
        newUrl: currentSrc
      });
      setCurrentImageUrl(currentSrc);
      setImageFile(null);
    }
  };

  const handleSaveImageEdit = () => {
    if (!editingImage || !currentImageUrl.trim()) {
      toast({
        title: "Erro",
        description: "URL da imagem é obrigatória",
        variant: "destructive"
      });
      return;
    }

    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    if (!iframe?.contentDocument) {
      toast({
        title: "Erro",
        description: "Iframe não encontrado",
        variant: "destructive"
      });
      return;
    }

    // Tentar encontrar a imagem de várias formas
    let img: HTMLImageElement | null = null;

    // 1. Tentar pela referência direta do elemento
    if (editingImage.element && iframe.contentDocument.contains(editingImage.element)) {
      img = editingImage.element;
    }

    // 2. Tentar pelo src exato
    if (!img) {
      img = iframe.contentDocument.querySelector(`img[src="${editingImage.oldUrl}"]`) as HTMLImageElement;
    }

    // 3. Tentar por todas as imagens e comparar src
    if (!img) {
      const allImages = iframe.contentDocument.querySelectorAll('img');
      for (const testImg of Array.from(allImages)) {
        if (testImg.src === editingImage.oldUrl) {
          img = testImg;
          break;
        }
      }
    }

    if (!img) {
      toast({
        title: "Erro",
        description: "Não foi possível encontrar a imagem na página",
        variant: "destructive",
      });
      return;
    }

    // Atualizar a imagem
    const oldSrc = img.src;
    img.src = currentImageUrl;

    // Aplicar CSS para evitar repetição e garantir ajuste adequado
    img.style.objectFit = 'cover';
    img.style.width = '100%';
    img.style.height = '100%';

    // Forçar recarga visual
    img.style.transition = 'opacity 0.3s';
    img.style.opacity = '0';
    setTimeout(() => {
      img!.style.opacity = '1';
    }, 100);

    // Atualizar HTML em memória
    if (iframe.contentDocument.documentElement) {
      const updatedHtml = iframe.contentDocument.documentElement.outerHTML;
      setClonedHtml(updatedHtml);
    }

    setEditingImage(null);
    setCurrentImageUrl('');
    setImageFile(null);

    toast({
      title: "Imagem atualizada!",
      description: "A imagem foi substituída com sucesso.",
    });
  };

  const handleSavePage = async () => {
    if (!pageName.trim()) {
      toast({
        title: "Erro",
        description: "Digite um nome para a página",
        variant: "destructive",
      });
      return;
    }

    if (!clonedHtml) {
      toast({
        title: "Erro",
        description: "Nenhuma página para salvar",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      // Obter HTML SEMPRE do iframe (garantir que todas as alterações sejam capturadas)
      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      let finalHtml = clonedHtml;

      if (iframe?.contentDocument?.documentElement) {
        finalHtml = iframe.contentDocument.documentElement.outerHTML;
      }

      const response = isEditingExisting
        ? await fetch('/api/update-cloned-page', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            credentials: 'include',
            body: JSON.stringify({
              name: pageName,
              html: finalHtml
            })
          })
        : await fetch('/api/save-cloned-page', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            credentials: 'include',
            body: JSON.stringify({
              name: pageName,
              html: finalHtml
            })
          });

      if (response.status === 401) {
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente.",
          variant: "destructive",
        });
        window.location.href = '/login';
        return;
      }

      if (!response.ok) throw new Error('Erro ao salvar página');

      const data = await response.json();

      // Atualizar HTML em memória com o HTML salvo
      setClonedHtml(finalHtml);

      toast({
        title: "Página salva!",
        description: `Sua página foi salva como "${data.originalName || data.name}"`,
      });

      setIsEditingExisting(true);
      setPageName(data.name);
      await loadSavedPages();

    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };


  if (featureBlocked) {
    return (
      <FeatureLockedOverlay 
        featureName="Clonador de Páginas" 
        description="Clone páginas de alta conversão em segundos. Disponível apenas para assinantes."
      />
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <SEO 
        title={seoConfig.clonador.title}
        description={seoConfig.clonador.description}
        canonicalUrl={seoConfig.clonador.canonical}
      />
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Globe className="h-8 w-8" />
          Clonador de Páginas
        </h1>
        <p className="text-muted-foreground">
          Clone qualquer página, edite visualmente e hospede no seu domínio
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Painel de Clonagem */}
        <Card>
          <CardHeader>
            <CardTitle>1. Clonar Página</CardTitle>
            <CardDescription>Digite a URL da página que deseja clonar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="url">URL da Página</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://exemplo.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <Button onClick={clonePage} className="w-full">
              <Globe className="mr-2 h-4 w-4" />
              Clonar Página
            </Button>
            
            <div className="text-center pt-2">
              <button 
                type="button"
                onClick={() => setShowVideoTutorialDialog(true)}
                className="text-sm text-primary hover:underline flex items-center justify-center gap-1 mx-auto"
                data-testid="link-video-tutorial"
              >
                <Eye className="h-4 w-4" />
                Veja como clonar um site fácil
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Painel de Configurar */}
        <Card>
          <CardHeader>
            <CardTitle>2. Configurar Domínio e Pixel</CardTitle>
            <CardDescription>Configure domínio personalizado e adicione códigos de rastreamento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Após clonar uma página, você poderá configurar seu domínio personalizado e instalar pixels de rastreamento.
            </p>

            {savedPages.length === 0 ? (
              <div className="bg-muted p-6 rounded-lg text-center space-y-2">
                <Globe className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                <p className="font-medium">Nenhuma página clonada ainda</p>
                <p className="text-sm text-muted-foreground">
                  Clone uma página primeiro e volte aqui para configurar domínio e pixels
                </p>
              </div>
            ) : (
              <Button 
                onClick={() => {
                  if (savedPages.length > 0) {
                    setCurrentPage(savedPages[0].name);
                    setShowTrackingDialog(true);
                  }
                }} 
                className="w-full"
                data-testid="button-configure"
              >
                <Settings className="mr-2 h-4 w-4" />
                Configurar
              </Button>
            )}
          </CardContent>
        </Card>
      </div>


      {/* Dialog de Edição */}
      <Dialog open={!!selectedElement} onOpenChange={() => setSelectedElement(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedElement?.type === 'text' && 'Editar Texto'}
              {selectedElement?.type === 'link' && 'Editar Link'}
              {selectedElement?.type === 'image' && 'Editar Imagem'}
            </DialogTitle>
            <DialogDescription>
              Faça as alterações desejadas no elemento selecionado
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>
                {selectedElement?.type === 'text' && 'Novo Texto'}
                {selectedElement?.type === 'link' && 'Nova URL do Link'}
                {selectedElement?.type === 'image' && 'Nova URL da Imagem'}
              </Label>
              {selectedElement?.type === 'text' ? (
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="Digite o novo texto"
                />
              ) : (
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="Digite a nova URL"
                  type="url"
                />
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={applyEdit} className="flex-1">
                Aplicar Alteração
              </Button>
              <Button variant="outline" onClick={() => setSelectedElement(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Configuração (Domínio e Pixel) */}
      <Dialog open={showTrackingDialog} onOpenChange={setShowTrackingDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurar Página Clonada
            </DialogTitle>
            <DialogDescription>
              Configure domínio personalizado e pixels de rastreamento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Seleção de Página */}
            <div>
              <Label htmlFor="page-select">Selecionar Página</Label>
              <Select value={currentPage} onValueChange={setCurrentPage}>
                <SelectTrigger id="page-select" className="mt-2" data-testid="select-page">
                  <SelectValue placeholder="Escolha uma página..." />
                </SelectTrigger>
                <SelectContent>
                  {savedPages.map((page) => (
                    <SelectItem key={page.name} value={page.name}>
                      {page.originalName || page.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {currentPage && (
              <div className="space-y-4">
                {/* Seção HEAD */}
                  <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="enable-head-code" className="font-semibold flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          Código no &lt;head&gt;
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Para pixels do Facebook/Meta, Google Analytics, GTM, etc.
                        </p>
                      </div>
                      <Switch
                        id="enable-head-code"
                        checked={enableHeadCode}
                        onCheckedChange={setEnableHeadCode}
                        data-testid="switch-enable-head"
                      />
                    </div>
                    {enableHeadCode && (
                      <Textarea
                        placeholder="Cole o código que será inserido no <head> da página..."
                        value={headCode}
                        onChange={(e) => setHeadCode(e.target.value)}
                        className="min-h-[120px] font-mono text-sm"
                        data-testid="textarea-head-code"
                      />
                    )}
                  </div>

                  {/* Seção BODY */}
                  <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="enable-body-code" className="font-semibold flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          Código no início do &lt;body&gt;
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Para scripts que precisam carregar no início da página
                        </p>
                      </div>
                      <Switch
                        id="enable-body-code"
                        checked={enableBodyCode}
                        onCheckedChange={setEnableBodyCode}
                        data-testid="switch-enable-body"
                      />
                    </div>
                    {enableBodyCode && (
                      <Textarea
                        placeholder="Cole o código que será inserido no início do <body>..."
                        value={bodyCode}
                        onChange={(e) => setBodyCode(e.target.value)}
                        className="min-h-[120px] font-mono text-sm"
                        data-testid="textarea-body-code"
                      />
                    )}
                  </div>

                  {/* Seção FOOTER */}
                  <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="enable-footer-code" className="font-semibold flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          Código antes do &lt;/body&gt; (Footer)
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Para scripts de conversão, chatbots ou que devem carregar por último
                        </p>
                      </div>
                      <Switch
                        id="enable-footer-code"
                        checked={enableFooterCode}
                        onCheckedChange={setEnableFooterCode}
                        data-testid="switch-enable-footer"
                      />
                    </div>
                    {enableFooterCode && (
                      <Textarea
                        placeholder="Cole o código que será inserido antes do </body>..."
                        value={footerCode}
                        onChange={(e) => setFooterCode(e.target.value)}
                        className="min-h-[120px] font-mono text-sm"
                        data-testid="textarea-footer-code"
                      />
                    )}
                  </div>

                  {/* Opções de Processamento */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                      <div className="space-y-1">
                        <Label htmlFor="remove-old-pixels" className="font-semibold">
                          Substituir pixels antigos
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Remove Google Analytics, Facebook Pixel, GTM e outros trackers da página original antes de adicionar os novos
                        </p>
                      </div>
                      <Switch
                        id="remove-old-pixels"
                        checked={removeOldPixels}
                        onCheckedChange={setRemoveOldPixels}
                        data-testid="switch-remove-old-pixels"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                      <div className="space-y-1">
                        <Label htmlFor="deactivate-other-scripts" className="font-semibold">
                          Desativar outros scripts
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Comenta/desativa scripts de terceiros não essenciais (chatbots, widgets, etc.)
                        </p>
                      </div>
                      <Switch
                        id="deactivate-other-scripts"
                        checked={deactivateOtherScripts}
                        onCheckedChange={setDeactivateOtherScripts}
                        data-testid="switch-deactivate-scripts"
                      />
                    </div>
                  </div>

                  <div className="bg-muted p-4 rounded-lg space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Como Funciona
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      O sistema analisa seu HTML e instala os códigos nas posições corretas automaticamente. 
                      Também identifica e remove/substitui pixels duplicados quando a opção está ativada.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={installPixel} 
                      className="flex-1"
                      disabled={isProcessing}
                      data-testid="button-install-pixel"
                    >
                      {isProcessing ? (
                        <>
                          <div className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          {(!enableHeadCode && !enableBodyCode && !enableFooterCode) ? 'Aplicar Configurações' : 'Instalar Scripts'}
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setShowTrackingDialog(false);
                      setHeadCode("");
                      setBodyCode("");
                      setFooterCode("");
                    }} disabled={isProcessing}>
                      Cancelar
                    </Button>
                  </div>
              </div>
            )}

            {!currentPage && (
              <div className="bg-muted p-6 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                  Selecione uma página acima para começar a configurar
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Páginas Salvas - Projetos */}
      {savedPages.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Suas Páginas Clonadas</CardTitle>
            <CardDescription>
              Total de {savedPages.length} página{savedPages.length !== 1 ? 's' : ''} criada{savedPages.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead>Visualizações</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {savedPages.map((page) => (
                  <TableRow key={page.name}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{page.originalName ?? (page.name.split('-').slice(1, -1).join('-') || page.name)}</span>
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
                      {page.createdAt && format(new Date(page.createdAt), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        <span>{page.viewCount || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {page.customDomain ? (
                          <code 
                            className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded max-w-[300px] truncate font-medium" 
                            title={`https://${page.customDomain}`}
                          >
                            https://{page.customDomain}
                          </code>
                        ) : (
                          <code 
                            className="text-xs bg-muted px-2 py-1 rounded max-w-[300px] truncate" 
                            title={`${window.location.origin}/pages/${page.name}`}
                          >
                            {`${window.location.origin}/pages/${page.name}`.length > 45 
                              ? `${window.location.origin}/pages/${page.name}`.substring(0, 45) + '...'
                              : `${window.location.origin}/pages/${page.name}`}
                          </code>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyPageLink(page.name)}
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
                          <DropdownMenuItem onClick={() => {
                            const url = page.customDomain 
                              ? `https://${page.customDomain}` 
                              : `${window.location.origin}/pages/${page.name}`;
                            window.open(url, '_blank');
                          }}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver Página
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openDomainConfig(page.name)}>
                            <Globe className="mr-2 h-4 w-4" />
                            Configurações de Domínio
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setCurrentPage(page.name);
                            setShowTrackingDialog(true);
                          }}>
                            <Settings className="mr-2 h-4 w-4" />
                            Configurar Scripts
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => startClonePage(page.name)}>
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
      )}

      {/* Dialog de Clonar Página Existente */}
      <Dialog open={showCloneDialog} onOpenChange={setShowCloneDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Clonar Página: {pageToClone}
            </DialogTitle>
            <DialogDescription>
              Digite um nome para a nova página clonada
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="clonedPageName">Nome da Nova Página</Label>
              <Input
                id="clonedPageName"
                placeholder="minha-pagina-clonada"
                value={clonedPageName}
                onChange={(e) => setClonedPageName(e.target.value)}
                className="mt-2"
                data-testid="input-cloned-page-name"
              />
              <p className="text-xs text-muted-foreground mt-1">
                A página será clonada e o editor será aberto automaticamente
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={cloneExistingPage} 
                className="flex-1"
                data-testid="button-clone-confirm"
              >
                <Save className="mr-2 h-4 w-4" />
                Clonar e Editar
              </Button>
              <Button variant="outline" onClick={() => {
                setShowCloneDialog(false);
                setClonedPageName("");
              }}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para Nomear Nova Página Clonada */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="h-5 w-5" />
              Salvar Página Clonada
            </DialogTitle>
            <DialogDescription>
              Digite um nome para salvar a página e abrir o editor
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newPageName">Nome do Projeto</Label>
              <Input
                id="newPageName"
                placeholder="minha-pagina"
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
                className="mt-2"
                data-testid="input-new-page-name"
              />
              <p className="text-xs text-muted-foreground mt-1">
                A página será salva e o editor será aberto em nova guia
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={saveAndOpenEditor} 
                className="flex-1"
                data-testid="button-save-and-edit"
              >
                <Save className="mr-2 h-4 w-4" />
                Salvar e Editar
              </Button>
              <Button variant="outline" onClick={() => {
                setShowNameDialog(false);
                setNewPageName("");
              }}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Configuração de Domínio - Interface Simplificada */}
      <Dialog open={showDomainDialog} onOpenChange={async (open) => {
        if (!open && customDomain.trim() && domainPageName) {
          const page = savedPages.find(p => p.name === domainPageName);
          if (page?.customDomain !== customDomain.trim()) {
            await saveDomainConfig();
          }
        }
        setShowDomainDialog(open);
        if (!open) {
          setDomainStatus('idle');
          setTxtRecords([]);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5" />
              Domínio Personalizado
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Domínio Input + Salvar */}
            <div className="flex gap-2">
              <Input
                id="domain-input-cloner"
                data-testid="input-custom-domain-cloner"
                placeholder="meusite.com ou app.meusite.com"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                className="flex-1 h-10"
              />
              <Button 
                onClick={async () => {
                  if (!customDomain.trim()) {
                    toast({ title: "Digite um domínio", variant: "destructive" });
                    return;
                  }
                  await saveDomainConfig();
                }} 
                disabled={isSavingDomain || !customDomain.trim()}
                data-testid="button-save-domain-cloner" 
                className="h-10 px-6"
                variant="default"
              >
                {isSavingDomain ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar
              </Button>
            </div>

            {/* Instruções rápidas */}
            <div className="text-sm text-muted-foreground space-y-1">
              <p>1. Digite seu domínio e clique em "Salvar"</p>
              <p>2. Configure os registros DNS abaixo no Cloudflare</p>
              <p>3. Aguarde 2-5 minutos para ativação do SSL</p>
              <p>4. Clique em "Verificar" para confirmar</p>
            </div>

            {/* DNS Records - Tabela */}
            {customDomain && (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-20">Tipo</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Nome</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Valor</th>
                      <th className="w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {/* CNAME Record */}
                    <tr>
                      <td className="px-3 py-2.5">
                        <code className="bg-muted px-2 py-1 rounded text-xs">CNAME</code>
                      </td>
                      <td className="px-3 py-2.5">
                        <code className="text-xs" data-testid="text-dns-name-cloner">{getDnsHostName(customDomain)}</code>
                      </td>
                      <td className="px-3 py-2.5">
                        <code className="text-xs font-medium" data-testid="text-dns-target-cloner">proxy.lowfy.com.br</code>
                      </td>
                      <td className="px-2 py-2.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          data-testid="button-copy-cname-cloner"
                          onClick={() => copyToClipboardDns('proxy.lowfy.com.br', 'CNAME')}
                          title="Copiar valor"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                    {/* TXT Records from API */}
                    {txtRecords.map((record, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2.5">
                          <code className="bg-muted px-2 py-1 rounded text-xs">TXT</code>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <code className="text-xs break-all block max-w-[180px]" title={record.name}>{record.name}</code>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 shrink-0"
                              data-testid={`button-copy-txt-name-${index}`}
                              onClick={() => {
                                navigator.clipboard.writeText(record.name);
                                toast({ title: "Nome copiado!" });
                              }}
                              title="Copiar nome"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <code className="text-xs break-all block max-w-[180px]" title={record.value}>{record.value}</code>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 shrink-0"
                              data-testid={`button-copy-txt-value-${index}`}
                              onClick={() => {
                                navigator.clipboard.writeText(record.value);
                                toast({ title: "Valor copiado!" });
                              }}
                              title="Copiar valor"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="px-2 py-2.5"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2.5 bg-muted/30 border-t text-sm text-muted-foreground">
                  Configure no Cloudflare com proxy ativado (nuvem laranja)
                </div>
              </div>
            )}

            {/* Aviso de propagação - sempre visível quando tem domínio */}
            {customDomain && domainStatus !== 'active' && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Dica:</strong> Você pode fechar este modal e continuar usando a plataforma normalmente. 
                  A propagação DNS pode levar de alguns minutos até 24 horas dependendo do seu provedor.
                </p>
              </div>
            )}

            {/* Link do vídeo tutorial */}
            <div className="text-center">
              <button 
                type="button"
                data-testid="button-video-tutorial-cloner"
                onClick={() => setShowVideoTutorialDialog(true)}
                className="text-sm text-muted-foreground underline hover:text-foreground"
              >
                Assista ao vídeo tutorial e veja como é fácil!
              </button>
            </div>

            {/* Status - Linha simples */}
            {domainStatus !== 'idle' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded border text-sm">
                  {domainStatus === 'active' ? (
                    <>
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-muted-foreground">{domainMessage || 'Domínio ativo'}</span>
                      <a
                        href={`https://${customDomain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-xs underline text-muted-foreground hover:text-foreground"
                        data-testid="link-open-domain"
                      >
                        Abrir
                      </a>
                    </>
                  ) : domainStatus === 'pending' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="text-muted-foreground">{domainMessage || 'Aguardando ativação...'}</span>
                    </>
                  ) : domainStatus === 'error' ? (
                    <>
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span className="text-muted-foreground">{domainMessage || 'Verifique o DNS'}</span>
                    </>
                  ) : null}
                </div>
                {domainStatus === 'pending' && (
                  <p className="text-xs text-muted-foreground text-center">
                    Você pode fechar este modal e continuar usando a plataforma. A propagação DNS pode levar até 24h.
                  </p>
                )}
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-2 pt-1">
              <Button 
                variant="outline" 
                onClick={() => setShowDomainDialog(false)} 
                className="flex-1 h-9 text-sm" 
                data-testid="button-cancel-domain-cloner"
              >
                Fechar
              </Button>
              <Button 
                onClick={handleVerifyDomain} 
                disabled={isVerifyingDomain || !customDomain.trim()} 
                data-testid="button-check-domain" 
                className="flex-1 h-9 text-sm"
                variant="default"
              >
                {isVerifyingDomain ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Verificar
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Vídeo Tutorial - Como Clonar Sites */}
      <Dialog open={showVideoTutorialDialog} onOpenChange={setShowVideoTutorialDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Como Clonar um Site Facilmente</DialogTitle>
            <DialogDescription>
              Assista ao tutorial e aprenda a clonar qualquer página em segundos
            </DialogDescription>
          </DialogHeader>
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <video
              controls
              poster="/videos/cloner-tutorial-thumb.jpg"
              className="w-full h-full"
              data-testid="video-tutorial-cloner"
            >
              <source src="/videos/cloner-tutorial.mp4" type="video/mp4" />
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