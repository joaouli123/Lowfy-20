import { useState, useEffect, useRef } from 'react';
import { useQuery, useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { useRoute, Link } from 'wouter';
import { useSocket } from '@/contexts/SocketContext';
import DOMPurify from 'isomorphic-dompurify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ThumbsUp, 
  MessageSquare, 
  Share2, 
  Flag,
  ArrowLeft,
  MoreVertical,
  Pin,
  Eye,
  Tag,
  Clock,
  User,
  MapPin,
  Globe,
  Bookmark,
  Calendar,
  TrendingUp,
  Award,
  ChevronRight,
  ExternalLink,
  Star,
  Edit,
  Trash2,
  Hash,
  X,
  FileText,
  ImagePlus,
  MessageCircle // Import MessageCircle for reply button
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { formatTimeAgo } from '@/lib/formatTime';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useGamification } from '@/hooks/useGamification';
import { getLevelIcon, getLevelColor, getLevelName } from '@/lib/levelIcons';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

interface Topic {
  id: string;
  title: string;
  content: string;
  slug?: string;
  videoLink?: string | null;
  attachments?: Array<{
    url: string;
    filename?: string;
    mimetype?: string;
    size?: number;
  }>;
  author?: {
    id: string;
    name: string;
    email?: string;
    profileImageUrl: string | null;
    bio?: string;
    location?: string;
    website?: string;
    profession?: string;
    areaAtuacao?: string;
  };
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  tags?: {
    id: string;
    name: string;
    slug: string;
    color?: string;
  }[];
  isSticky: boolean;
  isClosed?: boolean;
  viewCount: number;
  likeCount: number;
  replyCount: number;
  createdAt: string;
  updatedAt?: string;
  hasLiked: boolean;
  authorId?: string;
}

interface Comment {
  id: string;
  content: string;
  author?: {
    id: string;
    name: string;
    email?: string;
    profileImageUrl: string | null;
    areaAtuacao?: string;
    profession?: string; // Added profession and badge for potential future use
    badge?: string;
  };
  likeCount: number;
  hasLiked: boolean;
  createdAt: string;
  isAccepted?: boolean;
  parentCommentId?: string | null;
  isPinned?: boolean; // Added for pinning comments
  userHasLiked?: boolean; // Renamed for clarity in optimistic updates
}

// Helper function to build nested comment tree
function buildCommentTree(comments: Comment[]): Comment[] {
  const commentMap = new Map<string, Comment & { replies: Comment[] }>();
  const rootComments: (Comment & { replies: Comment[] })[] = [];

  comments.forEach(comment => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });

  comments.forEach(comment => {
    const commentWithReplies = commentMap.get(comment.id)!;
    if (comment.parentCommentId) {
      const parent = commentMap.get(comment.parentCommentId);
      if (parent) {
        parent.replies.push(commentWithReplies);
      } else {
        rootComments.push(commentWithReplies);
      }
    } else {
      rootComments.push(commentWithReplies);
    }
  });

  return rootComments;
}

// Helper function to extract YouTube video ID
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/i,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/i
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

// Helper function to extract Vimeo video ID
function getVimeoVideoId(url: string): string | null {
  const pattern = /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/i;
  const match = url.match(pattern);
  return match ? match[1] : null;
}

// Component to render video embed
function VideoEmbed({ url }: { url: string }) {
  const youtubeId = getYouTubeVideoId(url);
  const vimeoId = getVimeoVideoId(url);

  if (youtubeId) {
    return (
      <div className="video-embed my-4">
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', maxWidth: '100%', borderRadius: '0.5rem' }}>
          <iframe 
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0, borderRadius: '0.5rem' }}
            src={`https://www.youtube.com/embed/${youtubeId}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  if (vimeoId) {
    return (
      <div className="video-embed my-4">
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', maxWidth: '100%', borderRadius: '0.5rem' }}>
          <iframe 
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0, borderRadius: '0.5rem' }}
            src={`https://player.vimeo.com/video/${vimeoId}`}
            allow="autoplay; fullscreen; picture-in-picture" 
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  return null;
}

// Helper function to embed videos from URLs (for content with mixed text and videos)
function embedVideos(content: string): string {
  let processedContent = content;

  // Primeiro, processar iframes que já estão no conteúdo (quando usuário cola código de iframe)
  // Detectar iframes escapados (< e > foram substituídos por &lt; e &gt;)
  processedContent = processedContent.replace(/&lt;iframe/gi, '<iframe');
  processedContent = processedContent.replace(/&lt;\/iframe&gt;/gi, '</iframe>');
  processedContent = processedContent.replace(/&quot;/gi, '"');
  processedContent = processedContent.replace(/&#039;/gi, "'");

  // Melhorar iframes existentes envolvendo-os em div responsivo se ainda não estiverem
  processedContent = processedContent.replace(
    /<iframe(?![^>]*class="[^"]*video-embed-iframe)/gi,
    (match) => {
      // Verificar se já está dentro de um wrapper de vídeo
      return match;
    }
  );

  // Processar iframes soltos e envolvê-los em div responsivo
  processedContent = processedContent.replace(
    /<iframe\s+([^>]*src=["'](?:https?:)?\/\/(?:www\.)?(?:youtube\.com\/embed\/|player\.vimeo\.com\/video\/|[^"']+)["'][^>]*)><\/iframe>/gi,
    (match, attributes) => {
      // Verificar se já está dentro de um wrapper
      if (processedContent.indexOf(`<div class="video-embed my-4">`) > -1 && 
          processedContent.indexOf(match) > processedContent.lastIndexOf(`<div class="video-embed my-4">`)) {
        return match; // Já está dentro de um wrapper, não modificar
      }

      return `<div class="video-embed my-4">
        <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; border-radius: 0.5rem;">
          <iframe ${attributes} style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; border-radius: 0.5rem;"></iframe>
        </div>
      </div>`;
    }
  );

  // YouTube patterns (URLs simples)
  const youtubePatterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/gi,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)/gi,
  ];

  youtubePatterns.forEach(pattern => {
    processedContent = processedContent.replace(pattern, (match, videoId) => {
      // Verificar se a URL já está dentro de um iframe para evitar duplicação
      if (/<iframe[^>]*src=["'][^"']*youtube\.com\/embed\/${videoId}["']/i.test(processedContent)) {
        return match;
      }

      return `<div class="video-embed my-4">
        <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; border-radius: 0.5rem;">
          <iframe 
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; border-radius: 0.5rem;" 
            src="https://www.youtube.com/embed/${videoId}" 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen
          ></iframe>
        </div>
      </div>`;
    });
  });

  // Vimeo pattern (URLs simples)
  const vimeoPattern = /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/gi;
  processedContent = processedContent.replace(vimeoPattern, (match, videoId) => {
    // Verificar se a URL já está dentro de um iframe para evitar duplicação
    if (/<iframe[^>]*src=["'][^"']*vimeo\.com\/video\/${videoId}["']/i.test(processedContent)) {
      return match;
    }

    return `<div class="video-embed my-4">
      <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; border-radius: 0.5rem;">
        <iframe 
          style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; border-radius: 0.5rem;" 
          src="https://player.vimeo.com/video/${videoId}" 
          frameborder="0" 
          allow="autoplay; fullscreen; picture-in-picture" 
          allowfullscreen
        ></iframe>
      </div>
    </div>`;
  });

  return processedContent;
}

