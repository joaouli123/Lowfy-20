import { db } from "./db";
import { aiTools, globalAIAccess } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "./utils/logger";

const categoriesMap: Record<string, string> = {
  "mining": "mineracao",
  "ai": "ia",
  "design": "design",
  "seo": "seo",
  "courtesy": "cortesia",
  "infoproducts": "infoprodutos",
  "bonus": "brinde",
  "maintenance": "manutencao"
};

const aiToolsData = [
  // ============ CATEGORIA 1: MINERAÇÃO (8 ferramentas) ============
  {
    name: "ADSPARO",
    description: "Plataforma de espionagem de anúncios",
    toolUrl: "https://adsparo.com/adspy/login.php",
    category: "mineracao",
    instructions: "Use os acessos fornecidos para fazer login",
    accessCredentials: [
      { label: "Acesso 1", login: "toolsuite.app@gmail.com", password: "sublaunch.com/toolsuite?32nkkkoacaa" },
      { label: "Acesso 2", login: "facectrloficial23@gmail.com", password: "783232suportenozap24981432178" }
    ],
    isActive: true
  },
  {
    name: "AMERICAN SWIPE",
    description: "Plataforma de swipe files para marketing direto",
    toolUrl: "https://www.americanswipe.app/",
    category: "mineracao",
    instructions: "Use o acesso fornecido para fazer login",
    accessCredentials: [
      { label: "Acesso Principal", login: "oanthonycopy@gmail.com", password: "a1b2c3d4E@" }
    ],
    isActive: true
  },
  {
    name: "GURUKILLER",
    description: "Ferramenta de espionagem de infoprodutos e PLRs",
    toolUrl: "https://dashboard.gurukiller.ai/",
    category: "mineracao",
    instructions: "⚠️ IMPORTANTE: ACESSAR NA GUIA ANÔNIMA!",
    accessCredentials: [
      { label: "Acesso Principal", login: "sechack49@gmail.com", password: "I04xPejFKF5PxcNWhTnWRDi0jvUofxRU" }
    ],
    isActive: true
  },
  {
    name: "BIGSPY",
    description: "Ferramenta de espionagem de anúncios multi-plataforma",
    toolUrl: "https://bigspy.com",
    category: "mineracao",
    instructions: "Acesso via cookies - Copie e cole o cookie fornecido",
    accessCredentials: [
      { label: "Cookie de Acesso", login: "https://pt.anotepad.com/note/read/fjgxg8aj", password: "Via Cookie" }
    ],
    isActive: true
  },
  {
    name: "SPY HERO",
    description: "Ferramenta de espionagem de anúncios para afiliados",
    toolUrl: "https://activity.adspower.com/",
    category: "mineracao",
    instructions: "Acesso via AdsPoswer - Perfil: +80 FERRAMENTAS",
    accessCredentials: [
      { label: "Via AdsPoswer", login: "membrosdominando3@gmail.com", password: "membrosdominandoacessoplus123" }
    ],
    isActive: true
  },
  {
    name: "SOCIAL PETA",
    description: "Plataforma de análise de anúncios e tendências",
    toolUrl: "https://socialpeta.com/user/login",
    category: "mineracao",
    instructions: "Use o acesso fornecido para fazer login",
    accessCredentials: [
      { label: "Acesso Principal", login: "teammarketing@lutech.ltd", password: "mktLTD24#" }
    ],
    isActive: true
  },
  {
    name: "SHOPHUNTER",
    description: "Ferramenta de mineração para Dropshipping",
    toolUrl: "https://app.shophunter.io/login",
    category: "mineracao",
    instructions: "Use o acesso fornecido para fazer login",
    accessCredentials: [
      { label: "Acesso Principal", login: "elytra1081@gmail.com", password: "adminwater1081" }
    ],
    isActive: true
  },
  {
    name: "PIPIADS",
    description: "Análise de anúncios e produtos virais",
    toolUrl: "https://www.pipiads.com/pt/login",
    category: "mineracao",
    instructions: "Use o acesso fornecido para fazer login",
    accessCredentials: [
      { label: "Acesso Principal", login: "siley30729@exitings.com", password: "siley30729@exitings.com" }
    ],
    isActive: true
  },

  // ============ CATEGORIA 2: INTELIGÊNCIAS ARTIFICIAIS (15 ferramentas) ============
  {
    name: "CHAT GPT-4",
    description: "Modelo de linguagem avançado da OpenAI",
    toolUrl: "https://chatgpt.com",
    category: "ia",
    instructions: "⚠️ IMPORTANTE: ACESSAR NA GUIA ANÔNIMA! Use um dos acessos fornecidos",
    accessCredentials: [
      { label: "Acesso 1", login: "aprendizado564@mayquera.com", password: "@M4yQu3Z3r4gg0953523" },
      { label: "Acesso 2", login: "pc2556pc@sanalcell.network", password: "asdasdasd#123" },
      { label: "Acesso 3", login: "jovitoolsbr02@gmail.com", password: "!JOVITOOLS@25L" },
      { label: "Acesso 4 (PRO + SORA)", login: "jonikusuumaa@atomicmail.io", password: "6pZYPE4%Wq8E" }
    ],
    isActive: true
  },
  {
    name: "SORA AI",
    description: "IA de geração de vídeos da OpenAI",
    toolUrl: "Via AdsPoswer (Apenas PC)",
    category: "ia",
    instructions: "⚠️ APENAS PC! Acesse na guia anônima via AdsPoswer",
    accessCredentials: [
      { label: "Via AdsPoswer", login: "sidneimartins2025@gmail.com", password: "(FXSUk-Pc7s8%nS8zz-Y" }
    ],
    isActive: true
  },
  {
    name: "LEONARDO AI",
    description: "Geração de imagens com IA",
    toolUrl: "https://app.leonardo.ai/",
    category: "ia",
    instructions: "Acesso 1 via AdsPoswer ou Acessos 2 e 3 direto no site",
    accessCredentials: [
      { label: "Acesso 1 (VIA ADSPOWER)", login: "membrosdominando3@gmail.com", password: "@C712U*VG6RY$rRzZ9+B" },
      { label: "Acesso 2 (SITE - Microsoft)", login: "palazeleonardoai@outlook.com", password: "palaze1234!" },
      { label: "Acesso 3 (SITE)", login: "alisonjn.gmx1@gmail.com", password: "alisonjn!L@987234" }
    ],
    isActive: true
  },
  {
    name: "HEY GEN",
    description: "Geração de vídeos com avatares IA",
    toolUrl: "https://app.heygen.com/login",
    category: "ia",
    instructions: "⚠️ Se aparecer FREE, clique em 'alisonjn.ggmax' e selecione 'Heygen Team'",
    accessCredentials: [
      { label: "Acesso 1 (VIA ADSPOWER)", login: "membrosdominando3@gmail.com", password: "@C712U*VG6RY$rRzZ9+B" },
      { label: "Acesso 2 (DIRETO)", login: "alison.ggmx@gmail.com", password: "alisonjn!H@482992" }
    ],
    isActive: true
  },
  {
    name: "MIDJOURNEY",
    description: "Geração de imagens artísticas com IA",
    toolUrl: "Via AdsPoswer",
    category: "ia",
    instructions: "Acesse via AdsPoswer",
    accessCredentials: [
      { label: "Via AdsPoswer", login: "ads3.12acesso@gmail.com", password: ",YXfZn/KcwdB#vDVAq*X" }
    ],
    isActive: true
  },
  {
    name: "RUNWAY",
    description: "IA para edição e geração de vídeos",
    toolUrl: "Via AdsPoswer",
    category: "ia",
    instructions: "Acesse via AdsPoswer",
    accessCredentials: [
      { label: "Via AdsPoswer", login: "membrosdominando3@gmail.com", password: "@C712U*VG6RY$rRzZ9+B" }
    ],
    isActive: true
  },
  {
    name: "COPILOT PRO AI",
    description: "Assistente de IA da Microsoft",
    toolUrl: "https://copilot.microsoft.com",
    category: "ia",
    instructions: "⚠️ Escolha CONTA DE TRABALHO ao logar. Se pedir código, clique em 'Use a senha'",
    accessCredentials: [
      { label: "Acesso Principal", login: "a13502@msdn365.vip", password: "@M4yQu3r4gg0309125623" }
    ],
    isActive: true
  },
  {
    name: "PERPLEXITY AI",
    description: "Motor de busca com IA",
    toolUrl: "https://www.perplexity.ai",
    category: "ia",
    instructions: "Use um dos acessos fornecidos",
    accessCredentials: [
      { label: "Acesso 1", login: "mathppprivado2@outlook.com", password: "Via código email" },
      { label: "Acesso 2", login: "mayqueragg118@outlook.com", password: "Via código email" }
    ],
    isActive: true
  },
  {
    name: "GAMMA APP",
    description: "Criação de apresentações com IA",
    toolUrl: "https://gamma.app/",
    category: "ia",
    instructions: "Acesso 1 via AdsPoswer ou Acesso 2 direto",
    accessCredentials: [
      { label: "Acesso 1 (VIA ADSPOWER)", login: "membrosdominando3@gmail.com", password: "@C712U*VG6RY$rRzZ9+B" },
      { label: "Acesso 2 (DIRETO)", login: "soudd784.flop718@aleeas.com", password: "AaaaaBO9çç@" }
    ],
    isActive: true
  },
  {
    name: "SEAART",
    description: "Geração de arte com IA",
    toolUrl: "https://www.seaart.ai/pt",
    category: "ia",
    instructions: "1. Acesse o site\n2. Clique LOGIN → DISCORD\n3. Use o acesso fornecido\n⚠️ Ative 'Geração Gratuita' em Criar",
    accessCredentials: [
      { label: "Via Discord", login: "alisonjn.gmx1@gmail.com", password: "alisonjn!S@849863" }
    ],
    isActive: true
  },
  {
    name: "IDEOGRAMA",
    description: "Geração de imagens e ideogramas com IA",
    toolUrl: "Via AdsPoswer",
    category: "ia",
    instructions: "Acesse via AdsPoswer",
    accessCredentials: [
      { label: "Via AdsPoswer", login: "membrosdominando3@gmail.com", password: "@C712U*VG6RY$rRzZ9+B" }
    ],
    isActive: true
  },
  {
    name: "GROK AI",
    description: "IA avançada (Apenas PC)",
    toolUrl: "Via AdsPoswer",
    category: "ia",
    instructions: "⚠️ APENAS PC! Acesse via AdsPoswer",
    accessCredentials: [
      { label: "Via AdsPoswer", login: "membrosdominando3@gmail.com", password: "#zC3mR.uolFk)FY7NC%n" }
    ],
    isActive: true
  },
  {
    name: "SYNTHESIA",
    description: "Geração de vídeos com avatares IA",
    toolUrl: "https://www.synthesia.io/pt-br",
    category: "cortesia",
    instructions: "Ferramenta de cortesia - Use o acesso fornecido",
    accessCredentials: [
      { label: "Acesso Principal", login: "matt@alltoneshutters.com.au", password: "Wiki@llton3" }
    ],
    isActive: true
  },
  {
    name: "YOU.COM",
    description: "Buscador com IA integrada",
    toolUrl: "Via AdsPoswer",
    category: "cortesia",
    instructions: "Ferramenta de cortesia - Acesse via AdsPoswer",
    accessCredentials: [
      { label: "Via AdsPoswer", login: "membrosdominando3@gmail.com", password: "%s2vRO@EoHj1)aWESA$e" }
    ],
    isActive: true
  },

  // ============ CATEGORIA 3: DESIGN E EDIÇÃO (5 ferramentas) ============
  {
    name: "CANVA PRO",
    description: "Editor de design gráfico online profissional",
    toolUrl: "https://www.canva.com/",
    category: "design",
    instructions: "Use um dos links de equipe para entrar no Canva Pro",
    accessCredentials: [
      { label: "Link Equipe 1", login: "https://www.canva.com/brand/join?token=SQJQJyy_M8QHyLbEQuLbuA&referrer=team-invite", password: "Via Link" },
      { label: "Link Equipe 2", login: "https://www.canva.com/brand/join?token=ywpmMW7c7SFIbZUJt9S1GA&referrer=team-invite", password: "Via Link" },
      { label: "Link Equipe 3", login: "https://www.canva.com/brand/join?token=Z77AdYiOly5iMDb-2sZZNw&referrer=team-invite", password: "Via Link" },
      { label: "Link Equipe 4", login: "https://www.canva.com/brand/join?token=12lZIlKv2bCbsZeHIZQmeg&referrer=team-invite", password: "Via Link" }
    ],
    isActive: true
  },
  {
    name: "CAPCUT PRO",
    description: "Editor de vídeo profissional",
    toolUrl: "https://www.capcut.com/",
    category: "design",
    instructions: "Use um dos acessos web ou baixe a versão PC (⚠️ Não atualizar a versão PC!)",
    accessCredentials: [
      { label: "Acesso Web 1", login: "fcptw25@anjay.id", password: "masuk123" },
      { label: "Acesso Web 2", login: "vntur72@anjay.id", password: "masuk123" },
      { label: "Acesso Web 3", login: "zqbui66@anjay.id", password: "masuk123" }
    ],
    isActive: true
  },
  {
    name: "ENVATO ELEMENTS",
    description: "Biblioteca de recursos digitais premium",
    toolUrl: "Via AdsPoswer",
    category: "design",
    instructions: "Acesse via AdsPoswer - ⚠️ Se não entrar, use perfil +50 Ferramentas SEO",
    accessCredentials: [
      { label: "Via AdsPoswer", login: "membrosdominando3@gmail.com", password: "%s2vRO@EoHj1)aWESA$e" }
    ],
    isActive: true
  },
  {
    name: "FREEPIK",
    description: "Recursos gráficos para designers",
    toolUrl: "Via AdsPoswer",
    category: "design",
    instructions: "Acesse via AdsPoswer",
    accessCredentials: [
      { label: "Via AdsPoswer", login: "membrosdominando3@gmail.com", password: "%s2vRO@EoHj1)aWESA$e" }
    ],
    isActive: true
  },
  {
    name: "REMINI PRO",
    description: "Melhorador de qualidade de imagem com IA",
    toolUrl: "Via AdsPoswer",
    category: "design",
    instructions: "Acesse via AdsPoswer",
    accessCredentials: [
      { label: "Via AdsPoswer", login: "ads3.12acesso@gmail.com", password: ",YXfZn/KcwdB#vDVAq*X" }
    ],
    isActive: true
  },
  {
    name: "FLATICON",
    description: "Banco de ícones e stickers",
    toolUrl: "Via AdsPoswer",
    category: "cortesia",
    instructions: "Ferramenta de cortesia - Use um dos acessos via AdsPoswer",
    accessCredentials: [
      { label: "Acesso 1", login: "sidneimartins2025@gmail.com", password: "(FXSUk-Pc7s8%nS8zz-Y" },
      { label: "Acesso 2", login: "ads3.12acesso@gmail.com", password: ",YXfZn/KcwdB#vDVAq*X" }
    ],
    isActive: true
  },

  // ============ CATEGORIA 4: FERRAMENTAS DE SEO (3 ferramentas) ============
  {
    name: "SEMRUSH",
    description: "Plataforma completa de marketing digital e SEO",
    toolUrl: "https://rankerfox.com/login/",
    category: "seo",
    instructions: "⚠️ IMPORTANTE: GUIA ANÔNIMA! Loga e clica em 'Go to Premium Plan'",
    accessCredentials: [
      { label: "Acesso Principal", login: "facectrloficial@gmail.com", password: "Fuuurjjofd231332@@" }
    ],
    isActive: true
  },
  {
    name: "+80 FERRAMENTAS DE SEO",
    description: "Conjunto completo de ferramentas SEO via RankerFox",
    toolUrl: "https://rankerfox.com/login/",
    category: "seo",
    instructions: "Acesse com as mesmas credenciais do SemRush",
    accessCredentials: [
      { label: "Acesso Principal", login: "facectrloficial@gmail.com", password: "Fuuurjjofd231332@@" }
    ],
    isActive: true
  },
  {
    name: "SIMILAR WEB",
    description: "Análise de tráfego e mercado",
    toolUrl: "Via AdsPoswer",
    category: "seo",
    instructions: "⚠️ IMPORTANTE: GUIA ANÔNIMA! Acesse via AdsPoswer",
    accessCredentials: [
      { label: "Via AdsPoswer", login: "membrosdominando3@gmail.com", password: "#b045n*LduY1#M2AHH!8" }
    ],
    isActive: true
  },

  // ============ CATEGORIA 5: INFOPRODUTOS PARA REVENDA ============
  {
    name: "EDUZZ",
    description: "Plataforma de produtos digitais para revenda",
    toolUrl: "https://sun.eduzz.com/",
    category: "infoprodutos",
    instructions: "Use o acesso fornecido para fazer login",
    accessCredentials: [
      { label: "Acesso Principal", login: "jstory.contato@gmail.com", password: "Mayquera777@" }
    ],
    isActive: true
  },
  {
    name: "MONETIZZE",
    description: "Marketplace de produtos digitais",
    toolUrl: "https://app.monetizze.com.br/painel/inicio",
    category: "infoprodutos",
    instructions: "Use o acesso fornecido para fazer login",
    accessCredentials: [
      { label: "Acesso Principal", login: "jstory.contato@gmail.com", password: "Mayquera777@" }
    ],
    isActive: true
  },
  {
    name: "HOTMART",
    description: "Maior plataforma de produtos digitais do Brasil",
    toolUrl: "https://app-vlc.hotmart.com/login",
    category: "infoprodutos",
    instructions: "Use o acesso fornecido para fazer login",
    accessCredentials: [
      { label: "Acesso Principal", login: "jstory.contato@gmail.com", password: "Mayquera777@" }
    ],
    isActive: true
  },
  {
    name: "KIWIFY",
    description: "Plataforma de vendas de produtos digitais",
    toolUrl: "https://dashboard.kiwify.com.br/login",
    category: "infoprodutos",
    instructions: "Use o acesso fornecido para fazer login",
    accessCredentials: [
      { label: "Acesso Principal", login: "jstory.contato@gmail.com", password: "Mayquera777@" }
    ],
    isActive: true
  },
  {
    name: "BRAIP",
    description: "Gateway de pagamento e marketplace digital",
    toolUrl: "https://app.braip.com/",
    category: "infoprodutos",
    instructions: "Use o acesso fornecido para fazer login",
    accessCredentials: [
      { label: "Acesso Principal", login: "jstory.contato@gmail.com", password: "Mayquera777@" }
    ],
    isActive: true
  },

  // ============ CATEGORIA 6: CONTAS ADSPOWER PRINCIPAIS ============
  {
    name: "AdsPoswer - Perfil +80 Ferramentas",
    description: "Perfil principal com acesso a mais de 80 ferramentas",
    toolUrl: "https://www.adspower.com/pt/download",
    category: "manutencao",
    instructions: "Baixe o AdsPoswer e use as credenciais para acessar o perfil +80 FERRAMENTAS",
    accessCredentials: [
      { label: "Acesso Principal", login: "membrosdominando3@gmail.com", password: "membrosdominandoacessoplus123" }
    ],
    isActive: true
  },
  {
    name: "AdsPoswer - Perfil +50 Ferramentas SEO",
    description: "Perfil especializado em ferramentas de SEO",
    toolUrl: "https://www.adspower.com/pt/download",
    category: "manutencao",
    instructions: "Baixe o AdsPoswer e use as credenciais para acessar o perfil +50 Ferramentas SEO",
    accessCredentials: [
      { label: "Acesso Principal", login: "sidneimartins2025@gmail.com", password: "(FXSUk-Pc7s8%nS8zz-Y" }
    ],
    isActive: true
  },
  {
    name: "AdsPoswer - Perfil Ferramentas Extras",
    description: "Perfil com ferramentas complementares",
    toolUrl: "https://www.adspower.com/pt/download",
    category: "manutencao",
    instructions: "Baixe o AdsPoswer e use as credenciais para acessar ferramentas extras",
    accessCredentials: [
      { label: "Acesso Principal", login: "ads3.12acesso@gmail.com", password: ",YXfZn/KcwdB#vDVAq*X" }
    ],
    isActive: true
  }
];

