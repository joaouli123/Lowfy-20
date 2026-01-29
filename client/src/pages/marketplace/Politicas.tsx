import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ShieldCheck, 
  AlertTriangle, 
  Ban, 
  Scale, 
  Mail, 
  ArrowLeft,
  CheckCircle,
  XCircle,
  Info
} from "lucide-react";
import { Link } from "wouter";

export default function MarketplacePolicies() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <div className="mb-8">
          <Link href="/marketplace">
            <Button variant="ghost" className="mb-4" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Marketplace
            </Button>
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="w-10 h-10 text-primary" />
            <div>
              <h1 className="text-3xl font-bold" data-testid="page-title">Políticas do Marketplace</h1>
              <p className="text-muted-foreground">Regras e diretrizes para vendedores e compradores</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-600" />
                Sobre o Marketplace
              </CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                Nosso marketplace é uma plataforma que conecta vendedores de produtos digitais com compradores 
                interessados em plugins, templates, cursos e outros produtos digitais. Para manter um ambiente 
                seguro e confiável para todos, estabelecemos as seguintes políticas.
              </p>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <Ban className="w-5 h-5" />
                Produtos Proibidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Os seguintes tipos de produtos são <strong>estritamente proibidos</strong> em nossa plataforma. 
                A violação dessas regras resultará no bloqueio imediato do produto e possível banimento da conta.
              </p>
              
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-2 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Armas e Munições</p>
                    <p className="text-xs text-muted-foreground">
                      Armas de fogo, armas brancas, explosivos, munições ou qualquer item relacionado
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Drogas e Substâncias Ilícitas</p>
                    <p className="text-xs text-muted-foreground">
                      Drogas ilegais, substâncias controladas, medicamentos sem prescrição
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Conteúdo Adulto</p>
                    <p className="text-xs text-muted-foreground">
                      Pornografia, conteúdo sexual explícito ou materiais para adultos
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Conteúdo Pirata</p>
                    <p className="text-xs text-muted-foreground">
                      Software crackeado, filmes, músicas ou qualquer conteúdo protegido por direitos autorais
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Dados Pessoais</p>
                    <p className="text-xs text-muted-foreground">
                      Venda de dados pessoais, listas de emails, informações de cartões de crédito
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Malware e Vírus</p>
                    <p className="text-xs text-muted-foreground">
                      Software malicioso, vírus, trojans, ransomware ou ferramentas de hacking
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Produtos Falsificados</p>
                    <p className="text-xs text-muted-foreground">
                      Réplicas, falsificações ou produtos que violem marcas registradas
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Conteúdo de Ódio</p>
                    <p className="text-xs text-muted-foreground">
                      Materiais que promovam discriminação, violência ou ódio contra grupos
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Jogos de Azar Ilegais</p>
                    <p className="text-xs text-muted-foreground">
                      Cassinos online ilegais, apostas não regulamentadas, esquemas de pirâmide
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Fraudes e Golpes</p>
                    <p className="text-xs text-muted-foreground">
                      Esquemas de enriquecimento rápido, golpes financeiros, promessas falsas
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle className="w-5 h-5" />
                Produtos Permitidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Nossa plataforma é destinada principalmente a produtos digitais legítimos:
              </p>
              
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-2 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Plugins e Extensões</p>
                    <p className="text-xs text-muted-foreground">
                      Plugins para WordPress, Shopify, WooCommerce e outras plataformas
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Templates e Temas</p>
                    <p className="text-xs text-muted-foreground">
                      Templates de sites, temas, landing pages, dashboards
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Cursos e E-books</p>
                    <p className="text-xs text-muted-foreground">
                      Cursos online, tutoriais, e-books, materiais educacionais
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Software e SaaS</p>
                    <p className="text-xs text-muted-foreground">
                      Aplicativos, ferramentas de produtividade, automações
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Design e Gráficos</p>
                    <p className="text-xs text-muted-foreground">
                      Ícones, ilustrações, mockups, fontes, elementos gráficos
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Scripts e Código</p>
                    <p className="text-xs text-muted-foreground">
                      Scripts, componentes, bibliotecas, APIs
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-blue-600" />
                Direitos e Responsabilidades
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Para Vendedores:</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    Você é responsável por garantir que seus produtos não violem direitos autorais de terceiros
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    Deve fornecer descrições precisas e honestas de seus produtos
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    Precisa oferecer suporte básico aos compradores
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    Deve manter seus produtos atualizados e funcionais
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Para Compradores:</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    Você pode solicitar reembolso dentro de 7 dias se o produto não funcionar como descrito
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    Não pode redistribuir ou revender produtos adquiridos sem autorização
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    Deve usar os produtos de acordo com os termos de licença do vendedor
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                Consequências de Violações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Violações das políticas do marketplace podem resultar nas seguintes ações:
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800">1ª Violação</Badge>
                  <p className="text-sm">Advertência e bloqueio temporário do produto</p>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800">2ª Violação</Badge>
                  <p className="text-sm">Bloqueio permanente do produto e suspensão temporária da conta</p>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                  <Badge variant="destructive">3ª Violação</Badge>
                  <p className="text-sm">Banimento permanente da plataforma</p>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground mt-4">
                * Violações graves (armas, drogas, conteúdo ilegal) resultam em banimento imediato sem advertência prévia.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600" />
                Denúncias e Contato
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Se você encontrar um produto que viole nossas políticas ou tiver alguma dúvida, 
                entre em contato conosco:
              </p>
              
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Email:</strong>{" "}
                  <a href="mailto:suporte@lowfy.com.br" className="text-primary hover:underline">
                    suporte@lowfy.com.br
                  </a>
                </p>
                <p>
                  <strong>Assunto:</strong> [Denúncia] ou [Dúvida sobre políticas]
                </p>
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Todas as denúncias são analisadas em até 48 horas úteis. 
                  Agradecemos sua colaboração em manter nossa comunidade segura!
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="text-center text-sm text-muted-foreground pt-4 border-t">
            <p>Última atualização: Novembro de 2025</p>
            <p className="mt-2">
              Ao utilizar o marketplace, você concorda com estas políticas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
