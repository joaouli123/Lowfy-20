import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Share2,
  MoreHorizontal,
  MoreVertical,
  Flag,
  Send,
  FileText,
  Pin,
  Heart,
  PartyPopper,
  Zap,
  Lightbulb,
  Trash2,
  PinOff,
  CheckCircle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { formatTimeAgo } from '@/lib/formatTime';

interface PostCardProps {
  post: any;
  currentUser?: any;
  onOpenComments?: (postId: string) => void;
  onOpenReactions?: (postId: string) => void;
}

const reactionIcons: Record<string, any> = {
  like: { icon: ThumbsUp, color: 'text-blue-600' },
  dislike: { icon: ThumbsDown, color: 'text-red-600' },
};

const reactionTypes = [
  { type: 'like', icon: ThumbsUp, label: 'Curtir' },
  { type: 'dislike', icon: ThumbsDown, label: 'Descurtir' },
];

// Helper function to convert video URLs to embed URLs
function convertToEmbedUrl(url: string): string {
  if (!url) return '';

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    if (hostname.includes('youtube.com')) {
      const videoId = urlObj.searchParams.get('v');
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    } else if (hostname.includes('youtu.be')) {
      const videoId = urlObj.pathname.substring(1);
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    } else if (hostname.includes('vimeo.com')) {
      const videoId = urlObj.pathname.substring(1).split('/')[0];
      if (videoId) return `https://player.vimeo.com/video/${videoId}`;
    } else if (hostname.includes('dailymotion.com')) {
      const videoId = urlObj.pathname.split('/video/')[1];
      if (videoId) return `https://www.dailymotion.com/embed/video/${videoId}`;
    }
  } catch (e) {
  }

  return url;
}

// Helper function to render content with clickable hashtags
function renderContentWithHashtags(content: string, onHashtagClick: (tag: string) => void) {
  if (!content) return null;

  const hashtagRegex = /#(\w+)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = hashtagRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`} dangerouslySetInnerHTML={{ __html: content.substring(lastIndex, match.index) }} />
      );
    }

    const tag = match[1];
    parts.push(
      <button
        key={`tag-${match.index}`}
        onClick={(e) => {
          e.stopPropagation();
          onHashtagClick(tag);
        }}
        className="text-primary hover:underline font-medium cursor-pointer inline"
      >
        #{tag}
      </button>
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(
      <span key={`text-${lastIndex}`} dangerouslySetInnerHTML={{ __html: content.substring(lastIndex) }} />
    );
  }

  return parts.length > 0 ? <>{parts}</> : <span dangerouslySetInnerHTML={{ __html: content }} />;
}

