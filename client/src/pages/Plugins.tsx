import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Puzzle, ExternalLink, Search, Download } from "lucide-react";
import { useState, useMemo } from "react";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { FeatureLockedOverlay } from "@/components/FeatureLockedOverlay";

interface PluginInfo {
  name: string;
  description: string;
  logo: string;
  category: string;
  downloadUrl: string;
}

// Link único para todos os plugins
const PLUGINS_DOWNLOAD_URL = "https://drive.google.com/drive/folders/1jccFmyPPJROl1UAEiWUaeTHaDeFxeXZc";

const PLUGIN_DATABASE: Record<string, PluginInfo> = {
  "all-in-one-wp-migration": {
    name: "All-in-One WP Migration Unlimited Extension",
    description: "Plugin de migração completo para WordPress. Faça backup e migre sites sem limitações.",
    logo: "https://ps.w.org/all-in-one-wp-migration/assets/icon-256x256.png",
    category: "Migration",
    downloadUrl: PLUGINS_DOWNLOAD_URL
  },
  "clonador-de-paginas": {
    name: "Clonador de Páginas",
    description: "Ferramenta para clonar e editar páginas web. Ideal para criar landing pages rapidamente.",
    logo: "/plugin-logos/clonador.webp",
    category: "Development",
    downloadUrl: PLUGINS_DOWNLOAD_URL
  },
  "elementor": {
    name: "Elementor Pro",
    description: "O construtor de páginas WordPress mais popular. Crie designs incríveis com drag & drop, sem código.",
    logo: "https://ps.w.org/elementor/assets/icon-256x256.gif",
    category: "Page Builder",
    downloadUrl: PLUGINS_DOWNLOAD_URL
  },
  "essential-addons-elementor": {
    name: "Essential Addons for Elementor Pro",
    description: "Pacote essencial de widgets para Elementor. Expanda as funcionalidades do construtor.",
    logo: "/plugin-logos/essential-addons.webp",
    category: "Elementor Addons",
    downloadUrl: PLUGINS_DOWNLOAD_URL
  },
  "jetelements": {
    name: "JetElements",
    description: "Pacote completo de widgets para Elementor. Adicione funcionalidades avançadas ao seu construtor.",
    logo: "/plugin-logos/jetelements.webp",
    category: "Elementor Addons",
    downloadUrl: PLUGINS_DOWNLOAD_URL
  },
  "jetengine": {
    name: "JetEngine",
    description: "Motor de funcionalidades avançadas para WordPress. Crie custom post types, taxonomias e mais.",
    logo: "/plugin-logos/jetengine.webp",
    category: "Development",
    downloadUrl: PLUGINS_DOWNLOAD_URL
  },
  "jetsearch": {
    name: "JetSearch",
    description: "Sistema de busca avançado para WordPress. Adicione busca inteligente com filtros ao seu site.",
    logo: "/plugin-logos/jetsearch.webp",
    category: "Search",
    downloadUrl: PLUGINS_DOWNLOAD_URL
  },
  "jetsmartfilters": {
    name: "JetSmartFilters",
    description: "Plugin de filtros inteligentes para WordPress. Crie filtros avançados para seus posts e produtos.",
    logo: "/plugin-logos/jetsmartfilters.webp",
    category: "Filters",
    downloadUrl: PLUGINS_DOWNLOAD_URL
  },
  "jetwoobuilder": {
    name: "JetWooBuilder",
    description: "Construtor visual para WooCommerce. Personalize páginas de produtos com Elementor.",
    logo: "/plugin-logos/jetwoobuilder.webp",
    category: "WooCommerce",
    downloadUrl: PLUGINS_DOWNLOAD_URL
  },
  "optimonster": {
    name: "OptinMonster",
    description: "Ferramenta de geração de leads e popups para WordPress. Aumente suas conversões com popups inteligentes.",
    logo: "/plugin-logos/optinmonster.webp",
    category: "Marketing",
    downloadUrl: PLUGINS_DOWNLOAD_URL
  },
  "presto-player-pro": {
    name: "Presto Player Pro",
    description: "Player de vídeo avançado para WordPress. Adicione vídeos responsivos com recursos profissionais.",
    logo: "https://ps.w.org/presto-player/assets/icon-256x256.png",
    category: "Media",
    downloadUrl: PLUGINS_DOWNLOAD_URL
  },
  "rankmath": {
    name: "Rank Math SEO Pro",
    description: "Plugin de SEO completo com análise avançada e sugestões de otimização.",
    logo: "https://ps.w.org/seo-by-rank-math/assets/icon-256x256.png",
    category: "SEO",
    downloadUrl: PLUGINS_DOWNLOAD_URL
  },
  "really-simple-ssl-pro": {
    name: "Really Simple SSL Pro",
    description: "Configure SSL/HTTPS automaticamente no WordPress. Segurança e proteção em um clique.",
    logo: "https://ps.w.org/really-simple-ssl/assets/icon-256x256.png",
    category: "Security",
    downloadUrl: PLUGINS_DOWNLOAD_URL
  },
  "smush-pro": {
    name: "Smush Pro",
    description: "Otimize e comprima imagens automaticamente. Melhore a velocidade do seu site.",
    logo: "https://ps.w.org/wp-smushit/assets/icon-256x256.png",
    category: "Optimization",
    downloadUrl: PLUGINS_DOWNLOAD_URL
  },
  "translatepress": {
    name: "TranslatePress Multilingual",
    description: "Plugin de tradução multilíngue para WordPress. Traduza seu site diretamente do frontend.",
    logo: "https://ps.w.org/translatepress-multilingual/assets/icon-256x256.png",
    category: "Translation",
    downloadUrl: PLUGINS_DOWNLOAD_URL
  },
  "w3-total-cache-pro": {
    name: "W3 Total Cache Pro",
    description: "Plugin de cache completo para WordPress. Melhore a velocidade e performance do seu site.",
    logo: "https://ps.w.org/w3-total-cache/assets/icon-256x256.png",
    category: "Performance",
    downloadUrl: PLUGINS_DOWNLOAD_URL
  },
  "wp-mail-smtp-pro": {
    name: "WP Mail SMTP Pro",
    description: "Configure SMTP profissional para emails do WordPress. Garanta entrega de emails.",
    logo: "https://ps.w.org/wp-mail-smtp/assets/icon-256x256.png",
    category: "Email",
    downloadUrl: PLUGINS_DOWNLOAD_URL
  },
  "wp-rocket": {
    name: "WP Rocket",
    description: "Plugin de cache e otimização de performance para WordPress. Melhore drasticamente a velocidade do seu site.",
    logo: "/plugin-logos/wprocket.webp",
    category: "Performance",
    downloadUrl: PLUGINS_DOWNLOAD_URL
  }
};

