import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Save, Eye, Trash2, Type, Video, MousePointer, Image as ImageIcon,
  Layout, FileText, ChevronDown, ChevronUp, ArrowLeft, Monitor, Tablet, Smartphone,
  Settings, Minus, Clock, Sparkles, AlignLeft, AlignCenter, AlignRight, Globe, Code, LinkIcon, FileCode, Info,
  Bold, Italic, Underline, Columns, GripVertical, Check, X, Search, Copy, RefreshCw, ExternalLink, CheckCircle, AlertCircle
} from "lucide-react";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { FeatureLockedOverlay } from "@/components/FeatureLockedOverlay";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragOverEvent,
  closestCorners,
  useDroppable,
  useDraggable,
  pointerWithin,
  rectIntersection,
  DragStartEvent,
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
  type: 'headline' | 'subheadline' | 'video' | 'text' | 'button' | 'image' | 'divider' | 'countdown' | 'container';
  content: string;
  children?: PreSellElement[];
  columnIndex?: number;
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
    buttonOpenNewTab?: boolean;
    videoUrl?: string;
    imageUrl?: string;
    imageWidth?: string;
    videoWidth?: string;
    countdownMinutes?: number;
    countdownTextColor?: string;
    countdownBgColor?: string;
    countdownPrefix?: string;
    buttonDelay?: number;
    buttonEffect?: 'none' | 'pulse' | 'shake' | 'bounce' | 'glow';
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    textDecoration?: 'none' | 'underline';
    columns?: number;
    gap?: string;
    countdownTime?: number; // Adicionado para o input de tempo
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
  customDomain?: string;
  scripts?: {
    head?: string;
    body?: string;
    footer?: string;
  };
  seo?: {
    title?: string;
    description?: string;
    favicon?: string;
    ogImage?: string;
  };
  slug: string;
}

type ViewportSize = 'desktop' | 'tablet' | 'mobile';

const viewportSizes: Record<ViewportSize, string> = {
  desktop: 'max-w-4xl',
  tablet: 'max-w-2xl',
  mobile: 'max-w-md'
};

// Algoritmo de detecção de colisão melhorado para feedback visual correto
function customCollisionDetection(args: any) {
  const { droppableContainers, active } = args;

  // Primeiro, tenta detecção baseada no ponteiro (mais precisa)
  const pointerCollisions = pointerWithin(args);

  if (pointerCollisions.length > 0) {
    // Priorizar elementos específicos sobre colunas vazias
    const elementCollisions = pointerCollisions.filter((collision: any) => {
      const container = Array.from(droppableContainers).find(
        (c: any) => c.id === collision.id
      );
      return container?.data?.current?.type === 'element';
    });

    // Se há colisão com um elemento específico, usar essa
    if (elementCollisions.length > 0) {
      return elementCollisions;
    }

    // Se não há elementos, mas há colunas, usar as colunas
    const columnCollisions = pointerCollisions.filter((collision: any) => {
      const container = Array.from(droppableContainers).find(
        (c: any) => c.id === collision.id
      );
      return container?.data?.current?.type === 'column';
    });

    if (columnCollisions.length > 0) {
      return columnCollisions;
    }

    // Retornar todas as colisões detectadas
    return pointerCollisions;
  }

  // Fallback: usa closestCenter para melhor detecção geral
  return closestCenter(args);
}

// Componente draggable para elementos da sidebar
function DraggableElementButton({
  type,
  icon: Icon,
  label,
  onClick
}: {
  type: string;
  icon: any;
  label: string;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `new-${type}`,
    data: {
      type: 'new-element',
      elementType: type
    }
  });

  return (
    <Button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      variant="outline"
      className={`h-auto flex-col items-center gap-3 p-5 hover:bg-primary/10 hover:border-primary/60 hover:shadow-md transition-all duration-200 bg-card border-border text-foreground hover:text-foreground cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50' : ''
      }`}
      onClick={onClick}
      data-testid={`button-add-${type}`}
    >
      <Icon className="h-10 w-10 text-primary" />
      <span className="text-xs font-medium">{label}</span>
    </Button>
  );
}

// Componente principal droppable (área fora dos containers)
function MainDroppableArea({
  elements,
  selectedElementId,
  setSelectedElementId,
  deleteElement,
  moveElement,
  renderElementContent,
  activeId
}: any) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'main-droppable-area',
    data: {
      type: 'main',
      accepts: ['element']
    }
  });

  // Só mostrar indicador se estiver arrastando de dentro de um container
  const isDraggingFromContainer = activeId && elements.some((el: any) =>
    el.children?.some((c: any) => c.id === activeId)
  );

  return (
    <div
      ref={setNodeRef}
      className={`space-y-4 p-4 relative min-h-[400px] transition-all ${
        isOver && isDraggingFromContainer ? 'bg-green-50 ring-2 ring-green-400' : ''
      }`}
    >
      {/* Indicador de drop na área principal */}
      {isOver && isDraggingFromContainer && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-2xl animate-bounce flex items-center gap-2">
            <Check className="h-5 w-5" />
            <span className="font-semibold">Solte aqui para mover para fora do container</span>
          </div>
        </div>
      )}

      {/* Indicador visual quando arrastar de dentro do container */}
      {activeId && isDraggingFromContainer && !isOver && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-start justify-center pt-4">
          <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-2xl animate-bounce flex items-center gap-2">
            <Layout className="h-5 w-5" />
            <span className="font-semibold">↓ Solte fora do container para mover ↓</span>
          </div>
        </div>
      )}

      <SortableContext
        items={elements.filter((el: any) => !el.children).map((el: any) => el.id)}
        strategy={verticalListSortingStrategy}
      >
        {elements.map((element: any, index: number) => {
          // Containers não devem ser SortableElement para permitir drop nas colunas
          if (element.type === 'container') {
            return (
              <div
                key={element.id}
                className={`group relative p-4 rounded-lg border-2 transition-all ${
                  selectedElementId === element.id
                    ? 'border-primary bg-primary/5'
                    : 'border-transparent hover:border-gray-300'
                }`}
                onClick={() => setSelectedElementId(element.id)}
              >
                {/* Controls */}
                <div className="absolute -top-3 right-2 flex gap-1 opacity-0 group-hover:opacity-100 bg-white rounded-md shadow-lg p-1 z-10">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); moveElement(element.id, 'up'); }}
                    disabled={index === 0}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); moveElement(element.id, 'down'); }}
                    disabled={index === elements.length - 1}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedElementId(element.id);
                    }}
                    className="h-7 w-7 p-0"
                  >
                    <Settings className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); deleteElement(element.id); }}
                    className="h-7 w-7 p-0 text-red-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                {/* Container Content */}
                {renderElementContent(element)}
              </div>
            );
          }

          // Outros elementos usam SortableElement normalmente
          return (
            <SortableElement
              key={element.id}
              element={element}
              isSelected={selectedElementId === element.id}
              onSelect={setSelectedElementId}
              onDelete={() => deleteElement(element.id)}
              onMoveUp={() => moveElement(element.id, 'up')}
              onMoveDown={() => moveElement(element.id, 'down')}
              canMoveUp={index > 0}
              canMoveDown={index < elements.length - 1}
              renderContent={renderElementContent}
            />
          );
        })}
      </SortableContext>
    </div>
  );
}