export function PostCard({ post, currentUser, onOpenComments, onOpenReactions }: PostCardProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [commentsToShow, setCommentsToShow] = useState(5);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareComment, setShareComment] = useState('');
  const [showImageModal, setShowImageModal] = useState<string | null>(null);

  const handleHashtagClick = (tag: string) => {
    setLocation(`/timeline?tag=${encodeURIComponent(tag)}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Estados otimistas para atualização instantânea da UI
  const [optimisticReactionType, setOptimisticReactionType] = useState<string | null>(null);
  const [optimisticLikeCount, setOptimisticLikeCount] = useState<number | null>(null);
  const [optimisticDislikeCount, setOptimisticDislikeCount] = useState<number | null>(null);
  const [optimisticShareCount, setOptimisticShareCount] = useState<number | null>(null);
  const [optimisticComments, setOptimisticComments] = useState<any[] | null>(null);

  // Resetar estados otimistas quando o post muda (é um post diferente)
  // Usamos uma ref para rastrear o post ID anterior
  const prevPostIdRef = useRef(post.id);

  useEffect(() => {
    // Só resetar se for realmente um post diferente, não quando os dados são re-fetched
    if (prevPostIdRef.current !== post.id) {
      setOptimisticReactionType(null);
      setOptimisticLikeCount(null);
      setOptimisticDislikeCount(null);
      setOptimisticShareCount(null);
      setOptimisticComments(null);
      prevPostIdRef.current = post.id;
    }
  }, [post.id]);

  // Não sincronizar automaticamente - deixar as mutações controlarem
  // Isso evita loops e permite atualizações otimistas funcionarem corretamente

  // Usar valores otimistas se disponíveis, caso contrário usar do post
  const currentReactionType = optimisticReactionType !== null ? optimisticReactionType : (post.reactionType || null);
  const currentLikeCount = optimisticLikeCount !== null ? optimisticLikeCount : (post.likeCount || 0);
  const currentDislikeCount = optimisticDislikeCount !== null ? optimisticDislikeCount : (post.dislikeCount || 0);
  const currentShareCount = optimisticShareCount !== null ? optimisticShareCount : (post.shareCount || 0);

  // Mesclar comentários otimistas com reais
  const currentComments = (() => {
    // Se não há estado otimista, usar comentários do post
    if (optimisticComments === null) {
      return (post.comments || []).filter(c => c.author && c.author.id);
    }

    // Se há estado otimista, SEMPRE usar ele (pode ter atualizações de likes/dislikes)
    return optimisticComments.filter(c => c.author && c.author.id);
  })();

  // Contador de comentários REAL (não usar post.comments.length pois pode estar desatualizado)
  const commentCount = currentComments.length;

  const reactMutation = useMutation({
    mutationFn: async (type: string) => {
      return apiRequest('POST', `/api/timeline/posts/${post.id}/reactions`, { type });
    },
    onMutate: async (type: string) => {
      // Cancelar queries em andamento para evitar race conditions
      await queryClient.cancelQueries({ queryKey: ['/api/timeline/posts'] });

      // Capturar os valores atuais no momento da mutação (otimistas se disponíveis, senão do post)
      const baseReaction = optimisticReactionType !== null ? optimisticReactionType : (post.reactionType || null);
      const baseLikes = optimisticLikeCount !== null ? optimisticLikeCount : (post.likeCount || 0);
      const baseDislikes = optimisticDislikeCount !== null ? optimisticDislikeCount : (post.dislikeCount || 0);

      // Se já tem uma reação do mesmo tipo, remove
      if (baseReaction === type) {
        setOptimisticReactionType(null);
        if (type === 'like') {
          setOptimisticLikeCount(Math.max(0, baseLikes - 1));
        } else if (type === 'dislike') {
          setOptimisticDislikeCount(Math.max(0, baseDislikes - 1));
        }
      } else {
        // Se tinha outra reação, remove ela primeiro
        let newLikes = baseLikes;
        let newDislikes = baseDislikes;

        if (baseReaction === 'like') {
          newLikes = Math.max(0, baseLikes - 1);
        } else if (baseReaction === 'dislike') {
          newDislikes = Math.max(0, baseDislikes - 1);
        }

        // Adiciona a nova reação
        if (type === 'like') {
          newLikes = newLikes + 1;
        } else if (type === 'dislike') {
          newDislikes = newDislikes + 1;
        }

        setOptimisticReactionType(type);
        setOptimisticLikeCount(newLikes);
        setOptimisticDislikeCount(newDislikes);
      }

      return { previousReaction: post.reactionType || null, previousLikes: post.likeCount || 0, previousDislikes: post.dislikeCount || 0 };
    },
    onSuccess: () => {
      // Invalidar cache para forçar atualização com dados do servidor
      queryClient.invalidateQueries({
        queryKey: ['/api/timeline/posts'],
        exact: false,
        refetchType: 'active'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/gamification/daily-activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gamification/weekly-challenges'] });
    },
    onError: () => {
      // Rollback em caso de erro
      setOptimisticReactionType(null);
      setOptimisticLikeCount(null);
      setOptimisticDislikeCount(null);

      toast({
        title: "Erro",
        description: "Não foi possível registrar sua reação. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const shareMutation = useMutation({
    mutationFn: async (comment?: string) => {
      return apiRequest('POST', `/api/timeline/posts/${post.id}/share`, {
        sharedWith: 'public',
        comment: comment || undefined
      });
    },
    onMutate: () => {
      // Usar valor otimista se disponível, senão do post
      const baseShareCount = optimisticShareCount !== null ? optimisticShareCount : (post.shareCount || 0);
      setIsShared(true);
      setOptimisticShareCount(baseShareCount + 1);
      setTimeout(() => setIsShared(false), 800);
      setShowShareDialog(false);
      setShareComment('');
      toast({
        title: "Compartilhado!",
        description: "Post compartilhado com sucesso",
        duration: 2000,
      });
    },
    onSuccess: () => {
      // Invalidar cache para mostrar post compartilhado
      queryClient.invalidateQueries({
        queryKey: ['/api/timeline/posts'],
        exact: false,
        refetchType: 'active' // Refetch imediato para mostrar compartilhamento
      });
    },
    onError: () => {
      setOptimisticShareCount(null);
    }
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ content, parentCommentId }: { content: string; parentCommentId?: string }) => {
      const response = await apiRequest('POST', `/api/timeline/posts/${post.id}/comments`, { content, parentCommentId });
      return response.json();
    },
    onMutate: async ({ content, parentCommentId }) => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ queryKey: ['/api/timeline/posts'] });

      // Usar comentários otimistas se disponíveis, senão do post
      const baseComments = optimisticComments !== null ? optimisticComments : (post.comments || []);
      const tempComment = {
        id: `temp-${Date.now()}-${Math.random()}`,
        content,
        parentCommentId: parentCommentId || null,
        userId: currentUser?.id,
        author: {
          id: currentUser?.id,
          name: currentUser?.name || 'Você',
          profileImageUrl: currentUser?.profileImageUrl || null,
          profession: currentUser?.profession || null,
          areaAtuacao: currentUser?.areaAtuacao || null,
          badge: currentUser?.badge || null
        },
        createdAt: new Date().toISOString(),
        likeCount: 0,
        replyCount: 0,
        replies: [],
        isPinned: false,
        userHasLiked: false,
      };

      // Adicionar comentário otimista no INÍCIO da lista (mais recente primeiro)
      setOptimisticComments([tempComment, ...baseComments]);

      // Limpar campo e estado de resposta
      setComment('');
      setReplyingTo(null);

      return { previousComments: baseComments };
    },
    onSuccess: (serverComment) => {
      if (!serverComment || !serverComment.id) {
        return;
      }

      // Substituir comentário temporário pelo real do servidor
      const baseComments = optimisticComments !== null ? optimisticComments : (post.comments || []);

      // Substituir temp- pelo comentário real, ou adicionar se não existir
      let commentAdded = false;
      const syncedComments = baseComments.map(c => {
        if (c.id?.startsWith('temp-') && c.content === serverComment.content && c.userId === serverComment.userId) {
          commentAdded = true;
          return serverComment; // Substituir temporário
        }
        if (c.id === serverComment.id) {
          commentAdded = true;
          return serverComment; // Atualizar existente
        }
        return c;
      });

      // Se não foi adicionado/substituído, adicionar no INÍCIO
      if (!commentAdded) {
        syncedComments.unshift(serverComment);
      }

      setOptimisticComments(syncedComments);

      queryClient.invalidateQueries({ queryKey: ['/api/gamification/daily-activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gamification/weekly-challenges'] });

      // WebSocket também vai atualizar outros clientes
    },
    onError: (error: any, variables, context) => {
      // Reverter para estado anterior
      if (context?.previousComments) {
        setOptimisticComments(context.previousComments);
      } else {
        setOptimisticComments(null);
      }

      toast({
        title: "Erro",
        description: error?.message || "Não foi possível adicionar o comentário. Tente novamente.",
        variant: "destructive",
      });
    }
  });

  const likeCommentMutation = useMutation<
    { userHasLiked: boolean; likeCount: number },
    Error,
    string
  >({
    mutationFn: async (commentId: string) => {
      const response = await apiRequest('POST', `/api/timeline/posts/${post.id}/comments/${commentId}/like`, {});
      return response.json();
    },
    onMutate: async (commentId: string) => {
      const baseComments = optimisticComments !== null ? optimisticComments : (post.comments || []);

      const updateCommentRecursive = (comments: any[]): any[] => {
        return comments.map(c => {
          if (c.id === commentId) {
            const wasLiked = c.userHasLiked;
            const currentLikeCount = c.likeCount || 0;

            return {
              ...c,
              likeCount: wasLiked ? Math.max(0, currentLikeCount - 1) : currentLikeCount + 1,
              userHasLiked: !wasLiked
            };
          }
          if (c.replies && c.replies.length > 0) {
            return {
              ...c,
              replies: updateCommentRecursive(c.replies)
            };
          }
          return c;
        });
      };

      const updatedComments = updateCommentRecursive(baseComments);
      setOptimisticComments(updatedComments);

      return { previousComments: baseComments };
    },
    onSuccess: async () => {
    },
    onError: (_error, _commentId, context) => {
      if (context?.previousComments) {
        setOptimisticComments(context.previousComments);
      } else {
        setOptimisticComments(null);
      }

      toast({
        title: "Erro ao curtir comentário",
        description: "Tente novamente.",
        variant: "destructive",
      });
    }
  });

  const pinCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      return apiRequest('POST', `/api/timeline/posts/${post.id}/comments/${commentId}/pin`, {});
    },
    onMutate: async (commentId: string) => {
      // Usar comentários otimistas se disponíveis, senão do post
      const baseComments = optimisticComments !== null ? optimisticComments : (post.comments || []);

      // Marcar apenas o comentário selecionado como fixado, desafixar todos os outros
      const updatedComments = baseComments.map(c => ({
        ...c,
        isPinned: c.id === commentId ? true : false
      }));

      // Ordenar: fixados primeiro, depois por curtidas, depois por data
      const sortedComments = [...updatedComments].sort((a, b) => {
        // Fixados sempre no topo
        if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
        // Depois por curtidas
        if (a.likeCount !== b.likeCount) return b.likeCount - a.likeCount;
        // Depois por data
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setOptimisticComments(sortedComments);
      return { previousComments: baseComments };
    },
    onSuccess: async () => {
      toast({
        title: "Comentário fixado!",
        description: "O comentário foi fixado no topo",
        duration: 2000,
      });
      // Invalidar cache e aguardar refetch completar
      await queryClient.invalidateQueries({ queryKey: ['/api/timeline/posts'] });
      // Após refetch, limpar estado otimista
      setOptimisticComments(null);
    },
    onError: (_error, _vars, context) => {
      if (context?.previousComments) {
        setOptimisticComments(context.previousComments);
      } else {
        setOptimisticComments(null);
      }
      toast({
        title: "Erro ao fixar comentário",
        description: "Tente novamente",
        variant: "destructive",
        duration: 2000,
      });
    }
  });

  const unpinCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      return apiRequest('DELETE', `/api/timeline/posts/${post.id}/comments/${commentId}/pin`, {});
    },
    onMutate: async (commentId: string) => {
      // Usar comentários otimistas se disponíveis, senão do post
      const baseComments = optimisticComments !== null ? optimisticComments : (post.comments || []);

      // Desfixar o comentário selecionado APENAS
      const updatedComments = baseComments.map(c => ({
        ...c,
        isPinned: c.id === commentId ? false : c.isPinned
      }));

      // NÃO REORDENAR - apenas atualizar estado
      // A ordem natural já está correta do servidor
      setOptimisticComments(updatedComments);
      return { previousComments: baseComments };
    },
    onSuccess: async () => {
      toast({
        title: "Comentário desfixado!",
        description: "O comentário foi desfixado",
        duration: 2000,
      });
      // Invalidar cache e aguardar refetch completar
      await queryClient.invalidateQueries({ queryKey: ['/api/timeline/posts'] });
      // Após refetch, limpar estado otimista
      setOptimisticComments(null);
    },
    onError: (_error, _vars, context) => {
      if (context?.previousComments) {
        setOptimisticComments(context.previousComments);
      } else {
        setOptimisticComments(null);
      }
      toast({
        title: "Erro ao desfixar comentário",
        description: "Tente novamente",
        variant: "destructive",
        duration: 2000,
      });
    }
  });


  const reportMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/timeline/posts/${post.id}/report`, {
        reason: 'inappropriate',
        description: 'Conteúdo inapropriado'
      });
    },
    onSuccess: () => {
      toast({
        title: "Denúncia enviada",
        description: "O post foi denunciado e será analisado.",
      });
    },
  });

  const pinPostMutation = useMutation({
    mutationFn: async () => {
      if (post.isPinned) {
        return apiRequest('DELETE', `/api/timeline/posts/${post.id}/pin`, {});
      } else {
        return apiRequest('POST', `/api/timeline/posts/${post.id}/pin`, {});
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/timeline/posts'],
        exact: false
      });
      toast({
        title: post.isPinned ? "Post desfixado" : "Post fixado",
        description: post.isPinned ? "O post foi desfixado" : "O post foi fixado no topo do seu perfil",
        duration: 2000,
      });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/timeline/posts/${post.id}`, {});
    },
    onMutate: async () => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ queryKey: ['/api/timeline/posts'] });

      // Snapshot do estado anterior
      const previousData = queryClient.getQueryData(['/api/timeline/posts']);

      // Atualização otimista - remover post imediatamente
      queryClient.setQueriesData(
        { queryKey: ['/api/timeline/posts'] },
        (old: any) => {
          if (!old) return old;

          // Para useInfiniteQuery
          if (old.pages) {
            return {
              ...old,
              pages: old.pages.map((page: any[]) =>
                page.filter((p: any) => p.id !== post.id)
              )
            };
          }

          // Para array simples
          if (Array.isArray(old)) {
            return old.filter((p: any) => p.id !== post.id);
          }

          return old;
        }
      );

      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/timeline/posts'],
        exact: false,
        refetchType: 'active'
      });
      toast({
        title: "Post excluído",
        description: "O post foi excluído com sucesso",
        duration: 2000,
      });
    },
    onError: (error: any, variables, context) => {
      // Reverter para o estado anterior em caso de erro
      if (context?.previousData) {
        queryClient.setQueryData(['/api/timeline/posts'], context.previousData);
      }

      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: error?.message || "Não foi possível excluir o post",
      });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      return apiRequest('DELETE', `/api/timeline/posts/${post.id}/comments/${commentId}`);
    },
    onMutate: async (commentId: string) => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ queryKey: ['/api/timeline/posts'] });

      // Snapshot do estado anterior
      const previousData = queryClient.getQueryData(['/api/timeline/posts']);
      const previousOptimistic = optimisticComments;

      // Atualização otimista local - remover comentário dos estados otimistas
      const baseComments = optimisticComments !== null ? optimisticComments : (post.comments || []);
      setOptimisticComments(baseComments.filter(c => c.id !== commentId));

      // Atualização otimista do cache - remover comentário imediatamente
      queryClient.setQueriesData(
        { queryKey: ['/api/timeline/posts'] },
        (old: any) => {
          if (!old) return old;

          // Para useInfiniteQuery
          if (old.pages) {
            return {
              ...old,
              pages: old.pages.map((page: any[]) =>
                page.map((p: any) =>
                  p.id === post.id
                    ? {
                        ...p,
                        comments: p.comments?.filter((c: any) => c.id !== commentId) || [],
                        commentCount: Math.max(0, (p.commentCount || 0) - 1)
                      }
                    : p
                )
              )
            };
          }

          // Para array simples
          if (Array.isArray(old)) {
            return old.map((p: any) =>
              p.id === post.id
                ? {
                    ...p,
                    comments: p.comments?.filter((c: any) => c.id !== commentId) || [],
                    commentCount: Math.max(0, (p.commentCount || 0) - 1)
                  }
                : p
            );
          }

          return old;
        }
      );

      return { previousData, previousOptimistic };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/timeline/posts'],
        exact: false,
        refetchType: 'active'
      });
      toast({
        title: "Comentário excluído",
        description: "O comentário foi excluído com sucesso",
        duration: 2000,
      });
    },
    onError: (error: any, variables, context) => {
      // Reverter para o estado anterior em caso de erro
      if (context?.previousData) {
        queryClient.setQueryData(['/api/timeline/posts'], context.previousData);
      }
      if (context?.previousOptimistic !== undefined) {
        setOptimisticComments(context.previousOptimistic);
      }

      console.error('Delete comment error:', error);
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: error?.message || "Não foi possível excluir o comentário",
      });
    },
  });

  const reportCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      return apiRequest('POST', `/api/timeline/posts/${post.id}/comments/${commentId}/report`, {
        reason: 'inappropriate',
        description: 'Conteúdo inapropriado'
      });
    },
    onSuccess: () => {
      toast({
        title: "Denúncia enviada",
        description: "O comentário foi denunciado e será analisado.",
        duration: 2000,
      });
    },
  });

  const timeAgo = post.createdAt
    ? formatTimeAgo(post.createdAt)
    : '';

  const UserReactionIcon = currentReactionType ? reactionIcons[currentReactionType] : null;

  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const handleReply = (commentToReply: any) => {
    setReplyingTo(commentToReply.id);
    setComment(`@${commentToReply.author.name} `);
    setShowComments(true);
    setTimeout(() => {
      const textarea = document.querySelector(`[data-testid="input-comment-${post.id}"]`) as HTMLTextAreaElement;
      textarea?.focus();
    }, 100);
  };

  const handleCommentSubmit = () => {
    if (!comment.trim()) return;

    const commentContent = comment.trim();
    const parentId = replyingTo || undefined;

    // Chamada à mutação - ela já lida com optimistic update e limpeza
    addCommentMutation.mutate({
      content: commentContent,
      parentCommentId: parentId
    });
  };

  const handleReaction = (type: string) => {
    reactMutation.mutate(type);
  };

  // Separar comentários principais de respostas
  const mainComments = currentComments.filter((c: any) => !c.parentCommentId);
  const isPostAuthor = currentUser?.id === post.author?.id;

  // Handlers para as mutações de post
  const handlePinPost = () => pinPostMutation.mutate();
  const handleDeletePost = () => deletePostMutation.mutate();
  const handleReportPost = () => reportMutation.mutate();

  return (
    <Card
      className={`mb-2 sm:mb-4 overflow-hidden transition-all hover:shadow-lg ${
        post.isPinned ? 'border-primary/50 shadow-md' : ''
      }`}
      data-testid={`post-${post.id}`}
      data-post-id={post.id}
    >
      <CardContent className="p-3 sm:p-4">
        {post.isPinned && (
          <div className="mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2 text-primary text-xs sm:text-sm font-medium">
            <Pin className="w-3 h-3 sm:w-4 sm:h-4 fill-primary" />
            <span>Post Fixado</span>
          </div>
        )}
        {/* Mobile: Avatar e conteúdo em coluna, Desktop: lado a lado */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Avatar className="w-10 h-10 sm:w-12 sm:h-12 ring-1 ring-primary" data-testid={`img-author-avatar-${post.id}`}>
            <AvatarImage src={post.author?.profileImageUrl || ''} alt={post.author?.name} />
            <AvatarFallback className="bg-white dark:bg-card text-primary">
              {post.author?.name?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <Link href={`/users/${post.author?.id}`}>
                  <h3 className="font-semibold text-xs sm:text-sm hover:underline cursor-pointer" data-testid={`text-author-name-${post.id}`}>
                    {post.author?.name}
                  </h3>
                </Link>
                <p className="text-[10px] sm:text-xs text-muted-foreground" data-testid={`text-author-profession-${post.id}`}>
                  {post.author?.areaAtuacao || 'Profissional'}
                </p>
                {post.sharedPost && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground/70 mt-0.5 flex items-center gap-0.5 sm:gap-1">
                    <Share2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    Compartilhou um post
                  </p>
                )}
                {post.author?.badge && (
                  <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 bg-primary/10 text-primary text-[10px] sm:text-xs rounded-full mt-1" data-testid={`badge-author-${post.id}`}>
                    {post.author.badge}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-0.5 sm:gap-1 -mr-1 sm:-mr-2">
                <p className="text-[10px] sm:text-xs text-muted-foreground" data-testid={`text-post-time-${post.id}`}>
                  {timeAgo}
                </p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 sm:h-8 sm:w-8 p-0" data-testid={`button-post-menu-${post.id}`}>
                      <MoreVertical className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {currentUser?.id === post.author?.id && (
                      <DropdownMenuItem
                        onClick={handlePinPost}
                        className="cursor-pointer"
                      >
                        {post.isPinned ? (
                          <>
                            <PinOff className="mr-2 h-4 w-4" />
                            Desafixar
                          </>
                        ) : (
                          <>
                            <Pin className="mr-2 h-4 w-4" />
                            Fixar no topo
                          </>
                        )}
                      </DropdownMenuItem>
                    )}

                    {(currentUser?.id === post.author?.id || currentUser?.isAdmin) && (
                      <DropdownMenuItem
                        onClick={handleDeletePost}
                        className="cursor-pointer text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir post
                      </DropdownMenuItem>
                    )}
                    {!isPostAuthor && (
                      <DropdownMenuItem
                        onClick={handleReportPost}
                        className="text-red-600"
                        data-testid={`button-report-post-${post.id}`}
                      >
                        <Flag className="w-4 h-4 mr-2" />
                        Denunciar
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="mt-2 sm:mt-3">
              {post.content && (
                <div className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-4 prose prose-sm max-w-none dark:prose-invert">
                  {renderContentWithHashtags(post.content, handleHashtagClick)}
                </div>
              )}

              {/* Display Media (Imagens/Vídeos/Documentos) - apenas se NÃO for post compartilhado */}
              {post.media && post.media.length > 0 && !post.sharedPost && (
                <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
                  {post.media.map((media: any, index: number) => {
                    if (media.type === 'image') {
                      return (
                        <div key={index} className="rounded-lg overflow-hidden border border-border">
                          <img
                            src={media.url}
                            alt="Imagem do post"
                            className="w-full h-auto max-h-[500px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            data-testid={`img-post-media-${post.id}-${index}`}
                            onClick={() => setShowImageModal(media.url)}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23888"%3EImagem indispon%C3%ADvel%3C/text%3E%3C/svg%3E';
                            }}
                          />
                        </div>
                      );
                    }
                    if (media.type === 'video') {
                      return (
                        <div key={index} className="rounded-lg overflow-hidden border border-border">
                          <video
                            src={media.url}
                            controls
                            className="w-full h-auto max-h-[500px]"
                            data-testid={`video-post-media-${post.id}-${index}`}
                          >
                            Seu navegador não suporta vídeos.
                          </video>
                        </div>
                      );
                    }
                    if (media.type === 'document') {
                      return (
                        <div key={index} className="rounded-lg border border-border p-3 sm:p-4 bg-muted/30">
                          <div className="flex items-start gap-2 sm:gap-3 mb-2">
                            <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-primary flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-xs sm:text-sm truncate">{media.name || 'Documento'}</p>
                              {media.size && (
                                <p className="text-[10px] sm:text-xs text-muted-foreground">
                                  {(media.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(media.url, '_blank')}
                            data-testid={`button-download-doc-${post.id}-${index}`}
                            className="w-full h-9 text-xs sm:text-sm"
                          >
                            Download
                          </Button>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              )}

              {/* Display Video Link */}
              {post.videoLink && !post.sharedPost && (
                <div className="mt-3 rounded-lg overflow-hidden border border-border aspect-video" data-testid={`video-link-${post.id}`}>
                  <iframe
                    src={convertToEmbedUrl(post.videoLink)}
                    className="w-full h-full"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Vídeo do post"
                  />
                </div>
              )}

              {/* Display Link Preview */}
              {post.linkPreview && !post.sharedPost && (() => {
                let hostname = 'Link';
                try {
                  if (post.linkPreview.url) {
                    const urlObj = new URL(post.linkPreview.url);
                    hostname = urlObj.hostname;
                  }
                } catch {
                  // Usar título se hostname falhar
                  hostname = post.linkPreview.title || 'Link';
                }

                return (
                  <a
                    href={post.linkPreview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 block rounded-lg border border-border overflow-hidden hover:bg-muted/50 transition-colors"
                    data-testid={`link-preview-${post.id}`}
                  >
                    {post.linkPreview.image && (
                      <img
                        src={post.linkPreview.image}
                        alt={post.linkPreview.title || 'Preview'}
                        className="w-full h-48 object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="p-4">
                      <h4 className="font-semibold text-sm line-clamp-2">{post.linkPreview.title || 'Link'}</h4>
                      {post.linkPreview.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{post.linkPreview.description}</p>
                      )}
                      <p className="text-xs text-primary mt-2">{hostname}</p>
                    </div>
                  </a>
                );
              })()}

              {/* Display Shared Post */}
              {post.sharedPost && (
                <div
                  className="mt-3 border-2 border-primary/20 rounded-lg p-4 bg-muted/50"
                  data-testid={`shared-post-${post.sharedPost.id}`}
                >
                  <div className="flex gap-3 mb-3">
                    <Avatar className="w-10 h-10 ring-1 ring-border">
                      <AvatarImage src={post.sharedPost.author?.profileImageUrl || ''} alt={post.sharedPost.author?.name} />
                      <AvatarFallback className="bg-white dark:bg-card text-primary">
                        {post.sharedPost.author?.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <Link href={`/users/${post.sharedPost.author?.id}`}>
                        <h3 className="font-semibold text-sm hover:underline cursor-pointer">{post.sharedPost.author?.name}</h3>
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {post.sharedPost.author?.areaAtuacao || 'Profissional'}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        {post.sharedPost.createdAt && formatTimeAgo(post.sharedPost.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Shared post content */}
                  {post.sharedPost.content && (
                    <div className="text-sm prose prose-sm max-w-none dark:prose-invert mb-3">
                      {renderContentWithHashtags(post.sharedPost.content, handleHashtagClick)}
                    </div>
                  )}

                  {/* Shared post media */}
                  {post.sharedPost.media && post.sharedPost.media.length > 0 && (
                    <div className="mt-3 rounded-lg overflow-hidden">
                      {post.sharedPost.media[0].type === 'image' && (
                        <img
                          src={post.sharedPost.media[0].url}
                          alt="Shared post media"
                          className="w-full h-auto max-h-[500px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setShowImageModal(post.sharedPost.media[0].url)}
                        />
                      )}
                      {post.sharedPost.media[0].type === 'video' && (
                        <video
                          src={post.sharedPost.media[0].url}
                          controls
                          className="w-full h-auto max-h-[500px]"
                        />
                      )}
                    </div>
                  )}

                  {/* Shared post video link */}
                  {post.sharedPost.videoLink && (
                    <div className="mt-3 rounded-lg overflow-hidden border border-border aspect-video">
                      <iframe
                        src={convertToEmbedUrl(post.sharedPost.videoLink)}
                        className="w-full h-full"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title="Vídeo do post compartilhado"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Display Attachments */}
              {post.attachments && post.attachments.length > 0 && (
                <div className="mt-3 space-y-3">
                  {post.attachments.map((attachment: any, index: number) => (
                    <div key={index} className="rounded-lg overflow-hidden border border-border">
                      {attachment.type === 'image' && attachment.url && (
                        <img
                          src={attachment.url}
                          alt={attachment.name || 'Imagem anexada'}
                          className="w-full h-auto max-h-96 object-contain bg-muted"
                          data-testid={`img-post-attachment-${post.id}-${index}`}
                        />
                      )}
                      {attachment.type === 'video' && attachment.url && (
                        <video
                          src={attachment.url}
                          controls
                          className="w-full h-auto max-h-96"
                          data-testid={`video-post-attachment-${post.id}-${index}`}
                        >
                          Seu navegador não suporta vídeos.
                        </video>
                      )}
                      {attachment.type === 'article' && (
                        <div className="p-3 sm:p-4 bg-muted">
                          <div className="flex items-start gap-2 sm:gap-3">
                            <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-xs sm:text-sm truncate">{attachment.name}</p>
                              <p className="text-[10px] sm:text-xs text-muted-foreground">Documento anexado</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}


            </div>

            <div className="flex items-center gap-0.5 sm:gap-1 mt-2 sm:mt-4 pt-2 sm:pt-4 border-t flex-wrap">
              {reactionTypes.map((reaction) => {
                const IconComponent = reaction.icon;
                const isActive = currentReactionType === reaction.type;

                // Usar contadores otimistas para exibir valores atualizados instantaneamente
                const count = reaction.type === 'like' ? currentLikeCount : currentDislikeCount;

                const colorClass = reaction.type === 'like' ? 'text-blue-600' : 'text-red-600';
                return (
                  <Button
                    key={reaction.type}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReaction(reaction.type)}
                    className={`gap-1 h-8 sm:h-9 px-2 sm:px-3 flex-shrink-0 ${isActive ? colorClass : 'text-muted-foreground'} hover:bg-transparent hover:${colorClass}`}
                    disabled={reactMutation.isPending}
                    data-testid={`button-${reaction.type}-${post.id}`}
                  >
                    <IconComponent className={`w-4 h-4 ${isActive ? colorClass : ''}`} />
                    <span className="text-xs">({count})</span>
                  </Button>
                );
              })}

              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-primary-foreground dark:hover:text-primary-foreground hover:bg-primary dark:hover:bg-primary h-8 sm:h-9 px-2 sm:px-3 flex-shrink-0"
                onClick={() => {
                  setShowComments(!showComments);
                  if (!showComments) setCommentsToShow(5);
                }}
                data-testid={`button-comment-${post.id}`}
              >
                <MessageCircle className="w-4 h-4" />
                <span className="ml-1 text-xs">({commentCount})</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-primary-foreground dark:hover:text-primary-foreground hover:bg-primary dark:hover:bg-primary h-8 sm:h-9 px-2 sm:px-3 flex-shrink-0"
                onClick={() => setShowShareDialog(true)}
                disabled={shareMutation.isPending}
                data-testid={`button-share-${post.id}`}
              >
                <Share2 className="w-4 h-4" />
                <span className="ml-1 text-xs">({currentShareCount})</span>
              </Button>
            </div>

            {/* Inline Comments Section */}
            {showComments && (
              <div className="mt-6 pt-6 border-t space-y-5" data-testid={`comments-section-${post.id}`}>
                {/* Existing Comments */}
                {mainComments.length > 0 && (
                  <div className="space-y-4">
                    {mainComments.slice(0, commentsToShow).map((comment) => {
                      const replies = currentComments.filter((c: any) => c.parentCommentId === comment.id);
                      return (
                        <div key={comment.id} data-testid={`comment-${comment.id}`}>
                          <div className="flex gap-3">
                            <Avatar className="w-10 h-10 ring-2 ring-border flex-shrink-0">
                              <AvatarImage src={comment.author?.profileImageUrl || ''} alt={comment.author?.name} />
                              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-sm font-semibold">
                                {comment.author?.name?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className={`rounded-2xl p-4 border ${
                                comment.isPinned
                                  ? 'border-primary bg-primary/10 dark:bg-primary/5'
                                  : 'border-border/50'
                              } relative`}>
                                {comment.isPinned && (
                                  <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg ring-2 ring-background">
                                    <Pin className="w-3.5 h-3.5 fill-current" />
                                  </div>
                                )}
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex flex-col gap-1 flex-1">
                                    <Link href={`/users/${comment.author?.id}`}>
                                      <p className="font-semibold text-sm text-foreground hover:underline cursor-pointer">{comment.author?.name}</p>
                                    </Link>
                                    {comment.author?.profession && (
                                      <span className="text-xs text-muted-foreground">
                                        {comment.author.profession}
                                      </span>
                                    )}
                                    {comment.author?.badge && (
                                      <span className="inline-flex items-center w-fit gap-1 px-2 py-0.5 bg-primary/10 text-primary text-[10px] rounded-full font-medium">
                                        {comment.author.badge}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 -mr-2">
                                    <span className="text-xs text-muted-foreground/70 font-medium whitespace-nowrap">
                                      {comment.createdAt ? formatTimeAgo(comment.createdAt) : 'Agora'}
                                    </span>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                          <MoreVertical className="w-3 h-3" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        {comment.author?.id === currentUser?.id ? (
                                          <DropdownMenuItem
                                            onClick={() => deleteCommentMutation.mutate(comment.id)}
                                            className="text-red-600"
                                          >
                                            <Trash2 className="w-3 h-3 mr-2" />
                                            Excluir
                                          </DropdownMenuItem>
                                        ) : (
                                          <DropdownMenuItem
                                            onClick={() => reportCommentMutation.mutate(comment.id)}
                                            className="text-red-600"
                                          >
                                            <Flag className="w-3 h-3 mr-2" />
                                            Denunciar
                                          </DropdownMenuItem>
                                        )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                                <p className="text-sm leading-relaxed text-foreground/90 mt-2">
                                  {(comment.content || '').split(' ').map((word: string, i: number) => {
                                    if (word.startsWith('@')) {
                                      const username = word.substring(1);
                                      // Tentar encontrar o usuário mencionado nos comentários
                                      const mentionedUser = currentComments.find((c: any) =>
                                        c.author?.name?.toLowerCase() === username.toLowerCase()
                                      )?.author;

                                      if (mentionedUser?.id) {
                                        return (
                                          <Link key={i} href={`/users/${mentionedUser.id}`}>
                                            <span className="text-primary dark:text-primary font-semibold hover:underline cursor-pointer">
                                              {word}{' '}
                                            </span>
                                          </Link>
                                        );
                                      }

                                      return (
                                        <span key={i} className="text-primary dark:text-primary font-semibold">
                                          {word}{' '}
                                        </span>
                                      );
                                    }
                                    return word + ' ';
                                  })}
                                </p>
                              </div>
                              <div className="flex items-center gap-4 mt-2 ml-2">
                                <button
                                  className={`text-xs transition-colors font-medium flex items-center gap-1 ${
                                    comment.userHasLiked
                                      ? 'text-primary dark:text-primary'
                                      : 'text-muted-foreground hover:text-primary dark:text-muted-foreground dark:hover:text-primary'
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
                                  <ThumbsUp className={`w-3 h-3 ${comment.userHasLiked ? 'fill-primary' : ''}`} />
                                  {comment.likeCount || 0}
                                </button>
                                <button
                                  className="text-xs text-muted-foreground hover:text-primary dark:text-muted-foreground dark:hover:text-primary transition-colors font-medium flex items-center gap-1"
                                  onClick={() => handleReply(comment)}
                                >
                                  <MessageCircle className="w-3 h-3" />
                                  Responder {replies.length > 0 && `(${replies.length})`}
                                </button>
                                {isPostAuthor && (
                                  <button
                                    className="text-xs text-muted-foreground hover:text-primary dark:text-muted-foreground dark:hover:text-primary transition-colors font-medium flex items-center gap-1"
                                    onClick={() => comment.isPinned ? unpinCommentMutation.mutate(comment.id) : pinCommentMutation.mutate(comment.id)}
                                    data-testid={`button-${comment.isPinned ? 'unpin' : 'pin'}-comment-${comment.id}`}
                                  >
                                    <Pin className="w-3 h-3" />
                                    {comment.isPinned ? 'Desfixar' : 'Fixar'}
                                  </button>
                                )}
                              </div>

                              {/* Respostas / Threads */}
                              {replies.length > 0 && (
                                <div className="mt-4 ml-4 space-y-3 border-l-2 border-border pl-4">
                                  {replies.map((reply) => (
                                    <div key={reply.id} className="flex gap-2">
                                      <Avatar className="w-8 h-8 ring-1 ring-border flex-shrink-0">
                                        <AvatarImage src={reply.author?.profileImageUrl || ''} alt={reply.author?.name} />
                                        <AvatarFallback className="bg-muted text-xs">
                                          {reply.author?.name?.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1">
                                        <div className="rounded-xl p-3 border border-border/30 relative">
                                          <div className="flex items-start justify-between mb-1">
                                            <div className="flex flex-col gap-0.5">
                                              <Link href={`/users/${reply.author?.id}`}>
                                                <p className="font-semibold text-xs hover:underline cursor-pointer">{reply.author?.name || 'Usuário'}</p>
                                              </Link>
                                              {reply.author?.profession && (
                                                <span className="text-[10px] text-muted-foreground">{reply.author.profession}</span>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <span className="text-xs text-muted-foreground/70 font-medium whitespace-nowrap">
                                                {reply.createdAt ? formatTimeAgo(reply.createdAt) : 'Agora'}
                                              </span>
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                                                    <MoreVertical className="w-3 h-3" />
                                                  </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                  {reply.author?.id === currentUser?.id ? (
                                                    <DropdownMenuItem
                                                      onClick={() => deleteCommentMutation.mutate(reply.id)}
                                                      className="text-red-600 text-xs"
                                                    >
                                                      <Trash2 className="w-3 h-3 mr-2" />
                                                      Excluir
                                                    </DropdownMenuItem>
                                                  ) : (
                                                    <DropdownMenuItem
                                                      onClick={() => reportCommentMutation.mutate(reply.id)}
                                                      className="text-red-600 text-xs"
                                                    >
                                                      <Flag className="w-3 h-3 mr-2" />
                                                      Denunciar
                                                    </DropdownMenuItem>
                                                  )}
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                            </div>
                                          </div>
                                          <p className="text-xs text-foreground/90 mt-1">
                                            {(reply.content || '').split(' ').map((word: string, i: number) => {
                                              if (word.startsWith('@')) {
                                                const username = word.substring(1);
                                                const mentionedUser = currentComments.find((c: any) =>
                                                  c.author?.name?.toLowerCase() === username.toLowerCase()
                                                )?.author;

                                                if (mentionedUser?.id) {
                                                  return (
                                                    <Link key={i} href={`/users/${mentionedUser.id}`}>
                                                      <span className="text-primary dark:text-primary font-semibold hover:underline cursor-pointer text-xs">
                                                        {word}{' '}
                                                      </span>
                                                    </Link>
                                                  );
                                                }

                                                return (
                                                  <span key={i} className="text-primary dark:text-primary font-semibold text-xs">
                                                    {word}{' '}
                                                  </span>
                                                );
                                              }
                                              return word + ' ';
                                            })}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2 ml-2">
                                          <button
                                            className={`text-xs transition-colors font-medium flex items-center gap-1 ${
                                              reply.userHasLiked
                                                ? 'text-primary dark:text-primary'
                                                : 'text-muted-foreground hover:text-primary dark:text-muted-foreground dark:hover:text-primary'
                                            } ${reply.id.startsWith('temp-') ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              if (!reply.id.startsWith('temp-')) {
                                                if (isDev) console.log('[ReplyLike] Curtindo resposta:', reply.id);
                                                likeCommentMutation.mutate(reply.id);
                                              }
                                            }}
                                            disabled={likeCommentMutation.isPending || reply.id.startsWith('temp-')}
                                            data-testid={`button-like-reply-${reply.id}`}
                                          >
                                            <ThumbsUp className={`w-3 h-3 ${reply.userHasLiked ? 'fill-primary' : ''}`} />
                                            <span>{reply.likeCount || 0}</span>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Comment */}
                <div className="flex gap-3 items-start">
                  <Avatar className="w-10 h-10 ring-2 ring-border">
                    <AvatarImage src={currentUser?.profileImageUrl || ''} alt="Seu perfil" />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                      {currentUser?.name?.charAt(0).toUpperCase() || 'V'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 flex gap-3">
                    <Textarea
                      placeholder="Escreva um comentário..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="min-h-[80px] resize-none text-sm py-3 px-4 rounded-2xl bg-muted/50 border-border/50 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                      data-testid={`input-comment-${post.id}`}
                      showEmojiPicker={true}
                      onEmojiSelect={(emoji) => setComment(comment + emoji)}
                    />
                    <Button
                      size="sm"
                      onClick={handleCommentSubmit}
                      disabled={!comment.trim() || addCommentMutation.isPending}
                      className="self-end h-10 px-4 bg-primary hover:bg-primary/90 rounded-xl"
                      data-testid={`button-submit-comment-${post.id}`}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Compartilhar Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-4 border">
              <p className="text-sm text-muted-foreground line-clamp-3">
                {post.content}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Adicionar comentário (opcional)</label>
              <Textarea
                placeholder="O que você pensa sobre isso?"
                value={shareComment}
                onChange={(e) => setShareComment(e.target.value)}
                className="min-h-[100px] resize-none"
                data-testid={`input-share-comment-${post.id}`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowShareDialog(false);
                setShareComment('');
              }}
              data-testid={`button-cancel-share-${post.id}`}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => shareMutation.mutate(shareComment || undefined)}
              disabled={shareMutation.isPending}
              data-testid={`button-confirm-share-${post.id}`}
            >
              {shareMutation.isPending ? 'Compartilhando...' : 'Compartilhar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Modal */}
      <Dialog open={!!showImageModal} onOpenChange={() => setShowImageModal(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden bg-black/40 backdrop-blur-sm border-none">
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={showImageModal || ''}
              alt="Imagem completa"
              className="max-w-full max-h-[95vh] object-contain rounded-lg shadow-2xl"
              onClick={() => setShowImageModal(null)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}