export default function Plugins() {
  const { isFeatureBlocked } = useFeatureAccess();
  const featureBlocked = isFeatureBlocked("plugins");
  
  const [searchTerm, setSearchTerm] = useState("");

  // Lista de todos os plugins disponíveis
  const allPlugins = useMemo(() => {
    return Object.entries(PLUGIN_DATABASE).map(([key, plugin]) => ({
      id: key,
      ...plugin
    }));
  }, []);

  const filteredPlugins = useMemo(() => {
    if (!searchTerm.trim()) return allPlugins;

    const term = searchTerm.toLowerCase();
    return allPlugins.filter(plugin => 
      plugin.name.toLowerCase().includes(term) ||
      plugin.description.toLowerCase().includes(term) ||
      plugin.category.toLowerCase().includes(term)
    );
  }, [allPlugins, searchTerm]);

  const handleOpenPlugin = (downloadUrl: string) => {
    window.open(downloadUrl, '_blank', 'noopener,noreferrer');
  };

  if (featureBlocked) {
    return (
      <FeatureLockedOverlay 
        featureName="Plugins WordPress" 
        description="Acesse mais de 20 plugins premium. Disponível para assinantes e compradores."
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8" data-testid="plugins-page">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Plugins WordPress</h1>
        <p className="text-muted-foreground">Acesse nossa coleção completa de plugins premium para WordPress</p>
      </div>

      {/* Filtro de pesquisa */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Pesquisar plugins..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white dark:bg-background"
            data-testid="input-search"
          />
        </div>
      </div>

      {/* Contador de resultados */}
      <div className="mb-4">
        <div className="text-sm text-muted-foreground">
          <span data-testid="text-count">
            {filteredPlugins.length} {filteredPlugins.length === 1 ? 'plugin encontrado' : 'plugins encontrados'}
          </span>
        </div>
      </div>

      {/* Lista de plugins */}
      {filteredPlugins.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlugins.map((plugin) => (
              <Card 
                key={plugin.id}
                className="hover:shadow-lg transition-all duration-300 cursor-pointer group overflow-hidden"
                onClick={() => handleOpenPlugin(plugin.downloadUrl)}
                data-testid={`card-plugin-${plugin.id}`}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                    {/* Logo do Plugin */}
                    <div className={`rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 ${
                      plugin.id.startsWith('jet') ? 'w-48 h-20 p-4' : 'w-20 h-20 p-3'
                    }`}>
                      <img 
                        src={plugin.logo} 
                        alt={plugin.name}
                        className="w-full h-full object-contain"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          if (e.currentTarget.parentElement) {
                            e.currentTarget.parentElement.innerHTML = '<svg class="w-12 h-12 text-primary" fill="currentColor" viewBox="0 0 20 20"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"></path></svg>';
                          }
                        }}
                      />
                    </div>

                    {/* Categoria */}
                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      {plugin.category}
                    </div>

                    {/* Nome do Plugin */}
                    <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors" data-testid={`text-name-${plugin.id}`}>
                      {plugin.name}
                    </h3>

                    {/* Descrição */}
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {plugin.description}
                    </p>

                    {/* Botão de Download */}
                    <Button
                      className="w-full mt-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenPlugin(plugin.downloadUrl);
                      }}
                      data-testid={`button-open-${plugin.id}`}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Baixar Plugin
                      <ExternalLink className="w-3 h-3 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Puzzle className="w-20 h-20 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-2xl font-semibold text-foreground mb-2">
            Nenhum plugin encontrado
          </h3>
          <p className="text-muted-foreground">
            {searchTerm ? 
              `Nenhum plugin corresponde à pesquisa "${searchTerm}"` : 
              "Nenhum plugin disponível no momento"
            }
          </p>
        </Card>
      )}
    </div>
  );
}