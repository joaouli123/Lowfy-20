import { useState, useEffect } from "react";
const isDev = import.meta.env.DEV;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Save, Eye, Trash2, Settings, Globe, Code2, Video,
  Type, MousePointer, Image as ImageIcon, Layout, FileText,
  ChevronDown, ChevronUp, GripVertical, Copy, Download, ExternalLink,
  X, ArrowLeft, Check, Monitor, Tablet, Smartphone
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { useLocation } from "wouter";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDraggable,
  useDroppable,
  DragOverlay,
  DragStartEvent,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Função para extrair o nome correto do host para DNS
function getDnsHostName(domain: string | null | undefined): string {
  if (!domain) return '@';
  const parts = domain.toLowerCase().split('.');
  const isCompositeTld = parts.length >= 2 && 
    ['br', 'ar', 'mx', 'uk', 'au', 'nz', 'za', 'in', 'jp'].includes(parts[parts.length - 1]);
  const apexPartsCount = isCompositeTld ? 3 : 2;
  if (parts.length > apexPartsCount) {
    return parts[0];
  }
  return '@';
}

interface PreSellElement {
  id: string;
  type: 'headline' | 'subheadline' | 'video' | 'text' | 'button' | 'image' | 'divider' | 'countdown';
  content: string;
  styles?: {
    textAlign?: 'left' | 'center' | 'right';
    fontSize?: string;
    color?: string;
    backgroundColor?: string;
    paddingTop?: string;
    paddingRight?: string;
    paddingBottom?: string;
    paddingLeft?: string;
    marginTop?: string;
    marginRight?: string;
    marginBottom?: string;
    marginLeft?: string;
    buttonUrl?: string;
    videoUrl?: string;
    imageUrl?: string;
    countdownDate?: string;
    countdownTextColor?: string;
    countdownBgColor?: string;
    countdownPrefix?: string;
    buttonDelay?: number;
    buttonEffect?: 'none' | 'pulse' | 'shake' | 'bounce' | 'glow';
  };
}

interface PreSellPage {
  name: string;
  elements: PreSellElement[];
  settings: {
    backgroundColor: string;
    maxWidth: string;
    fontFamily: string;
  };
  scripts?: {
    head?: string;
    body?: string;
    footer?: string;
  };
  customDomain?: string;
}

type ViewportSize = 'desktop' | 'tablet' | 'mobile';

const viewportSizes: Record<ViewportSize, string> = {
  desktop: 'max-w-4xl',
  tablet: 'max-w-2xl',
  mobile: 'max-w-md'
};

interface SortableElementProps {
  element: PreSellElement;
  index: number;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  convertToEmbedUrl: (url: string) => string;
}

function SortableElement({ 
  element, 
  index, 
  isSelected, 
  isFirst, 
  isLast, 
  onSelect, 
  onMoveUp, 
  onMoveDown, 
  onDuplicate, 
  onDelete,
  convertToEmbedUrl 
}: SortableElementProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: element.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const paddingStyle = `${element.styles?.paddingTop || '0px'} ${element.styles?.paddingRight || '0px'} ${element.styles?.paddingBottom || '0px'} ${element.styles?.paddingLeft || '0px'}`;
  const marginStyle = `${element.styles?.marginTop || '0px'} ${element.styles?.marginRight || '0px'} ${element.styles?.marginBottom || '0px'} ${element.styles?.marginLeft || '0px'}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative p-5 rounded-xl border-2 transition-all duration-300 ${
        isSelected
          ? 'border-primary bg-primary/5 shadow-lg ring-4 ring-primary/10'
          : 'border-border/50 hover:border-primary/40 hover:shadow-md hover:bg-accent/5'
      }`}
      data-testid={`element-${element.type}-${index}`}
    >
      {/* Drag Handle */}
      <div 
        {...attributes} 
        {...listeners}
        className="absolute -left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-grab active:cursor-grabbing bg-background border-2 border-border rounded-lg shadow-md p-2 hover:bg-accent hover:scale-110"
        data-testid={`drag-handle-${element.id}`}
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>

      {/* Controls */}
      <div className="absolute -top-4 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 bg-background border-2 border-border rounded-lg shadow-md p-1">
        <Button
          data-testid={`button-move-up-${element.id}`}
          size="sm"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          disabled={isFirst}
          className="h-8 w-8 p-0 hover:bg-accent/80 transition-all duration-200"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          data-testid={`button-move-down-${element.id}`}
          size="sm"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          disabled={isLast}
          className="h-8 w-8 p-0 hover:bg-accent/80 transition-all duration-200"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button
          data-testid={`button-duplicate-${element.id}`}
          size="sm"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          className="h-8 w-8 p-0 hover:bg-accent/80 transition-all duration-200"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          data-testid={`button-delete-${element.id}`}
          size="sm"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/15 transition-all duration-200"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Element Content */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        style={{ padding: paddingStyle, margin: marginStyle }}
        className="cursor-pointer"
      >
        {element.type === 'headline' && (
          <h1 style={{
            textAlign: element.styles?.textAlign,
            fontSize: element.styles?.fontSize,
            color: element.styles?.color,
            margin: 0
          }}>
            {element.content}
          </h1>
        )}

        {element.type === 'subheadline' && (
          <h2 style={{
            textAlign: element.styles?.textAlign,
            fontSize: element.styles?.fontSize,
            color: element.styles?.color,
            margin: 0
          }}>
            {element.content}
          </h2>
        )}

        {element.type === 'video' && (
          <div style={{ textAlign: element.styles?.textAlign }}>
            {element.styles?.videoUrl ? (
              <iframe
                width="100%"
                height="400"
                src={convertToEmbedUrl(element.styles.videoUrl)}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="rounded-lg"
              ></iframe>
            ) : (
              <div className="bg-gray-200 rounded flex items-center justify-center aspect-video">
                <Video className="h-12 w-12 text-gray-400" />
              </div>
            )}
          </div>
        )}

        {element.type === 'text' && (
          <p style={{
            textAlign: element.styles?.textAlign,
            fontSize: element.styles?.fontSize,
            color: element.styles?.color,
            margin: 0,
            whiteSpace: 'pre-wrap'
          }}>
            {element.content}
          </p>
        )}

        {element.type === 'button' && (
          <div style={{ textAlign: element.styles?.textAlign }}>
            <button style={{
              backgroundColor: element.styles?.backgroundColor,
              color: element.styles?.color,
              fontSize: element.styles?.fontSize,
              padding: '18px 40px',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}>
              {element.content}
            </button>
            {element.styles?.buttonDelay && element.styles.buttonDelay > 0 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                ⏱️ Aparece após {element.styles.buttonDelay}s
              </p>
            )}
          </div>
        )}

        {element.type === 'image' && (
          <div style={{ textAlign: element.styles?.textAlign }}>
            {element.styles?.imageUrl && element.styles.imageUrl !== 'https://via.placeholder.com/600x400/e5e7eb/6b7280?text=Adicione+uma+imagem' ? (
              <img
                src={element.styles.imageUrl}
                alt={element.content || 'Imagem'}
                style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px' }}
                className="mx-auto"
              />
            ) : (
              <div className="bg-gray-200 rounded-lg flex items-center justify-center w-full h-64 border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <ImageIcon className="h-16 w-16 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Imagem</p>
                </div>
              </div>
            )}
          </div>
        )}

        {element.type === 'countdown' && (
          <div style={{
            textAlign: element.styles?.textAlign,
            fontSize: element.styles?.fontSize,
            color: element.styles?.countdownTextColor || element.styles?.color,
            backgroundColor: element.styles?.countdownBgColor || 'transparent',
            fontWeight: 'bold',
            padding: '10px',
            borderRadius: '8px'
          }}>
            {element.styles?.countdownPrefix || ''}<span>00:00:00</span>
          </div>
        )}

        {element.type === 'divider' && (
          <hr style={{ border: 'none', borderTop: '2px solid #ddd', margin: '30px 0' }} />
        )}
      </div>
    </div>
  );
}

