import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { formatTimeAgo } from '@/lib/formatTime';

interface CommentsModalProps {
  postId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: any;
}

export function CommentsModal({ postId, open, onOpenChange, user }: CommentsModalProps) {
  const { toast } = useToast();
  const [comment, setComment] = useState('');

  const { data: post } = useQuery({
    queryKey: [`/api/timeline/posts/${postId}`],
    enabled: !!postId && open,
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest('POST', `/api/timeline/posts/${postId}/comments`, { content });
    },
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({ queryKey: [`/api/timeline/posts/${postId}`] });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/timeline/posts'],
        exact: false 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/gamification/daily-activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gamification/weekly-challenges'] });
      toast({
        title: "Comentário adicionado",
        description: "Seu comentário foi publicado com sucesso!",
      });
    },
  });

  const handleSubmit = () => {
    if (!comment.trim()) return;
    addCommentMutation.mutate(comment.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]" data-testid="modal-comments">
        <DialogHeader>
          <DialogTitle>Comentários</DialogTitle>
        </DialogHeader>

        {post && (
          <div className="space-y-4">
            <div className="flex gap-3 pb-4 border-b">
              <Avatar className="w-10 h-10 ring-1 ring-primary" data-testid="img-post-author-avatar">
                <AvatarImage src={post.author?.profileImageUrl || ''} alt={post.author?.name} />
                <AvatarFallback className="bg-white dark:bg-card text-primary">
                  {post.author?.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h4 className="font-semibold text-sm" data-testid="text-post-author-name">
                  {post.author?.name}
                </h4>
                <p className="text-sm mt-1" data-testid="text-post-content">
                  {post.content}
                </p>
              </div>
            </div>

            <ScrollArea className="h-[300px]">
              <div className="space-y-4 pr-4">
                {post.comments && post.comments.length > 0 ? (
                  post.comments.map((c: any) => (
                    <div key={c.id} className="flex gap-3" data-testid={`comment-${c.id}`}>
                      <Avatar className="w-8 h-8 ring-1 ring-primary" data-testid={`img-comment-author-avatar-${c.id}`}>
                        <AvatarImage src={c.author?.profileImageUrl || ''} alt={c.author?.name} />
                        <AvatarFallback className="bg-white dark:bg-card text-primary text-xs">
                          {c.author?.name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <h5 className="font-semibold text-sm" data-testid={`text-comment-author-${c.id}`}>
                            {c.author?.name}
                          </h5>
                          <span className="text-xs text-muted-foreground" data-testid={`text-comment-time-${c.id}`}>
                            {c.createdAt && formatTimeAgo(c.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm" data-testid={`text-comment-content-${c.id}`}>
                          {c.content}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground text-sm py-8" data-testid="text-no-comments">
                    Nenhum comentário ainda. Seja o primeiro a comentar!
                  </p>
                )}
              </div>
            </ScrollArea>

            {user && (
              <div className="flex gap-3 pt-4 border-t">
                <Avatar className="w-8 h-8 ring-1 ring-primary" data-testid="img-user-avatar">
                  <AvatarImage src={user.profileImageUrl || ''} alt={user.name} />
                  <AvatarFallback className="bg-white dark:bg-card text-primary text-xs">
                    {user.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 flex gap-2">
                  <Textarea
                    placeholder="Escreva um comentário..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="min-h-[60px] resize-none"
                    data-testid="input-comment"
                  />
                  <Button 
                    size="sm"
                    onClick={handleSubmit}
                    disabled={!comment.trim() || addCommentMutation.isPending}
                    className="bg-teal-600 hover:bg-teal-700"
                    data-testid="button-send-comment"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
