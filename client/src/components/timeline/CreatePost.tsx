import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ImagePlus, Send, FileText, Video, X, Hash } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export function CreatePost() {
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoLink, setVideoLink] = useState('');
  const [linkPreview, setLinkPreview] = useState<any>(null);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showHashtagSuggestions, setShowHashtagSuggestions] = useState(false);
  const [hashtagSuggestions, setHashtagSuggestions] = useState<any[]>([]);
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const [currentHashtag, setCurrentHashtag] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Buscar tags populares
  const { data: trendingTags = [] } = useQuery({
    queryKey: ['/api/timeline/trending-tags'],
  });

  // Detectar hashtags enquanto digita
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = content.substring(0, cursorPos);
    const lastHashIndex = textBeforeCursor.lastIndexOf('#');

    if (lastHashIndex === -1) {
      setShowHashtagSuggestions(false);
      return;
    }

    const textAfterHash = content.substring(lastHashIndex + 1, cursorPos);
    const hasSpace = textAfterHash.includes(' ') || textAfterHash.includes('\n');

    if (hasSpace) {
      setShowHashtagSuggestions(false);
      return;
    }

    setCurrentHashtag(textAfterHash);

    if (textAfterHash.length > 0) {
      const filtered = trendingTags
        .filter((tag: any) => tag.name.toLowerCase().startsWith(textAfterHash.toLowerCase()))
        .slice(0, 5);
      
      setHashtagSuggestions(filtered);
      setShowHashtagSuggestions(filtered.length > 0);
    } else {
      setHashtagSuggestions(trendingTags.slice(0, 5));
      setShowHashtagSuggestions(true);
    }
  }, [content, cursorPosition, trendingTags]);

  // Detectar URLs no conteúdo e carregar preview automaticamente
  useEffect(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = content.match(urlRegex);

    if (urls && urls.length > 0 && !linkPreview && !loadingPreview) {
      const url = urls[0]; // Pegar o primeiro link encontrado

      // Validar se é uma URL válida antes de processar
      let validUrl: URL;
      try {
        validUrl = new URL(url);
      } catch {
        return;
      }

      // Verificar se é um link de vídeo
      const videoUrlPattern = /(youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com)/i;
      if (videoUrlPattern.test(url)) {
        return; // Não carregar preview para vídeos
      }

      // Carregar preview do link automaticamente
      const loadPreview = async () => {
        setLoadingPreview(true);
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // Timeout de 10 segundos

          const response = await apiRequest('POST', '/api/link-preview', { url }, {
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          const preview = await response.json();

          // Só setar preview se tiver dados válidos
          if (preview && preview.url && preview.title) {
            setLinkPreview(preview);
          }
        } catch (error: any) {
        } finally {
          setLoadingPreview(false);
        }
      };

      // Debounce para evitar múltiplas requisições
      const timer = setTimeout(loadPreview, 1500);
      return () => clearTimeout(timer);
    }
  }, [content, linkPreview, loadingPreview]);

  const handleHashtagSelect = (tagName: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = content.substring(0, cursorPos);
    const lastHashIndex = textBeforeCursor.lastIndexOf('#');
    const textAfterCursor = content.substring(cursorPos);

    const newContent = content.substring(0, lastHashIndex + 1) + tagName + ' ' + textAfterCursor;
    setContent(newContent);
    setShowHashtagSuggestions(false);

    setTimeout(() => {
      const newCursorPos = lastHashIndex + tagName.length + 2;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setCursorPosition(e.target.selectionStart);
  };

  const createPostMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest('POST', '/api/timeline/posts', formData);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/timeline/posts'],
        exact: false,
        refetchType: 'all'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/gamification/daily-activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gamification/weekly-challenges'] });
      setContent('');
      setImageFile(null);
      setDocumentFile(null);
      setImagePreview(null);
      setVideoLink('');
      setLinkPreview(null);
      toast({
        title: 'Publicado!',
        description: 'Seu post foi publicado com sucesso.',
      });
    },
    onError: (error: any) => {
      const errorData = error?.response?.data || error;
      toast({
        title: '❌ Conteúdo bloqueado',
        description: errorData.suggestion || errorData.message || 'Seu post contém conteúdo inadequado.',
        variant: 'destructive',
      });
    },
  });

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Tipo de arquivo inválido',
        description: 'Use apenas imagens (JPG, PNG, GIF, WEBP, AVIF)',
        variant: 'destructive',
      });
      return;
    }

    const maxSize = 4 * 1024 * 1024; // 4MB
    if (file.size > maxSize) {
      toast({
        title: 'Imagem muito grande!',
        description: 'Tamanho máximo: 4MB. Escolha uma imagem menor.',
        variant: 'destructive',
      });
      return;
    }

    // Sempre otimizar imagem com qualidade 95%
    try {
      const imageCompression = (await import('browser-image-compression')).default;

      const options = {
        maxSizeMB: 3.5, // Limite próximo ao máximo para manter qualidade
        maxWidthOrHeight: 2560, // Resolução maior para manter detalhes
        useWebWorker: true,
        initialQuality: 0.95, // Qualidade 95%
        fileType: 'image/webp', // Converter para WebP (melhor compressão)
        preserveExif: false, // Remover metadados desnecessários
      };

      toast({
        title: 'Aguarde, fazendo upload...',
        description: 'Processando sua imagem',
      });

      const compressedFile = await imageCompression(file, options);

      // Validação: garantir que não excede 4MB
      if (compressedFile.size > 4 * 1024 * 1024) {
        toast({
          title: 'Erro',
          description: `A imagem está muito grande (${(compressedFile.size / 1024 / 1024).toFixed(2)}MB). Use uma imagem menor.`,
          variant: 'destructive',
        });
        return;
      }

      setImageFile(compressedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(compressedFile);

      toast({
        title: 'Imagem adicionada!',
        description: 'Pronta para publicar',
      });
    } catch (error) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      toast({
        title: 'Aviso',
        description: 'Não foi possível otimizar a imagem. Usando original.',
        variant: 'default',
      });
    }
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast({
        title: 'Documento muito grande!',
        description: 'Tamanho máximo: 10MB. Escolha um arquivo menor.',
        variant: 'destructive',
      });
      return;
    }

    const validExtensions = ['.pdf', '.txt', '.zip', '.doc', '.docx', '.rar'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(fileExtension)) {
      toast({
        title: 'Tipo de arquivo não suportado',
        description: 'Use: PDF, TXT, ZIP, DOC, DOCX, RAR',
        variant: 'destructive',
      });
      return;
    }

    setDocumentFile(file);
    toast({
      title: 'Documento anexado',
      description: `${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`,
    });
  };

  const handleVideoLink = () => {
    if (!videoLink.trim()) {
      toast({
        title: 'Link inválido',
        description: 'Digite um link de vídeo válido',
        variant: 'destructive',
      });
      return;
    }

    const videoUrlPattern = /(youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com)/i;
    if (!videoUrlPattern.test(videoLink)) {
      toast({
        title: 'Link não suportado',
        description: 'Use links do YouTube, Vimeo ou Dailymotion',
        variant: 'destructive',
      });
      return;
    }

    setShowVideoDialog(false);
    toast({
      title: 'Vídeo adicionado!',
      description: 'Link do vídeo foi anexado ao post',
    });
  };



  const extractHashtags = (text: string): string[] => {
    const hashtagRegex = /#(\w+)/g;
    const matches = text.match(hashtagRegex);
    if (!matches) return [];
    return [...new Set(matches.map(tag => tag.substring(1).toLowerCase()))];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() && !imageFile && !documentFile && !videoLink && !linkPreview) {
      toast({
        title: 'Erro',
        description: 'Adicione conteúdo, imagem, documento, vídeo ou link ao seu post.',
        variant: 'destructive',
      });
      return;
    }

    const formData = new FormData();

    let validContent = '';
    if (content && content.trim()) {
      validContent = content.trim();
    } else if (imageFile) {
      validContent = '📷';
    } else if (documentFile) {
      validContent = '📎';
    } else if (videoLink) {
      validContent = '🎥';
    } else if (linkPreview) {
      validContent = '🔗';
    } else {
      validContent = ' ';
    }

    formData.append('content', validContent);

    // Extrair hashtags do conteúdo
    const hashtags = extractHashtags(validContent);
    if (hashtags.length > 0) {
      formData.append('tags', JSON.stringify(hashtags));
    }

    if (imageFile) {
      formData.append('media', imageFile);
    }

    if (documentFile) {
      formData.append('media', documentFile);
    }

    if (videoLink) {
      formData.append('videoLink', videoLink);
    }

    if (linkPreview) {
      formData.append('linkPreview', JSON.stringify(linkPreview));
    }

    createPostMutation.mutate(formData);
  };

  return (
    <Card data-testid="card-create-post">
      <CardContent className="p-3 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-4">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && showHashtagSuggestions) {
                  setShowHashtagSuggestions(false);
                  e.preventDefault();
                }
              }}
              placeholder="Compartilhe algo interessante... Use # para adicionar hashtags!"
              className="min-h-[80px] sm:min-h-[150px] resize-none text-xs sm:text-sm"
              data-testid="input-post-content"
              showEmojiPicker={true}
              onEmojiSelect={(emoji) => setContent(content + emoji)}
            />
            
            {showHashtagSuggestions && hashtagSuggestions.length > 0 && (
              <div className="absolute z-50 mt-1 w-full max-w-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                <div className="p-2">
                  <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
                    <Hash className="w-3 h-3 inline mr-1" />
                    Tags sugeridas
                  </div>
                  <div className="space-y-1">
                    {hashtagSuggestions.map((tag: any) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleHashtagSelect(tag.name)}
                        className="w-full text-left px-3 py-2 rounded hover:bg-accent transition-colors text-sm flex items-center justify-between group"
                      >
                        <span className="font-medium">#{tag.name}</span>
                        <Badge variant="secondary" className="text-xs opacity-60 group-hover:opacity-100">
                          {tag.postCount || 0} posts
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {imagePreview && (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Preview"
                className="max-h-64 rounded-lg object-cover"
                data-testid="img-post-preview"
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => {
                  setImageFile(null);
                  setImagePreview(null);
                }}
                data-testid="button-remove-image"
              >
                Remover
              </Button>
            </div>
          )}

          {documentFile && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <FileText className="h-5 w-5" />
              <span className="text-sm flex-1">{documentFile.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDocumentFile(null)}
                data-testid="button-remove-document"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {videoLink && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Video className="h-5 w-5" />
              <span className="text-sm flex-1 truncate">{videoLink}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setVideoLink('')}
                data-testid="button-remove-video"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {loadingPreview && (
            <div className="border rounded-lg p-3 flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
              <span className="text-sm text-muted-foreground">Carregando preview do link...</span>
            </div>
          )}

          {linkPreview && !loadingPreview && (
            <div className="border rounded-lg p-3 flex gap-3">
              {linkPreview.image && (
                <img src={linkPreview.image} alt="" className="w-20 h-20 object-cover rounded" />
              )}
              <div className="flex-1">
                <h4 className="font-semibold text-sm">{linkPreview.title}</h4>
                {linkPreview.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{linkPreview.description}</p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLinkPreview(null)}
                data-testid="button-remove-link"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('post-image-upload')?.click()}
                data-testid="button-add-image"
                className="relative"
              >
                <ImagePlus className="h-4 w-4" />
              </Button>
              <input
                id="post-image-upload"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif"
                className="hidden"
                onChange={handleImageChange}
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('post-document-upload')?.click()}
                data-testid="button-add-document"
              >
                <FileText className="h-4 w-4" />
              </Button>
              <input
                id="post-document-upload"
                type="file"
                accept=".pdf,.txt,.zip,.doc,.docx,.rar"
                className="hidden"
                onChange={handleDocumentChange}
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowVideoDialog(true)}
                data-testid="button-add-video"
              >
                <Video className="h-4 w-4" />
              </Button>
            </div>

            <Button
              type="submit"
              disabled={createPostMutation.isPending}
              data-testid="button-publish-post"
            >
              {createPostMutation.isPending ? (
                'Publicando...'
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Publicar
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>

      {/* Dialog para adicionar vídeo */}
      <Dialog open={showVideoDialog} onOpenChange={setShowVideoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Vídeo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Cole o link do vídeo (YouTube, Vimeo, etc.)"
              value={videoLink}
              onChange={(e) => setVideoLink(e.target.value)}
              data-testid="input-video-link"
            />
            <p className="text-sm text-muted-foreground">
              Suportado: YouTube, Vimeo, Dailymotion
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVideoDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleVideoLink} data-testid="button-confirm-video">
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </Card>
  );
}