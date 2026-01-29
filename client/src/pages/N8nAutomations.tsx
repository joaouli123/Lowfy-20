import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Download, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SEO } from "@/components/SEO";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { FeatureLockedOverlay } from "@/components/FeatureLockedOverlay";

interface N8nAutomation {
  id: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  category: string;
  categoryEn: string;
  department: string | null;
  templateUrl: string;
  viewCount: number;
  createdAt: string;
}

const ITEMS_PER_PAGE = 12;

export default function N8nAutomations() {
  const { isFeatureBlocked } = useFeatureAccess();
  const featureBlocked = isFeatureBlocked("n8n");
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [displayedItems, setDisplayedItems] = useState(ITEMS_PER_PAGE);

  // Buscar todas as automações
  const { data: automations = [], isLoading } = useQuery<N8nAutomation[]>({
    queryKey: ['/api/n8n-automations'],
    staleTime: 5 * 60 * 1000,
  });

  // Extrair categorias únicas
  const categories = useMemo(() => {
    const uniqueCategories = Array.from(new Set(automations.map(a => a.category)));
    return uniqueCategories.sort();
  }, [automations]);

  // Extrair departamentos únicos
  const departments = useMemo(() => {
    const uniqueDepartments = Array.from(
      new Set(automations.map(a => a.department).filter(Boolean))
    ) as string[];
    return uniqueDepartments.sort();
  }, [automations]);

  // Filtrar automações
  const filteredAutomations = useMemo(() => {
    let filtered = automations;

    // Filtrar por categoria
    if (selectedCategory !== "all") {
      filtered = filtered.filter(auto => auto.category === selectedCategory);
    }

    // Filtrar por departamento
    if (selectedDepartment !== "all") {
      filtered = filtered.filter(auto => auto.department === selectedDepartment);
    }

    // Filtrar por termo de pesquisa
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(auto => 
        auto.title.toLowerCase().includes(term) ||
        auto.description.toLowerCase().includes(term) ||
        auto.department?.toLowerCase().includes(term)
      );
    }

    // Ordenar alfabeticamente
    return filtered.sort((a, b) => a.title.localeCompare(b.title));
  }, [automations, searchTerm, selectedCategory, selectedDepartment]);

  const handleDownload = async (automation: N8nAutomation) => {
    try {
      // Forçar download do arquivo JSON
      const response = await fetch(automation.templateUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Nome do arquivo baseado no título
      const fileName = automation.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') + '.json';
      
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      window.open(automation.templateUrl, '_blank');
    }
  };

  const handleLoadMore = () => {
    setDisplayedItems(prev => prev + ITEMS_PER_PAGE);
  };

  const displayedAutomations = filteredAutomations.slice(0, displayedItems);
  const hasMore = displayedItems < filteredAutomations.length;

  if (featureBlocked) {
    return (
      <FeatureLockedOverlay 
        featureName="Automações N8N" 
        description="Acesse 153 templates de automação prontos. Disponível apenas para assinantes."
      />
    );
  }

  return (
    <>
      <SEO 
        title="153 Automações N8N Prontas"
        description="Acesse 153 templates de automação para N8N organizados por categorias: Gmail, Telegram, Google Drive, WordPress, Discord e muito mais!"
        keywords="n8n, automação, templates, workflows, gmail, telegram, google drive, wordpress, discord, ai automation"
        ogTitle="153 Automações N8N Prontas - Templates Gratuitos"
        ogDescription="Mais de 150 templates de automação organizados para você usar no N8N!"
      />
      <div className="max-w-7xl mx-auto p-4 md:p-8" data-testid="n8n-page">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Automações N8N</h1>
          <p className="text-muted-foreground">
            153 templates prontos de automação para usar no N8N. 
            Organize e-mails, integre com Telegram, automatize WordPress e muito mais!
          </p>
        </div>

        {/* Filtros */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Pesquisar automações..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white dark:bg-background"
                data-testid="input-search-automations"
              />
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-[250px] bg-white dark:bg-background" data-testid="select-category">
                <SelectValue placeholder="Todas as Categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Categorias</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-full md:w-[250px] bg-white dark:bg-background" data-testid="select-department">
                <SelectValue placeholder="Todos os Departamentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Departamentos</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contador de resultados */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap" data-testid="text-automation-count">
            <span>{filteredAutomations.length} {filteredAutomations.length === 1 ? 'automação encontrada' : 'automações encontradas'}</span>
            {selectedCategory !== 'all' && (
              <Badge variant="secondary">{selectedCategory}</Badge>
            )}
            {selectedDepartment !== 'all' && (
              <Badge variant="secondary">{selectedDepartment}</Badge>
            )}
          </div>
        </div>

        {/* Grid de Cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : displayedAutomations.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedAutomations.map((automation) => (
                <Card 
                  key={automation.id}
                  className="group hover:shadow-lg transition-all duration-200 hover:-translate-y-1 cursor-pointer flex flex-col"
                  onClick={() => handleDownload(automation)}
                  data-testid={`card-automation-${automation.id}`}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg group-hover:text-primary transition-colors line-clamp-2" data-testid={`text-automation-title-${automation.id}`}>
                      {automation.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-3 min-h-[60px]">
                      {automation.description}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="pt-0 mt-auto">
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Badge variant="secondary" className="text-xs">
                        {automation.category}
                      </Badge>
                      {automation.department && (
                        <Badge variant="outline" className="text-xs">
                          {automation.department}
                        </Badge>
                      )}
                    </div>
                    
                    <Button
                      size="sm"
                      className="w-full gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(automation);
                      }}
                      data-testid={`button-download-automation-${automation.id}`}
                    >
                      <Download className="w-4 h-4" />
                      Baixar Template
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Botão Carregar Mais */}
            {hasMore && (
              <div className="flex justify-center pt-8">
                <Button 
                  onClick={handleLoadMore}
                  variant="outline"
                  size="lg"
                  className="w-full md:w-auto"
                  data-testid="button-load-more"
                >
                  Carregar Mais Automações
                </Button>
              </div>
            )}
          </>
        ) : (
          <Card className="p-8 text-center">
            <Download className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Nenhuma automação encontrada
            </h3>
            <p className="text-muted-foreground">
              {searchTerm ? 
                `Nenhuma automação corresponde à pesquisa "${searchTerm}"` : 
                "Nenhuma automação disponível no momento"
              }
            </p>
          </Card>
        )}

        {/* Créditos */}
        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Créditos:{" "}
            <a 
              href="https://github.com/enescingoz" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors underline"
            >
              Enes Cingoz
            </a>
            {" "}e colaboradores do{" "}
            <a 
              href="https://github.com/enescingoz/awesome-n8n-templates" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors underline"
            >
              repositório awesome-n8n-templates
            </a>
          </p>
        </div>
      </div>
    </>
  );
}