interface DraggableWidgetProps {
  type: PreSellElement['type'];
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

function DraggableWidget({ type, icon, label, onClick }: DraggableWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `sidebar-${type}`,
    data: { type }
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div className="relative group">
      <Button
        ref={setNodeRef}
        style={style}
        {...attributes}
        data-testid={`button-add-${type}`}
        variant="outline"
        className="h-auto flex-col items-center gap-3 p-5 hover:bg-primary/10 hover:border-primary/60 hover:shadow-md transition-all duration-200 bg-background w-full cursor-grab active:cursor-grabbing"
      >
        <div {...listeners} className="flex flex-col items-center gap-3 w-full touch-none">
          {icon}
          <span className="text-xs font-medium pointer-events-none">{label}</span>
        </div>
      </Button>
      {onClick && (
        <button
          onClick={onClick}
          data-testid={`button-click-add-${type}`}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:scale-110 z-10"
          title="Clique para adicionar"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

interface DroppableCanvasProps {
  children: React.ReactNode;
  isEmpty: boolean;
}

function DroppableCanvas({ children, isEmpty }: DroppableCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas-droppable'
  });

  return (
    <div
      ref={setNodeRef}
      className={`transition-all duration-300 ${isOver ? 'ring-4 ring-primary/30' : ''}`}
    >
      {children}
    </div>
  );
}

export default function PreSellBuilder() {
  const [pages, setPages] = useState<Array<{ name: string; createdAt: string }>>([]);
  const [currentPage, setCurrentPage] = useState<PreSellPage>({
    name: '',
    elements: [],
    settings: {
      backgroundColor: '#ffffff',
      maxWidth: '800px',
      fontFamily: 'Arial, sans-serif'
    }
  });
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showVideoTutorialDialog, setShowVideoTutorialDialog] = useState(false);
  const [newPageName, setNewPageName] = useState('');
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [viewport, setViewport] = useState<ViewportSize>('desktop');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Configurações de scripts
  const [enableHeadCode, setEnableHeadCode] = useState(false);
  const [headCode, setHeadCode] = useState('');
  const [enableBodyCode, setEnableBodyCode] = useState(false);
  const [bodyCode, setBodyCode] = useState('');
  const [enableFooterCode, setEnableFooterCode] = useState(false);
  const [footerCode, setFooterCode] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [domainDialogTab, setDomainDialogTab] = useState<'configurar' | 'dns' | 'status'>('configurar');
  const [domainStatus, setDomainStatus] = useState<{
    status: string;
    statusLabel: string;
    ssl?: { status: string; statusLabel: string };
    dcvDelegation?: { cname: string; cnameTarget: string };
    ownershipVerification?: { txtName: string; txtValue: string };
    dnsInstructions?: { cname: string; dcvDelegation: string; ownershipTxt: string };
  } | null>(null);
  const [isCheckingDomain, setIsCheckingDomain] = useState(false);
  
  // Configurações de SEO
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoFavicon, setSeoFavicon] = useState('');
  const [seoOgImage, setSeoOgImage] = useState('');

  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) {
      if (isDev) console.log('Nenhuma área de drop detectada');
      return;
    }

    if (isDev) console.log('Drop detectado:', { activeId: active.id, overId: over.id, activeData: active.data.current });

    // Caso 1: Arrastar da sidebar para o canvas
    if (String(active.id).startsWith('sidebar-')) {
      const elementType = active.data.current?.type as PreSellElement['type'];
      if (isDev) console.log('Arrastando da sidebar:', elementType);
      
      if (elementType) {
        // Aceita drop no canvas-droppable ou em qualquer elemento existente
        if (over.id === 'canvas-droppable' || !String(over.id).startsWith('sidebar-')) {
          if (isDev) console.log('Adicionando elemento:', elementType);
          addElement(elementType);
          return;
        }
      }
    }

    // Caso 2: Reordenar elementos dentro do canvas
    if (active.id !== over.id && !String(active.id).startsWith('sidebar-')) {
      const oldIndex = currentPage.elements.findIndex((el) => el.id === active.id);
      const newIndex = currentPage.elements.findIndex((el) => el.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newElements = arrayMove(currentPage.elements, oldIndex, newIndex);

        setCurrentPage({
          ...currentPage,
          elements: newElements,
        });

        toast({
          title: "Elemento reordenado",
          description: "A ordem dos elementos foi atualizada.",
        });
      }
    }
  };

  useEffect(() => {
    loadSavedPages();
  }, []);

  const loadSavedPages = async () => {
    try {
      const response = await fetch('/api/presell/list', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setPages(data.pages || []);
      }
    } catch (error) {
      console.error('Erro ao carregar páginas:', error);
    }
  };

  const addElement = (type: PreSellElement['type']) => {
    const newElement: PreSellElement = {
      id: `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      content: getDefaultContent(type),
      styles: getDefaultStyles(type)
    };

    setCurrentPage({
      ...currentPage,
      elements: [...currentPage.elements, newElement]
    });

    setSelectedElementId(newElement.id);

    toast({
      title: "Elemento adicionado!",
      description: `${getElementName(type)} foi adicionado à página.`,
    });
  };

  const getDefaultContent = (type: PreSellElement['type']): string => {
    switch (type) {
      case 'headline':
        return 'Título Principal Impactante';
      case 'subheadline':
        return 'Subtítulo explicativo que gera desejo';
      case 'video':
        return 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      case 'text':
        return 'Digite seu texto aqui. Conte a história, mostre benefícios, gere desejo...';
      case 'button':
        return 'QUERO GARANTIR MINHA VAGA AGORA!';
      case 'image':
        return 'https://via.placeholder.com/600x400';
      case 'countdown':
        return '';
      default:
        return '';
    }
  };

  const getDefaultStyles = (type: PreSellElement['type']) => {
    const baseStyles = {
      paddingTop: '20px',
      paddingRight: '20px',
      paddingBottom: '20px',
      paddingLeft: '20px',
      marginTop: '20px',
      marginRight: '0px',
      marginBottom: '20px',
      marginLeft: '0px'
    };

    switch (type) {
      case 'headline':
        return {
          ...baseStyles,
          textAlign: 'center' as const,
          fontSize: '42px',
          color: '#1a1a1a'
        };
      case 'subheadline':
        return {
          ...baseStyles,
          textAlign: 'center' as const,
          fontSize: '24px',
          color: '#444'
        };
      case 'video':
        return {
          ...baseStyles,
          textAlign: 'center' as const,
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        };
      case 'text':
        return {
          ...baseStyles,
          textAlign: 'left' as const,
          fontSize: '18px',
          color: '#333'
        };
      case 'button':
        return {
          ...baseStyles,
          textAlign: 'center' as const,
          fontSize: '20px',
          color: '#ffffff',
          backgroundColor: '#ff6b00',
          buttonUrl: 'https://seu-link-de-vendas.com',
          buttonDelay: 0,
          buttonEffect: 'pulse' as const
        };
      case 'image':
        return {
          ...baseStyles,
          textAlign: 'center' as const,
          imageUrl: 'https://via.placeholder.com/600x400/e5e7eb/6b7280?text=Adicione+uma+imagem'
        };
      case 'countdown':
        return {
          ...baseStyles,
          textAlign: 'center' as const,
          fontSize: '32px',
          color: '#ff0000',
          countdownTextColor: '#ff0000',
          countdownBgColor: 'transparent',
          countdownPrefix: 'Termina em: ',
          countdownDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
      default:
        return baseStyles;
    }
  };

  const getElementName = (type: PreSellElement['type']): string => {
    const names: Record<PreSellElement['type'], string> = {
      headline: 'Título Principal',
      subheadline: 'Subtítulo',
      video: 'Vídeo',
      text: 'Texto',
      button: 'Botão de Ação',
      image: 'Imagem',
      divider: 'Divisor',
      countdown: 'Contador Regressivo'
    };
    return names[type];
  };

  const updateElement = (id: string, updates: Partial<PreSellElement>) => {
    setCurrentPage({
      ...currentPage,
      elements: currentPage.elements.map(el =>
        el.id === id ? { ...el, ...updates } : el
      )
    });
  };

  const deleteElement = (id: string) => {
    setCurrentPage({
      ...currentPage,
      elements: currentPage.elements.filter(el => el.id !== id)
    });
    setSelectedElementId(null);
    toast({
      title: "Elemento removido",
      description: "O elemento foi excluído da página.",
    });
  };

  const moveElement = (id: string, direction: 'up' | 'down') => {
    const index = currentPage.elements.findIndex(el => el.id === id);
    if (index === -1) return;

    const newElements = [...currentPage.elements];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newElements.length) return;

    [newElements[index], newElements[targetIndex]] = [newElements[targetIndex], newElements[index]];

    setCurrentPage({
      ...currentPage,
      elements: newElements
    });
  };

  const duplicateElement = (id: string) => {
    const element = currentPage.elements.find(el => el.id === id);
    if (!element) return;

    const newElement = {
      ...element,
      id: `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    const index = currentPage.elements.findIndex(el => el.id === id);
    const newElements = [...currentPage.elements];
    newElements.splice(index + 1, 0, newElement);

    setCurrentPage({
      ...currentPage,
      elements: newElements
    });

    toast({
      title: "Elemento duplicado!",
      description: "Uma cópia foi criada logo abaixo.",
    });
  };

  const checkDomainStatus = async (domain: string) => {
    if (!domain.trim()) {
      toast({
        title: "Domínio não informado",
        description: "Digite um domínio para verificar o status.",
        variant: "destructive",
      });
      return;
    }

    setIsCheckingDomain(true);
    try {
      const response = await fetch(`/api/custom-domains/${encodeURIComponent(domain.trim())}/check`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setDomainStatus(data);
        setDomainDialogTab('status');
      } else {
        const error = await response.json();
        toast({
          title: "Erro ao verificar domínio",
          description: error.message || "Não foi possível verificar o status do domínio.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao verificar domínio",
        description: error.message || "Erro de conexão",
        variant: "destructive",
      });
    } finally {
      setIsCheckingDomain(false);
    }
  };

  const copyToClipboardDns = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: `${label} copiado para área de transferência.`,
    });
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'initializing':
      case 'pending_validation':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const savePage = async (nameOverride?: string) => {
    const pageName = nameOverride || currentPage.name;

    // Se não tem nome E não está editando uma existente, pedir nome
    if (!pageName && !isEditingExisting) {
      setShowNameDialog(true);
      return;
    }

    // Verificar se já tinha domínio e está tentando remover
    const existingPage = pages.find((p: { name: string; createdAt: string; customDomain?: string }) => p.name === pageName) as { name: string; createdAt: string; customDomain?: string } | undefined;
    const hadDomainBefore = existingPage?.customDomain && existingPage.customDomain.trim() !== '';
    if (hadDomainBefore && !customDomain.trim()) {
      toast({
        title: "Domínio obrigatório",
        description: "Você já configurou um domínio próprio. Para alterar, insira um novo domínio.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Serializar elementos, removendo qualquer propriedade que não seja JSON-serializável
      const serializedElements = currentPage.elements.map(el => {
        const cleanStyles: Record<string, string | number> = {};

        if (el.styles) {
          for (const [key, value] of Object.entries(el.styles)) {
            // Apenas incluir valores primitivos válidos
            if (typeof value === 'string' || typeof value === 'number') {
              cleanStyles[key] = value;
            } else if (typeof value === 'boolean') {
              cleanStyles[key] = String(value);
            }
            // Ignorar null, undefined, objetos, funções, eventos, etc
          }
        }

        return {
          id: el.id,
          type: el.type,
          content: el.content,
          styles: cleanStyles
        };
      });

      const pageData = {
        name: String(pageName),
        elements: serializedElements,
        settings: {
          backgroundColor: String(currentPage.settings?.backgroundColor || '#ffffff'),
          maxWidth: String(currentPage.settings?.maxWidth || '800px'),
          fontFamily: String(currentPage.settings?.fontFamily || 'Arial, sans-serif')
        },
        scripts: {
          head: enableHeadCode && headCode ? String(headCode) : null,
          body: enableBodyCode && bodyCode ? String(bodyCode) : null,
          footer: enableFooterCode && footerCode ? String(footerCode) : null
        },
        seo: {
          title: seoTitle ? String(seoTitle) : null,
          description: seoDescription ? String(seoDescription) : null,
          favicon: seoFavicon ? String(seoFavicon) : null,
          ogImage: seoOgImage ? String(seoOgImage) : null
        },
        customDomain: customDomain ? String(customDomain) : null
      };

      // Validar JSON antes de enviar
      JSON.stringify(pageData);

      const endpoint = isEditingExisting ? '/api/presell/update' : '/api/presell/save';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(pageData)
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      toast({
        title: "✅ Página Salva!",
        description: `Sua Pre-Sell foi salva com sucesso!`,
      });

      // Atualizar currentPage com o nome salvo
      setCurrentPage({ ...currentPage, name: pageName });
      loadSavedPages();
      setIsEditingExisting(true);
    } catch (error: any) {
      console.error('Erro detalhado ao salvar:', error);
      toast({
        title: "Erro ao salvar",
        description: error.message || 'Erro desconhecido',
        variant: "destructive",
      });
    }
  };

  const saveAndName = async () => {
    if (!newPageName) {
      toast({
        title: "Erro",
        description: "Digite um nome para a página",
        variant: "destructive",
      });
      return;
    }

    setShowNameDialog(false);
    setIsEditingExisting(false);

    // Passar o nome diretamente para evitar problemas com estado assíncrono
    await savePage(newPageName);
  };

  const loadPage = async (name: string) => {
    try {
      const response = await fetch(`/api/presell/get/${name}`, {
        credentials: 'include'
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      setCurrentPage(data.page);
      setIsEditingExisting(true);

      if (data.page.scripts) {
        setEnableHeadCode(!!data.page.scripts.head);
        setHeadCode(data.page.scripts.head || '');
        setEnableBodyCode(!!data.page.scripts.body);
        setBodyCode(data.page.scripts.body || '');
        setEnableFooterCode(!!data.page.scripts.footer);
        setFooterCode(data.page.scripts.footer || '');
      }

      if (data.page.seo) {
        setSeoTitle(data.page.seo.title || '');
        setSeoDescription(data.page.seo.description || '');
        setSeoFavicon(data.page.seo.favicon || '');
        setSeoOgImage(data.page.seo.ogImage || '');
      }

      setCustomDomain(data.page.customDomain || '');

      toast({
        title: "Página carregada!",
        description: "Continue editando sua Pre-Sell.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deletePage = async (name: string) => {
    if (!confirm(`Deseja excluir a página "${name}"?`)) return;

    try {
      const response = await fetch(`/api/presell/delete/${name}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      toast({
        title: "Página excluída!",
        description: "A Pre-Sell foi removida com sucesso.",
      });

      loadSavedPages();

      if (currentPage.name === name) {
        setCurrentPage({
          name: '',
          elements: [],
          settings: {
            backgroundColor: '#ffffff',
            maxWidth: '800px',
            fontFamily: 'Arial, sans-serif'
          }
        });
        setIsEditingExisting(false);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const newPage = () => {
    setCurrentPage({
      name: '',
      elements: [],
      settings: {
        backgroundColor: '#ffffff',
        maxWidth: '800px',
        fontFamily: 'Arial, sans-serif'
      }
    });
    setIsEditingExisting(false);
    setSelectedElementId(null);
    setEnableHeadCode(false);
    setHeadCode('');
    setEnableBodyCode(false);
    setBodyCode('');
    setEnableFooterCode(false);
    setFooterCode('');
    setCustomDomain('');
  };

  const previewPage = () => {
    if (!currentPage.elements.length) {
      toast({
        title: "Erro",
        description: "Adicione elementos à página primeiro",
        variant: "destructive",
      });
      return;
    }

    const pageData = {
      ...currentPage,
      scripts: {
        head: enableHeadCode ? headCode : null,
        body: enableBodyCode ? bodyCode : null,
        footer: enableFooterCode ? footerCode : null
      }
    };

    // Usar localStorage (mais confiável entre janelas)
    const sessionId = `presell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(`presell-preview-${sessionId}`, JSON.stringify(pageData));

    // Abrir preview em nova janela
    const previewWindow = window.open(`/presell/preview?session=${sessionId}`, '_blank');

    if (!previewWindow) {
      toast({
        title: "Erro",
        description: "Bloqueador de pop-ups ativo. Permita pop-ups para este site.",
        variant: "destructive",
      });
    }
  };

  const copyPageLink = () => {
    if (!currentPage.name) {
      toast({
        title: "Erro",
        description: "Salve a página primeiro para obter o link",
        variant: "destructive",
      });
      return;
    }

    const link = `${window.location.origin}/presell/${currentPage.name}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado!",
      description: "Link da Pre-Sell copiado para área de transferência",
    });
  };

  const exportHTML = () => {
    if (!currentPage.elements.length) {
      toast({
        title: "Erro",
        description: "Adicione elementos à página primeiro",
        variant: "destructive",
      });
      return;
    }

    const html = generateHTML(currentPage);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentPage.name || 'presell'}.html`;
    a.click();

    toast({
      title: "HTML exportado!",
      description: "Arquivo baixado com sucesso.",
    });
  };

  // Função auxiliar para converter URL do YouTube
  const convertToEmbedUrl = (url: string): string => {
    if (!url) return '';

    // YouTube
    if (url.includes('youtube.com/watch?v=')) {
      const videoId = url.split('v=')[1]?.split('&')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }

    // Vimeo
    if (url.includes('vimeo.com/')) {
      const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
      return `https://player.vimeo.com/video/${videoId}`;
    }

    // Se já for embed, retorna direto
    if (url.includes('/embed/') || url.includes('player.')) {
      return url;
    }

    return url;
  };

  const generateHTML = (page: PreSellPage): string => {
    const elementsHTML = page.elements.map(el => {
      const paddingStyle = `${el.styles?.paddingTop || '0px'} ${el.styles?.paddingRight || '0px'} ${el.styles?.paddingBottom || '0px'} ${el.styles?.paddingLeft || '0px'}`;
      const marginStyle = `${el.styles?.marginTop || '0px'} ${el.styles?.marginRight || '0px'} ${el.styles?.marginBottom || '0px'} ${el.styles?.marginLeft || '0px'}`;

      switch (el.type) {
        case 'headline':
          return `<h1 style="text-align: ${el.styles?.textAlign}; font-size: ${el.styles?.fontSize}; color: ${el.styles?.color}; padding: ${paddingStyle}; margin: ${marginStyle};">${el.content}</h1>`;

        case 'subheadline':
          return `<h2 style="text-align: ${el.styles?.textAlign}; font-size: ${el.styles?.fontSize}; color: ${el.styles?.color}; padding: ${paddingStyle}; margin: ${marginStyle};">${el.content}</h2>`;

        case 'video':
          const embedUrl = convertToEmbedUrl(el.styles?.videoUrl || '');
          return `<div style="text-align: ${el.styles?.textAlign}; padding: ${paddingStyle}; margin: ${marginStyle};"><iframe width="100%" height="400" src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;

        case 'text':
          return `<p style="text-align: ${el.styles?.textAlign}; font-size: ${el.styles?.fontSize}; color: ${el.styles?.color}; padding: ${paddingStyle}; margin: ${marginStyle}; white-space: pre-wrap;">${el.content}</p>`;

        case 'button':
          const buttonEffect = el.styles?.buttonEffect || 'none';
          const buttonDelay = el.styles?.buttonDelay || 0;
          const buttonId = `btn-${el.id}`;

          let animationCSS = '';
          if (buttonEffect === 'pulse') {
            animationCSS = `@keyframes pulse-${el.id} { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } } .btn-${el.id}:hover { animation: pulse-${el.id} 1s infinite; }`;
          } else if (buttonEffect === 'shake') {
            animationCSS = `@keyframes shake-${el.id} { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } } .btn-${el.id}:hover { animation: shake-${el.id} 0.5s infinite; }`;
          } else if (buttonEffect === 'bounce') {
            animationCSS = `@keyframes bounce-${el.id} { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } } .btn-${el.id}:hover { animation: bounce-${el.id} 0.5s infinite; }`;
          } else if (buttonEffect === 'glow') {
            animationCSS = `.btn-${el.id}:hover { box-shadow: 0 0 20px ${el.styles?.backgroundColor}; }`;
          }

          return `
            <style>${animationCSS}</style>
            <div id="${buttonId}-wrapper" style="text-align: ${el.styles?.textAlign}; padding: ${paddingStyle}; margin: ${marginStyle}; display: none;">
              <a href="${el.styles?.buttonUrl}" target="_blank" class="btn-${el.id}" style="display: inline-block; background-color: ${el.styles?.backgroundColor}; color: ${el.styles?.color}; font-size: ${el.styles?.fontSize}; padding: 18px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; transition: all 0.3s;">${el.content}</a>
            </div>
            <script>
              setTimeout(() => {
                document.getElementById('${buttonId}-wrapper').style.display = 'block';
              }, ${buttonDelay * 1000});
            </script>
          `;

        case 'image':
          return `<div style="text-align: ${el.styles?.textAlign}; padding: ${paddingStyle}; margin: ${marginStyle};"><img src="${el.styles?.imageUrl}" alt="${el.content}" style="max-width: 100%; height: auto; border-radius: 8px;"></div>`;

        case 'divider':
          return `<hr style="border: none; border-top: 2px solid #ddd; margin: 30px 0;">`;

        case 'countdown':
          return `
            <div id="${el.id}" style="text-align: ${el.styles?.textAlign}; font-size: ${el.styles?.fontSize}; color: ${el.styles?.countdownTextColor}; background-color: ${el.styles?.countdownBgColor}; padding: ${paddingStyle}; margin: ${marginStyle}; font-weight: bold; border-radius: 8px;">
              ${el.styles?.countdownPrefix || ''}<span class="countdown-time">00:00:00</span>
            </div>
            <script>
              const countdown${el.id.replace(/-/g, '')} = () => {
                const end = new Date('${el.styles?.countdownDate}').getTime();
                const now = new Date().getTime();
                const distance = end - now;
                if (distance < 0) {
                  document.getElementById('${el.id}').querySelector('.countdown-time').innerHTML = 'EXPIRADO';
                  return;
                }
                const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                document.getElementById('${el.id}').querySelector('.countdown-time').innerHTML = hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
              };
              setInterval(countdown${el.id.replace(/-/g, '')}, 1000);
              countdown${el.id.replace(/-/g, '')}();
            </script>
          `;

        default:
          return '';
      }
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${page.name || 'Pre-Sell'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${page.settings.fontFamily};
      background-color: ${page.settings.backgroundColor};
      padding: 0;
      line-height: 1.6;
    }
    .container {
      max-width: ${page.settings.maxWidth};
      margin: 0 auto;
      background: white;
      padding: 40px;
    }
    @media (max-width: 768px) {
      .container { padding: 20px; }
    }
  </style>
  ${page.scripts?.head || ''}
</head>
<body>
  ${page.scripts?.body || ''}
  <div class="container">
    ${elementsHTML}
  </div>
  ${page.scripts?.footer || ''}
</body>
</html>`;
  };

  const selectedElement = currentPage.elements.find(el => el.id === selectedElementId);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b px-6 py-3 flex items-center justify-between bg-background">
        <div className="flex items-center gap-3">
          <Layout className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">
              {currentPage.name || 'Nova Pre-Sell'}
            </h1>
            <p className="text-xs text-muted-foreground">Construtor de Páginas de Pré-Venda</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Viewport Buttons */}
          <div className="flex items-center gap-0.5 px-1 py-0.5 bg-muted rounded-md border">
            <Button
              data-testid="button-viewport-desktop"
              variant={viewport === 'desktop' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewport('desktop')}
              className="h-7 w-7 p-0"
              title="Desktop"
            >
              <Monitor className="h-3.5 w-3.5" />
            </Button>
            <Button
              data-testid="button-viewport-tablet"
              variant={viewport === 'tablet' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewport('tablet')}
              className="h-7 w-7 p-0"
              title="Tablet"
            >
              <Tablet className="h-3.5 w-3.5" />
            </Button>
            <Button
              data-testid="button-viewport-mobile"
              variant={viewport === 'mobile' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewport('mobile')}
              className="h-7 w-7 p-0"
              title="Mobile"
            >
              <Smartphone className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <Button data-testid="button-settings" variant="outline" size="sm" onClick={() => setShowSettingsDialog(true)}>
            <Settings className="h-3.5 w-3.5 mr-2" />
            Configurações
          </Button>
          <Button data-testid="button-preview" variant="outline" size="sm" onClick={previewPage}>
            <Eye className="h-3.5 w-3.5 mr-2" />
            Preview
          </Button>
          <Button data-testid="button-save" size="sm" onClick={() => savePage()}>
            <Save className="h-3.5 w-3.5 mr-2" />
            Salvar
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Widgets or Properties */}
        <div className="w-80 border-r overflow-y-auto bg-muted/20">
          {!selectedElement ? (
            // Widgets Panel
            <>
              <div className="p-5 border-b bg-background/50">
                <h3 className="font-semibold text-base">Elementos</h3>
                <p className="text-xs text-muted-foreground mt-1">Clique para adicionar</p>
              </div>

            <div className="p-5 space-y-6">
              {/* Texto */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Texto</h4>
                <div className="grid grid-cols-2 gap-3">
                  <DraggableWidget
                    type="headline"
                    icon={<Type className="h-10 w-10 text-primary" />}
                    label="Título"
                    onClick={() => addElement('headline')}
                  />
                  <DraggableWidget
                    type="subheadline"
                    icon={<Type className="h-10 w-10 text-primary" />}
                    label="Subtítulo"
                    onClick={() => addElement('subheadline')}
                  />
                  <DraggableWidget
                    type="text"
                    icon={<FileText className="h-10 w-10 text-primary" />}
                    label="Parágrafo"
                    onClick={() => addElement('text')}
                  />
                </div>
              </div>

              {/* Mídia */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Mídia</h4>
                <div className="grid grid-cols-2 gap-3">
                  <DraggableWidget
                    type="video"
                    icon={<Video className="h-10 w-10 text-primary" />}
                    label="Vídeo"
                    onClick={() => addElement('video')}
                  />
                  <DraggableWidget
                    type="image"
                    icon={<ImageIcon className="h-10 w-10 text-primary" />}
                    label="Imagem"
                    onClick={() => addElement('image')}
                  />
                </div>
              </div>

              {/* Interação */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Interação</h4>
                <div className="space-y-3">
                  <DraggableWidget
                    type="button"
                    icon={<MousePointer className="h-10 w-10 text-primary" />}
                    label="Botão CTA"
                    onClick={() => addElement('button')}
                  />
                  <DraggableWidget
                    type="countdown"
                    icon={<Type className="h-10 w-10 text-primary" />}
                    label="Contador Regressivo"
                    onClick={() => addElement('countdown')}
                  />
                </div>
              </div>

              {/* Layout */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Layout</h4>
                <DraggableWidget
                  type="divider"
                  icon={<Type className="h-10 w-10 text-primary" />}
                  label="Divisor"
                  onClick={() => addElement('divider')}
                />
              </div>
            </div>
            </>
          ) : (
            // Properties Panel
            <>
              <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-background shadow-sm z-10">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base truncate">Propriedades</h3>
                  <p className="text-xs text-muted-foreground mt-1">{getElementName(selectedElement.type)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedElementId(null)}
                  className="gap-1.5 ml-2 shrink-0 hover:bg-muted"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span className="text-xs">Voltar</span>
                </Button>
              </div>

              <Accordion type="multiple" defaultValue={["content", "style"]} className="px-5 py-2">
                {/* Conteúdo */}
                {selectedElement.type !== 'divider' && (
                  <AccordionItem value="content" className="border-b">
                    <AccordionTrigger className="text-sm font-semibold hover:no-underline py-4 hover:text-primary transition-colors">
                      📝 Conteúdo
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pb-5 pt-2">
                      {selectedElement.type === 'text' ? (
                        <Textarea
                          value={selectedElement.content}
                          onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                          rows={5}
                        />
                      ) : (
                        <Input
                          value={selectedElement.content}
                          onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                        />
                      )}

                      {/* URL do Vídeo */}
                      {selectedElement.type === 'video' && (
                        <div>
                          <Label className="text-xs font-medium">URL do Vídeo</Label>
                          <Input
                            value={selectedElement.styles?.videoUrl || ''}
                            onChange={(e) => updateElement(selectedElement.id, {
                              styles: { ...selectedElement.styles, videoUrl: e.target.value }
                            })}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="mt-1.5"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Cole o link do YouTube, Vimeo ou outro vídeo
                          </p>
                        </div>
                      )}

                      {/* URL da Imagem */}
                      {selectedElement.type === 'image' && (
                        <>
                          <div>
                            <Label className="text-xs font-medium">URL da Imagem</Label>
                            <Input
                              value={selectedElement.styles?.imageUrl || ''}
                              onChange={(e) => updateElement(selectedElement.id, {
                                styles: { ...selectedElement.styles, imageUrl: e.target.value }
                              })}
                              placeholder="https://exemplo.com/imagem.jpg"
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-medium">Texto Alternativo</Label>
                            <Input
                              value={selectedElement.content}
                              onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                              className="mt-1.5"
                            />
                          </div>
                        </>
                      )}
                      {/* URL do Botão */}
                      {selectedElement.type === 'button' && (
                        <>
                          <div>
                            <Label className="text-xs font-medium">Link do Botão</Label>
                            <Input
                              value={selectedElement.styles?.buttonUrl || ''}
                              onChange={(e) => updateElement(selectedElement.id, {
                                styles: { ...selectedElement.styles, buttonUrl: e.target.value }
                              })}
                              placeholder="https://seu-link-de-vendas.com"
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-medium">Tempo para Aparecer (segundos)</Label>
                            <Input
                              type="number"
                              min="0"
                              value={selectedElement.styles?.buttonDelay || 0}
                              onChange={(e) => updateElement(selectedElement.id, {
                                styles: { ...selectedElement.styles, buttonDelay: parseInt(e.target.value) || 0 }
                              })}
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-medium">Efeito do Botão</Label>
                            <Select
                              value={selectedElement.styles?.buttonEffect || 'none'}
                              onValueChange={(value: string) => updateElement(selectedElement.id, {
                                styles: { ...selectedElement.styles, buttonEffect: value as 'none' | 'pulse' | 'shake' | 'bounce' | 'glow' }
                              })}
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sem efeito</SelectItem>
                                <SelectItem value="pulse">Pulsar</SelectItem>
                                <SelectItem value="shake">Tremer</SelectItem>
                                <SelectItem value="bounce">Pular</SelectItem>
                                <SelectItem value="glow">Brilho</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}

                      {/* Contador */}
                      {selectedElement.type === 'countdown' && (
                        <>
                          <div>
                            <Label className="text-xs font-medium">Data de Expiração</Label>
                            <Input
                              type="datetime-local"
                              value={selectedElement.styles?.countdownDate ? new Date(selectedElement.styles.countdownDate).toISOString().slice(0, 16) : ''}
                              onChange={(e) => updateElement(selectedElement.id, {
                                styles: { ...selectedElement.styles, countdownDate: new Date(e.target.value).toISOString() }
                              })}
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-medium">Texto Antes do Contador</Label>
                            <Input
                              value={selectedElement.styles?.countdownPrefix || ''}
                              onChange={(e) => updateElement(selectedElement.id, {
                                styles: { ...selectedElement.styles, countdownPrefix: e.target.value }
                              })}
                              placeholder="Termina em: "
                              className="mt-1.5"
                            />
                          </div>
                        </>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Estilo */}
                {selectedElement.type !== 'divider' && (
                  <AccordionItem value="style" className="border-b">
                    <AccordionTrigger className="text-sm font-semibold hover:no-underline py-4 hover:text-primary transition-colors">
                      🎨 Estilo & Aparência
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pb-5 pt-2">
                      <div>
                        <Label className="text-xs font-medium mb-2 block">Alinhamento</Label>
                      <div className="flex gap-1">
                        <Button
                          variant={selectedElement.styles?.textAlign === 'left' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1"
                          onClick={() => updateElement(selectedElement.id, {
                            styles: { ...selectedElement.styles, textAlign: 'left' }
                          })}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="21" x2="3" y1="6" y2="6"/>
                            <line x1="15" x2="3" y1="12" y2="12"/>
                            <line x1="17" x2="3" y1="18" y2="18"/>
                          </svg>
                        </Button>
                        <Button
                          variant={selectedElement.styles?.textAlign === 'center' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1"
                          onClick={() => updateElement(selectedElement.id, {
                            styles: { ...selectedElement.styles, textAlign: 'center' }
                          })}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" x2="6" y1="6" y2="6"/>
                            <line x1="15" x2="9" y1="12" y2="12"/>
                            <line x1="18" x2="6" y1="18" y2="18"/>
                          </svg>
                        </Button>
                        <Button
                          variant={selectedElement.styles?.textAlign === 'right' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1"
                          onClick={() => updateElement(selectedElement.id, {
                            styles: { ...selectedElement.styles, textAlign: 'right' }
                          })}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="21" x2="9" y1="6" y2="6"/>
                            <line x1="21" x2="7" y1="12" y2="12"/>
                            <line x1="21" x2="3" y1="18" y2="18"/>
                          </svg>
                        </Button>
                      </div>
                    </div>

                    {selectedElement.type !== 'video' && selectedElement.type !== 'image' && (
                      <>
                        <div>
                          <Label className="text-sm font-medium">Tamanho da Fonte</Label>
                          <Input
                            value={selectedElement.styles?.fontSize || '16px'}
                            onChange={(e) => updateElement(selectedElement.id, {
                              styles: { ...selectedElement.styles, fontSize: e.target.value }
                            })}
                            placeholder="16px"
                            className="mt-2"
                          />
                        </div>

                        <div>
                          <Label className="text-sm font-medium">Cor do Texto</Label>
                          <Input
                            type="color"
                            value={selectedElement.styles?.color || '#000000'}
                            onChange={(e) => updateElement(selectedElement.id, {
                              styles: { ...selectedElement.styles, color: e.target.value }
                            })}
                            className="mt-2 h-10 w-full"
                          />
                        </div>
                      </>
                    )}

                    {selectedElement.type === 'button' && (
                      <div>
                        <Label className="text-sm font-medium">Cor de Fundo</Label>
                        <Input
                          type="color"
                          value={selectedElement.styles?.backgroundColor || '#ff6b00'}
                          onChange={(e) => updateElement(selectedElement.id, {
                            styles: { ...selectedElement.styles, backgroundColor: e.target.value }
                          })}
                          className="mt-2 h-10 w-full"
                        />
                      </div>
                    )}

                      {selectedElement.type === 'countdown' && (
                        <>
                          <div>
                            <Label className="text-xs font-medium">Cor do Texto</Label>
                            <Input
                              type="color"
                              value={selectedElement.styles?.countdownTextColor || '#ff0000'}
                              onChange={(e) => updateElement(selectedElement.id, {
                                styles: { ...selectedElement.styles, countdownTextColor: e.target.value }
                              })}
                              className="mt-1.5 h-10 w-full"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-medium">Cor de Fundo</Label>
                            <Input
                              type="color"
                              value={selectedElement.styles?.countdownBgColor || 'transparent'}
                              onChange={(e) => updateElement(selectedElement.id, {
                                styles: { ...selectedElement.styles, countdownBgColor: e.target.value }
                              })}
                              className="mt-1.5 h-10 w-full"
                            />
                          </div>
                        </>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Espaçamento */}
                {selectedElement.type !== 'divider' && (
                  <AccordionItem value="spacing" className="border-b">
                    <AccordionTrigger className="text-sm font-semibold hover:no-underline py-4 hover:text-primary transition-colors">
                      📏 Espaçamento
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pb-5 pt-2">
                      <div>
                        <Label className="text-sm font-medium mb-3 block">Espaçamento Interno (Padding)</Label>
                        <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Topo</Label>
                        <div className="relative mt-1">
                          <Input
                            type="number"
                            value={selectedElement.styles?.paddingTop?.replace('px', '') || '0'}
                            onChange={(e) => updateElement(selectedElement.id, {
                              styles: { ...selectedElement.styles, paddingTop: `${e.target.value}px` }
                            })}
                            placeholder="20"
                            className="pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">px</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Direita</Label>
                        <div className="relative mt-1">
                          <Input
                            type="number"
                            value={selectedElement.styles?.paddingRight?.replace('px', '') || '0'}
                            onChange={(e) => updateElement(selectedElement.id, {
                              styles: { ...selectedElement.styles, paddingRight: `${e.target.value}px` }
                            })}
                            placeholder="20"
                            className="pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">px</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Baixo</Label>
                        <div className="relative mt-1">
                          <Input
                            type="number"
                            value={selectedElement.styles?.paddingBottom?.replace('px', '') || '0'}
                            onChange={(e) => updateElement(selectedElement.id, {
                              styles: { ...selectedElement.styles, paddingBottom: `${e.target.value}px` }
                            })}
                            placeholder="20"
                            className="pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">px</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Esquerda</Label>
                        <div className="relative mt-1">
                          <Input
                            type="number"
                            value={selectedElement.styles?.paddingLeft?.replace('px', '') || '0'}
                            onChange={(e) => updateElement(selectedElement.id, {
                              styles: { ...selectedElement.styles, paddingLeft: `${e.target.value}px` }
                            })}
                            placeholder="20"
                            className="pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">px</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-3 block">Espaçamento Externo (Margin)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Topo</Label>
                        <div className="relative mt-1">
                          <Input
                            type="number"
                            value={selectedElement.styles?.marginTop?.replace('px', '') || '0'}
                            onChange={(e) => updateElement(selectedElement.id, {
                              styles: { ...selectedElement.styles, marginTop: `${e.target.value}px` }
                            })}
                            placeholder="20"
                            className="pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">px</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Direita</Label>
                        <div className="relative mt-1">
                          <Input
                            type="number"
                            value={selectedElement.styles?.marginRight?.replace('px', '') || '0'}
                            onChange={(e) => updateElement(selectedElement.id, {
                              styles: { ...selectedElement.styles, marginRight: `${e.target.value}px` }
                            })}
                            placeholder="0"
                            className="pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">px</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Baixo</Label>
                        <div className="relative mt-1">
                          <Input
                            type="number"
                            value={selectedElement.styles?.marginBottom?.replace('px', '') || '0'}
                            onChange={(e) => updateElement(selectedElement.id, {
                              styles: { ...selectedElement.styles, marginBottom: `${e.target.value}px` }
                            })}
                            placeholder="20"
                            className="pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">px</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Esquerda</Label>
                        <div className="relative mt-1">
                          <Input
                            type="number"
                            value={selectedElement.styles?.marginLeft?.replace('px', '') || '0'}
                            onChange={(e) => updateElement(selectedElement.id, {
                              styles: { ...selectedElement.styles, marginLeft: `${e.target.value}px` }
                            })}
                            placeholder="0"
                            className="pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">px</span>
                        </div>
                      </div>
                    </div>
                  </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </>
          )}
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-y-auto bg-muted/20 p-8">
          <DroppableCanvas isEmpty={currentPage.elements.length === 0}>
            <div
              className={`${viewportSizes[viewport]} mx-auto bg-background rounded-xl border shadow-lg min-h-[700px] p-8 transition-all duration-300`}
              style={{
                backgroundColor: currentPage.settings.backgroundColor,
                fontFamily: currentPage.settings.fontFamily,
                backgroundImage: currentPage.elements.length === 0 ? 
                  'repeating-conic-gradient(hsl(var(--muted)/0.5) 0% 25%, transparent 0% 50%) 50% / 24px 24px' : 
                  'none'
              }}
            >
            {currentPage.elements.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[600px]">
                <div className="text-center space-y-5">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 ring-8 ring-primary/5">
                    <Layout className="h-10 w-10 text-primary/60" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-semibold text-foreground">Canvas vazio</p>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">Arraste os elementos da esquerda para começar a construir sua página de pré-venda profissional</p>
                  </div>
                </div>
              </div>
            ) : (
              <SortableContext
                items={currentPage.elements.map(el => el.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {currentPage.elements.map((element, index) => (
                    <SortableElement
                      key={element.id}
                      element={element}
                      index={index}
                      isSelected={selectedElementId === element.id}
                      isFirst={index === 0}
                      isLast={index === currentPage.elements.length - 1}
                      onSelect={() => setSelectedElementId(element.id)}
                      onMoveUp={() => moveElement(element.id, 'up')}
                      onMoveDown={() => moveElement(element.id, 'down')}
                      onDuplicate={() => duplicateElement(element.id)}
                      onDelete={() => deleteElement(element.id)}
                      convertToEmbedUrl={convertToEmbedUrl}
                    />
                  ))}
                </div>
              </SortableContext>
            )}
            </div>
          </DroppableCanvas>
        </div>


      </div>
      </DndContext>

      {/* Dialogs */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurações da Página</DialogTitle>
            <DialogDescription>
              Configure scripts, domínio, SEO, aparência e outras opções
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="general">Geral</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
              <TabsTrigger value="scripts">Scripts</TabsTrigger>
              <TabsTrigger value="domain">Domínio</TabsTrigger>
              <TabsTrigger value="appearance">Aparência</TabsTrigger>
            </TabsList>

            {/* ABA GERAL */}
            <TabsContent value="general" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label>Cor de Fundo da Página</Label>
                  <div className="flex gap-2 items-center mt-2">
                    <Input
                      type="color"
                      value={currentPage.settings.backgroundColor}
                      onChange={(e) => setCurrentPage({
                        ...currentPage,
                        settings: { ...currentPage.settings, backgroundColor: e.target.value }
                      })}
                      className="h-10 w-20"
                    />
                    <Input
                      type="text"
                      value={currentPage.settings.backgroundColor}
                      onChange={(e) => setCurrentPage({
                        ...currentPage,
                        settings: { ...currentPage.settings, backgroundColor: e.target.value }
                      })}
                      placeholder="#ffffff"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div>
                  <Label>Largura Máxima do Conteúdo</Label>
                  <Select
                    value={currentPage.settings.maxWidth}
                    onValueChange={(value) => setCurrentPage({
                      ...currentPage,
                      settings: { ...currentPage.settings, maxWidth: value }
                    })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="600px">600px (Estreito)</SelectItem>
                      <SelectItem value="800px">800px (Médio)</SelectItem>
                      <SelectItem value="1000px">1000px (Largo)</SelectItem>
                      <SelectItem value="1200px">1200px (Extra Largo)</SelectItem>
                      <SelectItem value="100%">100% (Tela Cheia)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Família de Fontes</Label>
                  <Select
                    value={currentPage.settings.fontFamily}
                    onValueChange={(value) => setCurrentPage({
                      ...currentPage,
                      settings: { ...currentPage.settings, fontFamily: value }
                    })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Arial, sans-serif">Arial</SelectItem>
                      <SelectItem value="'Times New Roman', serif">Times New Roman</SelectItem>
                      <SelectItem value="'Courier New', monospace">Courier New</SelectItem>
                      <SelectItem value="Georgia, serif">Georgia</SelectItem>
                      <SelectItem value="Verdana, sans-serif">Verdana</SelectItem>
                      <SelectItem value="'Montserrat', sans-serif">Montserrat</SelectItem>
                      <SelectItem value="'Poppins', sans-serif">Poppins</SelectItem>
                      <SelectItem value="'Roboto', sans-serif">Roboto</SelectItem>
                      <SelectItem value="'Open Sans', sans-serif">Open Sans</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button size="sm" onClick={() => savePage()}>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Configurações
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* ABA SEO */}
            <TabsContent value="seo" className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  💡 <strong>Dica:</strong> Otimize sua página para motores de busca preenchendo os campos abaixo. Isso ajudará seu conteúdo a aparecer melhor no Google e redes sociais.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="page-title">Título da Página (Meta Title)</Label>
                  <Input
                    id="page-title"
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    placeholder="Ex: Minha Super Oferta - Transforme Sua Vida"
                    className="mt-2"
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {seoTitle.length}/60 caracteres - Aparece na aba do navegador e resultados do Google
                  </p>
                </div>

                <div>
                  <Label htmlFor="page-description">Descrição da Página (Meta Description)</Label>
                  <Textarea
                    id="page-description"
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    placeholder="Descrição que aparecerá nos resultados de busca..."
                    rows={3}
                    className="mt-2"
                    maxLength={160}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {seoDescription.length}/160 caracteres - Aparece abaixo do título no Google
                  </p>
                </div>

                <div>
                  <Label htmlFor="page-favicon">Favicon (Ícone da Aba)</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="page-favicon"
                      value={seoFavicon}
                      onChange={(e) => setSeoFavicon(e.target.value)}
                      type="url"
                      placeholder="https://exemplo.com/favicon.ico"
                      className="flex-1"
                    />
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".ico,.png,.jpg,.jpeg,.svg"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const formData = new FormData();
                          formData.append('file', file);
                          try {
                            const response = await fetch('/api/upload/favicon', {
                              method: 'POST',
                              credentials: 'include',
                              body: formData
                            });
                            const data = await response.json();
                            if (data.url) {
                              setSeoFavicon(data.url);
                              toast({ title: "Favicon enviado!", description: "Imagem carregada com sucesso." });
                            }
                          } catch (error) {
                            toast({ title: "Erro ao enviar", variant: "destructive" });
                          }
                        }}
                      />
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span><Plus className="h-4 w-4 mr-1" />Enviar Favicon</span>
                      </Button>
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Formatos aceitos: .ico, .png, .jpg, .svg (32×32px recomendado)
                  </p>
                </div>

                <div>
                  <Label htmlFor="page-og-image">Imagem de Compartilhamento (OG Image)</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="page-og-image"
                      value={seoOgImage}
                      onChange={(e) => setSeoOgImage(e.target.value)}
                      type="url"
                      placeholder="https://exemplo.com/og-image.jpg"
                      className="flex-1"
                    />
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const formData = new FormData();
                          formData.append('file', file);
                          try {
                            const response = await fetch('/api/upload/og-image', {
                              method: 'POST',
                              credentials: 'include',
                              body: formData
                            });
                            const data = await response.json();
                            if (data.url) {
                              setSeoOgImage(data.url);
                              toast({ title: "Imagem enviada!", description: "OG Image carregada com sucesso." });
                            }
                          } catch (error) {
                            toast({ title: "Erro ao enviar", variant: "destructive" });
                          }
                        }}
                      />
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span><Plus className="h-4 w-4 mr-1" />Enviar Imagem</span>
                      </Button>
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Imagem que aparece ao compartilhar no WhatsApp/Facebook (1200×630px recomendado)
                  </p>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button size="sm" onClick={() => savePage()}>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar SEO
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* ABA SCRIPTS */}
            <TabsContent value="scripts" className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  💡 <strong>Dica:</strong> Use esta seção para adicionar pixels de rastreamento, Google Analytics, Facebook Pixel, Google Tag Manager, ou qualquer outro script personalizado.
                </p>
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="head-script" className="font-medium">Script no &lt;head&gt;</Label>
                    <p className="text-xs text-muted-foreground mt-1">Ideal para pixels de rastreamento e meta tags</p>
                  </div>
                  <Switch
                    id="head-script"
                    checked={enableHeadCode}
                    onCheckedChange={setEnableHeadCode}
                  />
                </div>
                {enableHeadCode && (
                  <Textarea
                    value={headCode}
                    onChange={(e) => setHeadCode(e.target.value)}
                    placeholder="Cole seu pixel do Facebook, Google Analytics, etc..."
                    rows={6}
                  />
                )}
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="body-script" className="font-medium">Script no início do &lt;body&gt;</Label>
                    <p className="text-xs text-muted-foreground mt-1">Scripts que precisam carregar primeiro</p>
                  </div>
                  <Switch
                    id="body-script"
                    checked={enableBodyCode}
                    onCheckedChange={setEnableBodyCode}
                  />
                </div>
                {enableBodyCode && (
                  <Textarea
                    value={bodyCode}
                    onChange={(e) => setBodyCode(e.target.value)}
                    placeholder="Scripts que precisam carregar no início..."
                    rows={6}
                  />
                )}
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="footer-script" className="font-medium">Script antes do &lt;/body&gt;</Label>
                    <p className="text-xs text-muted-foreground mt-1">Scripts de conversão, chatbots, etc.</p>
                  </div>
                  <Switch
                    id="footer-script"
                    checked={enableFooterCode}
                    onCheckedChange={setEnableFooterCode}
                  />
                </div>
                {enableFooterCode && (
                  <Textarea
                    value={footerCode}
                    onChange={(e) => setFooterCode(e.target.value)}
                    placeholder="Scripts de conversão, chatbots, etc..."
                    rows={6}
                  />
                )}
              </div>

              <div className="flex justify-end mt-4 pt-4 border-t">
                <Button size="sm" onClick={() => savePage()} data-testid="button-save-scripts">
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Scripts
                </Button>
              </div>
            </TabsContent>

            {/* ABA DOMÍNIO */}
            <TabsContent value="domain" className="space-y-4">
              <Tabs value={domainDialogTab} onValueChange={(v) => setDomainDialogTab(v as 'configurar' | 'dns' | 'status')}>
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="configurar" data-testid="tab-configurar-presell">Configurar</TabsTrigger>
                  <TabsTrigger value="dns" data-testid="tab-dns-presell">Instruções DNS</TabsTrigger>
                  <TabsTrigger value="status" data-testid="tab-status-presell">Status</TabsTrigger>
                </TabsList>

                {/* SUB-ABA CONFIGURAR */}
                <TabsContent value="configurar" className="space-y-4">
                  <div>
                    <Label htmlFor="custom-domain" className="font-medium">Domínio Personalizado</Label>
                    <Input
                      id="custom-domain"
                      data-testid="input-custom-domain-presell"
                      value={customDomain}
                      onChange={(e) => setCustomDomain(e.target.value)}
                      placeholder="www.meusite.com ou presell.meusite.com"
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Digite o domínio completo que deseja usar para esta página
                    </p>
                  </div>

                  <div className="flex justify-end pt-4 border-t">
                    <Button size="sm" onClick={async () => {
                      await savePage();
                      if (customDomain.trim()) {
                        setDomainDialogTab('dns');
                      }
                    }} data-testid="button-save-domain-presell">
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Domínio
                    </Button>
                  </div>
                </TabsContent>

                {/* SUB-ABA INSTRUÇÕES DNS */}
                <TabsContent value="dns" className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Configure estes 2 registros no DNS do seu domínio:
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Adicione os registros abaixo no painel de DNS do seu provedor (Cloudflare, Registro.br, GoDaddy, Hostinger, etc.)
                    </p>
                  </div>

                  {/* Registro 1 - CNAME Principal */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">Registro 1 - CNAME Principal</span>
                      <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">Obrigatório</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between bg-white dark:bg-gray-900 p-2 rounded border">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Tipo:</span>
                          <code className="ml-2 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-mono">CNAME</code>
                        </div>
                      </div>
                      <div className="flex items-center justify-between bg-white dark:bg-gray-900 p-2 rounded border">
                        <div className="flex-1">
                          <span className="text-gray-500 dark:text-gray-400">Nome/Host:</span>
                          <code className="ml-2 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-mono" data-testid="text-dns-name-presell">
                            {getDnsHostName(customDomain)}
                          </code>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid="button-copy-dns-name-presell"
                          onClick={() => copyToClipboardDns(getDnsHostName(customDomain), 'Nome')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between bg-white dark:bg-gray-900 p-2 rounded border">
                        <div className="flex-1">
                          <span className="text-gray-500 dark:text-gray-400">Valor/Destino:</span>
                          <code className="ml-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-0.5 rounded font-mono font-bold" data-testid="text-dns-target-presell">
                            proxy.lowfy.com.br
                          </code>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid="button-copy-dns-target-presell"
                          onClick={() => copyToClipboardDns('proxy.lowfy.com.br', 'Destino')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Registro 2 - CNAME de Validação */}
                  {domainStatus?.dcvDelegation && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">Registro 2 - CNAME de Validação SSL</span>
                        <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">Para SSL</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between bg-white dark:bg-gray-900 p-2 rounded border">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Tipo:</span>
                            <code className="ml-2 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-mono">CNAME</code>
                          </div>
                        </div>
                        <div className="flex items-center justify-between bg-white dark:bg-gray-900 p-2 rounded border">
                          <div className="flex-1 overflow-hidden">
                            <span className="text-gray-500 dark:text-gray-400">Nome/Host:</span>
                            <code className="ml-2 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-mono text-xs break-all" data-testid="text-dcv-name-presell">
                              {domainStatus.dcvDelegation.cname}
                            </code>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            data-testid="button-copy-dcv-name-presell"
                            onClick={() => copyToClipboardDns(domainStatus.dcvDelegation!.cname, 'Nome DCV')}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between bg-white dark:bg-gray-900 p-2 rounded border">
                          <div className="flex-1 overflow-hidden">
                            <span className="text-gray-500 dark:text-gray-400">Valor/Destino:</span>
                            <code className="ml-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded font-mono text-xs break-all" data-testid="text-dcv-target-presell">
                              {domainStatus.dcvDelegation.cnameTarget}
                            </code>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            data-testid="button-copy-dcv-target-presell"
                            onClick={() => copyToClipboardDns(domainStatus.dcvDelegation!.cnameTarget, 'Destino DCV')}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!domainStatus?.dcvDelegation && (
                    <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        <strong>Nota:</strong> O registro de validação SSL será gerado após salvar o domínio e verificar o status. Clique em "Verificar Status" para obter as instruções completas.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end pt-4 border-t">
                    <Button 
                      size="sm"
                      onClick={() => checkDomainStatus(customDomain)} 
                      disabled={isCheckingDomain}
                      data-testid="button-verify-status-presell"
                    >
                      {isCheckingDomain ? 'Verificando...' : 'Verificar Status'}
                    </Button>
                  </div>
                </TabsContent>

                {/* SUB-ABA STATUS */}
                <TabsContent value="status" className="space-y-4">
                  {domainStatus ? (
                    <>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
                        <div className="flex items-center justify-between mb-4">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">Status do Domínio</span>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(domainStatus.status)}`} data-testid="badge-domain-status-presell">
                            {domainStatus.statusLabel || domainStatus.status}
                          </span>
                        </div>
                        
                        {domainStatus.ssl && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Certificado SSL</span>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(domainStatus.ssl.status)}`} data-testid="badge-ssl-status-presell">
                              {domainStatus.ssl.statusLabel || domainStatus.ssl.status}
                            </span>
                          </div>
                        )}
                      </div>

                      {domainStatus.status !== 'active' && (
                        <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                          <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Ações pendentes</h4>
                          <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside space-y-1">
                            <li>Configure os registros DNS conforme as instruções na aba "Instruções DNS"</li>
                            <li>Aguarde a propagação do DNS (pode levar até 48 horas)</li>
                            <li>Clique em "Verificar Novamente" para atualizar o status</li>
                          </ul>
                        </div>
                      )}

                      {domainStatus.status === 'active' && (
                        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                          <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">Domínio ativo!</h4>
                          <p className="text-sm text-green-700 dark:text-green-300">
                            Seu domínio está configurado corretamente e funcionando. Acesse{' '}
                            <a href={`https://${customDomain}`} target="_blank" rel="noopener noreferrer" className="underline font-medium">
                              https://{customDomain}
                            </a>
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center">
                      <Globe className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        Clique no botão abaixo para verificar o status do seu domínio.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end pt-4 border-t">
                    <Button 
                      size="sm"
                      onClick={() => checkDomainStatus(customDomain)} 
                      disabled={isCheckingDomain}
                      data-testid="button-recheck-status-presell"
                    >
                      {isCheckingDomain ? 'Verificando...' : (domainStatus ? 'Verificar Novamente' : 'Verificar Status')}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* ABA APARÊNCIA */}
            <TabsContent value="appearance" className="space-y-4">
              <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-purple-800 dark:text-purple-200">
                  🎨 <strong>Dica:</strong> Personalize a aparência visual da sua página para combinar com sua marca.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Tamanho da Resolução/Viewport</Label>
                  <Select defaultValue="responsive">
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="responsive">Responsivo (recomendado)</SelectItem>
                      <SelectItem value="desktop">Desktop Only (1920px)</SelectItem>
                      <SelectItem value="tablet">Tablet (768px)</SelectItem>
                      <SelectItem value="mobile">Mobile (375px)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Define como a página se adapta a diferentes dispositivos
                  </p>
                </div>

                <Separator />

                <div>
                  <Label>Esquema de Cores</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button variant="outline" className="justify-start">
                      <div className="w-4 h-4 rounded-full bg-white border mr-2"></div>
                      Claro
                    </Button>
                    <Button variant="outline" className="justify-start">
                      <div className="w-4 h-4 rounded-full bg-black mr-2"></div>
                      Escuro
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button size="sm" onClick={() => savePage()}>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Aparência
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nome da Página</DialogTitle>
            <DialogDescription>
              Digite um nome único para sua Pre-Sell
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Página</Label>
              <Input
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
                placeholder="minha-presell-produto"
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveAndName} className="flex-1">
                <Check className="h-4 w-4 mr-2" />
                Salvar
              </Button>
              <Button variant="outline" onClick={() => setShowNameDialog(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Vídeo Tutorial */}
      <Dialog open={showVideoTutorialDialog} onOpenChange={setShowVideoTutorialDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Como Configurar seu Domínio Personalizado</DialogTitle>
            <DialogDescription>
              Assista ao tutorial passo a passo
            </DialogDescription>
          </DialogHeader>
          <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="text-lg mb-2">Vídeo em breve!</p>
              <p className="text-sm">O tutorial será adicionado aqui.</p>
            </div>
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