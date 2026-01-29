import { useState, useEffect, useRef } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { useSocket } from '@/contexts/SocketContext';
import { UserCard } from '@/components/timeline/UserCard';
import { ActiveChallenges } from '@/components/timeline/ActiveChallenges';
import { WeeklyGoals } from '@/components/timeline/WeeklyGoals';
import { DailyMissions } from '@/components/timeline/DailyMissions';
import { SuggestedConnections } from '@/components/timeline/SuggestedConnections';
import { WeeklyRanking } from '@/components/timeline/WeeklyRanking';
import { TrendingTopics } from '@/components/timeline/TrendingTopics';
import { CreatePost } from '@/components/timeline/CreatePost';
import { TagFilters } from '@/components/timeline/TagFilters';
import { FeedTabs } from '@/components/timeline/FeedTabs';
import { PostCard } from '@/components/timeline/PostCard';
import { CommentsModal } from '@/components/timeline/CommentsModal';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import confetti from "canvas-confetti";
import { useTour } from '@/hooks/useTour';
import { timelineTour } from '@/config/tours';
import { TourOverlay } from '@/components/ui/tour/TourOverlay';
import { TourButton } from '@/components/ui/tour/TourButton';

export default function Timeline() {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('feed');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const hasScrolledToPost = useRef(false); // Track if we've already scrolled to a post from URL
  const confettiFiredRef = useRef(false); // Track if confetti has been fired
  const { on, off, isConnected } = useSocket();
  const tour = useTour(timelineTour);

  const { data: user, isLoading: isUserLoading } = useQuery({
    queryKey: ['/api/auth/user'],
  });

  // Ler tag da URL e sincronizar com mudanças de rota
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tagParam = params.get('tag');
    setActiveTag(tagParam);
  }, [location]);

  // Efeito de confetes de boas-vindas no primeiro acesso
  useEffect(() => {
    // Evitar disparar múltiplas vezes
    if (confettiFiredRef.current) return;
    
    // Aguardar o user carregar
    if (isUserLoading) return;
    
    const shouldShowConfetti = localStorage.getItem('show_welcome_confetti');

    if (shouldShowConfetti === 'true' && user) {
      // Marcar como disparado e remover flag imediatamente
      confettiFiredRef.current = true;
      localStorage.removeItem('show_welcome_confetti');

      // Aguardar um pouco para a página carregar
      setTimeout(() => {
        // Disparar confetes múltiplas vezes para efeito mais dramático
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

        function randomInRange(min: number, max: number) {
          return Math.random() * (max - min) + min;
        }

        const interval = setInterval(() => {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            clearInterval(interval);
            return;
          }

          const particleCount = 50 * (timeLeft / duration);

          // Confetes da esquerda
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
          });

          // Confetes da direita
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
          });
        }, 250);
      }, 500);
    }
  }, [user, isUserLoading]);


  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ['/api/timeline/posts', activeTab, activeTag],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams();
      params.append('feedType', activeTab);
      params.append('limit', '12');
      params.append('offset', pageParam.toString());
      if (activeTag) {
        params.append('tag', activeTag);
      }

      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/timeline/posts?${params.toString()}`, {
        cache: 'no-store',
        headers,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch posts');
      return res.json();
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < 12) return undefined;
      return allPages.length * 12;
    },
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
  });

  // ✅ WebSocket 100% - TODAS atualizações em tempo real SEM HTTP
  useEffect(() => {
    if (!isConnected) {
      return;
    }

    // Novo post - adicionar DIRETAMENTE via WebSocket (SEM invalidate)
    const handleNewPost = (post: any) => {
      queryClient.setQueriesData<any>(
        { queryKey: ['/api/timeline/posts'], exact: false },
        (oldData: any) => {
          if (!oldData?.pages) return oldData;

          // Adicionar post no INÍCIO da primeira página
          const newPages = [...oldData.pages];
          if (newPages[0]) {
            newPages[0] = [post, ...newPages[0]];
          } else {
            newPages[0] = [post];
          }

          return {
            ...oldData,
            pages: newPages,
          };
        }
      );
    };

    // Nova reação - atualizar contadores via WebSocket
    const handlePostReaction = ({ postId, likeDelta, dislikeDelta }: any) => {
      queryClient.setQueriesData<any>(
        { queryKey: ['/api/timeline/posts'], exact: false },
        (oldData: any) => {
          if (!oldData?.pages) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page: any[]) =>
              page.map((post: any) => {
                if (post.id === postId) {
                  return {
                    ...post,
                    likeCount: Math.max(0, (post.likeCount || 0) + (likeDelta || 0)),
                    dislikeCount: Math.max(0, (post.dislikeCount || 0) + (dislikeDelta || 0)),
                  };
                }
                return post;
              })
            ),
          };
        }
      );
    };

    // Novo comentário - incrementar contador e adicionar comentário via WebSocket
    const handleNewComment = ({ postId, comment }: any) => {
      // Validar se o comentário tem dados completos antes de processar
      if (!comment || !comment.id || !comment.author) {
        return;
      }

      queryClient.setQueriesData<any>(
        { queryKey: ['/api/timeline/posts'], exact: false },
        (oldData: any) => {
          if (!oldData?.pages) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page: any[]) =>
              page.map((post: any) => {
                if (post.id === postId) {
                  // Verificar se o comentário já existe (pode ser temporário ou real)
                  const existingComments = post.comments || [];
                  const commentExists = existingComments.some((c: any) => 
                    c.id === comment.id || 
                    (c.id?.startsWith('temp-') && c.content === comment.content && c.userId === comment.userId)
                  );

                  if (commentExists) {
                    // Se existe temporário, substituir pelo real mantendo a posição no início
                    const updatedComments = existingComments.map((c: any) =>
                      (c.id?.startsWith('temp-') && c.content === comment.content && c.userId === comment.userId) 
                        ? comment 
                        : (c.id === comment.id ? comment : c)
                    );

                    return {
                      ...post,
                      commentCount: post.commentCount || 0, // Não incrementar, já foi incrementado
                      comments: updatedComments,
                    };
                  } else {
                    // Comentário novo de outro usuário - adicionar no INÍCIO da lista
                    return {
                      ...post,
                      commentCount: (post.commentCount || 0) + 1,
                      comments: [comment, ...existingComments],
                    };
                  }
                }
                return post;
              })
            ),
          };
        }
      );
    };

    // Like em comentário - atualizar via WebSocket (recursivamente para respostas)
    const handleCommentLike = ({ postId, commentId, likeCount, userHasLiked }: any) => {
      queryClient.setQueriesData<any>(
        { queryKey: ['/api/timeline/posts'], exact: false },
        (oldData: any) => {
          if (!oldData?.pages) return oldData;

          // Função recursiva para atualizar comentários e respostas
          const updateCommentRecursive = (comments: any[]): any[] => {
            return comments.map((c: any) => {
              if (c.id === commentId) {
                return {
                  ...c,
                  likeCount,
                  userHasLiked,
                };
              }
              // Atualizar respostas recursivamente
              if (c.replies && c.replies.length > 0) {
                return {
                  ...c,
                  replies: updateCommentRecursive(c.replies)
                };
              }
              return c;
            });
          };

          return {
            ...oldData,
            pages: oldData.pages.map((page: any[]) =>
              page.map((post: any) => {
                if (post.id === postId && post.comments) {
                  return {
                    ...post,
                    comments: updateCommentRecursive(post.comments),
                  };
                }
                return post;
              })
            ),
          };
        }
      );
    };

    on('new_post', handleNewPost);
    on('post_reaction', handlePostReaction);
    on('new_comment', handleNewComment);
    on('comment_like', handleCommentLike);

    // Cleanup on component unmount
    return () => {
      off('new_post', handleNewPost);
      off('post_reaction', handlePostReaction);
      off('new_comment', handleNewComment);
      off('comment_like', handleCommentLike);
    };
  }, [isConnected, on, off]);

  const posts = data?.pages.flatMap(page => page) || [];

  // Handle URL parameters for post navigation (from notifications)
  useEffect(() => {
    if (hasScrolledToPost.current || isLoading || posts.length === 0) return;

    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('post');
    const hash = window.location.hash;

    if (postId) {
      hasScrolledToPost.current = true;

      // Wait a bit for the page to render
      setTimeout(() => {
        // Find the post element
        const postElement = document.querySelector(`[data-post-id="${postId}"]`);

        if (postElement) {
          // Scroll to the post
          postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Highlight the post
          postElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
          setTimeout(() => {
            postElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
          }, 3000);

          // If there's a comment hash, scroll to that comment after a delay
          if (hash && hash.startsWith('#comment-')) {
            setTimeout(() => {
              const commentId = hash.replace('#comment-', '');
              const commentElement = document.getElementById(`comment-${commentId}`);

              if (commentElement) {
                commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                commentElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
                setTimeout(() => {
                  commentElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
                }, 3000);
              }
            }, 1000);
          }

          // Clean up URL
          window.history.replaceState({}, '', window.location.pathname);
        } else {
          // Post not found in current feed, might need to open comments modal
          setSelectedPostId(postId);

          // Clean up URL
          window.history.replaceState({}, '', window.location.pathname);
        }
      }, 500);
    }
  }, [posts, isLoading]);

  // Intersection Observer para carregamento infinito
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


  return (
    <>
      <TourOverlay
        isActive={tour.isActive}
        step={tour.getCurrentStep()}
        elementRef={tour.getCurrentElement()}
        position={tour.getCurrentStep()?.position}
        currentStep={tour.currentStep}
        totalSteps={tour.totalSteps}
        onNext={tour.next}
        onPrev={tour.prev}
        onSkip={tour.skip}
      />

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900" id="timeline-main">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-6">
          {/* Tour Button */}
          <div className="flex justify-end mb-4">
            <TourButton onClick={tour.start} label="Conhecer a plataforma" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-6">
            {/* Sidebar Esquerda - Oculta no mobile */}
            <aside className="hidden lg:block lg:col-span-3 space-y-4">
              <div data-testid="user-card-section">
                <UserCard />
              </div>
              <div data-testid="daily-missions-section">
                <DailyMissions />
              </div>
              <div data-testid="weekly-challenges-section">
                <ActiveChallenges />
              </div>
              <div data-testid="weekly-goals-section">
                <WeeklyGoals />
              </div>
            </aside>

            {/* Conteúdo Principal */}
            <main className="lg:col-span-6 space-y-2 sm:space-y-4">
              <div data-testid="create-post-area">
                <CreatePost />
              </div>

              <div data-testid="feed-tabs-container">
                <FeedTabs
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                />
              </div>

              {activeTab === 'feed' && (
                <div data-testid="tag-filters-container">
                  <TagFilters
                    activeTag={activeTag}
                    onTagChange={(tag) => {
                      setActiveTag(tag);
                      if (tag) {
                        setLocation(`/timeline?tag=${encodeURIComponent(tag)}`);
                      } else {
                        setLocation('/timeline');
                      }
                    }}
                  />
                </div>
              )}

              <div className="space-y-2 sm:space-y-4" data-testid="posts-list">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4">
                      <div className="flex gap-2 sm:gap-3">
                        <Skeleton className="w-10 h-10 sm:w-12 sm:h-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-3 sm:h-4 w-24 sm:w-32" />
                          <Skeleton className="h-2 sm:h-3 w-20 sm:w-24" />
                        </div>
                      </div>
                      <Skeleton className="h-16 sm:h-20 w-full" />
                    </div>
                  ))
                ) : posts.length === 0 ? (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-8 sm:p-12 text-center" data-testid="no-posts">
                    <p className="text-sm sm:text-base text-muted-foreground">
                      Nenhum post encontrado. Seja o primeiro a compartilhar algo!
                    </p>
                  </div>
                ) : (
                  <>
                    {posts.map((post: any) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        currentUser={user}
                        onOpenComments={() => setSelectedPostId(post.id)}
                      />
                    ))}

                    {/* Elemento de trigger para carregamento infinito */}
                    <div ref={loadMoreRef} className="py-2 sm:py-4">
                      {isFetchingNextPage && (
                        <div className="flex justify-center">
                          <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-primary" />
                        </div>
                      )}
                      {!hasNextPage && posts.length > 0 && (
                        <p className="text-center text-xs sm:text-sm text-muted-foreground">
                          Você viu todos os posts disponíveis
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </main>

            {/* Sidebar Direita - Oculta no mobile */}
            <aside className="hidden lg:block lg:col-span-3 space-y-4">
              <div data-testid="weekly-ranking-section">
                <WeeklyRanking />
              </div>
              <div data-testid="suggested-connections-section">
                <SuggestedConnections />
              </div>
              <div data-testid="trending-topics-section">
                <TrendingTopics />
              </div>
            </aside>
          </div>
        </div>
      </div>

      <CommentsModal
        postId={selectedPostId}
        open={!!selectedPostId}
        onOpenChange={(open) => !open && setSelectedPostId(null)}
        user={user}
      />
    </>
  );
}