import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  MessageSquare,
  ThumbsUp,
  Eye,
  Plus,
  Search,
  TrendingUp,
  Pin,
  Filter,
  ChevronDown,
  Share2,
  Trophy,
  Medal,
  Award,
  Flame,
  MessageCircle,
  ImagePlus,
  X,
  Hash,
  ChevronUp,
  FileText
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { formatTimeAgo } from '@/lib/formatTime';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

interface Topic {
  id: number;
  title: string;
  content: string;
  author: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  category: string;
  isPinned: boolean;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
}

export default function Forum() {
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [newTopic, setNewTopic] = useState({
    title: '',
    content: '',
    categoryId: '',
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<Array<{ id: string; name: string; usageCount: number }>>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [loadingTagSuggestions, setLoadingTagSuggestions] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [videoLink, setVideoLink] = useState('');
  const [linkPreview, setLinkPreview] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState('recentes');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Auto-load link preview from content
  useEffect(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = newTopic.content.match(urlRegex);

    if (urls && urls.length > 0 && !linkPreview && !loadingPreview) {
      const url = urls[0];

      let validUrl: URL;
      try {
        validUrl = new URL(url);
      } catch {
        return;
      }

      const videoUrlPattern = /(youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com)/i;
      if (videoUrlPattern.test(url)) {
        return;
      }

      const loadPreview = async () => {
        setLoadingPreview(true);
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const response = await fetch('/api/link-preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          const preview = await response.json();
          if (preview && preview.url && preview.title) {
            setLinkPreview(preview);
          }
        } catch (error: any) {
        } finally {
          setLoadingPreview(false);
        }
      };

      const timer = setTimeout(loadPreview, 1500);
      return () => clearTimeout(timer);
    }
  }, [newTopic.content, linkPreview, loadingPreview]);

  const { data: categories = [] } = useQuery({
    queryKey: ['/api/categories'],
  });

  const handleAttachmentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
      'application/pdf', 'text/plain',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip', 'application/x-rar-compressed'
    ];

    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Tipo de arquivo inválido',
        description: 'Arquivos permitidos: imagens, PDF, DOC, DOCX, XLS, XLSX, TXT, ZIP, RAR',
        variant: 'destructive',
      });
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast({
        title: 'Arquivo muito grande!',
        description: 'Tamanho máximo: 10MB',
        variant: 'destructive',
      });
      return;
    }

    setAttachmentFile(file);

    // Preview apenas para imagens
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachmentPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setAttachmentPreview(null);
    }

    toast({
      title: 'Arquivo anexado',
      description: `${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`,
    });
  };

  const createTopicMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest('POST', '/api/forum/topics', formData);
      return response;
    },
    onSuccess: (topic: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/forum/topics'] });
      resetForm();
      toast({
        title: 'Tópico criado!',
        description: 'Seu tópico foi publicado com sucesso.',
      });

      // Redirecionar para o tópico usando o slug
      if (topic && topic.slug) {
        setTimeout(() => {
          navigate(`/forum/${topic.slug}`);
        }, 500);
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar tópico',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newTopic.title.trim() || !newTopic.content.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Título e conteúdo são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    if (!newTopic.categoryId) {
      toast({
        title: 'Categoria obrigatória',
        description: 'Selecione uma categoria para o tópico.',
        variant: 'destructive',
      });
      return;
    }

    const formData = new FormData();
    formData.append('title', newTopic.title);
    formData.append('content', newTopic.content);
    formData.append('categoryId', newTopic.categoryId);
    formData.append('tags', JSON.stringify(selectedTags));

    if (attachmentFile) {
      formData.append('attachment', attachmentFile);
    }

    if (videoLink.trim()) {
      formData.append('videoLink', videoLink.trim());
    }

    if (linkPreview) {
      formData.append('linkPreview', JSON.stringify(linkPreview));
    }

    createTopicMutation.mutate(formData);
  };

  const resetForm = () => {
    setIsCreateFormOpen(false);
    setNewTopic({ title: '', content: '', categoryId: '', tags: [] });
    setSelectedTags([]);
    setAttachmentFile(null);
    setAttachmentPreview(null);
    setVideoLink('');
    setLinkPreview(null);
    setTagInput('');
    if (quillRef.current) {
      quillRef.current.off('text-change');
      if (quillRef.current.root) {
        quillRef.current.root.innerHTML = '';
      }
      quillRef.current = null;
    }
  };

  const quillRef = useRef<Quill | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const { data: topics = [], isLoading } = useQuery({
    queryKey: ['/api/forum/topics'],
  });

  const { data: tags = [] } = useQuery({
    queryKey: ['/api/forum/trending-tags'],
  });

  const { data: topContributors = [] } = useQuery({
    queryKey: ['/api/users/ranking'],
  });

  // Query para estatísticas reais do fórum
  const { data: forumStats } = useQuery({
    queryKey: ['/api/forum/stats'],
  });

  useEffect(() => {
    if (isCreateFormOpen && editorRef.current && !quillRef.current) {
      quillRef.current = new Quill(editorRef.current, {
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
      quillRef.current.on('text-change', () => {
        const content = quillRef.current?.root.innerHTML || '';
        setNewTopic(prev => ({ ...prev, content }));
      });
    }

    if (!isCreateFormOpen && quillRef.current) {
      quillRef.current.off('text-change');
      if (quillRef.current.root) {
        quillRef.current.root.innerHTML = '';
      }
      quillRef.current = null;
    }
  }, [isCreateFormOpen]);


  useEffect(() => {
    const searchTags = async () => {
      if (!tagInput.trim() || tagInput.trim().length < 1) {
        setTagSuggestions([]);
        setShowTagSuggestions(false);
        return;
      }

      setLoadingTagSuggestions(true);
      try {
        const response = await fetch(`/api/forum/tags/search?q=${encodeURIComponent(tagInput.trim())}&limit=10`);
        const data = await response.json();

        const filtered = data.filter((tag: any) => 
          !selectedTags.includes(tag.name.toLowerCase())
        );

        setTagSuggestions(filtered);
        setShowTagSuggestions(filtered.length > 0);
      } catch (error) {
        setTagSuggestions([]);
      } finally {
        setLoadingTagSuggestions(false);
      }
    };

    const debounceTimer = setTimeout(searchTags, 300);
    return () => clearTimeout(debounceTimer);
  }, [tagInput, selectedTags]);

  const handleAddTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (trimmedTag && !selectedTags.includes(trimmedTag) && selectedTags.length < 5) {
      const updatedTags = [...selectedTags, trimmedTag];
      setSelectedTags(updatedTags);
      setNewTopic(prev => ({ ...prev, tags: updatedTags }));
      setTagInput('');
      setShowTagSuggestions(false);

      toast({
        title: '✨ Tag adicionada',
        description: `Tag "${trimmedTag}" foi adicionada com sucesso`,
        duration: 2000,
      });
    } else if (selectedTags.length >= 5) {
      toast({
        title: '⚠️ Limite atingido',
        description: 'Você já adicionou o máximo de 5 tags',
        variant: 'destructive',
        duration: 2000,
      });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = selectedTags.filter(tag => tag !== tagToRemove);
    setSelectedTags(updatedTags);
    setNewTopic(prev => ({ ...prev, tags: updatedTags }));

    toast({
      title: '🗑️ Tag removida',
      description: `Tag "${tagToRemove}" foi removida`,
      duration: 1500,
    });
  };


  const filteredTopics = topics
    .filter((topic: any) => {
      const matchesSearch = topic.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           topic.content?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || !selectedCategory || topic.categoryId === selectedCategory;
      const matchesTag = !selectedTag || topic.tags?.some((tag: any) => tag.name.toLowerCase() === selectedTag.toLowerCase());
      return matchesSearch && matchesCategory && matchesTag;
    })
    .sort((a: any, b: any) => {
      if (selectedFilter === 'recentes') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (selectedFilter === 'em-alta') {
        return (b.viewCount || 0) - (a.viewCount || 0);
      } else if (selectedFilter === 'fixados') {
        return (b.isSticky ? 1 : 0) - (a.isSticky ? 1 : 0);
      } else if (selectedFilter === 'sem-resposta') {
        return (a.replyCount || 0) - (b.replyCount || 0);
      }
      return 0;
    });

  const trendingTags = tags.slice(0, 10);

  const shareToTimeline = (topic: any) => {
    toast({
      title: "Compartilhado!",
      description: "Discussão compartilhada na sua timeline.",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Content */}
          <main className="lg:col-span-9 space-y-4">
            {/* Header */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
                  <div>
                    <h1 className="text-2xl font-bold">Fórum da Comunidade</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      Compartilhe conhecimento e tire suas dúvidas
                    </p>
                  </div>
                  <Button
                    onClick={() => setIsCreateFormOpen(!isCreateFormOpen)}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                    data-testid="button-new-topic"
                  >
                    {isCreateFormOpen ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {isCreateFormOpen ? 'Fechar' : 'Nova Discussão'}
                  </Button>
                </div>

                {/* Filtros de ordenação */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  <Button
                    variant={selectedFilter === 'recentes' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedFilter('recentes')}
                    className="gap-2"
                  >
                    <Flame className="w-4 h-4" />
                    <span>Em Alta</span>
                  </Button>
                  <Button
                    variant={selectedFilter === 'em-alta' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedFilter('em-alta')}
                    className="gap-2"
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span>Tendências</span>
                  </Button>
                  <Button
                    variant={selectedFilter === 'fixados' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedFilter('fixados')}
                    className="gap-2"
                  >
                    <Pin className="w-4 h-4" />
                    <span>Fixados</span>
                  </Button>
                  <Button
                    variant={selectedFilter === 'sem-resposta' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedFilter('sem-resposta')}
                    className="gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Sem Resposta</span>
                  </Button>
                </div>

                {/* Indicador de filtros ativos */}
                {(selectedCategory && selectedCategory !== 'all' || selectedTag) && (
                  <div className="flex items-center gap-2 pt-3 border-t mt-2">
                    <span className="text-xs text-muted-foreground">Filtrando por:</span>
                    {selectedCategory && selectedCategory !== 'all' && (
                      <Badge
                        variant="secondary"
                        className="gap-1"
                      >
                        {categories.find((c: any) => c.id === selectedCategory)?.name}
                        <button
                          onClick={() => setSelectedCategory(null)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    )}
                    {selectedTag && (
                      <Badge
                        variant="outline"
                        className="gap-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                      >
                        #{selectedTag}
                        <button
                          onClick={() => setSelectedTag(null)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => {
                        setSelectedCategory(null);
                        setSelectedTag(null);
                      }}
                    >
                      Limpar filtros
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Formulário de Criação Inline */}
            {isCreateFormOpen && (
              <Card className="border-2 border-emerald-500/20 shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Criar Nova Discussão</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Título</Label>
                    <Input
                      id="title"
                      placeholder="Digite o título da discussão..."
                      value={newTopic.title}
                      onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })}
                      data-testid="input-topic-title"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Select
                      value={newTopic.categoryId}
                      onValueChange={(value) => setNewTopic({ ...newTopic, categoryId: value })}
                    >
                      <SelectTrigger data-testid="select-category">
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat: any) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Conteúdo</Label>
                    <div ref={editorRef} className="bg-white dark:bg-gray-950 rounded-md border min-h-[200px]" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="topic-tags" className="flex items-center gap-2">
                        <Hash className="w-4 h-4" />
                        Tags
                      </Label>
                      <span className={`text-xs font-medium ${selectedTags.length >= 5 ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {selectedTags.length}/5
                      </span>
                    </div>

                    {selectedTags.length > 0 && (
                      <div className="flex gap-2 flex-wrap p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-200 dark:border-gray-800 animate-in fade-in duration-300">
                        {selectedTags.map((tag, index) => (
                          <div
                            key={index}
                            className="group inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full shadow-sm hover:shadow-md transition-all duration-200 animate-in slide-in-from-bottom-2"
                            style={{ animationDelay: `${index * 50}ms` }}
                            data-testid={`tag-selected-${tag}`}
                          >
                            <Hash className="w-3 h-3" />
                            <span className="text-sm font-medium">{tag}</span>
                            <button
                              onClick={() => handleRemoveTag(tag)}
                              className="ml-1 p-0.5 rounded-full hover:bg-emerald-200/50 dark:hover:bg-emerald-800/50 transition-colors"
                              data-testid={`button-remove-tag-${tag}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="relative">
                      <Input
                        ref={tagInputRef}
                        id="topic-tags"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            if (tagInput.trim()) {
                              handleAddTag(tagInput);
                            }
                          } else if (e.key === 'Backspace' && !tagInput && selectedTags.length > 0) {
                            e.preventDefault();
                            const lastTag = selectedTags[selectedTags.length - 1];
                            handleRemoveTag(lastTag);
                          }
                        }}
                        onFocus={() => {
                          if (tagInput.trim()) {
                            setShowTagSuggestions(true);
                          }
                        }}
                        onBlur={() => {
                          setTimeout(() => setShowTagSuggestions(false), 200);
                        }}
                        placeholder={
                          selectedTags.length >= 5
                            ? 'Limite de 5 tags atingido'
                            : 'Digite para buscar tags (Enter ou vírgula para adicionar)'
                        }
                        disabled={selectedTags.length >= 5}
                        className={`${selectedTags.length >= 5 ? 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800' : ''}`}
                        data-testid="input-tag-search"
                      />

                      {loadingTagSuggestions && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="animate-spin h-4 w-4 border-2 border-emerald-500 border-t-transparent rounded-full" />
                        </div>
                      )}

                      {showTagSuggestions && tagSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-2 bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-950/20 dark:to-blue-950/20 border-b border-gray-200 dark:border-gray-800">
                            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              Sugestões de tags
                            </p>
                          </div>
                          <div className="max-h-60 overflow-y-auto">
                            {tagSuggestions.map((tag) => (
                              <button
                                key={tag.id}
                                onClick={() => handleAddTag(tag.name)}
                                className="w-full px-3 py-2 flex items-center justify-between hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors text-left group"
                                data-testid={`suggestion-tag-${tag.name}`}
                              >
                                <div className="flex items-center gap-2">
                                  <Hash className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                  <span className="text-sm font-medium group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                                    {tag.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                                    {tag.usageCount} {tag.usageCount === 1 ? 'post' : 'posts'}
                                  </span>
                                  <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {showTagSuggestions && tagSuggestions.length === 0 && tagInput.trim() && !loadingTagSuggestions && (
                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg p-4 text-center animate-in fade-in slide-in-from-top-2 duration-200">
                          <p className="text-sm text-muted-foreground">
                            Nenhuma tag encontrada. Pressione <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">Enter</kbd> para criar "{tagInput.trim()}"
                          </p>
                        </div>
                      )}
                    </div>

                    {!tagInput && selectedTags.length === 0 && tags.length > 0 && (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Flame className="w-3 h-3" />
                          Tags populares:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {tags.slice(0, 10).map((tag: any) => (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => handleAddTag(tag.name)}
                              disabled={selectedTags.includes(tag.name.toLowerCase()) || selectedTags.length >= 5}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 hover:from-emerald-100 hover:to-blue-100 dark:hover:from-emerald-900/30 dark:hover:to-blue-900/30 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed group text-sm"
                              data-testid={`popular-tag-${tag.name}`}
                            >
                              <Hash className="w-3 h-3 text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
                              <span className="font-medium group-hover:text-emerald-600 dark:group-hover:text-emerald-400">{tag.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      💡 Dica: Use <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">Enter</kbd> ou <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">,</kbd> para adicionar, <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">Backspace</kbd> para remover
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="topic-attachment">Anexar Documento (opcional)</Label>
                    {attachmentPreview ? (
                      <div className="relative">
                        <img
                          src={attachmentPreview}
                          alt="Preview"
                          className="max-h-64 rounded-lg object-cover"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => {
                            setAttachmentFile(null);
                            setAttachmentPreview(null);
                          }}
                        >
                          Remover
                        </Button>
                      </div>
                    ) : attachmentFile ? (
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                        <FileText className="h-5 w-5" />
                        <span className="text-sm flex-1">{attachmentFile.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAttachmentFile(null);
                            setAttachmentPreview(null);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('topic-attachment')?.click()}
                        className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted"
                      >
                        <ImagePlus className="h-4 w-4 mr-2" />
                        Anexar Documento
                      </Button>
                    )}
                    <input
                      id="topic-attachment"
                      type="file"
                      accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx,.zip,.rar"
                      className="hidden"
                      onChange={handleAttachmentChange}
                    />
                  </div>

                  <div>
                    <Label htmlFor="topic-video">Link de Vídeo (opcional)</Label>
                    <Input
                      id="topic-video"
                      value={videoLink}
                      onChange={(e) => setVideoLink(e.target.value)}
                      placeholder="Cole o link do vídeo (YouTube, Vimeo, etc)"
                    />
                  </div>

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
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={resetForm}
                      data-testid="button-cancel-topic"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={createTopicMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700"
                      data-testid="button-create-topic"
                    >
                      {createTopicMutation.isPending ? 'Criando...' : 'Criar Discussão'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Topics List */}
            <div className="space-y-3" data-testid="topics-list">
              {isLoading ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    Carregando discussões...
                  </CardContent>
                </Card>
              ) : filteredTopics.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchQuery
                        ? 'Nenhuma discussão encontrada com sua busca.'
                        : 'Nenhuma discussão ainda. Seja o primeiro a criar uma!'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredTopics.map((topic: any) => (
                  <Card
                    key={topic.id}
                    className={`hover:shadow-md transition-all cursor-pointer border-l-4 ${
                      topic.isSticky ? 'border-l-amber-400 bg-amber-50/30 dark:bg-amber-950/10' : 'border-l-transparent'
                    }`}
                    data-testid={`topic-${topic.id}`}
                    onClick={() => navigate(`/forum/${topic.slug || topic.id}`)}
                  >
                    <CardContent className="p-5">
                      <div className="flex gap-4">
                        {/* Avatar do autor */}
                        <div className="flex-shrink-0">
                          <Avatar className="w-11 h-11 ring-2 ring-gray-100 dark:ring-gray-800">
                            <AvatarImage src={topic.author?.profileImageUrl} />
                            <AvatarFallback className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                              {topic.author?.name?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base mb-1.5 line-clamp-2 text-gray-900 dark:text-gray-100" data-testid={`topic-title-${topic.id}`}>
                            {topic.title}
                          </h3>

                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                            {topic.content?.replace(/<[^>]*>/g, '').substring(0, 150)}
                          </p>

                          {/* Footer com autor, tempo e categoria */}
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500 mb-2.5 flex-wrap">
                            <Link href={`/users/${topic.author?.id}`}>
                              <span className="font-medium hover:text-gray-900 dark:hover:text-gray-300 cursor-pointer transition-colors">
                                {topic.author?.name}
                              </span>
                            </Link>
                            <span>•</span>
                            <span>{topic.createdAt && formatTimeAgo(topic.createdAt)}</span>

                            {/* Categoria */}
                            {topic.category && (
                              <>
                                <span>•</span>
                                <Badge
                                  variant="secondary"
                                  className="text-xs font-normal bg-emerald-600 hover:bg-emerald-700 text-white border-0 cursor-pointer transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCategory(topic.categoryId);
                                    setSelectedTag(null);
                                  }}
                                >
                                  {topic.category.name}
                                </Badge>
                              </>
                            )}
                          </div>

                          {/* Tags e stats numa linha */}
                          <div className="flex items-center justify-between gap-3">
                            {/* Tags */}
                            <div className="flex-1">
                              {topic.tags && topic.tags.length > 0 && (
                                <div className="flex gap-1.5 flex-wrap">
                                  {topic.tags.slice(0, 3).map((tag: any) => (
                                    <Badge
                                      key={tag.id}
                                      variant="outline"
                                      className="text-[10px] font-normal bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/50 cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTag(tag.name);
                                        setSelectedCategory(null);
                                        setSearchQuery('');
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                      }}
                                    >
                                      #{tag.name}
                                    </Badge>
                                  ))}
                                  {topic.tags.length > 3 && (
                                    <Badge variant="outline" className="text-[10px] font-normal text-gray-500">
                                      +{topic.tags.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Stats */}
                            <div className="flex items-center gap-3 text-gray-500 dark:text-gray-500">
                              <button className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                                <ThumbsUp className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium">{topic.likeCount || 0}</span>
                              </button>
                              <button className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium">{topic.replyCount || 0}</span>
                              </button>
                              <button className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                                <Eye className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium">{topic.viewCount || 0}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </main>

          {/* Sidebar Direita */}
          <aside className="lg:col-span-3 space-y-4">
            {/* Buscar */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Buscar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar discussões..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-sm"
                    data-testid="input-search-forum"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Categorias */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Categoria</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 max-h-96 overflow-y-auto">
                <Button
                  variant={selectedCategory === 'all' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-between text-sm"
                  onClick={() => setSelectedCategory('all')}
                >
                  <span>Todas as Categorias</span>
                  <Badge variant="secondary" className="ml-2">{topics.length}</Badge>
                </Button>
                {categories.map((cat: any) => (
                  <Button
                    key={cat.id}
                    variant={selectedCategory === cat.id ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-between text-sm"
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    <span className="truncate">{cat.name}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Top Contributors */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  Top Contributors
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {topContributors.slice(0, 4).map((user: any, index: number) => {
                  const userLevel = user.points?.level || 1;

                  const getRankIcon = () => {
                    if (index === 0) return <Trophy className="w-5 h-5 text-amber-500" />;
                    if (index === 1) return <Medal className="w-5 h-5 text-gray-400" />;
                    if (index === 2) return <Award className="w-5 h-5 text-amber-700" />;
                    return null;
                  };

                  return (
                    <div key={user.id} className="flex items-center gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <div className="w-6 text-center">
                          {getRankIcon() || <span className="text-sm font-bold text-muted-foreground">{index + 1}</span>}
                        </div>
                        <Avatar className="w-8 h-8 ring-2 ring-primary/20">
                          <AvatarImage src={user.profileImageUrl} />
                          <AvatarFallback className="text-xs">
                            {user.name?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <Link href={`/users/${user.id}`}>
                            <p className="text-sm font-medium truncate hover:underline cursor-pointer">{user.name}</p>
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            Nível {userLevel}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Tags em Alta */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  # Tags em Alta
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="flex flex-wrap gap-1">
                  {trendingTags.map((tag: any) => (
                    <button
                      key={tag.id}
                      onClick={() => {
                        setSelectedTag(tag.name);
                        setSelectedCategory(null);
                        setSearchQuery('');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted hover:bg-accent hover:text-accent-foreground transition-colors text-[10px] font-medium"
                      data-testid={`trending-tag-${tag.name}`}
                    >
                      <span className="font-semibold">#{tag.name}</span>
                      <span className="text-muted-foreground hover:text-accent-foreground text-[9px]">
                        ({tag.topicCount || 0})
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Estatísticas */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  Estatísticas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Discussões Ativas</span>
                  <span className="text-lg font-bold text-emerald-600" data-testid="text-active-discussions">
                    {forumStats?.activeTopics || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Membros Online</span>
                  <span className="text-lg font-bold text-blue-600" data-testid="text-online-members">
                    {forumStats?.onlineUsers || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Respostas Hoje</span>
                  <span className="text-lg font-bold text-purple-600" data-testid="text-replies-today">
                    {forumStats?.repliesToday || 0}
                  </span>
                </div>
              </CardContent>
            </Card>

            </aside>
        </div>
      </div>
    </div>
  );
}