export async function seedAITools() {
  logger.info("\n🚀 Iniciando seed de ferramentas IA...\n");

  const testTool = await db.select().from(aiTools).where(eq(aiTools.name, "dfsfsdfsd"));
  if (testTool.length > 0) {
    await db.delete(aiTools).where(eq(aiTools.name, "dfsfsdfsd"));
    logger.debug("✅ Ferramenta de teste 'dfsfsdfsd' removida\n");
  }

  const existingTools = await db.select().from(aiTools);

  if (existingTools.length > 0) {
    logger.debug(`ℹ️  ${existingTools.length} ferramentas já existem no banco.`);
    logger.debug("🔄 Continuando com o seed...\n");
  }


  let created = 0;
  let errors = 0;

  for (const tool of aiToolsData) {
    try {
      logger.debug(`📌 Criando: ${tool.name}...`);
      await db.insert(aiTools).values(tool);
      logger.debug(`✅ ${tool.name} criado com sucesso!`);
      created++;
    } catch (error: any) {
      if (error.code === '23505') {
        logger.debug(`⚠️  ${tool.name} já existe, pulando...`);
      } else {
        logger.error(`❌ Erro ao criar ${tool.name}:`, error.message);
        errors++;
      }
    }
  }

  logger.info("\n════════════════════════════════════════");
  logger.info(`✅ Ferramentas criadas: ${created}`);
  logger.info(`❌ Erros: ${errors}`);
  logger.info("════════════════════════════════════════\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedAITools()
    .then(() => {
      logger.info("✅ Seed concluído!\n");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("❌ Erro no seed:", error);
      process.exit(1);
    });
}