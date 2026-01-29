
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Folder, ExternalLink, Loader2, Search } from "lucide-react";
import { useState, useMemo } from "react";
import { SEO, seoConfig } from "@/components/SEO";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { FeatureLockedOverlay } from "@/components/FeatureLockedOverlay";

interface Course {
  id: string;
  title: string;
  description?: string;
  category?: string;
  duration?: string;
  lessonCount?: number;
  thumbnailUrl?: string;
  courseUrl?: string;
  driveFolderId?: string;
  driveFolderUrl?: string;
  sourceType?: string;
  isActive: boolean;
  isNew?: boolean;
  isPopular?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Categorias disponíveis
const COURSE_CATEGORIES = [
  "Low Ticket",
  "Afiliados",
  "Mentorias e Formações",
  "Conteúdos dos Membros",
  "Desenvolvimento Pessoal",
  "Inteligência Artificial",
  "iGaming",
  "YouTube",
  "TikTok",
];

const ITEMS_PER_PAGE = 25;

export default function Courses() {
  const { isFeatureBlocked } = useFeatureAccess();
  const featureBlocked = isFeatureBlocked("cursos");
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [displayedItems, setDisplayedItems] = useState(ITEMS_PER_PAGE);

  // SEO Schema Markup
  const coursesSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Lowfy",
        "item": "https://lowfy.com.br"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Cursos Online",
        "item": "https://lowfy.com.br/courses"
      }
    ]
  };

  // Buscar cursos sincronizados do banco de dados
  const { data: courses = [], isLoading } = useQuery<Course[]>({
    queryKey: ['/api/courses'],
    staleTime: 10 * 60 * 1000, // Cache por 10 minutos (otimizado para escalabilidade)
    gcTime: 30 * 60 * 1000, // Manter em cache por 30 minutos
    refetchOnWindowFocus: false, // Não refetch ao focar janela (economia de requests)
  });

  // Filtrar cursos baseado na pesquisa e categoria
  const filteredCourses = useMemo(() => {
    let filtered = courses;

    // Filtrar por categoria
    if (selectedCategory !== "all") {
      filtered = filtered.filter(course => course.category === selectedCategory);
    }

    // Filtrar por termo de pesquisa
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(course => 
        course.title.toLowerCase().includes(term) ||
        course.description?.toLowerCase().includes(term)
      );
    }

    // Clonar array antes de ordenar para não mutar o cache do React Query
    return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
  }, [courses, searchTerm, selectedCategory]);

  const handleOpenCourse = () => {
    // Todos os cursos acessam a mesma pasta do Google Drive
    window.open("https://drive.google.com/drive/folders/123aQZBYZQUypRggZl1cYrm3hmRLGn0YP?usp=sharing", '_blank');
  };

  const handleLoadMore = () => {
    setDisplayedItems(prev => prev + ITEMS_PER_PAGE);
  };

  const displayedCourses = filteredCourses.slice(0, displayedItems);
  const hasMore = displayedItems < filteredCourses.length;

  if (featureBlocked) {
    return (
      <FeatureLockedOverlay 
        featureName="Cursos Online" 
        description="Acesse mais de 380 cursos de alta qualidade. Disponível para assinantes e compradores."
      />
    );
  }

  return (
    <>
      <SEO 
        title={seoConfig.cursos.title}
        description={seoConfig.cursos.description}
        canonicalUrl={seoConfig.cursos.canonical}
      />
      <script type="application/ld+json">
        {JSON.stringify(coursesSchema)}
      </script>
      <div className="max-w-7xl mx-auto p-4 md:p-8" data-testid="courses-page">
      <div className="mb-6">
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Cursos Online Especializados</h1>
        <p className="text-muted-foreground text-lg">
          Acesse nossa biblioteca com mais de 380 cursos de alta qualidade em Marketing Digital, Low Ticket, Afiliados, Inteligência Artificial, YouTube, TikTok e muito mais. Tudo organizado por categorias para facilitar sua aprendizagem.
        </p>
      </div>

      {/* Filtros */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Pesquisar cursos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white dark:bg-background"
            data-testid="input-search-courses"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full md:w-[250px] bg-white dark:bg-background" data-testid="select-category">
            <SelectValue placeholder="Todas as Categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Categorias</SelectItem>
            {COURSE_CATEGORIES.map(category => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Contador de resultados */}
      <div className="mb-4 text-sm text-muted-foreground" data-testid="text-course-count">
        {isLoading ? (
          <span>Carregando...</span>
        ) : (
          <span>{filteredCourses.length} {filteredCourses.length === 1 ? 'curso encontrado' : 'cursos encontrados'}</span>
        )}
      </div>

      {/* Lista de cursos */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : displayedCourses.length > 0 ? (
        <>
          <Card className="overflow-hidden">
            <div className="divide-y divide-border">
              {displayedCourses.map((course) => (
                <div
                  key={course.id}
                  className="group hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={handleOpenCourse}
                  data-testid={`card-course-${course.id}`}
                >
                  <div className="p-4 flex items-center gap-4">
                    {/* Ícone */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                      <Folder className="w-5 h-5 text-primary" />
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate" data-testid={`text-course-title-${course.id}`}>
                            {course.title}
                          </h3>
                          {course.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                              {course.description}
                            </p>
                          )}
                        </div>

                        {/* Categoria e botão */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {course.category && (
                            <span className="hidden sm:inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 dark:bg-primary/20 text-primary whitespace-nowrap" data-testid={`text-course-category-${course.id}`}>
                              {course.category}
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenCourse();
                            }}
                            data-testid={`button-access-course-${course.id}`}
                          >
                            <span className="hidden md:inline">Acessar</span>
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Botão Carregar Mais */}
          {hasMore && (
            <div className="flex justify-center pt-6">
              <Button 
                onClick={handleLoadMore}
                variant="outline"
                size="lg"
                className="w-full md:w-auto"
                data-testid="button-load-more"
              >
                Carregar Mais Cursos
              </Button>
            </div>
          )}
        </>
      ) : (
        <Card className="p-8 text-center">
          <Folder className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Nenhum curso encontrado
          </h3>
          <p className="text-muted-foreground">
            {searchTerm ? 
              `Nenhum curso corresponde à pesquisa "${searchTerm}"` : 
              "Nenhum curso disponível no momento"
            }
          </p>
        </Card>
      )}
    </div>
    </>
  );
}