// Componente Droppable para colunas do container
function DroppableColumn({
  id,
  colIndex,
  children,
  columnChildren,
  selectedElementId,
  setSelectedElementId,
  deleteElement,
  renderElementContent
}: any) {
  const { setNodeRef, isOver, active } = useDroppable({
    id,
    data: {
      type: 'column',
      columnIndex: colIndex,
      accepts: ['element']
    }
  });

  // IMPORTANTE: isOver só é true quando o cursor está EXATAMENTE sobre ESTA coluna
  // Não precisa verificar active, pois isOver já faz isso
  const isDraggingOver = isOver && active;

  return (
    <div
      ref={setNodeRef}
      className={`relative border-2 border-dashed rounded-lg transition-all ${
        isDraggingOver
          ? 'border-green-500 bg-green-100/70 shadow-xl ring-4 ring-green-300 scale-[1.02]'
          : 'border-gray-300 bg-gray-50/50 hover:border-green-400 hover:bg-green-50/30'
      }`}
      style={{
        minHeight: '200px',
        padding: '15px',
        position: 'relative',
        zIndex: isDraggingOver ? 10 : 1,
        width: '100%',
        height: '100%'
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) {
          setSelectedElementId(null);
        }
      }}
    >
      {/* Badge removido conforme solicitado */}

      {/* Indicador de drop - só aparece quando isOver for TRUE nesta coluna específica */}
      {isDraggingOver && active && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="bg-green-500/90 text-white px-4 py-2 rounded-lg shadow-2xl text-center animate-pulse flex items-center gap-2">
            <Check className="h-5 w-5" />
            <p className="font-semibold text-sm">Solte na Col {colIndex + 1}</p>
          </div>
        </div>
      )}

      <SortableContext
        items={columnChildren.map((c: any) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="relative z-10">
          {columnChildren.length > 0 ? (
            <div className="space-y-2">
              {columnChildren.map((child: any) => (
                <SortableElement
                  key={child.id}
                  element={child}
                  isSelected={selectedElementId === child.id}
                  onSelect={setSelectedElementId}
                  onDelete={() => deleteElement(child.id)}
                  onMoveUp={() => {}}
                  onMoveDown={() => {}}
                  canMoveUp={false}
                  canMoveDown={false}
                  renderContent={renderElementContent}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm py-16 pointer-events-none">
              <div className={`text-center transition-all ${isOver ? 'scale-110' : ''}`}>
                <Plus className={`h-10 w-10 mx-auto mb-3 transition-colors ${isOver ? 'text-green-500 animate-bounce' : ''}`} />
                <p className={`font-medium transition-colors ${isOver ? 'text-green-600 font-bold text-sm flex items-center gap-1.5 justify-center' : ''}`}>
                  {isOver ? <><Check className="h-4 w-4" /> Solte aqui</> : 'Arraste widgets aqui'}
                </p>
              </div>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// Componente Sortable para elementos
function SortableElement({
  element,
  isSelected,
  onSelect,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  renderContent
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: element.id,
    data: {
      type: 'element',
      element: element
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    cursor: isDragging ? 'grabbing' : 'default',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative p-4 pl-12 rounded-lg border-2 transition-all ${
        isSelected
          ? 'border-green-500 bg-green-50'
          : isDragging
          ? 'border-green-500 bg-green-100 shadow-2xl ring-4 ring-green-300'
          : 'border-transparent hover:border-green-200'
      }`}
      onClick={() => onSelect(element.id)}
    >
      {/* Drag Handle - Visual indicator */}
      <div
        className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <div
          {...attributes}
          {...listeners}
          className="bg-green-500 rounded-md shadow-lg p-1.5 cursor-grab active:cursor-grabbing pointer-events-auto"
        >
          <GripVertical className="h-6 w-6 text-white" />
        </div>
      </div>

      {/* Controls */}
      <div className="absolute -top-3 right-2 flex gap-1 opacity-0 group-hover:opacity-100 bg-white rounded-md shadow-lg p-1 z-10">
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          disabled={!canMoveUp}
          className="h-7 w-7 p-0"
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          disabled={!canMoveDown}
          className="h-7 w-7 p-0"
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(element.id);
          }}
          className="h-7 w-7 p-0"
        >
          <Settings className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="h-7 w-7 p-0 text-red-500"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Element Content */}
      {renderContent(element)}
    </div>
  );
}

export default function PreSellBuilderSimple() {
  const { isFeatureBlocked } = useFeatureAccess();
  const featureBlocked = isFeatureBlocked("presell-builder");
  
  const [currentPage, setCurrentPage] = useState<PreSellPage>({
    name: '',
    elements: [],
    settings: {
      backgroundColor: '#ffffff',
      maxWidth: '1200px',
      fontFamily: 'Arial, sans-serif'
    },
    slug: ''
  });
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [newPageName, setNewPageName] = useState('');
  const [viewport, setViewport] = useState<ViewportSize>('desktop');
  const [domainStatus, setDomainStatus] = useState<{
    status: string;
    statusLabel: string;
    ssl?: { status: string; statusLabel: string };
    dcvDelegation?: { cname: string; cnameTarget: string };
    ownershipVerification?: { txtName: string; txtValue: string };
    dnsInstructions?: { cname: string; dcvDelegation: string; ownershipTxt: string };
    isFullyActive?: boolean;
    needsSync?: boolean;
    message?: string;
  } | null>(null);
  const [isCheckingDomain, setIsCheckingDomain] = useState(false);
  const [originalCustomDomain, setOriginalCustomDomain] = useState<string>('');
  const [txtRecords, setTxtRecords] = useState<Array<{name: string; value: string; type: string}>>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lastOverColumn, setLastOverColumn] = useState<{overId: string, columnIndex: number} | null>(null);
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editName = params.get('edit');
    const openSettings = params.get('settings') === 'true';

    if (editName) {
      loadPage(editName).then(() => {
        if (openSettings) {
          setShowSettingsDialog(true);
        }
      });
    } else if (params.get('new')) {
      setShowNameDialog(true);
    }
  }, []);

  const loadPage = async (name: string) => {
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
      if (response.ok) {
        const data = await response.json();
        setCurrentPage({
          ...data,
          elements: data.elements || [],
          slug: data.slug || '',
          name: data.name || name
        });
        setOriginalCustomDomain(data.customDomain || '');
      }
    } catch (error) {
    }
  };

  const addElement = (type: PreSellElement['type']) => {
    const newElement: PreSellElement = {
      id: `el-${Date.now()}`,
      type,
      content: getDefaultContent(type),
      styles: getDefaultStyles(type)
    };

    setCurrentPage({
      ...currentPage,
      elements: [...(currentPage.elements || []), newElement]
    });
    setSelectedElementId(newElement.id);
  };

  const getDefaultContent = (type: string): string => {
    switch (type) {
      case 'headline': return 'Título Principal Impactante';
      case 'subheadline': return 'Subtítulo que gera desejo';
      case 'text': return 'Digite seu texto aqui...';
      case 'button': return 'QUERO GARANTIR AGORA!';
      case 'video': return 'https://www.youtube.com/watch?v=exemplo';
      case 'image': return 'URL da imagem';
      case 'divider': return '';
      case 'countdown': return '';
      default: return '';
    }
  };

  const getDefaultStyles = (type: string) => {
    const base = {
      textAlign: 'center' as const,
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
      case 'headline': return { ...base, fontSize: '36px', color: '#000000', fontWeight: 'bold' as const, fontStyle: 'normal' as const, textDecoration: 'none' as const };
      case 'subheadline': return { ...base, fontSize: '24px', color: '#333333', fontWeight: 'normal' as const, fontStyle: 'normal' as const, textDecoration: 'none' as const };
      case 'text': return { ...base, fontSize: '16px', color: '#666666', fontWeight: 'normal' as const, fontStyle: 'normal' as const, textDecoration: 'none' as const };
      case 'button': return { ...base, fontSize: '18px', color: '#ffffff', backgroundColor: '#0070f3', buttonUrl: '#', buttonOpenNewTab: true, buttonDelay: 0, buttonEffect: 'none' as const };
      case 'video': return { ...base, videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', videoWidth: '100%' };
      case 'image': return { ...base, imageUrl: 'https://images.vexels.com/media/users/3/147917/isolated/preview/db5b584f9e40ca3169c74cbcc2f739d7-icone-de-curso-de-camera-fotografica.png', imageWidth: '25%' };
      case 'countdown': return { ...base, countdownMinutes: 60, countdownTextColor: '#ffffff', countdownBgColor: '#ff0000', countdownPrefix: 'Falta apenas: ', countdownTime: 60 }; // Adicionado countdownTime inicial
      case 'container': return { ...base, columns: 2, gap: '20px', backgroundColor: 'transparent' };
      default: return base;
    }
  };

  const updateElement = (id: string, updates: Partial<PreSellElement>) => {
    const elements = currentPage.elements || [];

    const updateRecursive = (els: PreSellElement[]): PreSellElement[] => {
      return els.map(el => {
        if (el.id === id) {
          return { ...el, ...updates, styles: { ...el.styles, ...updates.styles } };
        }
        if (el.children && el.children.length > 0) {
          return { ...el, children: updateRecursive(el.children) };
        }
        return el;
      });
    };

    setCurrentPage({
      ...currentPage,
      elements: updateRecursive(elements)
    });
  };

  const deleteElement = (id: string) => {
    const deleteRecursive = (els: PreSellElement[]): PreSellElement[] => {
      return els.filter(el => el.id !== id).map(el => {
        if (el.children && el.children.length > 0) {
          return { ...el, children: deleteRecursive(el.children) };
        }
        return el;
      });
    };

    setCurrentPage({
      ...currentPage,
      elements: deleteRecursive(currentPage.elements || [])
    });
    setSelectedElementId(null);
  };

  const moveElement = (id: string, direction: 'up' | 'down') => {
    const elements = currentPage.elements || [];
    const index = elements.findIndex(el => el.id === id);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= elements.length) return;

    const newElements = arrayMove(elements, index, newIndex);
    setCurrentPage({ ...currentPage, elements: newElements });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setLastOverColumn(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;

    if (!over) {
      setLastOverColumn(null);
      return;
    }

    const overId = over.id as string;
    const overData = over.data.current;

    // Prioridade 1: Detectar se é uma coluna via data
    if (overData?.type === 'column' && typeof overData.columnIndex === 'number') {
      setLastOverColumn({ overId, columnIndex: overData.columnIndex });
      return;
    }

    // Prioridade 2: Fallback - detectar por ID do droppable
    if (overId.startsWith('container-') && overId.includes('-col-')) {
      const parts = overId.split('-col-');
      const columnIndex = parseInt(parts[parts.length - 1]);
      if (!isNaN(columnIndex)) {
        setLastOverColumn({ overId, columnIndex });
        return;
      }
    }

    // Se não for coluna, limpar
    setLastOverColumn(null);
  };

  // Função para encontrar elemento e sua localização
  const findElementLocation = (id: string) => {
    const elements = currentPage.elements || [];

    // Procurar no nível principal
    const mainIndex = elements.findIndex(el => el.id === id);
    if (mainIndex !== -1) {
      return {
        element: elements[mainIndex],
        containerId: null,
        columnIndex: null,
        index: mainIndex
      };
    }

    // Procurar em containers
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (el.children && el.children.length > 0) {
        const childIndex = el.children.findIndex(c => c.id === id);
        if (childIndex !== -1) {
          return {
            element: el.children[childIndex],
            containerId: el.id,
            columnIndex: el.children[childIndex].columnIndex ?? 0,
            index: childIndex
          };
        }
      }
    }
    return null;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) {
      setLastOverColumn(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;
    const overData = over.data.current;
    const activeData = active.data.current;

    // CASO NOVO: Arrastar elemento novo da sidebar
    if (activeData?.type === 'new-element' && activeData?.elementType) {
      const elementType = activeData.elementType as PreSellElement['type'];

      const newElement: PreSellElement = {
        id: `el-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: elementType,
        content: getDefaultContent(elementType),
        styles: getDefaultStyles(elementType)
      };

      let newElements = [...(currentPage.elements || [])];

      // Verificar se foi dropado em uma coluna de container
      let targetColIndex: number | null = null;
      let containerId: string | null = null;

      // Prioridade 1: Verificar overData
      if (overData?.type === 'column' && typeof overData.columnIndex === 'number') {
        targetColIndex = overData.columnIndex;
        const parts = overId.split('-');
        const containerIdWithPrefix = parts.slice(0, -2).join('-');
        containerId = containerIdWithPrefix.replace('container-', '');
      }
      // Prioridade 2: Verificar overId
      else if (overId && typeof overId === 'string' && overId.startsWith('container-') && overId.includes('-col-')) {
        const parts = overId.split('-col-');
        const colIndexStr = parts[parts.length - 1];
        targetColIndex = parseInt(colIndexStr);
        const containerIdWithPrefix = parts.slice(0, -1).join('-');
        containerId = containerIdWithPrefix.replace('container-', '');
      }

      // Se foi dropado em uma coluna, adicionar lá
      if (targetColIndex !== null && !isNaN(targetColIndex) && containerId) {
        let found = false;
        newElements = newElements.map(el => {
          if (el.id === containerId) {
            found = true;
            const elementWithColumn = { ...newElement, columnIndex: targetColIndex };
            return {
              ...el,
              children: [...(el.children || []), elementWithColumn]
            };
          }
          return el;
        });

        if (!found) {
          // Container não encontrado, adicionar no nível principal
          newElements.push(newElement);
        }
      } else {
        // Adicionar no nível principal
        newElements.push(newElement);
      }

      setCurrentPage({ ...currentPage, elements: newElements });
      setSelectedElementId(newElement.id);
      setLastOverColumn(null);

      toast({
        title: "✅ Elemento adicionado!",
        description: `${elementType} adicionado com sucesso`,
      });
      return;
    }

    // CASO ESPECIAL: Drop na área principal (fora do container)
    if (overId === 'main-droppable-area' || overData?.type === 'main') {
      const activeLocation = findElementLocation(activeId);
      if (!activeLocation) return;

      // Só permite mover se estiver dentro de um container
      if (activeLocation.containerId) {
        let newElements = [...(currentPage.elements || [])];

        // Remover do container
        newElements = newElements.map(el => {
          if (el.id === activeLocation.containerId) {
            return {
              ...el,
              children: (el.children || []).filter(c => c.id !== activeId)
            };
          }
          return el;
        });

        // Adicionar no nível principal (sem columnIndex)
        const movedElement = { ...activeLocation.element };
        delete movedElement.columnIndex;
        newElements.push(movedElement);

        setCurrentPage({ ...currentPage, elements: newElements });
        setLastOverColumn(null);

        toast({
          title: "✅ Movido!",
          description: "Widget movido para fora do container",
        });
        return;
      }
    }

    const activeLocation = findElementLocation(activeId);
    if (!activeLocation) {
      setLastOverColumn(null);
      return;
    }

    let newElements = [...(currentPage.elements || [])];

    // CASO 1: Drop sobre uma coluna do container
    // Prioridade 1: Usar over.data.current
    let targetColIndex: number | null = null;
    let containerId: string | null = null;

    if (overData?.type === 'column' && typeof overData.columnIndex === 'number') {
      targetColIndex = overData.columnIndex;
      const parts = overId.split('-');
      const containerIdWithPrefix = parts.slice(0, -2).join('-');
      containerId = containerIdWithPrefix.replace('container-', '');
    }
    // Prioridade 2: Detectar por overId
    else if (overId.startsWith('container-') && overId.includes('-col-')) {
      const parts = overId.split('-col-');
      targetColIndex = parseInt(parts[parts.length - 1]);
      const containerIdWithPrefix = parts.slice(0, -1).join('-');
      containerId = containerIdWithPrefix.replace('container-', '');
    }
    // Prioridade 3: Usar lastOverColumn se disponível
    else if (lastOverColumn) {
      targetColIndex = lastOverColumn.columnIndex;
      const parts = lastOverColumn.overId.split('-col-');
      const containerIdWithPrefix = parts.slice(0, -1).join('-');
      containerId = containerIdWithPrefix.replace('container-', '');
    }

    // Se detectou uma coluna válida, fazer o drop
    if (targetColIndex !== null && containerId !== null) {

      // Remover elemento da origem
      if (activeLocation.containerId) {
        newElements = newElements.map(el => {
          if (el.id === activeLocation.containerId) {
            return {
              ...el,
              children: (el.children || []).filter(c => c.id !== activeId)
            };
          }
          return el;
        });
      } else {
        newElements = newElements.filter(el => el.id !== activeId);
      }

      // Adicionar ao container de destino
      newElements = newElements.map(el => {
        if (el.id === containerId) {
          const movedElement = {
            ...activeLocation.element,
            columnIndex: targetColIndex
          };
          return {
            ...el,
            children: [...(el.children || []), movedElement]
          };
        }
        return el;
      });

      setCurrentPage({ ...currentPage, elements: newElements });
      setLastOverColumn(null);

      toast({
        title: "✅ Movido!",
        description: `Widget adicionado à coluna ${targetColIndex + 1}`,
      });
      return;
    }

    // CASO 2: Drop sobre outro elemento
    const overLocation = findElementLocation(overId);
    if (!overLocation) {
      setLastOverColumn(null);
      return;
    }

    // Mesmo container e mesma coluna - reordenar
    if (activeLocation.containerId === overLocation.containerId &&
             activeLocation.columnIndex === overLocation.columnIndex) {

      if (activeLocation.containerId) {
        // Reordenar dentro de container
        newElements = newElements.map(el => {
          if (el.id === activeLocation.containerId) {
            const columnChildren = (el.children || []).filter(
              c => (c.columnIndex ?? 0) === activeLocation.columnIndex
            );
            const otherChildren = (el.children || []).filter(
              c => (c.columnIndex ?? 0) !== activeLocation.columnIndex
            );

            const oldIdx = columnChildren.findIndex(c => c.id === activeId);
            const newIdx = columnChildren.findIndex(c => c.id === overId);

            if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
              const reordered = arrayMove(columnChildren, oldIdx, newIdx);
              return { ...el, children: [...otherChildren, ...reordered] };
            }
          }
          return el;
        });
      } else {
        // Reordenar no nível principal
        const oldIdx = newElements.findIndex(el => el.id === activeId);
        const newIdx = newElements.findIndex(el => el.id === overId);

        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          newElements = arrayMove(newElements, oldIdx, newIdx);
        }
      }

      setCurrentPage({ ...currentPage, elements: newElements });
      setLastOverColumn(null);
    }
    // Containers diferentes ou colunas diferentes - mover
    else if (activeLocation.containerId !== overLocation.containerId ||
             activeLocation.columnIndex !== overLocation.columnIndex) {

      // Remover da origem
      if (activeLocation.containerId) {
        newElements = newElements.map(el => {
          if (el.id === activeLocation.containerId) {
            return {
              ...el,
              children: (el.children || []).filter(c => c.id !== activeId)
            };
          }
          return el;
        });
      } else {
        newElements = newElements.filter(el => el.id !== activeId);
      }

      // Adicionar ao destino
      if (overLocation.containerId) {
        // Movendo para dentro de um container
        newElements = newElements.map(el => {
          if (el.id === overLocation.containerId) {
            const movedElement = {
              ...activeLocation.element,
              columnIndex: overLocation.columnIndex
            };
            const children = el.children || [];
            const targetIndex = children.findIndex(c => c.id === overId);
            const newChildren = [...children];
            newChildren.splice(targetIndex, 0, movedElement);

            return { ...el, children: newChildren };
          }
          return el;
        });
      } else {
        // Movendo para fora do container (nível principal)
        const movedElement = { ...activeLocation.element };
        delete movedElement.columnIndex; // Remover propriedade de coluna
        delete movedElement.children; // Limpar children se houver

        const targetIndex = newElements.findIndex(el => el.id === overId);
        if (targetIndex !== -1) {
          newElements.splice(targetIndex, 0, movedElement);
        } else {
          // Se não encontrou o elemento de destino, adicionar no final
          newElements.push(movedElement);
        }
      }

      setCurrentPage({ ...currentPage, elements: newElements });
      setLastOverColumn(null);

      toast({
        title: "✅ Movido!",
        description: overLocation.containerId
          ? `Widget movido para coluna ${(overLocation.columnIndex ?? 0) + 1}`
          : "Widget movido para fora do container",
      });
    } else {
      setLastOverColumn(null);
    }
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
        credentials: 'include',
        headers: { ...getAuthHeaders() }
      });

      if (response.ok) {
        const data = await response.json();
        setDomainStatus(data);
        if (data.txtRecords && Array.isArray(data.txtRecords)) {
          setTxtRecords(data.txtRecords);
        } else {
          setTxtRecords([]);
        }
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

  const savePage = async () => {
    if (!currentPage.name) {
      setShowNameDialog(true);
      return;
    }

    // Verificar se já tinha domínio e está tentando remover
    const hadDomainBefore = originalCustomDomain && originalCustomDomain.trim() !== '';
    if (hadDomainBefore && (!currentPage.customDomain || !currentPage.customDomain.trim())) {
      toast({
        title: "Domínio obrigatório",
        description: "Você já configurou um domínio próprio. Para alterar, insira um novo domínio.",
        variant: "destructive",
      });
      return;
    }

    try {
      const endpoint = currentPage.name ? '/api/presell/update' : '/api/presell/save';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify(currentPage)
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
          title: "Página salva!",
          description: "Pre-Sell salva com sucesso."
        });
      } else {
        const data = await response.json();
        throw new Error(data.message || 'Erro ao salvar');
      }
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const saveWithName = async () => {
    if (!newPageName) {
      toast({
        title: "Erro",
        description: "Digite um nome para a página",
        variant: "destructive"
      });
      return;
    }

    const slug = newPageName.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/^-+|-+$/g, '');

    const pageData = {
      ...currentPage,
      name: slug,
      slug: slug,
      elements: currentPage.elements || []
    };

    setCurrentPage(pageData);
    setShowNameDialog(false);

    setTimeout(async () => {
      try {
        const response = await fetch('/api/presell/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          credentials: 'include',
          body: JSON.stringify(pageData)
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
            title: "✅ Página salva!",
            description: `Acesse em: /presell/${slug}`
          });

          window.history.replaceState({}, '', `/presell-builder?edit=${slug}`);
        } else {
          const data = await response.json();
          throw new Error(data.message || 'Erro ao salvar');
        }
      } catch (error: any) {
        toast({
          title: "Erro ao salvar",
          description: error.message,
          variant: "destructive"
        });
      }
    }, 100);
  };

  const findElementById = (elements: PreSellElement[], id: string): PreSellElement | undefined => {
    for (const el of elements) {
      if (el.id === id) return el;
      if (el.children && el.children.length > 0) {
        const found = findElementById(el.children, id);
        if (found) return found;
      }
    }
    return undefined;
  };

  const selectedElement = selectedElementId ? findElementById(currentPage.elements || [], selectedElementId) : undefined;

  const buildCommonStyles = (el: PreSellElement) => {
    const paddingStyle = `${el.styles?.paddingTop} ${el.styles?.paddingRight} ${el.styles?.paddingBottom} ${el.styles?.paddingLeft}`;
    const marginStyle = `${el.styles?.marginTop} ${el.styles?.marginRight} ${el.styles?.marginBottom} ${el.styles?.marginLeft}`;
    return { paddingStyle, marginStyle };
  };

  const buildTextStyleObject = (el: PreSellElement, paddingStyle: string, marginStyle: string) => {
    return {
      textAlign: el.styles?.textAlign,
      fontSize: el.styles?.fontSize,
      color: el.styles?.color,
      fontWeight: el.styles?.fontWeight,
      fontStyle: el.styles?.fontStyle,
      textDecoration: el.styles?.textDecoration,
      padding: paddingStyle,
      margin: marginStyle
    };
  };

  const buildTextStyleString = (el: PreSellElement, paddingStyle: string, marginStyle: string) => {
    return `text-align: ${el.styles?.textAlign}; font-size: ${el.styles?.fontSize}; color: ${el.styles?.color}; font-weight: ${el.styles?.fontWeight}; font-style: ${el.styles?.fontStyle}; text-decoration: ${el.styles?.textDecoration}; padding: ${paddingStyle}; margin: ${marginStyle};`;
  };

  const buildButtonEffect = (el: PreSellElement) => {
    const buttonEffect = el.styles?.buttonEffect || 'none';
    let className = '';
    let animationCSS = '';
    let animationStyle = '';

    if (buttonEffect === 'pulse') {
      className = 'animate-pulse-infinite';
      animationCSS = `
        @keyframes pulse-${el.id} {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }`;
      animationStyle = `animation: pulse-${el.id} 1.5s ease-in-out infinite;`;
    } else if (buttonEffect === 'shake') {
      className = 'animate-shake-infinite';
      animationCSS = `
        @keyframes shake-${el.id} {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }`;
      animationStyle = `animation: shake-${el.id} 0.8s ease-in-out infinite;`;
    } else if (buttonEffect === 'bounce') {
      className = 'animate-bounce-infinite';
      animationCSS = `
        @keyframes bounce-${el.id} {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }`;
      animationStyle = `animation: bounce-${el.id} 1s ease-in-out infinite;`;
    } else if (buttonEffect === 'glow') {
      className = 'animate-glow-infinite';
      animationCSS = `
        @keyframes glow-${el.id} {
          0%, 100% { box-shadow: 0 0 10px ${el.styles?.backgroundColor}; }
          50% { box-shadow: 0 0 20px ${el.styles?.backgroundColor}, 0 0 30px ${el.styles?.backgroundColor}; }
        }`;
      animationStyle = `animation: glow-${el.id} 2s ease-in-out infinite;`;
    }

    return { className, animationCSS, animationStyle };
  };

  const buildCountdownConfig = (el: PreSellElement) => {
    const rawMinutes = el.styles?.countdownMinutes;
    const parsedMinutes = Number(rawMinutes);
    const minutes = (!rawMinutes || isNaN(parsedMinutes) || parsedMinutes <= 0) ? 60 : parsedMinutes;
    const displayMinutes = Math.floor(minutes).toString().padStart(2, '0');
    const textColor = el.styles?.countdownTextColor || el.styles?.color || '#ffffff';
    const bgColor = el.styles?.countdownBgColor || '#ff0000';
    const prefix = el.styles?.countdownPrefix || 'Falta apenas: ';
    const fontSize = el.styles?.fontSize || '24px';

    return { minutes, displayMinutes, textColor, bgColor, prefix, fontSize };
  };

  const buildImageJustifyContent = (textAlign?: string) => {
    if (textAlign === 'left') return 'flex-start';
    if (textAlign === 'right') return 'flex-end';
    return 'center';
  };

  const renderElementContent = (el: PreSellElement) => {
    const { paddingStyle, marginStyle } = buildCommonStyles(el);

    switch (el.type) {
      case 'headline':
        return (
          <h1 style={buildTextStyleObject(el, paddingStyle, marginStyle)}>
            {el.content}
          </h1>
        );

      case 'subheadline':
        return (
          <h2 style={buildTextStyleObject(el, paddingStyle, marginStyle)}>
            {el.content}
          </h2>
        );

      case 'text':
        return (
          <p style={{
            ...buildTextStyleObject(el, paddingStyle, marginStyle),
            whiteSpace: 'pre-wrap'
          }}>
            {el.content}
          </p>
        );

      case 'video':
        return el.styles?.videoUrl ? (
          <div style={{
            textAlign: el.styles?.textAlign,
            padding: paddingStyle,
            margin: marginStyle
          }}>
            <iframe
              width={el.styles.videoWidth || '100%'}
              height="315"
              src={el.styles.videoUrl.replace('watch?v=', 'embed/')}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ maxWidth: '100%' }}
            />
          </div>
        ) : null;

      case 'image':
        return (
          <div style={{
            textAlign: el.styles?.textAlign,
            padding: paddingStyle,
            margin: marginStyle,
            display: 'flex',
            justifyContent: buildImageJustifyContent(el.styles?.textAlign)
          }}>
            {el.styles?.imageUrl ? (
              <img
                src={el.styles.imageUrl}
                alt={el.content}
                style={{ width: el.styles.imageWidth || '100%', height: 'auto', maxWidth: '100%', display: 'block' }}
              />
            ) : (
              <div style={{
                width: el.styles?.imageWidth || '100%',
                height: '300px',
                maxWidth: '100%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
              }}>
                {/* Padrão de fundo decorativo */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0.1,
                  background: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                }}></div>

                {/* Círculo de fundo */}
                <div style={{
                  position: 'absolute',
                  width: '200px',
                  height: '200px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  zIndex: 0
                }}></div>

                {/* Container do ícone */}
                <div style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.25)',
                  borderRadius: '50%',
                  padding: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                  zIndex: 1,
                  backdropFilter: 'blur(10px)'
                }}>
                  <ImageIcon
                    style={{
                      width: '48px',
                      height: '48px',
                      color: '#ffffff',
                      strokeWidth: 1.5
                    }}
                  />
                </div>

                {/* Texto explicativo */}
                <p style={{
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: '600',
                  margin: 0,
                  zIndex: 1,
                  textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  Adicione uma imagem
                </p>
                <p style={{
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontSize: '14px',
                  margin: '8px 0 0 0',
                  zIndex: 1
                }}>
                  Configure a URL nas propriedades →
                </p>
              </div>
            )}
          </div>
        );

      case 'button':
        const { className: buttonClassName } = buildButtonEffect(el);

        return (
          <div style={{
            textAlign: el.styles?.textAlign,
            padding: paddingStyle,
            margin: marginStyle
          }}>
            <a
              href={el.styles?.buttonUrl || '#'}
              target={el.styles?.buttonOpenNewTab !== false ? '_blank' : '_self'}
              rel={el.styles?.buttonOpenNewTab !== false ? 'noopener noreferrer' : undefined}
              onClick={(e) => e.preventDefault()}
              className={buttonClassName}
              style={{
                display: 'inline-block',
                backgroundColor: el.styles?.backgroundColor,
                color: el.styles?.color,
                fontSize: el.styles?.fontSize,
                padding: '12px 24px',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer',
                textDecoration: 'none',
                pointerEvents: 'none'
              }}
            >
              {el.content}
            </a>
          </div>
        );

      case 'divider':
        return (
          <hr style={{
            border: 'none',
            borderTop: '2px solid #ddd',
            margin: marginStyle
          }} />
        );

      case 'countdown':
        const countdownConfig = buildCountdownConfig(el);
        return (
          <div style={{
            textAlign: el.styles?.textAlign,
            fontSize: countdownConfig.fontSize,
            color: countdownConfig.textColor,
            backgroundColor: countdownConfig.bgColor,
            padding: paddingStyle,
            margin: '0',
            fontWeight: 'bold',
            borderRadius: '8px',
            display: 'block',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            {countdownConfig.prefix}
            <span className="countdown-time">{countdownConfig.displayMinutes}:00</span>
          </div>
        );

      case 'container':
        const columns = el.styles?.columns || 2;
        return (
          <div
            className="container-responsive w-full"
            style={{
              gap: el.styles?.gap || '20px',
              backgroundColor: el.styles?.backgroundColor,
              padding: paddingStyle,
              margin: marginStyle,
              maxWidth: '100%',
              overflow: 'hidden'
            }}
            data-columns={columns}
          >
            {Array.from({ length: el.styles?.columns || 2 }).map((_, colIndex) => {
              const columnChildren = el.children?.filter(child => (child.columnIndex ?? 0) === colIndex) || [];
              const droppableId = `container-${el.id}-col-${colIndex}`;

              return (
                <DroppableColumn
                  key={droppableId}
                  id={droppableId}
                  colIndex={colIndex}
                  columnChildren={columnChildren}
                  selectedElementId={selectedElementId}
                  setSelectedElementId={setSelectedElementId}
                  deleteElement={deleteElement}
                  renderElementContent={renderElementContent}
                />
              );
            })}
          </div>
        );

      default:
        return null;
    }
  };

  // Função para renderizar elementos que serão convertidos em HTML puro para scripts
  const renderElementAsHtml = (el: PreSellElement): string => {
    const { paddingStyle, marginStyle } = buildCommonStyles(el);

    switch (el.type) {
      case 'headline':
        return `<h1 style="${buildTextStyleString(el, paddingStyle, marginStyle)}">${el.content}</h1>`;
      case 'subheadline':
        return `<h2 style="${buildTextStyleString(el, paddingStyle, marginStyle)}">${el.content}</h2>`;
      case 'text':
        return `<p style="${buildTextStyleString(el, paddingStyle, marginStyle)} white-space: pre-wrap;">${el.content}</p>`;
      case 'video':
        return el.styles?.videoUrl ? `<div style="text-align: ${el.styles?.textAlign}; padding: ${paddingStyle}; margin: ${marginStyle};"><iframe width="${el.styles.videoWidth || '100%'}" height="315" src="${el.styles.videoUrl.replace('watch?v=', 'embed/')}" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style="max-width: 100%;"></iframe></div>` : '';
      case 'image':
        return el.styles?.imageUrl ? `<div style="text-align: ${el.styles?.textAlign}; padding: ${paddingStyle}; margin: ${marginStyle};"><img src="${el.styles.imageUrl}" alt="${el.content}" style="width: ${el.styles.imageWidth || '100%'}; height: auto; max-width: 100%; display: block; margin: 0 auto;"></div>` : '';
      case 'button':
        const { animationCSS, animationStyle } = buildButtonEffect(el);
        const buttonDelay = Number(el.styles?.buttonDelay) || 0;
        const buttonId = `btn-${el.id}`;

        const buttonHtml = `<a id="${buttonId}" href="${el.styles?.buttonUrl || '#'}" target="${el.styles?.buttonOpenNewTab !== false ? '_blank' : '_self'}" rel="${el.styles?.buttonOpenNewTab !== false ? 'noopener noreferrer' : ''}" style="display: ${buttonDelay > 0 ? 'none' : 'inline-block'}; background-color: ${el.styles?.backgroundColor}; color: ${el.styles?.color}; font-size: ${el.styles?.fontSize}; padding: 12px 24px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; text-decoration: none; ${animationStyle}">
                    ${el.content}
                  </a>`;

        const delayScript = buttonDelay > 0 ? `<script>setTimeout(function(){var btn=document.getElementById('${buttonId}');if(btn)btn.style.display='inline-block';}, ${buttonDelay * 1000});</script>` : '';

        return `${animationCSS ? `<style>${animationCSS}</style>` : ''}<div style="text-align: ${el.styles?.textAlign}; padding: ${paddingStyle}; margin: ${marginStyle};">
                  ${buttonHtml}
                </div>${delayScript}`;
      case 'divider':
        return `<hr style="border: none; border-top: 2px solid #ddd; margin: ${marginStyle};" />`;
      case 'countdown':
        const countdownHtmlConfig = buildCountdownConfig(el);
        return `<div id="${el.id}" style="text-align: ${el.styles?.textAlign}; font-size: ${countdownHtmlConfig.fontSize}; color: ${countdownHtmlConfig.textColor}; background-color: ${countdownHtmlConfig.bgColor}; padding: ${paddingStyle}; margin: 0; font-weight: bold; border-radius: 8px; display: block; width: 100%; box-sizing: border-box;">${countdownHtmlConfig.prefix}<span class="countdown-time">${countdownHtmlConfig.displayMinutes}:00</span></div>`;
      case 'container':
        const columns = el.styles?.columns || 2;
        const containerGap = el.styles?.gap || '20px';
        const columnHtml = Array.from({ length: columns }).map((_, colIndex) => {
          const columnChildren = el.children?.filter(child => (child.columnIndex ?? 0) === colIndex) || [];
          const columnContent = columnChildren.map(renderElementAsHtml).join('');
          return `<div style="width: ${100 / columns}%; box-sizing: border-box; padding: ${containerGap};">${columnContent}</div>`;
        }).join('');
        return `<div style="display: flex; flex-wrap: wrap; gap: ${containerGap}; background-color: ${el.styles?.backgroundColor}; padding: ${paddingStyle}; margin: ${marginStyle};">${columnHtml}</div>`;

      default:
        return '';
    }
  };

  // Gerar o HTML completo da página com scripts para countdown
  const generatePageHtml = (): string => {
    let htmlContent = '';
    const allElements = currentPage.elements || [];
    const countdownElements: PreSellElement[] = [];

    const processElements = (elements: PreSellElement[]) => {
      elements.forEach(el => {
        if (el.type === 'countdown') {
          countdownElements.push(el);
        }
        htmlContent += renderElementAsHtml(el);
        if (el.children && el.children.length > 0) {
          processElements(el.children);
        }
      });
    };

    processElements(allElements);

    let scriptContent = '';
    countdownElements.forEach(el => {
      const countdownId = el.id.replace(/-/g, '');
      const safeMinutes = Number(el.styles?.countdownMinutes) || 60;
      scriptContent += `
        (function() {
          function initCountdown${countdownId}() {
            let remainingSeconds = ${safeMinutes * 60};
            const countdown${countdownId} = function() {
              const targetEl = document.getElementById('${el.id}');
              if (!targetEl) return;
              const timeSpan = targetEl.querySelector('.countdown-time');
              if (!timeSpan) return;

              if (remainingSeconds <= 0) {
                timeSpan.innerHTML = '00:00';
                return;
              }
              const minutes = Math.floor(remainingSeconds / 60);
              const seconds = remainingSeconds % 60;
              timeSpan.innerHTML = minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
              remainingSeconds--;
            };
            setInterval(countdown${countdownId}, 1000);
            countdown${countdownId}();
          }

          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initCountdown${countdownId});
          } else {
            initCountdown${countdownId}();
          }
        })();
      `;
    });

    const headScripts = currentPage.scripts?.head || '';
    const bodyScripts = currentPage.scripts?.body || '';
    const footerScripts = currentPage.scripts?.footer || '';

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${currentPage.name || 'Pre-Sell Page'}</title>
        <style>
          body { margin: 0; padding: 0; font-family: ${currentPage.settings.fontFamily}; background-color: ${currentPage.settings.backgroundColor}; }
          .container-responsive { display: flex; flex-wrap: wrap; }
          .container-responsive > div { width: 100%; }
          @media (min-width: 640px) { /* sm */
            .container-responsive[data-columns="2"] > div:nth-child(-n+2) { width: 50%; }
          }
          @media (min-width: 768px) { /* md */
            .container-responsive[data-columns="3"] > div:nth-child(-n+3) { width: 33.33%; }
          }
          @media (min-width: 1024px) { /* lg */
            .container-responsive[data-columns="4"] > div:nth-child(-n+4) { width: 25%; }
          }
          .countdown-time { font-variant-numeric: tabular-nums; }
        </style>
        ${headScripts}
      </head>
      <body style="margin: 0; padding: 0; font-family: ${currentPage.settings.fontFamily}; background-color: ${currentPage.settings.backgroundColor};">
        <div style="max-width: ${currentPage.settings.maxWidth}; margin: 0 auto; width: 100%;">
          ${bodyScripts}
          ${htmlContent}
        </div>
        ${footerScripts}
        <script>
          ${scriptContent}
        </script>
      </body>
      </html>
    `;
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
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation('/presell-dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-xl font-bold">
              {currentPage.name || 'Nova Pre-Sell'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Viewport Controls */}
          <div className="flex gap-1 mr-4 bg-gray-100 p-1 rounded-lg">
            <Button
              variant={viewport === 'desktop' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewport('desktop')}
              className="px-3"
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Button
              variant={viewport === 'tablet' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewport('tablet')}
              className="px-3"
            >
              <Tablet className="h-4 w-4" />
            </Button>
            <Button
              variant={viewport === 'mobile' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewport('mobile')}
              className="px-3"
            >
              <Smartphone className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={() => setShowSettingsDialog(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Configurações
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            const slug = (currentPage.slug || currentPage.name || '').toLowerCase();
            if (!slug) {
              toast({
                title: "Erro",
                description: "Salve a página antes de visualizar",
                variant: "destructive"
              });
              return;
            }
            window.open(`/presell/${slug}`, '_blank');
          }}>
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
          <Button size="sm" onClick={savePage}>
            <Save className="mr-2 h-4 w-4" />
            Salvar
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Design Profissional com Cores Unificadas */}
        <div className="w-80 border-r overflow-y-auto bg-white" style={{ backgroundColor: '#ffffff' }}>
          {!selectedElement ? (
            // Painel de Widgets com Novo Design
            <>
              <div className="p-5 border-b bg-white/50 sticky top-0 z-10">
                <h3 className="font-semibold text-base">Elementos</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <GripVertical className="h-3 w-3" />
                    Clique para adicionar
                  </span>
                </p>
              </div>

              <div className="p-4 space-y-4">
                {/* Texto */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Texto</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <DraggableElementButton
                      type="headline"
                      icon={Type}
                      label="Título"
                      onClick={() => addElement('headline')}
                    />
                    <DraggableElementButton
                      type="subheadline"
                      icon={Type}
                      label="Subtítulo"
                      onClick={() => addElement('subheadline')}
                    />
                    <DraggableElementButton
                      type="text"
                      icon={FileText}
                      label="Parágrafo"
                      onClick={() => addElement('text')}
                    />
                  </div>
                </div>

                {/* Mídia */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Mídia</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <DraggableElementButton
                      type="video"
                      icon={Video}
                      label="Vídeo"
                      onClick={() => addElement('video')}
                    />
                    <DraggableElementButton
                      type="image"
                      icon={ImageIcon}
                      label="Imagem"
                      onClick={() => addElement('image')}
                    />
                  </div>
                </div>

                {/* Interação */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Interação</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <DraggableElementButton
                      type="button"
                      icon={MousePointer}
                      label="Botão CTA"
                      onClick={() => addElement('button')}
                    />
                    <DraggableElementButton
                      type="countdown"
                      icon={Clock}
                      label="Contador"
                      onClick={() => addElement('countdown')}
                    />
                  </div>
                </div>

                {/* Layout */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Layout</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <DraggableElementButton
                      type="divider"
                      icon={Minus}
                      label="Divisor"
                      onClick={() => addElement('divider')}
                    />
                    <DraggableElementButton
                      type="container"
                      icon={Columns}
                      label="Container"
                      onClick={() => addElement('container')}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            // Painel de Propriedades com Accordion
            <>
              <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white shadow-sm z-10">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base truncate">Propriedades</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedElement.type === 'headline' ? 'Título Principal' :
                     selectedElement.type === 'subheadline' ? 'Subtítulo' :
                     selectedElement.type === 'text' ? 'Parágrafo' :
                     selectedElement.type === 'video' ? 'Vídeo' :
                     selectedElement.type === 'image' ? 'Imagem' :
                     selectedElement.type === 'button' ? 'Botão CTA' :
                     selectedElement.type === 'countdown' ? 'Contador Regressivo' :
                     selectedElement.type === 'container' ? 'Container' :
                     'Divisor'}
                  </p>
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
                      Conteúdo
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pb-5 pt-2">
                {/* Conteúdo baseado no tipo de elemento */}
                      {selectedElement.type !== 'container' && selectedElement.type !== 'image' && selectedElement.type !== 'video' && selectedElement.type !== 'countdown' && (
                        <div>
                          <Label className="text-xs font-medium">Texto</Label>
                          {selectedElement.type === 'text' ? (
                            <Textarea
                              value={selectedElement.content}
                              onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                              rows={5}
                              className="mt-1.5"
                            />
                          ) : (
                            <Input
                              value={selectedElement.content}
                              onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                              className="mt-1.5"
                            />
                          )}
                        </div>
                      )}

                      {selectedElement.type === 'container' && (
                        <div>
                          <Label className="text-xs font-medium">Número de Colunas</Label>
                          <div className="grid grid-cols-4 gap-2 mt-2">
                            {[1, 2, 3, 4].map(num => (
                              <Button
                                key={num}
                                type="button"
                                variant={selectedElement.styles?.columns === num ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => updateElement(selectedElement.id, {
                                  styles: { ...selectedElement.styles, columns: num }
                                })}
                              >
                                {num}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                {selectedElement.type === 'image' && (
                        <div>
                          <Label className="text-xs font-medium">Texto Alternativo</Label>
                          <Input
                            value={selectedElement.content}
                            onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                            className="mt-1.5"
                          />
                        </div>
                      )}

                      {selectedElement.type === 'button' && (
                        <>
                          <div>
                            <Label className="text-xs font-medium">Link do Botão</Label>
                            <Input
                              value={selectedElement.styles?.buttonUrl || '#'}
                              onChange={(e) => updateElement(selectedElement.id, {
                                styles: { ...selectedElement.styles, buttonUrl: e.target.value }
                              })}
                              placeholder="https://seu-link-de-vendas.com"
                              className="mt-1.5"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium">Abrir em Nova Guia</Label>
                            <Switch
                              checked={selectedElement.styles?.buttonOpenNewTab !== false}
                              onCheckedChange={(checked) => updateElement(selectedElement.id, {
                                styles: { ...selectedElement.styles, buttonOpenNewTab: checked }
                              })}
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
                              onValueChange={(value) => updateElement(selectedElement.id, {
                                styles: { ...selectedElement.styles, buttonEffect: value as any }
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

                      {/* Contador de Tempo */}
                        {selectedElement.type === 'countdown' && (
                          <div className="space-y-3">
                            <div>
                              <Label htmlFor="countdownTime">Tempo em Minutos</Label>
                              <Input
                                id="countdownTime"
                                type="number"
                                min="1"
                                value={selectedElement.styles?.countdownMinutes || 60}
                                onChange={(e) => {
                                  const minutes = parseInt(e.target.value) || 60;
                                  updateElement(selectedElement.id, {
                                    styles: {
                                      ...selectedElement.styles,
                                      countdownMinutes: minutes
                                    }
                                  });
                                }}
                                placeholder="60"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Exemplo: 5 = 05:00 minutos | 60 = 60:00 minutos
                              </p>
                            </div>
                          </div>
                        )}
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Estilo */}
                {selectedElement.type !== 'divider' && (
                  <AccordionItem value="style" className="border-b">
                    <AccordionTrigger className="text-sm font-semibold hover:no-underline py-4 hover:text-primary transition-colors">
                      Estilo & Aparência
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pb-5 pt-2">

                <div>
                  <Label>Alinhamento</Label>
                  <div className="flex gap-2 mt-2">
                    <Button
                      type="button"
                      variant={selectedElement.styles?.textAlign === 'left' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateElement(selectedElement.id, {
                        styles: { ...selectedElement.styles, textAlign: 'left' }
                      })}
                      className="flex-1"
                    >
                      <AlignLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant={selectedElement.styles?.textAlign === 'center' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateElement(selectedElement.id, {
                        styles: { ...selectedElement.styles, textAlign: 'center' }
                      })}
                      className="flex-1"
                    >
                      <AlignCenter className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant={selectedElement.styles?.textAlign === 'right' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateElement(selectedElement.id, {
                        styles: { ...selectedElement.styles, textAlign: 'right' }
                      })}
                      className="flex-1"
                    >
                      <AlignRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {(selectedElement.type === 'text' || selectedElement.type === 'headline' || selectedElement.type === 'subheadline') && (
                  <div>
                    <Label>Formatação</Label>
                    <div className="flex gap-2 mt-2">
                      <Button
                        type="button"
                        variant={selectedElement.styles?.fontWeight === 'bold' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateElement(selectedElement.id, {
                          styles: { ...selectedElement.styles, fontWeight: selectedElement.styles?.fontWeight === 'bold' ? 'normal' : 'bold' }
                        })}
                        className="flex-1"
                      >
                        <Bold className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant={selectedElement.styles?.fontStyle === 'italic' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateElement(selectedElement.id, {
                          styles: { ...selectedElement.styles, fontStyle: selectedElement.styles?.fontStyle === 'italic' ? 'normal' : 'italic' }
                        })}
                        className="flex-1"
                      >
                        <Italic className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant={selectedElement.styles?.textDecoration === 'underline' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateElement(selectedElement.id, {
                          styles: { ...selectedElement.styles, textDecoration: selectedElement.styles?.textDecoration === 'underline' ? 'none' : 'underline' }
                        })}
                        className="flex-1"
                      >
                        <Underline className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {selectedElement.type !== 'divider' && selectedElement.type !== 'image' && selectedElement.type !== 'video' && selectedElement.type !== 'container' && (
                  <div>
                    <Label>Tamanho da Fonte</Label>
                    <Input
                      type="text"
                      value={selectedElement.styles?.fontSize || '16px'}
                      onChange={(e) => updateElement(selectedElement.id, {
                        styles: { ...selectedElement.styles, fontSize: e.target.value }
                      })}
                      placeholder="16px"
                    />
                  </div>
                )}

                {selectedElement.type !== 'divider' && selectedElement.type !== 'image' && (
                  <div>
                    <Label>Cor do Texto</Label>
                    <Input
                      type="color"
                      value={selectedElement.styles?.color || '#000000'}
                      onChange={(e) => updateElement(selectedElement.id, {
                        styles: { ...selectedElement.styles, color: e.target.value }
                      })}
                    />
                  </div>
                )}

                {selectedElement.type === 'button' && (
                  <div>
                    <Label>Cor de Fundo</Label>
                    <Input
                      type="color"
                      value={selectedElement.styles?.backgroundColor || '#0070f3'}
                      onChange={(e) => updateElement(selectedElement.id, {
                        styles: { ...selectedElement.styles, backgroundColor: e.target.value }
                      })}
                    />
                  </div>
                )}

                {selectedElement.type === 'video' && (
                  <div>
                    <Label>Largura</Label>
                    <Select
                      value={selectedElement.styles?.videoWidth || '100%'}
                      onValueChange={(value) => updateElement(selectedElement.id, {
                        styles: { ...selectedElement.styles, videoWidth: value }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="50%">50%</SelectItem>
                        <SelectItem value="75%">75%</SelectItem>
                        <SelectItem value="100%">100% (Padrão)</SelectItem>
                        <SelectItem value="560px">560px (YouTube Padrão)</SelectItem>
                        <SelectItem value="800px">800px</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedElement.type === 'image' && (
                  <>
                    <div>
                      <Label>Largura</Label>
                      <Select
                        value={selectedElement.styles?.imageWidth || '100%'}
                        onValueChange={(value) => updateElement(selectedElement.id, {
                          styles: { ...selectedElement.styles, imageWidth: value }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="25%">25%</SelectItem>
                          <SelectItem value="50%">50%</SelectItem>
                          <SelectItem value="75%">75%</SelectItem>
                          <SelectItem value="100%">100% (Padrão)</SelectItem>
                          <SelectItem value="300px">300px</SelectItem>
                          <SelectItem value="500px">500px</SelectItem>
                          <SelectItem value="800px">800px</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Label>URL da Imagem</Label>
                        <Input
                          type="text"
                          value={selectedElement.styles?.imageUrl || ''}
                          onChange={(e) => updateElement(selectedElement.id, {
                            styles: { ...selectedElement.styles, imageUrl: e.target.value }
                          })}
                          placeholder="https://exemplo.com/imagem.jpg"
                          data-testid="input-image-url"
                        />
                      </div>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">ou</span>
                        </div>
                      </div>

                      <div>
                        <Label>Upload de Imagem</Label>
                        <div className="mt-2 space-y-2">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;

                                // Validação de tipo de arquivo
                                const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
                                if (!validTypes.includes(file.type)) {
                                  toast({
                                    variant: "destructive",
                                    title: "Tipo de arquivo inválido",
                                    description: "Use apenas: JPEG, PNG, GIF, WebP, AVIF",
                                  });
                                  return;
                                }

                                // Validação de tamanho
                                if (file.size > 4 * 1024 * 1024) {
                                  toast({
                                    variant: "destructive",
                                    title: "Arquivo muito grande",
                                    description: "Tamanho máximo: 4MB",
                                  });
                                  return;
                                }

                                const formData = new FormData();
                                formData.append('image', file);

                                try {
                                  const response = await fetch('/api/presell/upload-image', {
                                    method: 'POST',
                                    credentials: 'include',
                                    headers: {
                                      ...getAuthHeaders()
                                    },
                                    body: formData,
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
                                    const errorData = await response.json();
                                    throw new Error(errorData.message || 'Falha no upload');
                                  }

                                const data = await response.json();

                                updateElement(selectedElement.id, {
                                  styles: { ...selectedElement.styles, imageUrl: data.imageUrl }
                                });

                                toast({
                                  title: "✅ Upload concluído!",
                                  description: "Imagem otimizada e salva com sucesso.",
                                });

                                e.target.value = '';
                              } catch (error: any) {
                                console.error('Erro ao fazer upload:', error);
                                toast({
                                  variant: "destructive",
                                  title: "Erro no upload",
                                  description: error.message || "Não foi possível fazer upload da imagem.",
                                });
                              }
                            }}
                            data-testid="input-image-upload"
                          />
                          <p className="text-xs text-muted-foreground">
                            Formatos: JPEG, PNG, GIF, WebP, AVIF • Máx: 4MB • Será otimizada automaticamente
                          </p>
                        </div>
                      </div>

                      {selectedElement.styles?.imageUrl && (
                        <div className="mt-3">
                          <Label className="mb-2 block">Preview</Label>
                          <div className="border rounded-lg p-2 bg-gray-50">
                            <img
                              src={selectedElement.styles.imageUrl}
                              alt="Preview"
                              className="max-w-full h-auto max-h-48 mx-auto rounded"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle" fill="%23999" font-family="Arial" font-size="14"%3EImagem não encontrada%3C/text%3E%3C/svg%3E';
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {selectedElement.type === 'countdown' && (
                  <>
                    <div>
                      <Label>Cor do Texto</Label>
                      <Input
                        type="color"
                        value={selectedElement.styles?.countdownTextColor || '#ffffff'}
                        onChange={(e) => updateElement(selectedElement.id, {
                          styles: { ...selectedElement.styles, countdownTextColor: e.target.value }
                        })}
                      />
                    </div>
                    <div>
                      <Label>Cor de Fundo</Label>
                      <Input
                        type="color"
                        value={selectedElement.styles?.countdownBgColor || '#ff0000'}
                        onChange={(e) => updateElement(selectedElement.id, {
                          styles: { ...selectedElement.styles, countdownBgColor: e.target.value }
                        })}
                      />
                    </div>
                  </>
                )}

                {selectedElement.type === 'container' && (
                  <>
                    <div>
                      <Label>Espaçamento entre Colunas</Label>
                      <Input
                        type="number"
                        min="0"
                        value={parseInt(selectedElement.styles?.gap?.replace('px', '') || '20')}
                        onChange={(e) => updateElement(selectedElement.id, {
                          styles: { ...selectedElement.styles, gap: `${e.target.value}px` }
                        })}
                        placeholder="20"
                      />
                    </div>
                    <div>
                      <Label>Cor de Fundo</Label>
                      <Input
                        type="color"
                        value={selectedElement.styles?.backgroundColor || '#ffffff'}
                        onChange={(e) => updateElement(selectedElement.id, {
                          styles: { ...selectedElement.styles, backgroundColor: e.target.value }
                        })}
                      />
                    </div>
                  </>
                )}

                <div>
                  <Label className="mb-2 block">Espaçamento Interno (Padding)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Topo</Label>
                      <div className="relative mt-1">
                        <Input
                          type="number"
                          min="0"
                          value={parseInt(selectedElement.styles?.paddingTop?.replace('px', '') || '20')}
                          onChange={(e) => {
                            const value = e.target.value === '' ? '0' : e.target.value;
                            updateElement(selectedElement.id, {
                              styles: { ...selectedElement.styles, paddingTop: `${value}px` }
                            });
                          }}
                          placeholder="20"
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none select-none">px</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Direita</Label>
                      <div className="relative mt-1">
                        <Input
                          type="number"
                          min="0"
                          value={parseInt(selectedElement.styles?.paddingRight?.replace('px', '') || '20')}
                          onChange={(e) => {
                            const value = e.target.value === '' ? '0' : e.target.value;
                            updateElement(selectedElement.id, {
                              styles: { ...selectedElement.styles, paddingRight: `${value}px` }
                            });
                          }}
                          placeholder="20"
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none select-none">px</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Baixo</Label>
                      <div className="relative mt-1">
                        <Input
                          type="number"
                          min="0"
                          value={parseInt(selectedElement.styles?.paddingBottom?.replace('px', '') || '20')}
                          onChange={(e) => {
                            const value = e.target.value === '' ? '0' : e.target.value;
                            updateElement(selectedElement.id, {
                              styles: { ...selectedElement.styles, paddingBottom: `${value}px` }
                            });
                          }}
                          placeholder="20"
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none select-none">px</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Esquerda</Label>
                      <div className="relative mt-1">
                        <Input
                          type="number"
                          min="0"
                          value={parseInt(selectedElement.styles?.paddingLeft?.replace('px', '') || '20')}
                          onChange={(e) => {
                            const value = e.target.value === '' ? '0' : e.target.value;
                            updateElement(selectedElement.id, {
                              styles: { ...selectedElement.styles, paddingLeft: `${value}px` }
                            });
                          }}
                          placeholder="20"
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none select-none">px</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block">Margem Externa (Margin)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Topo</Label>
                      <div className="relative mt-1">
                        <Input
                          type="number"
                          min="0"
                          value={parseInt(selectedElement.styles?.marginTop?.replace('px', '') || '20')}
                          onChange={(e) => {
                            const value = e.target.value === '' ? '0' : e.target.value;
                            updateElement(selectedElement.id, {
                              styles: { ...selectedElement.styles, marginTop: `${value}px` }
                            });
                          }}
                          placeholder="20"
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none select-none">px</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Direita</Label>
                      <div className="relative mt-1">
                        <Input
                          type="number"
                          min="0"
                          value={parseInt(selectedElement.styles?.marginRight?.replace('px', '') || '0')}
                          onChange={(e) => {
                            const value = e.target.value === '' ? '0' : e.target.value;
                            updateElement(selectedElement.id, {
                              styles: { ...selectedElement.styles, marginRight: `${value}px` }
                            });
                          }}
                          placeholder="0"
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none select-none">px</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Baixo</Label>
                      <div className="relative mt-1">
                        <Input
                          type="number"
                          min="0"
                          value={parseInt(selectedElement.styles?.marginBottom?.replace('px', '') || '20')}
                          onChange={(e) => {
                            const value = e.target.value === '' ? '0' : e.target.value;
                            updateElement(selectedElement.id, {
                              styles: { ...selectedElement.styles, marginBottom: `${value}px` }
                            });
                          }}
                          placeholder="20"
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none select-none">px</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Esquerda</Label>
                      <div className="relative mt-1">
                        <Input
                          type="number"
                          min="0"
                          value={parseInt(selectedElement.styles?.marginLeft?.replace('px', '') || '0')}
                          onChange={(e) => {
                            const value = e.target.value === '' ? '0' : e.target.value;
                            updateElement(selectedElement.id, {
                              styles: { ...selectedElement.styles, marginLeft: `${value}px` }
                            });
                          }}
                          placeholder="0"
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none select-none">px</span>
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

        {/* Canvas - Design Profissional com Padrão Xadrez */}
        <div className="flex-1 overflow-y-auto bg-muted/20 p-8">
          <div className={`${viewportSizes[viewport]} mx-auto bg-background border shadow-lg min-h-[700px] p-8 transition-all duration-300`} style={{ borderTopLeftRadius: '15px', borderTopRightRadius: '15px' }}>
            <div
              className="min-h-[600px] overflow-auto"
              style={{
                maxWidth: currentPage.settings.maxWidth,
                fontFamily: currentPage.settings.fontFamily,
                backgroundColor: currentPage.settings.backgroundColor,
                backgroundImage: (!currentPage.elements || currentPage.elements.length === 0) ?
                  'repeating-conic-gradient(hsl(var(--muted)/0.5) 0% 25%, transparent 0% 50%) 50% / 24px 24px' :
                  'none'
              }}
            >
              {(!currentPage.elements || currentPage.elements.length === 0) ? (
                <div className="flex items-center justify-center h-full min-h-[500px]">
                  <div className="text-center space-y-5">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 ring-8 ring-primary/5">
                      <Layout className="h-10 w-10 text-primary/60" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-semibold text-foreground">Canvas vazio</p>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">Clique nos elementos à esquerda para começar a construir sua página de pré-venda profissional</p>
                    </div>
                  </div>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={customCollisionDetection}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                >
                  <MainDroppableArea
                    elements={currentPage.elements}
                    selectedElementId={selectedElementId}
                    setSelectedElementId={setSelectedElementId}
                    deleteElement={deleteElement}
                    moveElement={moveElement}
                    renderElementContent={renderElementContent}
                    activeId={activeId}
                  />
                </DndContext>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Name Dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nome da Pre-Sell</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={newPageName}
              onChange={(e) => setNewPageName(e.target.value)}
              placeholder="Digite o nome da página"
            />
            <div className="flex gap-2">
              <Button onClick={saveWithName} className="flex-1">Salvar</Button>
              <Button variant="outline" onClick={() => setShowNameDialog(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurações da Página</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="geral" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="geral">Geral</TabsTrigger>
              <TabsTrigger value="seo">
                <Search className="h-4 w-4 mr-2" />
                SEO
              </TabsTrigger>
              <TabsTrigger value="dominio">
                <Globe className="h-4 w-4 mr-2" />
                Domínio
              </TabsTrigger>
              <TabsTrigger value="scripts">
                <Code className="h-4 w-4 mr-2" />
                Scripts
              </TabsTrigger>
            </TabsList>

            <TabsContent value="geral" className="space-y-4 mt-4">
              <div>
                <Label className="text-foreground">Cor de Fundo da Página</Label>
                <Input
                  type="color"
                  value={currentPage.settings.backgroundColor}
                  onChange={(e) => setCurrentPage({
                    ...currentPage,
                    settings: { ...currentPage.settings, backgroundColor: e.target.value }
                  })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label className="text-foreground">Largura Máxima do Conteúdo</Label>
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
                    <SelectItem value="800px">800px (Estreito)</SelectItem>
                    <SelectItem value="1000px">1000px (Médio)</SelectItem>
                    <SelectItem value="1200px">1200px (Largo - Padrão)</SelectItem>
                    <SelectItem value="1400px">1400px (Extra Largo)</SelectItem>
                    <SelectItem value="100%">100% (Tela Cheia)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">1200px é o tamanho recomendado para a maioria das páginas</p>
              </div>
              <div>
                <Label className="text-foreground">Fonte Padrão</Label>
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
                    <SelectItem value="'Montserrat', sans-serif">Montserrat</SelectItem>
                    <SelectItem value="'Poppins', sans-serif">Poppins</SelectItem>
                    <SelectItem value="'Roboto', sans-serif">Roboto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="seo" className="space-y-4 mt-4">

              <div>
                <Label className="text-foreground">Título da Página (Meta Title)</Label>
                <Input
                  type="text"
                  value={currentPage.seo?.title || ''}
                  onChange={(e) => setCurrentPage({
                    ...currentPage,
                    seo: { ...currentPage.seo, title: e.target.value }
                  })}
                  placeholder="Ex: Oferta Especial - Transforme Sua Vida Hoje"
                  className="mt-2"
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {(currentPage.seo?.title || '').length}/60 caracteres - Aparece na aba do navegador e resultados do Google
                </p>
              </div>

              <div>
                <Label className="text-foreground">Descrição da Página (Meta Description)</Label>
                <Textarea
                  value={currentPage.seo?.description || ''}
                  onChange={(e) => setCurrentPage({
                    ...currentPage,
                    seo: { ...currentPage.seo, description: e.target.value }
                  })}
                  placeholder="Descrição que aparecerá nos resultados de busca do Google..."
                  className="mt-2"
                  rows={3}
                  maxLength={160}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {(currentPage.seo?.description || '').length}/160 caracteres - Aparece abaixo do título no Google
                </p>
              </div>

              <div>
                <Label className="text-foreground">Favicon (Ícone da Aba)</Label>
                <div className="mt-2 space-y-2">
                  {currentPage.seo?.favicon && (
                    <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
                      <img src={currentPage.seo.favicon} alt="Favicon" className="w-8 h-8 object-contain" />
                      <span className="text-xs text-muted-foreground flex-1 truncate">{currentPage.seo.favicon}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage({
                          ...currentPage,
                          seo: { ...currentPage.seo, favicon: '' }
                        })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <label className="flex items-center gap-2 px-3 py-2 text-white text-sm rounded cursor-pointer transition-colors" style={{ backgroundColor: '#29654F' }}>
                    <Plus className="h-4 w-4" />
                    <span>Enviar Favicon</span>
                    <input
                      type="file"
                      accept="image/x-icon,image/png,image/jpeg,image/svg+xml,.ico"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const formData = new FormData();
                          formData.append('file', file);
                          formData.append('type', 'presell');
                          try {
                            const response = await fetch('/api/upload/favicon', {
                              method: 'POST',
                              body: formData,
                              credentials: 'include'
                            });
                            if (response.ok) {
                              const data = await response.json();
                              setCurrentPage({
                                ...currentPage,
                                seo: { ...currentPage.seo, favicon: data.url }
                              });
                              toast({ title: "Favicon enviado!", description: "O ícone foi salvo com sucesso." });
                            } else {
                              toast({ title: "Erro", description: "Não foi possível enviar o favicon.", variant: "destructive" });
                            }
                          } catch (error) {
                            toast({ title: "Erro", description: "Falha ao enviar arquivo.", variant: "destructive" });
                          }
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Formatos aceitos: .ico, .png, .jpg, .svg (32x32px recomendado)
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-foreground">Imagem de Compartilhamento (OG Image)</Label>
                <div className="mt-2 space-y-2">
                  {currentPage.seo?.ogImage && (
                    <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
                      <img src={currentPage.seo.ogImage} alt="OG Image" className="w-16 h-10 object-cover rounded" />
                      <span className="text-xs text-muted-foreground flex-1 truncate">{currentPage.seo.ogImage}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage({
                          ...currentPage,
                          seo: { ...currentPage.seo, ogImage: '' }
                        })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <label className="flex items-center gap-2 px-3 py-2 text-white text-sm rounded cursor-pointer transition-colors" style={{ backgroundColor: '#29654F' }}>
                    <Plus className="h-4 w-4" />
                    <span>Enviar Imagem</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const formData = new FormData();
                          formData.append('image', file);
                          try {
                            const response = await fetch('/api/presell/upload-image', {
                              method: 'POST',
                              body: formData,
                              credentials: 'include'
                            });
                            if (response.ok) {
                              const data = await response.json();
                              setCurrentPage({
                                ...currentPage,
                                seo: { ...currentPage.seo, ogImage: data.imageUrl }
                              });
                              toast({ title: "Imagem enviada!", description: "A imagem de compartilhamento foi salva." });
                            } else {
                              toast({ title: "Erro", description: "Não foi possível enviar a imagem.", variant: "destructive" });
                            }
                          } catch (error) {
                            toast({ title: "Erro", description: "Falha ao enviar arquivo.", variant: "destructive" });
                          }
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Imagem que aparece ao compartilhar no WhatsApp/Facebook (1200x630px recomendado)
                  </p>
                </div>
              </div>

            </TabsContent>

            <TabsContent value="dominio" className="space-y-4 mt-4">
              <div className="flex gap-2">
                <Input
                  type="text"
                  data-testid="input-custom-domain-simple"
                  value={currentPage.customDomain || ''}
                  onChange={(e) => setCurrentPage({
                    ...currentPage,
                    customDomain: e.target.value
                  })}
                  placeholder="meusite.com ou app.meusite.com"
                  className="flex-1 h-10"
                />
                <Button 
                  className="h-10 px-6"
                  variant="default"
                  onClick={savePage}
                  disabled={!currentPage.customDomain?.trim()}
                  data-testid="button-save-domain-simple"
                >
                  <Save className="mr-2 h-4 w-4" />
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

              {currentPage.customDomain && (
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
                      <tr>
                        <td className="px-3 py-2.5">
                          <code className="bg-muted px-2 py-1 rounded text-xs">CNAME</code>
                        </td>
                        <td className="px-3 py-2.5">
                          <code className="text-xs" data-testid="text-dns-name-simple">{getDnsHostName(currentPage.customDomain)}</code>
                        </td>
                        <td className="px-3 py-2.5">
                          <code className="text-xs font-medium" data-testid="text-dns-target-simple">proxy.lowfy.com.br</code>
                        </td>
                        <td className="px-2 py-2.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            data-testid="button-copy-cname-simple"
                            onClick={() => copyToClipboardDns('proxy.lowfy.com.br', 'CNAME')}
                            title="Copiar valor"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
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

              {/* Aviso de propagação - sempre visível quando tem domínio e não está ativo */}
              {currentPage.customDomain && (!domainStatus || !domainStatus.isFullyActive) && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>Dica:</strong> Você pode fechar esta aba e continuar usando a plataforma normalmente. 
                    A propagação DNS pode levar de alguns minutos até 24 horas dependendo do seu provedor.
                  </p>
                </div>
              )}

              {domainStatus && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded border text-sm">
                    {domainStatus.isFullyActive ? (
                      <>
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-muted-foreground">{domainStatus.message || 'Domínio ativo'}</span>
                        <a
                          href={`https://${currentPage.customDomain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto text-xs underline text-muted-foreground hover:text-foreground"
                          data-testid="link-open-domain"
                        >
                          Abrir
                        </a>
                      </>
                    ) : domainStatus.needsSync ? (
                      <>
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        <span className="text-muted-foreground">{domainStatus.message || 'Domínio precisa ser reconfigurado'}</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="text-muted-foreground">{domainStatus.message || 'Aguardando ativação...'}</span>
                      </>
                    )}
                  </div>
                  {!domainStatus.isFullyActive && !domainStatus.needsSync && (
                    <p className="text-xs text-muted-foreground text-center">
                      Você pode sair desta aba e continuar usando a plataforma. A propagação DNS pode levar até 24h.
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button 
                  onClick={() => checkDomainStatus(currentPage.customDomain || '')} 
                  disabled={isCheckingDomain || !currentPage.customDomain?.trim()} 
                  data-testid="button-verify-status-simple" 
                  className="flex-1 h-9 text-sm"
                  variant="default"
                >
                  {isCheckingDomain ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
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
            </TabsContent>

            <TabsContent value="scripts" className="space-y-4 mt-4">
              <div>
                <Label className="text-foreground">Scripts no Head (Meta Pixel, Google Tag Manager, etc.)</Label>
                <Textarea
                  value={currentPage.scripts?.head || ''}
                  onChange={(e) => setCurrentPage({
                    ...currentPage,
                    scripts: { ...currentPage.scripts, head: e.target.value }
                  })}
                  placeholder="<!-- Scripts que devem ir no <head> da página -->"
                  rows={5}
                  className="font-mono text-xs mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">Inserido logo após a tag &lt;head&gt;</p>
              </div>

              <div>
                <Label className="text-foreground">Scripts no Body (Tracking, Analytics, etc.)</Label>
                <Textarea
                  value={currentPage.scripts?.body || ''}
                  onChange={(e) => setCurrentPage({
                    ...currentPage,
                    scripts: { ...currentPage.scripts, body: e.target.value }
                  })}
                  placeholder="<!-- Scripts que devem ir no início do <body> -->"
                  rows={5}
                  className="font-mono text-xs mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">Inserido logo após a tag &lt;body&gt;</p>
              </div>

              <div>
                <Label className="text-foreground">Scripts no Footer (Chat, Widgets, etc.)</Label>
                <Textarea
                  value={currentPage.scripts?.footer || ''}
                  onChange={(e) => setCurrentPage({
                    ...currentPage,
                    scripts: { ...currentPage.scripts, footer: e.target.value }
                  })}
                  placeholder="<!-- Scripts que devem ir antes do </body> -->"
                  rows={5}
                  className="font-mono text-xs mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">Inserido antes da tag &lt;/body&gt;</p>
              </div>

            </TabsContent>
          </Tabs>

          <div className="flex gap-2 pt-6 border-t mt-6">
            <Button onClick={() => setShowSettingsDialog(false)} variant="outline" className="flex-1">
              Fechar
            </Button>
            <Button onClick={() => {
              savePage();
              toast({ title: "Configurações salvas!", description: "Todas as configurações foram atualizadas." });
              setShowSettingsDialog(false);
            }} className="flex-1 text-white" style={{ backgroundColor: '#29654F' }}>
              <Save className="mr-2 h-4 w-4" />
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}