// Recursive Reply Component - extracted to avoid hooks issues
interface RenderReplyProps {
  reply: Comment & { replies?: Comment[] };
  openReplyForms: Set<string>;
  setOpenReplyForms: React.Dispatch<React.SetStateAction<Set<string>>>;
  replyContents: Record<string, string>;
  setReplyContents: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  likeCommentMutation: any;
  commentMutation: any;
}

const RenderReply: React.FC<RenderReplyProps> = ({ 
  reply, 
  openReplyForms,
  setOpenReplyForms,
  replyContents,
  setReplyContents,
  likeCommentMutation,
  commentMutation
}) => {
  const nestedReplies = reply.replies || [];
  const isReplyingToThis = openReplyForms.has(reply.id);

  return (
  <div 
    id={`reply-${reply.id}`}
    className="py-3"
  >
    <div className="flex gap-3">
      {/* Avatar */}
      {reply.author && (
        <Link href={`/users/${reply.author.id}`}>
          <Avatar className="h-10 w-10 cursor-pointer shrink-0">
            <AvatarImage src={reply.author.profileImageUrl || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-green-600 text-white font-semibold text-sm">
              {reply.author.name?.[0]?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
        </Link>
      )}

      {/* Content Container */}
      <div className="flex-1 min-w-0">
        {/* Header with Author Info */}
        <div className="flex items-center gap-2 mb-2">
          {reply.author && (
            <Link href={`/users/${reply.author.id}`}>
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer">
                {reply.author.name}
              </span>
            </Link>
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            • há {formatTimeAgo(reply.createdAt)}
          </span>
        </div>

        {/* Reply Content */}
        <div 
          className="text-sm text-gray-700 dark:text-gray-300 mb-3 leading-relaxed"
          dangerouslySetInnerHTML={{ 
            __html: DOMPurify.sanitize(embedVideos(reply.content), {
              ADD_TAGS: ['iframe', 'div'],
              ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'style', 'src', 'class']
            })
          }}
        />

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button
            className={`flex items-center gap-1.5 text-sm transition-colors ${
              reply.hasLiked
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              likeCommentMutation.mutate(reply.id);
            }}
            disabled={likeCommentMutation.isPending}
            data-testid={`button-like-comment-${reply.id}`}
          >
            <ThumbsUp className={`w-4 h-4 ${reply.hasLiked ? 'fill-current' : ''}`} />
            <span>{reply.likeCount || 0}</span>
          </button>
          <button
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            onClick={() => {
              if (isReplyingToThis) {
                setOpenReplyForms(prev => {
                  const updated = new Set(prev);
                  updated.delete(reply.id);
                  return updated;
                });
                setReplyContents(prev => {
                  const updated = { ...prev };
                  delete updated[reply.id];
                  return updated;
                });
              } else {
                setOpenReplyForms(prev => new Set(prev).add(reply.id));
              }
            }}
            data-testid={`button-reply-comment-${reply.id}`}
          >
            <MessageCircle className="w-4 h-4" />
            <span>Responder</span>
          </button>
        </div>
      </div>
    </div>

    {/* Formulário Inline de Resposta para Nested Reply */}
    {isReplyingToThis && (
      <div className="mt-3 ml-13">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const content = replyContents[reply.id] || '';
            if (content.trim()) {
              commentMutation.mutate({
                content: content,
                parentId: reply.id
              });
            }
          }}
          className="space-y-3"
        >
          <Textarea
            value={replyContents[reply.id] || ''}
            onChange={(e) => setReplyContents(prev => ({ ...prev, [reply.id]: e.target.value }))}
            placeholder="Escreva sua resposta..."
            rows={2}
            className="resize-none text-sm"
            autoFocus
            data-testid={`input-reply-${reply.id}`}
          />
          <div className="flex gap-2">
            <Button 
              type="submit" 
              disabled={commentMutation.isPending || !(replyContents[reply.id] || '').trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              size="sm"
              data-testid={`button-submit-reply-${reply.id}`}
            >
              {commentMutation.isPending ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Responder'
              )}
            </Button>
            <Button 
              type="button" 
              variant="outline"
              onClick={() => {
                setOpenReplyForms(prev => {
                  const updated = new Set(prev);
                  updated.delete(reply.id);
                  return updated;
                });
                setReplyContents(prev => {
                  const updated = { ...prev };
                  delete updated[reply.id];
                  return updated;
                });
              }}
              size="sm"
              data-testid={`button-cancel-reply-${reply.id}`}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    )}

    {/* Nested Replies */}
    {nestedReplies.length > 0 && (
      <div className="mt-1 ml-13 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
        {nestedReplies.map((nestedReply) => (
          <RenderReply 
            key={nestedReply.id} 
            reply={nestedReply}
            openReplyForms={openReplyForms}
            setOpenReplyForms={setOpenReplyForms}
            replyContents={replyContents}
            setReplyContents={setReplyContents}
            likeCommentMutation={likeCommentMutation}
            commentMutation={commentMutation}
          />
        ))}
      </div>
    )}
  </div>
  );
};

export default function ForumTopic() {
  const [, params] = useRoute('/forum/:idOrSlug');
  const topicIdOrSlug = params?.idOrSlug;
  const [commentContent, setCommentContent] = useState('');
  const [openReplyForms, setOpenReplyForms] = useState<Set<string>>(new Set());
  const [replyContents, setReplyContents] = useState<Record<string, string>>({});
  const [commentsToShow, setCommentsToShow] = useState(10);
  const { toast } = useToast();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { user: currentUser } = useAuth();
  const { on, off, isConnected } = useSocket();

  // Fetch topic data - MUST be before any usage of 'topic'
  const { data: topic, isLoading: topicLoading, error } = useQuery<Topic>({
    queryKey: [`/api/forum/topics/${topicIdOrSlug}`],
    enabled: !!topicIdOrSlug,
    retry: 2,
    retryDelay: 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const { data: relatedTopics = [] } = useQuery({
    queryKey: ['/api/forum/topics'],
    enabled: !!topic,
  });

  const { data: authorBadges = [] } = useQuery({
    queryKey: [`/api/users/${topic?.author?.id}/badges`],
    enabled: !!topic?.author?.id,
  });

  const authorGamification = useGamification(topic?.author?.id);

  // Buscar categorias para o formulário de edição
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/categories'],
  });

  // Derived state - can now safely use 'topic'
  const isPostAuthor = !!currentUser && !!topic && currentUser.id === topic.authorId;

  // State for inline editing
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [editFormData, setEditFormData] = useState({ 
    title: '', 
    content: '', 
    categoryId: '',
    tags: [] as string[],
    videoLink: '',
  });
  const [selectedEditTags, setSelectedEditTags] = useState<string[]>([]);
  const [editAttachmentFile, setEditAttachmentFile] = useState<File | null>(null);
  const [editAttachmentPreview, setEditAttachmentPreview] = useState<string | null>(null);
  const [removeExistingAttachment, setRemoveExistingAttachment] = useState(false);
  const [editTagInput, setEditTagInput] = useState('');
  const [editTagSuggestions, setEditTagSuggestions] = useState<Array<{ id: string; name: string; usageCount: number }>>([]);
  const [showEditTagSuggestions, setShowEditTagSuggestions] = useState(false);
  const [loadingEditTagSuggestions, setLoadingEditTagSuggestions] = useState(false);

  // Refs for Quill editor in edit mode
  const editQuillRef = useRef<Quill | null>(null);
  const editEditorRef = useRef<HTMLDivElement | null>(null);

  // Handler to toggle inline edit mode
  const handleToggleEdit = () => {
    if (!isEditingInline && topic) {
      const tagNames = topic.tags?.map(t => t.name) || [];
      setEditFormData({ 
        title: topic.title, 
        content: topic.content,
        categoryId: topic.category?.id || '',
        tags: tagNames,
        videoLink: topic.videoLink || '',
      });
      setSelectedEditTags(tagNames);
      setRemoveExistingAttachment(false);
    }
    setIsEditingInline(!isEditingInline);
  };

  // Handler to cancel edit
  const handleCancelEdit = () => {
    setIsEditingInline(false);
    setEditFormData({ title: '', content: '', categoryId: '', tags: [], videoLink: '' });
    setSelectedEditTags([]);
    setEditAttachmentFile(null);
    setEditAttachmentPreview(null);
    setRemoveExistingAttachment(false);
    setEditTagInput('');
    if (editQuillRef.current) {
      editQuillRef.current.off('text-change');
      if (editQuillRef.current.root) {
        editQuillRef.current.root.innerHTML = '';
      }
      editQuillRef.current = null;
    }
  };

  // Handler for edit attachment change
  const handleEditAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditAttachmentFile(file);
      setRemoveExistingAttachment(false);

      // Generate preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setEditAttachmentPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setEditAttachmentPreview(null);
      }
    }
  };

  // Mutation for updating topic
  const updateTopicMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('title', editFormData.title);
      formData.append('content', editFormData.content);
      formData.append('categoryId', editFormData.categoryId);
      formData.append('tags', JSON.stringify(editFormData.tags));
      formData.append('videoLink', editFormData.videoLink || '');

      if (editAttachmentFile) {
        formData.append('attachment', editAttachmentFile);
      }

      if (removeExistingAttachment) {
        formData.append('removeAttachment', 'true');
      }

      return apiRequest('PUT', `/api/forum/topics/${topic?.id}`, formData);
    },
    onMutate: async () => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ queryKey: [`/api/forum/topics/${topicIdOrSlug}`] });

      // Snapshot do estado anterior
      const previousTopic = queryClient.getQueryData([`/api/forum/topics/${topicIdOrSlug}`]);

      // Atualização otimista - INSTANTÂNEA
      queryClient.setQueryData(
        [`/api/forum/topics/${topicIdOrSlug}`],
        (old: any) => {
          if (!old) return old;

          // Encontrar categoria atualizada
          const category = categories.find((c: any) => c.id === editFormData.categoryId);

          // Montar tags atualizadas
          const updatedTags = editFormData.tags.map(tagName => {
            // Tentar encontrar tag existente
            const existingTag = old.tags?.find((t: any) => t.name === tagName);
            if (existingTag) return existingTag;

            // Criar nova tag temporária
            return {
              id: `temp-${tagName}`,
              name: tagName,
              slug: tagName.toLowerCase()
            };
          });

          return {
            ...old,
            title: editFormData.title,
            content: editFormData.content,
            categoryId: editFormData.categoryId,
            category: category || old.category,
            tags: updatedTags,
            videoLink: editFormData.videoLink || null,
            updatedAt: new Date().toISOString(),
            // Atualizar attachments com base nas ações do usuário
            attachments: removeExistingAttachment 
              ? null 
              : editAttachmentFile 
                ? old.attachments // Será atualizado pelo servidor
                : old.attachments
          };
        }
      );

      return { previousTopic };
    },
    onSuccess: () => {
      // Invalidar para sincronizar com servidor
      queryClient.invalidateQueries({ 
        queryKey: [`/api/forum/topics/${topicIdOrSlug}`],
        refetchType: 'active'
      });
      toast({
        title: 'Tópico atualizado!',
        description: 'Seu tópico foi editado com sucesso.',
      });
      setIsEditingInline(false);
    },
    onError: (error: any, variables, context) => {
      // Reverter em caso de erro
      if (context?.previousTopic) {
        queryClient.setQueryData([`/api/forum/topics/${topicIdOrSlug}`], context.previousTopic);
      }
      toast({
        title: 'Erro ao editar tópico',
        description: error?.response?.data?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  // Mutation for deleting topic
  const deleteTopicMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', `/api/forum/topics/${topic?.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/forum/topics'] });
      toast({
        title: 'Tópico excluído!',
        description: 'Seu tópico foi excluído com sucesso.',
      });
      // Redirecionar para o fórum após excluir
      window.location.href = '/forum';
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao excluir tópico',
        description: error?.response?.data?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  // Inicializar Quill editor quando entrar em modo de edição
  useEffect(() => {
    if (isEditingInline && editEditorRef.current && !editQuillRef.current) {
      editQuillRef.current = new Quill(editEditorRef.current, {
        theme: 'snow',
        placeholder: 'Descreva sua dúvida ou compartilhe seu conhecimento...',
        modules: {
          toolbar: [
            ['bold', 'italic', 'underline', 'strike'],
            ['blockquote', 'code-block'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'header': [1, 2, 3, false] }],
            ['link'],
            ['clean']
          ]
        }
      });

      // Set initial content
      if (editFormData.content) {
        editQuillRef.current.root.innerHTML = editFormData.content;
      }

      editQuillRef.current.on('text-change', () => {
        const content = editQuillRef.current?.root.innerHTML || '';
        setEditFormData(prev => ({ ...prev, content }));
      });
    }

    if (!isEditingInline && editQuillRef.current) {
      editQuillRef.current.off('text-change');
      if (editQuillRef.current.root) {
        editQuillRef.current.root.innerHTML = '';
      }
      editQuillRef.current = null;
    }
  }, [isEditingInline]);

  // Buscar sugestões de tags ao digitar
  useEffect(() => {
    const searchTags = async () => {
      if (!editTagInput.trim() || editTagInput.trim().length < 1) {
        setEditTagSuggestions([]);
        setShowEditTagSuggestions(false);
        return;
      }

      setLoadingEditTagSuggestions(true);
      try {
        const response = await fetch(`/api/forum/tags/search?q=${encodeURIComponent(editTagInput.trim())}&limit=10`);
        const data = await response.json();

        const filtered = data.filter((tag: any) => 
          !selectedEditTags.includes(tag.name.toLowerCase())
        );

        setEditTagSuggestions(filtered);
        setShowEditTagSuggestions(filtered.length > 0);
      } catch (error) {
        console.error('Error searching tags:', error);
        setEditTagSuggestions([]);
      } finally {
        setLoadingEditTagSuggestions(false);
      }
    };

    const debounceTimer = setTimeout(searchTags, 300);
    return () => clearTimeout(debounceTimer);
  }, [editTagInput, selectedEditTags]);

  const handleAddEditTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (trimmedTag && !selectedEditTags.includes(trimmedTag) && selectedEditTags.length < 5) {
      const updatedTags = [...selectedEditTags, trimmedTag];
      setSelectedEditTags(updatedTags);
      setEditFormData(prev => ({ ...prev, tags: updatedTags }));
      setEditTagInput('');
      setShowEditTagSuggestions(false);

      toast({
        title: '✨ Tag adicionada',
        description: `Tag "${trimmedTag}" foi adicionada com sucesso`,
        duration: 2000,
      });
    } else if (selectedEditTags.length >= 5) {
      toast({
        title: '⚠️ Limite atingido',
        description: 'Você já adicionou o máximo de 5 tags',
        variant: 'destructive',
        duration: 2000,
      });
    }
  };

  const handleRemoveEditTag = (tagToRemove: string) => {
    const updatedTags = selectedEditTags.filter(tag => tag !== tagToRemove);
    setSelectedEditTags(updatedTags);
    setEditFormData(prev => ({ ...prev, tags: updatedTags }));

    toast({
      title: '🗑️ Tag removida',
      description: `Tag "${tagToRemove}" foi removida`,
      duration: 1500,
    });
  };

  // Log para debug
  useEffect(() => {
    if (import.meta.env.DEV) console.log('[ForumTopic] Estado:', { topicIdOrSlug, topicLoading, hasError: !!error, hasTopic: !!topic });

    if (error) {
      console.error('[ForumTopic] Erro ao buscar tópico:', error);
      toast({
        title: 'Erro ao carregar tópico',
        description: 'Não foi possível carregar o tópico. Tente novamente.',
        variant: 'destructive',
      });
    }
    if (topic) {
      if (import.meta.env.DEV) console.log('[ForumTopic] Tópico carregado:', topic);
    }
  }, [error, topic, topicLoading, topicIdOrSlug]);

  // ✅ SCROLL INFINITO para comentários
  const { 
    data: commentsData, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useInfiniteQuery({
    queryKey: [`/api/forum/${topicIdOrSlug}/replies`],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams();
      params.append('limit', '10');
      params.append('offset', pageParam.toString());
      const res = await fetch(`/api/forum/topics/${topic?.id || topicIdOrSlug}/replies?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch comments');
      return res.json();
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < 10) return undefined;
      return allPages.length * 10;
    },
    enabled: !!topicIdOrSlug && !!topic,
  });

  const comments = commentsData?.pages.flatMap(page => page) || [];

  const likeMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/forum/like`, { topicId: topic?.id }),
    onMutate: async () => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ queryKey: [`/api/forum/topics/${topicIdOrSlug}`] });

      // Snapshot do estado anterior
      const previousTopic = queryClient.getQueryData<Topic>([`/api/forum/topics/${topicIdOrSlug}`]);

      // Atualização otimista - INSTANTÂNEA
      queryClient.setQueryData<Topic>(
        [`/api/forum/topics/${topicIdOrSlug}`],
        (old) => {
          if (!old) return old;

          const wasLiked = old.hasLiked;
          return {
            ...old,
            likeCount: wasLiked ? Math.max(0, (old.likeCount || 0) - 1) : (old.likeCount || 0) + 1,
            hasLiked: !wasLiked,
          };
        }
      );

      return { previousTopic };
    },
    onError: (error: any, variables, context) => {
      // Reverter em caso de erro
      if (context?.previousTopic) {
        queryClient.setQueryData([`/api/forum/topics/${topicIdOrSlug}`], context.previousTopic);
      }
      toast({
        title: "Erro ao curtir",
        description: "Tente novamente",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Invalidar para garantir sincronização com servidor e atualizar estatísticas
      queryClient.invalidateQueries({ queryKey: [`/api/forum/topics/${topicIdOrSlug}`] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: ({ content, parentId }: { content: string; parentId?: string }) => 
      apiRequest('POST', `/api/forum/topics/${topic?.id}/replies`, { 
        content,
        parentCommentId: parentId 
      }),
    onSuccess: (data, variables) => {
      // ✅ CRÍTICO: Limpar estados IMEDIATAMENTE antes do refetch para evitar formulários fantasmas
      if (variables.parentId) {
        setReplyContents(prev => {
          const updated = { ...prev };
          delete updated[variables.parentId!];
          return updated;
        });
        setOpenReplyForms(prev => {
          const updated = new Set(prev);
          updated.delete(variables.parentId!);
          return updated;
        });
      } else {
        // Limpar formulário principal de comentário
        setCommentContent('');
      }

      // Agora invalidar queries após limpar os estados
      queryClient.invalidateQueries({ queryKey: [`/api/forum/${topicIdOrSlug}/replies`] });
      queryClient.invalidateQueries({ queryKey: [`/api/forum/topics/${topicIdOrSlug}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/gamification/daily-activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gamification/weekly-challenges'] });

      toast({
        title: variables.parentId ? 'Resposta publicada!' : 'Comentário publicado!',
        description: variables.parentId ? 'Sua resposta foi adicionada com sucesso.' : 'Seu comentário foi adicionado com sucesso.',
      });
    },
    onError: (error: any) => {
      const errorData = error?.response?.data || error;
      toast({
        title: '❌ Conteúdo bloqueado',
        description: errorData.suggestion || errorData.message || 'Seu comentário contém conteúdo inadequado.',
        variant: 'destructive',
      });
    },
  });

  const likeCommentMutation = useMutation<
    { userHasLiked: boolean; likeCount: number },
    Error,
    string
  >({
    mutationFn: async (commentId: string) => {
      const response = await fetch(`/api/forum/topics/${topic?.id || topicIdOrSlug}/comments/${commentId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to like comment');
      return response.json();
    },
    onMutate: async (commentId: string) => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ queryKey: [`/api/forum/${topicIdOrSlug}/replies`] });

      // Snapshot do estado anterior
      const previousData = queryClient.getQueryData([`/api/forum/${topicIdOrSlug}/replies`]);

      // Atualização otimista - INSTANTÂNEA
      queryClient.setQueriesData(
        { queryKey: [`/api/forum/${topicIdOrSlug}/replies`], exact: false },
        (old: any) => {
          if (!old?.pages) return old;

          return {
            ...old,
            pages: old.pages.map((page: any[]) =>
              page.map((reply: any) => {
                if (reply.id === commentId) {
                  const wasLiked = reply.hasLiked;
                  return {
                    ...reply,
                    likeCount: wasLiked ? Math.max(0, (reply.likeCount || 0) - 1) : (reply.likeCount || 0) + 1,
                    hasLiked: !wasLiked,
                  };
                }
                return reply;
              })
            ),
          };
        }
      );

      return { previousData };
    },
    onError: (error: any, variables, context) => {
      // Reverter em caso de erro
      if (context?.previousData) {
        queryClient.setQueryData([`/api/forum/${topicIdOrSlug}/replies`], context.previousData);
      }
      toast({
        title: "Erro ao curtir",
        description: "Tente novamente",
        variant: "destructive",
      });
    },
  });

  const markBestAnswerMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const response = await fetch(`/api/forum/topics/${topic?.id}/best-answer/${commentId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to mark best answer');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/forum/${topicIdOrSlug}/replies`] });
      toast({
        title: "Melhor resposta marcada!",
        description: "A resposta foi destacada como solução",
      });
    },
  });

  const removeBestAnswerMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/forum/topics/${topic?.id}/best-answer`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to remove best answer');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/forum/${topicIdOrSlug}/replies`] });
      queryClient.invalidateQueries({ queryKey: [`/api/forum/topics/${topicIdOrSlug}`] });
      toast({
        title: "Melhor resposta removida",
        description: "O destaque foi removido da resposta",
      });
    },
  });

  // Placeholder mutations for pinning/unpinning comments (implement logic as needed)
  const pinCommentMutation = useMutation({
    mutationFn: async (commentId: string) => apiRequest('POST', `/api/forum/topics/${topic?.id}/comments/${commentId}/pin`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/forum/${topicIdOrSlug}/replies`] });
      toast({ title: "Comentário fixado!" });
    },
    onError: () => toast({ title: "Erro ao fixar comentário", variant: "destructive" }),
  });

  const unpinCommentMutation = useMutation({
    mutationFn: async (commentId: string) => apiRequest('DELETE', `/api/forum/topics/${topic?.id}/comments/${commentId}/pin`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/forum/${topicIdOrSlug}/replies`] });
      toast({ title: "Comentário desfixado!" });
    },
    onError: () => toast({ title: "Erro ao desfixar comentário", variant: "destructive" }),
  });

  // Placeholder mutations for reporting comments
  const reportCommentMutation = useMutation({
    mutationFn: async (commentId: string) => apiRequest('POST', `/api/forum/comments/${commentId}/report`),
    onSuccess: () => toast({ title: "Comentário reportado!" }),
    onError: () => toast({ title: "Erro ao reportar comentário", variant: "destructive" }),
  });

  // Placeholder mutations for deleting comments
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => apiRequest('DELETE', `/api/forum/comments/${commentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/forum/${topicIdOrSlug}/replies`] });
      toast({ title: "Comentário excluído!" });
    },
    onError: () => toast({ title: "Erro ao excluir comentário", variant: "destructive" }),
  });

  // ✅ WebSocket para atualizações em tempo real do fórum
  useEffect(() => {
    if (!topic?.id || !isConnected) {
      return;
    }

    if (import.meta.env.DEV) {
      if (import.meta.env.DEV) console.log('🔌 [ForumTopic] Registrando listeners WebSocket para tópico:', topic.id);
    }

    // Novo reply no fórum
    const handleNewReply = ({ topicId: replyTopicId }: { topicId: string }) => {
      if (replyTopicId === topic.id) {
        if (import.meta.env.DEV) {
          if (import.meta.env.DEV) console.log('📡 [ForumTopic] Novo reply via WebSocket');
        }
        queryClient.invalidateQueries({ 
          queryKey: [`/api/forum/${topicIdOrSlug}/replies`],
          refetchType: 'active'
        });
        queryClient.invalidateQueries({ 
          queryKey: [`/api/forum/topics/${topicIdOrSlug}`],
          refetchType: 'active'
        });
      }
    };

    // Reação no fórum - atualizar otimisticamente
    const handleForumReaction = ({ topicId: reactionTopicId, replyId, result }: { topicId: string; replyId?: string; result: any }) => {
      if (reactionTopicId === topic.id) {
        if (!replyId) {
          if (import.meta.env.DEV) {
            if (import.meta.env.DEV) console.log('📡 [ForumTopic] Reação no tópico via WebSocket');
          }
          queryClient.invalidateQueries({ 
            queryKey: [`/api/forum/topics/${topicIdOrSlug}`],
            refetchType: 'active'
          });
        } else {
          if (import.meta.env.DEV) {
            if (import.meta.env.DEV) console.log('📡 [ForumTopic] Reação no reply via WebSocket:', replyId);
          }
          queryClient.setQueriesData(
            { queryKey: [`/api/forum/${topicIdOrSlug}/replies`], exact: false },
            (oldData: any) => {
              if (!oldData?.pages) return oldData;

              return {
                ...oldData,
                pages: oldData.pages.map((page: any[]) =>
                  page.map((reply: any) => {
                    if (reply.id === replyId) {
                      return {
                        ...reply,
                        likeCount: result.likeCount ?? reply.likeCount,
                        hasLiked: result.hasLiked ?? reply.hasLiked,
                      };
                    }
                    return reply;
                  })
                ),
              };
            }
          );
        }
      }
    };

    // Atualização de tópico em tempo real
    const handleTopicUpdated = ({ topicId: updatedTopicId }: { topicId: string }) => {
      if (updatedTopicId === topic.id) {
        if (import.meta.env.DEV) {
          if (import.meta.env.DEV) console.log('📡 [ForumTopic] Tópico atualizado via WebSocket');
        }
        queryClient.invalidateQueries({ 
          queryKey: [`/api/forum/topics/${topicIdOrSlug}`],
          refetchType: 'active'
        });
      }
    };

    on('forum_new_reply', handleNewReply);
    on('forum_reaction', handleForumReaction);
    on('forum_topic_updated', handleTopicUpdated);

    return () => {
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) console.log('🔌 [ForumTopic] Removendo listeners WebSocket para tópico:', topic.id);
      }
      off('forum_new_reply', handleNewReply);
      off('forum_reaction', handleForumReaction);
      off('forum_topic_updated', handleTopicUpdated);
    };
  }, [topic?.id, topicIdOrSlug, isConnected, on, off]);

  // ✅ Scroll para reply específico via URL hash
  useEffect(() => {
    const handleScrollToReply = () => {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#reply-')) {
        const replyId = hash.replace('#reply-', '');
        setTimeout(() => {
          const replyElement = document.getElementById(`reply-${replyId}`);
          if (replyElement) {
            replyElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            replyElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
            setTimeout(() => {
              replyElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
            }, 3000);
            window.history.replaceState({}, '', window.location.pathname);
          }
        }, 500); // Pequeno delay para garantir que o elemento exista
      }
    };
    handleScrollToReply();
  }, [topic, comments]); // Depende do tópico e comentários serem carregados

  // ✅ Intersection Observer para carregamento infinito de comentários
  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (topicLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-center text-muted-foreground">Carregando discussão...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <p className="text-center text-destructive mb-4">Erro ao carregar discussão</p>
            <Link href="/forum">
              <Button variant="outline">Voltar ao Fórum</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <p className="text-center text-muted-foreground mb-4">Discussão não encontrada</p>
            <Link href="/forum">
              <Button variant="outline">Voltar ao Fórum</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const filteredRelatedTopics = relatedTopics
    .filter((t: any) => t.id !== topic.id && t.categoryId === topic.categoryId)
    .slice(0, 4);

  // Função para lidar com a ação de responder a um comentário
  const handleReply = (comment: Comment) => {
    setOpenReplyForms(prev => new Set(prev).add(comment.id));
    // Focar automaticamente na textarea quando o formulário de resposta abrir
    setTimeout(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>(`#reply-${comment.id} textarea`) || document.querySelector<HTMLTextAreaElement>(`#reply-${comment.id} .ql-editor textarea`);
      textarea?.focus();
    }, 100); 
  };

  // ✅ PERFORMANCE FIX: Usar buildCommentTree para evitar O(n²)
  // Pré-processar comentários em estrutura de árvore hierárquica
  const commentTree = buildCommentTree(comments);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
          <Link href="/forum" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
            Fórum
          </Link>
          <ChevronRight className="w-4 h-4" />
          {topic.category && (
            <>
              <Link 
                href={`/forum?category=${topic.category.slug}`} 
                className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                {topic.category.name}
              </Link>
              <ChevronRight className="w-4 h-4" />
            </>
          )}
          <span className="text-gray-900 dark:text-gray-100 truncate max-w-xs font-medium">{topic.title}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Main Content */}
          <div className="lg:col-span-8 space-y-4">
            {/* Topic Card - REDESIGN EXATO REFERÊNCIA */}
            <Card className="overflow-hidden">
              <div className="px-4 sm:px-6 py-4 sm:py-6">
                {/* Header: Título e Menu de Ações */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex-1">
                    {topic.title}
                  </h1>

                  {/* Menu de Ações no Canto Superior Direito */}
                  {(currentUser?.id === topic.author?.id || currentUser?.isAdmin) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" data-testid="button-topic-actions">
                          <MoreVertical className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleToggleEdit} data-testid="button-edit-topic">
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={() => {
                            if (confirm('Tem certeza que deseja excluir este tópico? Esta ação não pode ser desfeita.')) {
                              deleteTopicMutation.mutate();
                            }
                          }}
                          data-testid="button-delete-topic"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" data-testid="button-report-topic">
                          <Flag className="h-4 w-4 mr-2" />
                          Denunciar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Tags */}
                {topic.tags && topic.tags.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    {topic.tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-md text-xs"
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Autor SEM Badge de Gamificação */}
                {topic.author && (
                  <div className="flex items-center gap-3 mb-6">
                    <Link href={`/users/${topic.author.id}`}>
                      <Avatar className="h-10 w-10 cursor-pointer">
                        <AvatarImage src={topic.author.profileImageUrl || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-green-600 text-white font-semibold">
                          {topic.author.name?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/users/${topic.author.id}`}>
                        <span className="font-semibold text-gray-900 dark:text-gray-100 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer">
                          {topic.author.name}
                        </span>
                      </Link>
                      <span className="text-sm text-gray-500 dark:text-gray-400">• há {formatTimeAgo(topic.createdAt)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Conteúdo */}
              <div className="px-6 pb-4">
                {isEditingInline ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="edit-title">Título</Label>
                      <Input
                        id="edit-title"
                        value={editFormData.title}
                        onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                        placeholder="Título do tópico"
                        data-testid="input-edit-title"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-content">Conteúdo</Label>
                      <div ref={editEditorRef} className="bg-white dark:bg-gray-950 rounded-md border min-h-[200px]" data-testid="input-edit-content" />
                    </div>
                    <div>
                      <Label htmlFor="edit-category">Categoria</Label>
                      <Select 
                        value={editFormData.categoryId} 
                        onValueChange={(value) => setEditFormData({ ...editFormData, categoryId: value })}
                      >
                        <SelectTrigger id="edit-category" data-testid="select-edit-category">
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat: any) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit-tags">Tags (máximo 5)</Label>
                      <div className="space-y-2">
                        {selectedEditTags.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {selectedEditTags.map((tag, index) => (
                              <Badge
                                key={index}
                                variant="secondary"
                                className="gap-1 pr-1"
                              >
                                <Hash className="w-3 h-3" />
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEditTag(tag)}
                                  className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="relative">
                          <Input
                            id="edit-tags"
                            placeholder="Digite uma tag e pressione Enter"
                            value={editTagInput}
                            onChange={(e) => setEditTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddEditTag(editTagInput);
                              }
                            }}
                            onFocus={() => setShowEditTagSuggestions(editTagSuggestions.length > 0)}
                            data-testid="input-edit-tags"
                          />
                          {showEditTagSuggestions && editTagSuggestions.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                              {editTagSuggestions.map((tag) => (
                                <button
                                  key={tag.id}
                                  type="button"
                                  onClick={() => handleAddEditTag(tag.name)}
                                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between"
                                >
                                  <span className="flex items-center gap-2">
                                    <Hash className="w-3 h-3" />
                                    {tag.name}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {tag.usageCount} usos
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="edit-attachment">Anexar Documento (opcional)</Label>
                      {editAttachmentPreview ? (
                        <div className="relative">
                          <img
                            src={editAttachmentPreview}
                            alt="Preview"
                            className="max-h-64 rounded-lg object-cover"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => {
                              setEditAttachmentFile(null);
                              setEditAttachmentPreview(null);
                            }}
                          >
                            Remover
                          </Button>
                        </div>
                      ) : editAttachmentFile ? (
                        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                          <FileText className="h-5 w-5" />
                          <span className="text-sm flex-1">{editAttachmentFile.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditAttachmentFile(null);
                              setEditAttachmentPreview(null);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : !removeExistingAttachment && topic?.attachments && topic.attachments.length > 0 ? (
                        <div className="space-y-2">
                          <div className="relative inline-block">
                            {topic.attachments[0].mimetype?.startsWith('image/') ? (
                              <img
                                src={topic.attachments[0].url}
                                alt="Anexo atual"
                                className="max-h-64 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                                <FileText className="h-5 w-5" />
                                <span className="text-sm">{topic.attachments[0].filename || 'Arquivo anexado'}</span>
                              </div>
                            )}
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute top-2 right-2"
                              onClick={() => setRemoveExistingAttachment(true)}
                              data-testid="button-remove-attachment"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Remover imagem
                            </Button>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => document.getElementById('edit-attachment')?.click()}
                            className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            <ImagePlus className="h-4 w-4 mr-2" />
                            Substituir anexo
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById('edit-attachment')?.click()}
                          className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          <ImagePlus className="h-4 w-4 mr-2" />
                          Anexar Documento
                        </Button>
                      )}
                      <input
                        id="edit-attachment"
                        type="file"
                        accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx,.zip,.rar"
                        className="hidden"
                        onChange={handleEditAttachmentChange}
                      />
                    </div>

                    <div>
                      <Label htmlFor="edit-video">Link de Vídeo (opcional)</Label>
                      <Input
                        id="edit-video"
                        value={editFormData.videoLink}
                        onChange={(e) => setEditFormData({ ...editFormData, videoLink: e.target.value })}
                        placeholder="Cole o link do vídeo (YouTube, Vimeo, etc)"
                        data-testid="input-edit-video"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={updateTopicMutation.isPending}
                        data-testid="button-cancel-edit"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={() => updateTopicMutation.mutate()}
                        disabled={updateTopicMutation.isPending || !editFormData.title.trim() || !editFormData.content.trim()}
                        className="bg-emerald-600 hover:bg-emerald-700"
                        data-testid="button-save-edit"
                      >
                        {updateTopicMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          'Salvar Alterações'
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Conteúdo Principal */}
                    <div 
                      className="prose prose-base dark:prose-invert max-w-none mb-6 text-gray-700 dark:text-gray-300"
                      dangerouslySetInnerHTML={{ 
                        __html: DOMPurify.sanitize(embedVideos(topic.content), {
                          ADD_TAGS: ['iframe', 'div'],
                          ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'style', 'src', 'class'],
                          FORCE_BODY: true
                        }) 
                      }}
                    />

                    {/* Vídeo */}
                    {topic.videoLink && (
                      <div className="mb-6">
                        <VideoEmbed url={topic.videoLink} />
                      </div>
                    )}

                    {/* Anexos */}
                    {topic.attachments && topic.attachments.length > 0 && (
                      <div className="mb-6 space-y-3">
                        {topic.attachments.map((attachment, index) => (
                          <div key={index} className="border rounded-lg overflow-hidden">
                            {attachment.mimetype?.startsWith('image/') ? (
                              <img 
                                src={attachment.url} 
                                alt={attachment.filename || 'Anexo'}
                                className="w-full h-auto max-h-96 object-contain"
                                loading="lazy"
                              />
                            ) : (
                              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 flex items-center gap-3">
                                <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{attachment.filename || 'Arquivo anexado'}</p>
                                  {attachment.size && (
                                    <p className="text-xs text-muted-foreground">
                                      {(attachment.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                  )}
                                </div>
                                <a 
                                  href={attachment.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline shrink-0"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Footer com Ações Principais */}
                    <div className="flex items-center gap-4 sm:gap-6 pt-4 border-t flex-wrap">
                      <button
                        onClick={() => likeMutation.mutate()}
                        className={`flex items-center gap-2 text-sm transition-colors ${
                          topic.hasLiked
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                        }`}
                        data-testid="button-like-topic"
                      >
                        <ThumbsUp className={`w-5 h-5 ${topic.hasLiked ? 'fill-current' : ''}`} />
                        <span className="font-medium">{topic.likeCount}</span>
                      </button>

                      <button 
                        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                        data-testid="text-reply-count"
                      >
                        <MessageSquare className="w-5 h-5" />
                        <span>{topic.replyCount} comentários</span>
                      </button>

                      <button className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors" data-testid="button-save-topic">
                        <Bookmark className="w-5 h-5" />
                        <span>Salvar</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </Card>

            {/* Comments Section - REDESIGN CLEAN EXATO REFERÊNCIA */}
            <Card className="overflow-hidden">
              {/* Título da Seção */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
                  {comments.length} Comentário{comments.length !== 1 ? 's' : ''}
                </h2>
              </div>

              <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-4">
                {/* Add Comment Form - CLEAN COM CONTAINER SEPARADO */}
                <div className="border rounded-lg bg-white dark:bg-gray-950 p-4">
                  <div className="flex items-start gap-3 mb-3">
                    {currentUser && (
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={currentUser.profileImageUrl || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-green-600 text-white font-semibold text-sm">
                          {currentUser.name?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (commentContent.trim()) {
                          commentMutation.mutate({
                            content: commentContent,
                            parentId: undefined
                          });
                        }
                      }}
                      className="flex-1"
                    >
                      <Textarea
                        value={commentContent}
                        onChange={(e) => setCommentContent(e.target.value)}
                        placeholder="O que você está pensando?"
                        rows={3}
                        className="resize-none text-sm border-gray-200 dark:border-gray-800 focus:border-emerald-500 dark:focus:border-emerald-500 mb-3"
                        data-testid="input-comment-content"
                      />
                      <div className="flex justify-end">
                        <Button 
                          type="submit" 
                          disabled={commentMutation.isPending || !commentContent.trim()}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6"
                          data-testid="button-submit-comment"
                        >
                          {commentMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            'Comentar'
                          )}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>

                {comments.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-700" />
                    <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">Nenhuma resposta ainda. Seja o primeiro a comentar!</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Main Comments - Using pre-built comment tree for O(1) access */}
                    {commentTree.slice(0, commentsToShow).map((comment) => {
                      const replies = comment.replies || [];
                      const isReplying = openReplyForms.has(comment.id);

                      return (
                        <div key={comment.id} data-testid={`comment-${comment.id}`} className="bg-white dark:bg-gray-950 rounded-lg p-5 border border-gray-200 dark:border-gray-800">
                          <div className="flex gap-3">
                            <Avatar className="w-10 h-10 flex-shrink-0">
                              <AvatarImage src={comment.author?.profileImageUrl || ''} alt={comment.author?.name} />
                              <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-green-600 text-white font-semibold text-sm">
                                {comment.author?.name?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Link href={`/users/${comment.author?.id}`}>
                                    <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer">{comment.author?.name}</p>
                                  </Link>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    • há {comment.createdAt ? formatTimeAgo(comment.createdAt) : '0s'}
                                  </span>
                                  {comment.isAccepted && (
                                    <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-xs">
                                      <Award className="w-3 h-3 mr-1" />
                                      Melhor Resposta
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  {comment.isPinned && (
                                    <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full p-1.5 mr-1">
                                      <Pin className="w-3.5 h-3.5 fill-current" />
                                    </div>
                                  )}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800">
                                        <MoreVertical className="w-4 h-4 text-gray-500" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {comment.author?.id === currentUser?.id ? (
                                        <DropdownMenuItem
                                          onClick={() => deleteCommentMutation.mutate(comment.id)}
                                          className="text-red-600"
                                        >
                                          <Trash2 className="w-4 h-4 mr-2" />
                                          Excluir
                                        </DropdownMenuItem>
                                      ) : (
                                        <DropdownMenuItem
                                          onClick={() => reportCommentMutation.mutate(comment.id)}
                                          className="text-red-600"
                                        >
                                          <Flag className="w-4 h-4 mr-2" />
                                          Denunciar
                                        </DropdownMenuItem>
                                      )}
                                      {isPostAuthor && (
                                        <DropdownMenuItem
                                          onClick={() => comment.isPinned ? unpinCommentMutation.mutate(comment.id) : pinCommentMutation.mutate(comment.id)}
                                          data-testid={`button-${comment.isPinned ? 'unpin' : 'pin'}-comment-${comment.id}`}
                                        >
                                          <Pin className="w-4 h-4 mr-2" />
                                          {comment.isPinned ? 'Desfixar' : 'Fixar'}
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>

                              <div 
                                className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 mb-3"
                                dangerouslySetInnerHTML={{ 
                                  __html: DOMPurify.sanitize(embedVideos(comment.content), {
                                    ADD_TAGS: ['iframe', 'div'],
                                    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'style', 'src', 'class']
                                  })
                                }}
                              />

                              <div className="flex items-center gap-4">
                                <button
                                  className={`text-sm flex items-center gap-1.5 transition-colors ${
                                    comment.hasLiked
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                  } ${comment.id.startsWith('temp-') ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (!comment.id.startsWith('temp-')) {
                                      likeCommentMutation.mutate(comment.id);
                                    }
                                  }}
                                  disabled={likeCommentMutation.isPending || comment.id.startsWith('temp-')}
                                  data-testid={`button-like-comment-${comment.id}`}
                                >
                                  <ThumbsUp className={`w-4 h-4 ${comment.hasLiked ? 'fill-current' : ''}`} />
                                  <span>{comment.likeCount || 0}</span>
                                </button>
                                <button
                                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors flex items-center gap-1.5"
                                  onClick={() => {
                                    if (isReplying) {
                                      setOpenReplyForms(prev => {
                                        const updated = new Set(prev);
                                        updated.delete(comment.id);
                                        return updated;
                                      });
                                      setReplyContents(prev => {
                                        const updated = { ...prev };
                                        delete updated[comment.id];
                                        return updated;
                                      });
                                    } else {
                                      setOpenReplyForms(prev => new Set(prev).add(comment.id));
                                    }
                                  }}
                                >
                                  <MessageCircle className="w-4 h-4" />
                                  Responder
                                </button>
                              </div>

                              {/* Inline Reply Form para comentário principal */}
                              {isReplying && (
                                <div className="mt-3 ml-13">
                                  <form
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      const content = replyContents[comment.id] || '';
                                      if (content.trim()) {
                                        commentMutation.mutate({
                                          content: content,
                                          parentId: comment.id
                                        });
                                      }
                                    }}
                                    className="space-y-3"
                                  >
                                    <Textarea
                                      value={replyContents[comment.id] || ''}
                                      onChange={(e) => setReplyContents(prev => ({ ...prev, [comment.id]: e.target.value }))}
                                      placeholder="Escreva sua resposta..."
                                      rows={2}
                                      className="resize-none text-sm"
                                      autoFocus
                                      data-testid={`input-reply-${comment.id}`}
                                    />
                                    <div className="flex gap-2">
                                      <Button 
                                        type="submit" 
                                        disabled={commentMutation.isPending || !(replyContents[comment.id] || '').trim()}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                        size="sm"
                                        data-testid={`button-submit-reply-${comment.id}`}
                                      >
                                        {commentMutation.isPending ? (
                                          <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Enviando...
                                          </>
                                        ) : (
                                          'Responder'
                                        )}
                                      </Button>
                                      <Button 
                                        type="button" 
                                        variant="outline"
                                        onClick={() => {
                                          setOpenReplyForms(prev => {
                                            const updated = new Set(prev);
                                            updated.delete(comment.id);
                                            return updated;
                                          });
                                          setReplyContents(prev => {
                                            const updated = { ...prev };
                                            delete updated[comment.id];
                                            return updated;
                                          });
                                        }}
                                        size="sm"
                                        data-testid={`button-cancel-reply-${comment.id}`}
                                      >
                                        Cancelar
                                      </Button>
                                    </div>
                                  </form>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Nested Replies - DESIGN IGUAL REFERÊNCIA */}
                          {replies.length > 0 && (
                            <div className="mt-1 ml-13 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                              {replies.map((reply: any) => (
                                <RenderReply 
                                  key={reply.id} 
                                  reply={reply}
                                  openReplyForms={openReplyForms}
                                  setOpenReplyForms={setOpenReplyForms}
                                  replyContents={replyContents}
                                  setReplyContents={setReplyContents}
                                  likeCommentMutation={likeCommentMutation}
                                  commentMutation={commentMutation}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Load More Trigger */}
                    {commentsToShow < commentTree.length && (
                      <div className="flex justify-center mt-6">
                        <Button variant="outline" onClick={() => setCommentsToShow(prev => prev + 10)}>
                          Ver mais comentários ({commentTree.length - commentsToShow} restantes)
                        </Button>
                      </div>
                    )}
                    {commentsToShow >= commentTree.length && commentTree.length > 0 && (
                      <p className="text-center text-sm text-muted-foreground py-4">
                        ✓ Todos os comentários foram carregados
                      </p>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-4 space-y-4">
            {/* Author Info Card */}
            {topic.author && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Sobre o Autor
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-16 w-16 ring-2 ring-emerald-500/20">
                      <AvatarImage src={topic.author.profileImageUrl || undefined} />
                      <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xl">
                        {topic.author.name?.[0]?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold text-base">{topic.author.name}</p>
                      {topic.author.areaAtuacao && (
                        <p className="text-xs text-muted-foreground mb-1">{topic.author.areaAtuacao}</p>
                      )}
                      <div className="flex flex-col gap-1 mt-1">
                        {authorGamification && authorGamification.level && (
                          <>
                            <Badge variant="outline" className={`gap-1 w-fit ${getLevelColor(authorGamification.level)}`}>
                              {(() => {
                                const LevelIcon = getLevelIcon(authorGamification.level);
                                return LevelIcon ? <LevelIcon className="h-3 w-3" /> : <Star className="h-3 w-3" />;
                              })()}
                              {getLevelName(authorGamification.level)}
                            </Badge>
                            {authorBadges && authorBadges.length > 0 && (
                              <div className="flex gap-1 flex-wrap mt-1">
                                {authorBadges.slice(0, 3).map((badge: any) => (
                                  <Badge 
                                    key={badge.id} 
                                    variant="secondary" 
                                    className="text-xs"
                                    title={badge.badge?.description}
                                  >
                                    {badge.badge?.name}
                                  </Badge>
                                ))}
                                {authorBadges.length > 3 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{authorBadges.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {topic.author.bio && (
                    <p className="text-sm text-muted-foreground">{topic.author.bio}</p>
                  )}

                  <div className="space-y-2 text-sm">
                    {topic.author.location && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span>{topic.author.location}</span>
                      </div>
                    )}
                    {topic.author.website && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Globe className="w-4 h-4" />
                        <a href={topic.author.website} target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline">
                          {topic.author.website}
                        </a>
                      </div>
                    )}
                  </div>

                  <Separator className="my-4" />

                  <Link href={`/users/${topic.author.id}`}>
                    <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 cursor-pointer transition-colors mt-[15px] mb-[15px]" data-testid="link-view-profile">
                      <User className="h-4 w-4" />
                      <span>Ver Perfil Completo</span>
                      <ExternalLink className="h-3 w-3 ml-auto" />
                    </div>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Topic Stats */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Estatísticas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Visualizações
                  </span>
                  <span className="text-sm font-semibold">{topic.viewCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <ThumbsUp className="w-4 h-4" />
                    Curtidas
                  </span>
                  <span className="text-sm font-semibold">{topic.likeCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Respostas
                  </span>
                  <span className="text-sm font-semibold">{topic.replyCount}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Criado
                  </span>
                  <span className="text-xs font-medium">{formatTimeAgo(topic.createdAt)}</span>
                </div>
                {topic.updatedAt && topic.updatedAt !== topic.createdAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Atualizado
                    </span>
                    <span className="text-xs font-medium">{formatTimeAgo(topic.updatedAt)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Related Topics */}
            {filteredRelatedTopics.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Discussões Relacionadas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {filteredRelatedTopics.map((relatedTopic: any) => (
                    <Link key={relatedTopic.id} href={`/forum/${relatedTopic.slug || relatedTopic.id}`}>
                      <div className="group cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors">
                        <p className="text-sm font-medium group-hover:text-emerald-600 line-clamp-2 mb-1">
                          {relatedTopic.title}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {relatedTopic.viewCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {relatedTopic.replyCount}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}