import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Save, X, Edit, Image as ImageIcon, Link as LinkIcon, Type, Code2, Moon, Sun, Wand2, Search, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

loader.config({ monaco });

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export default function PageClonerPreview() {
  const [html, setHtml] = useState("");
  const [editedHtml, setEditedHtml] = useState("");
  const [isViewMode, setIsViewMode] = useState(false);
  const [editMode, setEditMode] = useState(true);
  const [selectedElement, setSelectedElement] = useState<{
    type: 'text' | 'link' | 'image' | 'button';
    content: string;
    xpath: string;
    href?: string;
    text?: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editText, setEditText] = useState("");
  const [pageName, setPageName] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [codeInModal, setCodeInModal] = useState("");
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'vs'>('vs-dark');
  const editorRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Estado para armazenar o nome da página atual
  const [currentPageName, setCurrentPageName] = useState("");

  // Novos estados para o diálogo de edição de imagem
  const [showImageEditDialog, setShowImageEditDialog] = useState(false);
  const [editImageUrl, setEditImageUrl] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState(""); // Novo estado para URL do preview
  const [imageUploadFile, setImageUploadFile] = useState<File | null>(null); // Estado para o arquivo de upload

  useEffect(() => {
    // Pegar o sessionId e pageName da URL
    const urlParams = new URLSearchParams(window.location.search);
    const session = urlParams.get('session');
    const page = urlParams.get('page');
    const viewMode = urlParams.get('view') === 'true';

    // Se for modo visualização, desabilitar edição
    if (viewMode) {
      setIsViewMode(true);
      setEditMode(false);
    }

    if (!session) {
      toast({
        title: "Erro",
        description: "Sessão inválida",
        variant: "destructive",
      });
      setTimeout(() => setLocation('/clonador'), 2000);
      return;
    }

    setSessionId(session);

    // SEMPRE buscar do servidor usando o nome da página
    if (!page) {
      toast({
        title: "Erro",
        description: "Nome da página não informado",
        variant: "destructive",
      });
      setTimeout(() => setLocation('/clonador'), 2000);
      return;
    }

    setPageName(page);
    setCurrentPageName(page);
    
    // BUSCAR HTML DO SERVIDOR (não usa localStorage - muito grande)
    const loadPageFromServer = async () => {
      try {
        const response = await fetch(`/api/get-cloned-page/${page}`, {
          credentials: 'include',
          headers: { ...getAuthHeaders() }
        });
        
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        
        if (!response.ok) throw new Error('Página não encontrada');
        
        const data = await response.json();
        if (data.html) {
          setHtml(data.html);
          setEditedHtml(data.html);
        } else {
          throw new Error('HTML não recebido');
        }
      } catch (error: any) {
        toast({
          title: "Erro ao carregar",
          description: error.message || "Não foi possível carregar a página",
          variant: "destructive",
        });
        setTimeout(() => setLocation('/clonador'), 2000);
      }
    };
    
    loadPageFromServer();
  }, [setLocation, toast]);

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

    // REMOVER COMPLETAMENTE todos os estilos de edição anteriores
    const existingStyles = doc.querySelectorAll('style[data-edit-mode]');
    existingStyles.forEach(s => s.remove());

    // REMOVER todas as classes de edição de todos os elementos
    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
      el.classList.remove('edit-hover', 'edit-hover-active', 'edit-highlight');
    });

    // Se o modo de edição NÃO estiver ativo, parar aqui
    if (!editMode) return;

    // Adicionar estilos SOMENTE para hover (SEM tracejados permanentes)
    const style = doc.createElement('style');
    style.setAttribute('data-edit-mode', 'true');
    style.textContent = `
      /* Estilo de hover sem overlay de tela cheia */
      .edit-hoverable:hover { 
        outline: 3px solid #2563eb !important; 
        background-color: rgba(59, 130, 246, 0.1) !important; 
        cursor: pointer !important;
      }
    `;
    doc.head.appendChild(style);

    // Selecionar elementos editáveis básicos - EXPANDIDO para capturar mais elementos
    const basicElements = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, img, button, input[type="button"], input[type="submit"], div, label, li, td, th, figcaption, blockquote, strong, em, i, b, small, mark, del, ins, sub, sup, code, pre, cite, q, abbr, time, caption');

    // NOVO: Buscar TODOS os elementos com background-image (inline style ou computado)
    const allDivs = doc.querySelectorAll('*');
    const elementsWithBgImage: Element[] = [];

    allDivs.forEach(el => {
      const computedStyle = window.getComputedStyle(el);
      const bgImage = computedStyle.backgroundImage;

      // Se tem background-image E não é 'none' E contém 'url'
      if (bgImage && bgImage !== 'none' && bgImage.includes('url')) {
        elementsWithBgImage.push(el);
      }
    });

    // Combinar todos os elementos editáveis
    const allEditableElements = new Set([...basicElements, ...elementsWithBgImage]);

    allEditableElements.forEach(el => {
      // Adicionar APENAS a classe para hover (sem estilo visível permanente)
      el.classList.add('edit-hoverable');

      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const target = e.target as HTMLElement;

        // Verificar se é uma imagem de background (inline ou computado)
        const computedStyle = window.getComputedStyle(target);
        const bgImage = computedStyle.backgroundImage;
        const hasBgImage = bgImage && bgImage !== 'none' && bgImage.includes('url');

        if (target.tagName === 'IMG') {
          const currentSrc = target.getAttribute('src') || '';
          setSelectedElement({
            type: 'image',
            content: currentSrc,
            xpath: getElementXPath(target)
          });
          setEditImageUrl(currentSrc);
          setPreviewImageUrl(`${currentSrc}?t=${Date.now()}`);
          setShowImageEditDialog(true);
        } else if (hasBgImage) {
          // Extrair URL do background-image
          const urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
          const bgUrl = urlMatch ? urlMatch[1] : '';

          setSelectedElement({
            type: 'image',
            content: bgUrl,
            xpath: getElementXPath(target)
          });
          setEditImageUrl(bgUrl);
          setPreviewImageUrl(`${bgUrl}?t=${Date.now()}`);
          setShowImageEditDialog(true);
        } else if (target.tagName === 'A') {
          // É um link
          const currentHref = target.getAttribute('href') || '';
          const currentText = target.textContent || '';
          setSelectedElement({
            type: 'link',
            content: currentText,
            href: currentHref,
            xpath: getElementXPath(target)
          });
        } else if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' && (target.getAttribute('type') === 'button' || target.getAttribute('type') === 'submit')) {
          // É um botão
          const currentText = target.textContent || target.getAttribute('value') || '';
          setSelectedElement({
            type: 'button',
            content: currentText,
            xpath: getElementXPath(target)
          });
        } else {
          // É texto (p, h1, h2, span, div, etc.)
          const currentText = target.textContent || '';
          setSelectedElement({
            type: 'text',
            content: currentText,
            xpath: getElementXPath(target)
          });
        }
      });
    });
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;

    // Validar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Use apenas imagens (JPG, PNG, GIF, WEBP)",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo é 5MB",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
      toast({
        title: "Fazendo upload...",
        description: "Aguarde enquanto a imagem é enviada",
      });

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { ...getAuthHeaders() },
        credentials: 'include',
        body: formData,
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
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao fazer upload');
      }

      const data = await response.json();

      // Atualizar o campo URL com a URL do upload
      setEditImageUrl(data.url);
      
      // Atualizar o preview da imagem com cache-bust para forçar reload
      setPreviewImageUrl(`${data.url}?t=${Date.now()}`);

      // Mostrar feedback com a URL
      toast({
        title: "Upload concluído!",
        description: "URL da imagem atualizada. Clique em 'Aplicar Alteração' para substituir.",
      });

    } catch (error: any) {
      toast({
        title: "Erro no Upload",
        description: error.message || "Não foi possível fazer upload da imagem",
        variant: "destructive",
      });
    }
  };

  const handleImageChange = async (newImageUrl: string) => {
    if (!selectedElement) {
      return;
    }

    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) {
      return;
    }

    try {
      // Garantir que a URL está correta e adicionar cache-bust
      let finalUrl = newImageUrl;
      if (newImageUrl.startsWith('/uploads/')) {
        finalUrl = `${window.location.origin}${newImageUrl}`;
      }

      // Adicionar timestamp único para forçar bypass do cache
      const cacheBust = Date.now() + Math.random();
      const urlWithCacheBust = finalUrl.includes('?') 
        ? `${finalUrl}&_cb=${cacheBust}` 
        : `${finalUrl}?_cb=${cacheBust}`;


      // Usar XPath para localizar e atualizar o elemento diretamente no iframe
      const doc = iframe.contentDocument;
      if (!doc) {
        throw new Error('Documento do iframe não disponível');
      }

      const getElementByXPath = (path: string) => {
        const result = doc.evaluate(path, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        return result.singleNodeValue as HTMLElement;
      };

      const element = getElementByXPath(selectedElement.xpath);

      if (!element) {
        throw new Error('Elemento não encontrado no iframe');
      }


      // Atualizar elemento com a nova URL + cache-bust
      if (element.tagName === 'IMG') {
        const img = element as HTMLImageElement;
        
        // FORÇA total - remover atributo src e recriar
        img.removeAttribute('src');
        img.removeAttribute('srcset'); // Remover srcset se existir
        
        // Forçar reload com delay
        await new Promise(resolve => setTimeout(resolve, 50));
        img.setAttribute('src', urlWithCacheBust);
        
        // Aplicar CSS para evitar repetição e garantir ajuste adequado
        img.style.objectFit = 'cover';
        img.style.width = '100%';
        img.style.height = '100%';
        
      } else {
        const currentStyle = element.getAttribute('style') || '';
        
        // Remover propriedades de background existentes para garantir configuração limpa
        const cleanedStyle = currentStyle
          .replace(/background-image:\s*url\([^)]+\);?/gi, '')
          .replace(/background-size:\s*[^;]+;?/gi, '')
          .replace(/background-repeat:\s*[^;]+;?/gi, '')
          .replace(/background-position:\s*[^;]+;?/gi, '')
          .trim();
        
        // Adicionar background-image com propriedades para evitar repetição
        const newStyle = cleanedStyle ? 
          `${cleanedStyle}; background-image: url('${urlWithCacheBust}'); background-size: cover; background-repeat: no-repeat; background-position: center;` : 
          `background-image: url('${urlWithCacheBust}'); background-size: cover; background-repeat: no-repeat; background-position: center;`;
        element.setAttribute('style', newStyle);
      }

      // Extrair HTML atualizado
      const updatedHtml = doc.documentElement.outerHTML;
      setEditedHtml(updatedHtml);

      // FORÇAR RELOAD COMPLETO DO IFRAME - Método ULTRA agressivo

      // 1. Resetar completamente
      iframe.src = 'about:blank';
      
      // 2. Aguardar reset
      await new Promise(resolve => setTimeout(resolve, 100));

      // 3. Criar novo iframe temporário (força cache invalidation)
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = updatedHtml;
      
      // 4. Aplicar ao iframe com srcdoc vazio primeiro
      iframe.srcdoc = '';
      
      // 5. Aguardar limpeza
      await new Promise(resolve => setTimeout(resolve, 100));

      // 6. Aplicar HTML final
      iframe.srcdoc = updatedHtml;

      // 7. Aguardar load completo
      await new Promise(resolve => {
        const onLoad = () => {
          iframe.removeEventListener('load', onLoad);
          resolve(true);
        };
        iframe.addEventListener('load', onLoad);
        setTimeout(() => resolve(true), 1000);
      });

      // Fechar modal e mostrar toast
      setSelectedElement(null);
      setShowImageEditDialog(false);
      setEditImageUrl("");
      setPreviewImageUrl("");
      setImageUploadFile(null);

      toast({
        title: "✅ Imagem Atualizada!",
        description: "A alteração foi aplicada com sucesso",
      });

      // Reconfigurar modo de edição após reload
      if (editMode) {
        setTimeout(() => setupEditMode(), 500);
      }

    } catch (error) {
      toast({
        title: "Erro ao alterar imagem",
        description: error instanceof Error ? error.message : "Tente novamente ou use outra URL",
        variant: "destructive",
      });
    }
  };

  // Handler para aplicar a edição de imagem (chamado pelo modal de imagem)
  const applyImageEdit = async () => {

    if (!editImageUrl || !editImageUrl.trim()) {
      toast({
        title: "Erro",
        description: "Digite uma URL válida ou faça upload de uma imagem",
        variant: "destructive",
      });
      return;
    }

    // Aplicar a mudança e aguardar conclusão
    await handleImageChange(editImageUrl);
  };


  const applyEdit = () => {
    if (!selectedElement || !iframeRef.current?.contentDocument) return;

    const doc = iframeRef.current.contentDocument;
    const xpath = selectedElement.xpath;

    const getElementByXPath = (path: string) => {
      const result = doc.evaluate(path, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue as HTMLElement;
    };

    const element = getElementByXPath(xpath);

    if (element) {
      if (selectedElement.type === 'text') {
        element.innerText = editValue;
      } else if (selectedElement.type === 'link') {
        if (editValue) element.setAttribute('href', editValue);
        if (editText) element.textContent = editText;
      } else if (selectedElement.type === 'image') {
        // Limpar a URL para evitar múltiplos cache-busts
        const cleanUrl = editValue.split('?')[0];
        const timestamp = Date.now();
        const finalUrl = `${cleanUrl}?t=${timestamp}`;

        // Verificar se é uma tag IMG ou um background-image
        if (element.tagName === 'IMG') {
          element.setAttribute('src', finalUrl);
          // Forçar reload da imagem
          element.setAttribute('loading', 'eager');
          // Aplicar CSS para evitar repetição e garantir ajuste adequado
          const imgElement = element as HTMLImageElement;
          imgElement.style.objectFit = 'cover';
          imgElement.style.width = '100%';
          imgElement.style.height = '100%';
        } else {
          // É um background-image - atualizar o style
          const currentStyle = element.getAttribute('style') || '';

          // Remover propriedades de background existentes para garantir configuração limpa
          const cleanedStyle = currentStyle
            .replace(/background-image:\s*url\([^)]+\);?/gi, '')
            .replace(/background-size:\s*[^;]+;?/gi, '')
            .replace(/background-repeat:\s*[^;]+;?/gi, '')
            .replace(/background-position:\s*[^;]+;?/gi, '')
            .trim();

          // Adicionar novo background-image com propriedades para evitar repetição
          const newStyle = cleanedStyle ? 
            `${cleanedStyle}; background-image: url('${finalUrl}'); background-size: cover; background-repeat: no-repeat; background-position: center;` : 
            `background-image: url('${finalUrl}'); background-size: cover; background-repeat: no-repeat; background-position: center;`;

          element.setAttribute('style', newStyle);
        }
      } else if (selectedElement.type === 'button') {
        if (editText) element.textContent = editText;
        // Adicionar suporte para alterar href/onclick de botões
        if (editValue) {
          // Se o botão tem href (pode ser um <a> estilizado como botão)
          if (element.tagName === 'A') {
            element.setAttribute('href', editValue);
          } else {
            // Se é um button ou input, tentar adicionar onclick para redirecionar
            element.setAttribute('onclick', `window.location.href='${editValue}'`);
          }
        }
      }

      const newHtml = doc.documentElement.outerHTML;
      setEditedHtml(newHtml);

      // Para imagens, forçar reload COMPLETO do iframe para garantir atualização
      if (selectedElement.type === 'image') {
        const iframe = iframeRef.current;
        if (iframe) {
          // Método mais agressivo: criar um novo iframe temporário e substituir
          iframe.srcdoc = '';

          // Pequeno delay para garantir limpeza
          setTimeout(() => {
            iframe.srcdoc = newHtml;

            // Aguardar load do iframe e então reconfigurar o modo de edição
            iframe.onload = () => {
              setTimeout(() => {
                if (editMode) {
                  setupEditMode();
                }
              }, 100);
            };
          }, 100);
        }
      }

      toast({
        title: "Alteração aplicada!",
        description: "Elemento atualizado com sucesso",
      });
    }

    setSelectedElement(null);
    setEditValue("");
    setEditText("");
  };

  const formatHtml = (html: string): string => {
    // Formatar HTML com indentação adequada
    let formatted = html;
    let indent = 0;
    const lines: string[] = [];

    // Remover espaços extras
    formatted = formatted.replace(/>\s+</g, '><');

    // Adicionar quebras de linha nas tags
    formatted = formatted.replace(/(<\/?[^>]+>)/g, '\n$1');

    // Processar cada linha
    formatted.split('\n').forEach(line => {
      line = line.trim();
      if (line.length === 0) return;

      // Diminuir indentação para tags de fechamento
      if (line.match(/^<\//) && indent > 0) {
        indent--;
      }

      // Adicionar indentação
      lines.push('  '.repeat(indent) + line);

      // Aumentar indentação para tags de abertura (exceto auto-fechadas)
      if (line.match(/^<[^\/][^>]*[^\/]>$/)) {
        indent++;
      }
    });

    return lines.join('\n');
  };

  const openCodeModal = () => {
    // Usar o HTML editado diretamente - se vazio, usar um placeholder
    const htmlToShow = editedHtml || '<!-- Nenhum HTML disponível -->';
    setCodeInModal(htmlToShow);
    setIsCodeModalOpen(true);
  };

  const formatCodeInEditor = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
      toast({
        title: "Código Formatado!",
        description: "O código foi indentado automaticamente",
      });
    }
  };

  const openSearchInEditor = () => {
    if (editorRef.current) {
      editorRef.current.getAction('actions.find')?.run();
    }
  };

  const applyCodeChanges = () => {
    setEditedHtml(codeInModal);
    setIsCodeModalOpen(false);

    toast({
      title: "Código Aplicado!",
      description: "O HTML foi atualizado com sucesso. Clique em 'Salvar' para persistir.",
    });
  };

  const savePage = async () => {
    if (!pageName) {
      toast({
        title: "Erro",
        description: "Nome da página não encontrado",
        variant: "destructive",
      });
      return;
    }

    try {

      // Usar o endpoint de atualização para salvar as alterações
      const response = await fetch("/api/update-cloned-page", {
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
        title: "✅ Alterações Salvas!",
        description: `As alterações foram salvas com sucesso`,
      });

      // Aguardar um pouco para o toast ser visível e então redirecionar
      setTimeout(() => {
        // Fechar a aba atual e focar na aba do clonador
        window.close();

        // Se não conseguir fechar (algumas browsers bloqueiam), redirecionar
        setTimeout(() => {
          setLocation('/clonador');
        }, 100);
      }, 1500);
    } catch (error: any) {
      console.error('❌ Erro ao salvar página:', error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (editMode && editedHtml && iframeRef.current) {
      const iframe = iframeRef.current;

      iframe.onload = () => {
        setupEditMode();
      };
    }
  }, [editMode, editedHtml]);

  // Atualizar campos de edição quando o elemento for selecionado
  useEffect(() => {
    if (selectedElement) {
      if (selectedElement.type === 'text') {
        setEditValue(selectedElement.content);
      } else if (selectedElement.type === 'link') {
        setEditText(selectedElement.content);
        setEditValue(selectedElement.href || '');
      } else if (selectedElement.type === 'button') {
        setEditText(selectedElement.content);
        setEditValue('');
      }
    }
  }, [selectedElement]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Barra Superior */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">{isViewMode ? 'Visualização de Página' : 'Editor Visual de Página'}</h1>
          {!isViewMode && (
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-md">
              <Edit className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-600 font-medium">
                {editMode ? 'Modo Edição Ativo - Clique em qualquer elemento' : 'Modo Visualização'}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isViewMode && (
            <>
              <Button
                onClick={() => setEditMode(!editMode)}
                variant={editMode ? "default" : "outline"}
                size="sm"
              >
                <Edit className="mr-2 h-4 w-4" />
                {editMode ? 'Desativar Edição' : 'Ativar Edição'}
              </Button>

              <Button 
                onClick={openCodeModal} 
                variant="outline" 
                size="sm"
                data-testid="button-view-code"
              >
                <Code2 className="mr-2 h-4 w-4" />
                Ver Código
              </Button>

              <Button onClick={savePage} size="sm" data-testid="button-save-changes">
                <Save className="mr-2 h-4 w-4" />
                Salvar Alterações
              </Button>
            </>
          )}

          <Button
            onClick={() => setLocation('/clonador')}
            variant="outline"
            size="sm"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Preview em Tela Cheia */}
      <div className="flex-1 overflow-hidden">
        {editedHtml ? (
          <iframe
            ref={iframeRef}
            srcDoc={editedHtml}
            className="w-full h-full border-0"
            title="preview"
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-100">
            <div className="text-center">
              <p className="text-gray-600 mb-2">Carregando página...</p>
              <p className="text-sm text-gray-400">Se a página não carregar, volte e clone novamente</p>
            </div>
          </div>
        )}
      </div>

      {/* Dialog de Edição de Texto/Link/Botão */}
      <Dialog open={!!selectedElement && selectedElement.type !== 'image'} onOpenChange={() => setSelectedElement(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedElement?.type === 'text' && <><Type className="h-5 w-5" /> Editar Texto</>}
              {selectedElement?.type === 'link' && <><LinkIcon className="h-5 w-5" /> Editar Link</>}
              {selectedElement?.type === 'button' && <><Type className="h-5 w-5" /> Editar Botão</>}
            </DialogTitle>
            <DialogDescription>
              Faça as alterações desejadas no elemento selecionado
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Campo de TEXTO para links e botões */}
            {(selectedElement?.type === 'link' || selectedElement?.type === 'button') && (
              <div>
                <Label>Texto do {selectedElement.type === 'link' ? 'Link' : 'Botão'}</Label>
                <Input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder={`Digite o texto do ${selectedElement.type === 'link' ? 'link' : 'botão'}`}
                  className="mt-2"
                />
              </div>
            )}

            {/* Campo de URL para links E botões */}
            {(selectedElement?.type === 'link' || selectedElement?.type === 'button') && (
              <div>
                <Label>URL do {selectedElement.type === 'link' ? 'Link' : 'Botão'}</Label>
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="Digite a URL (exemplo: https://google.com)"
                  type="url"
                  className="mt-2"
                />
              </div>
            )}

            {/* Campo de texto simples */}
            {selectedElement?.type === 'text' && (
              <div>
                <Label>Novo Texto</Label>
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="Digite o novo texto"
                  className="mt-2"
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={applyEdit} className="flex-1" disabled={uploadingImage}>
                Aplicar Alteração
              </Button>
              <Button variant="outline" onClick={() => setSelectedElement(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição de Imagem */}
      <Dialog open={showImageEditDialog} onOpenChange={() => {
        setShowImageEditDialog(false);
        setSelectedElement(null);
        setEditImageUrl("");
        setPreviewImageUrl(""); // Limpar preview ao fechar
        setImageUploadFile(null);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Editar Imagem
            </DialogTitle>
            <DialogDescription>
              Faça as alterações desejadas no elemento selecionado
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="imageUrl">URL da Imagem</Label>
              <Input
                id="imageUrl"
                type="url"
                value={editImageUrl}
                onChange={(e) => {
                  setEditImageUrl(e.target.value);
                  // Atualiza o preview com cache-bust assim que a URL é digitada
                  setPreviewImageUrl(`${e.target.value}?t=${Date.now()}`);
                }}
                placeholder="https://exemplo.com/imagem.jpg ou /uploads/images/imagem.jpg"
                className="mt-2"
              />
              {previewImageUrl && ( // Usa previewImageUrl para o src da imagem
                <div className="mt-3 p-4 bg-muted/50 rounded-lg border-2 border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-primary">Preview da Imagem:</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-md p-2 border">
                    <img 
                      src={previewImageUrl}
                      alt="Preview" 
                      className="w-full max-h-48 object-contain rounded"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/150?text=Erro+ao+carregar';
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    ✓ Imagem carregada - Clique em "Aplicar Alteração" para substituir
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1 border-t"></div>
              <span className="text-sm text-muted-foreground">OU</span>
              <div className="flex-1 border-t"></div>
            </div>

            <div>
              <Label htmlFor="imageUpload" className="cursor-pointer">
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
                  <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Clique para fazer upload de uma imagem
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG, GIF, WEBP até 5MB
                  </p>
                </div>
              </Label>
              <input
                id="imageUpload"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImageUploadFile(file);
                    handleImageUpload(file);
                  }
                }}
              />
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={applyImageEdit} 
                className="flex-1"
                disabled={!editImageUrl.trim()}
              >
                <Check className="h-4 w-4 mr-2" />
                Aplicar Alteração
              </Button>
              <Button variant="outline" onClick={() => {
                setShowImageEditDialog(false);
                setSelectedElement(null);
                setEditImageUrl("");
                setPreviewImageUrl(""); // Limpar preview
                setImageUploadFile(null);
              }}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Visualização/Edição de Código HTML */}
      <Dialog open={isCodeModalOpen} onOpenChange={setIsCodeModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code2 className="h-5 w-5" />
              Visualizar/Editar Código HTML
            </DialogTitle>
            <DialogDescription>
              Visualize e edite o código HTML completo da página. As alterações serão aplicadas ao clicar em "Aplicar Alterações".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto max-h-[calc(90vh-200px)]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Tema do Editor:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditorTheme(editorTheme === 'vs-dark' ? 'vs' : 'vs-dark')}
                >
                  {editorTheme === 'vs-dark' ? (
                    <>
                      <Sun className="h-4 w-4 mr-2" />
                      Claro
                    </>
                  ) : (
                    <>
                      <Moon className="h-4 w-4 mr-2" />
                      Escuro
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={formatCodeInEditor}
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  Indentar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openSearchInEditor}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
                </Button>
              </div>
              <div className="text-sm text-muted-foreground bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-md flex gap-4">
                <span>
                  Busca: <kbd className="bg-white dark:bg-gray-700 px-2 py-0.5 rounded border">Ctrl+F</kbd>
                </span>
                <span>
                  Formatar: <kbd className="bg-white dark:bg-gray-700 px-2 py-0.5 rounded border">Shift+Alt+F</kbd>
                </span>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900">
              <Editor
                height="45vh"
                defaultLanguage="html"
                value={codeInModal}
                onChange={(value) => setCodeInModal(value || '')}
                theme={editorTheme}
                onMount={(editor) => {
                  editorRef.current = editor;
                }}
                loading={<div className="h-[45vh] flex items-center justify-center"><p className="text-muted-foreground">Carregando editor...</p></div>}
                options={{
                  minimap: { enabled: true },
                  fontSize: 13,
                  lineNumbers: 'on',
                  roundedSelection: true,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: 'off',
                  folding: true,
                  formatOnPaste: true,
                  formatOnType: true,
                  bracketPairColorization: { enabled: true },
                  autoIndent: 'full',
                  find: {
                    addExtraSpaceOnTop: false,
                    autoFindInSelection: 'never',
                    seedSearchStringFromSelection: 'always',
                  },
                  scrollbar: {
                    vertical: 'visible',
                    horizontal: 'visible',
                    verticalScrollbarSize: 10,
                    horizontalScrollbarSize: 10
                  }
                }}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setIsCodeModalOpen(false)}
                data-testid="button-cancel-code"
              >
                Cancelar
              </Button>
              <Button 
                onClick={applyCodeChanges}
                data-testid="button-apply-code"
              >
                Aplicar Alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}