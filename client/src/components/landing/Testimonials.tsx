import { TestimonialsColumn } from "@/components/landing/ui/testimonials-columns-1";
import { motion } from "framer-motion";

const testimonials = [
  {
    text: "Sou da época que a Lowfy era só uns PDFs perdidos! Ver essa plataforma virar esse monstro com IA, clonador e rede social é surreal. Orgulho de ter crescido junto e lucrado em cada fase!",
    name: "Carlos Eduardo",
    role: "Empreendedor",
  },
  {
    text: "Só de cancelar meu Canva Pro e o Semrush já paguei a assinatura da Lowfy. Ter acesso a 39 ferramentas num lugar só é economia pura. O bolso agradece!",
    name: "Juliana Martins",
    role: "Criadora de Conteúdo",
  },
  {
    text: "Peguei um PLR de emagrecimento na biblioteca, usei o clonador pra subir a página e pronto. Em 24h eu já estava rodando anúncio e fazendo venda. Praticidade total.",
    name: "Felipe Bastos",
    role: "Vendedor Digital",
  },
  {
    text: "O marketing digital é solitário, né? Mas na Lowfy fiz amigos reais no fórum. A gente troca dica de tráfego, fecha parceria... O networking aqui vale mais que muito curso caro.",
    name: "Ana Clara",
    role: "Especialista em Tráfego",
  },
  {
    text: "Indico a Lowfy de olhos fechados. A comissão de 50% é recorrente, então todo mês cai um dinheiro bom na conta. Melhor programa de afiliados que já participei.",
    name: "Rodrigo Santoro",
    role: "Afiliado",
  },
  {
    text: "O acesso liberado ao ChatGPT-4 e ao Midjourney mudou meu jogo. Crio copy e imagem pra anúncio em minutos. Antes eu levava dias.",
    name: "Mariana Costa",
    role: "Gestora de Campanhas",
  },
  {
    text: "Tava perdidaça no começo. A Lowfy me deu o norte com os cursos e as ferramentas prontas. Pra quem tá começando do zero, é ouro!",
    name: "Beatriz Lima",
    role: "Iniciante",
  },
  {
    text: "Confesso: tô viciado em subir de nível na plataforma. O sistema de gamificação te prende de um jeito bom. Já sou nível Mestre e quero pegar o top do ranking!",
    name: "João Pedro",
    role: "Community Member",
  },
  {
    text: "Não saio mais da plataforma pra nada. Edito vídeo, faço copy, baixo produto e vendo. Tudo num login só. A produtividade foi lá no teto.",
    name: "André Souza",
    role: "Produtor Digital",
  },
  {
    text: "As ferramentas de mineração de anúncios salvaram minha operação de dropshipping. Achei um produto vencedor espionando a concorrência e tô escalando agora com a ajuda da Lowfy.",
    name: "Lucas Gabriel",
    role: "Dropshipper",
  },
  {
    text: "Melhor investimento do ano. A entrega é absurda pelo preço. Sem mais.",
    name: "Patrícia Gomes",
    role: "Empreendedora",
  },
  {
    text: "Tive um problema com meu domínio no clonador e o suporte resolveu rapidinho. É bom saber que tem gente séria por trás da plataforma.",
    name: "Fernanda Dias",
    role: "Designer",
  },
  {
    text: "Achei que era conversa fiada ter tanta ferramenta cara inclusa, mas funciona mesmo. O acesso compartilhado é estável e a biblioteca de PLR é gigante.",
    name: "Marcelo Vieira",
    role: "Consultor",
  },
  {
    text: "Entrei na Lowfy quando não tinha quase nada de grana. Comecei vendendo os ebooks deles e hoje vivo disso. Minha gratidão é eterna!",
    name: "Larissa Mendes",
    role: "Vendedora de Conteúdo",
  },
  {
    text: "Uso tudo: vendo meus produtos no marketplace deles, uso o clonador pra minhas LPs e ainda minero produtos novos. A Lowfy é meu escritório virtual.",
    name: "Thiago Ramos",
    role: "Entrepreneur",
  },
  {
    text: "A sacada de ter PLRs em espanhol foi genial. Peguei um e-book de saúde na biblioteca, não precisei traduzir nada e estou vendendo muito para o público da América Latina. O lucro tá sendo bem maior que no Brasil porque a concorrência lá é bem menor!",
    name: "Ricardo Mendez",
    role: "Vendedor LATAM",
  },
  {
    text: "O que mais me impressionou foi a velocidade das páginas no clonador. Meus anúncios pararam de queimar dinheiro porque o site abre voando no mobile. A conversão da minha Landing Page dobrou só de migrar para a estrutura da Lowfy.",
    name: "Camila Torres",
    role: "Gestora de Tráfego",
  },
  {
    text: "Tive uma dificuldade na configuração do DNS e chamei o suporte. Fui atendido super rápido e resolveram meu problema na hora via ticket. É raro ver plataforma com atendimento humano e ágil assim hoje em dia.",
    name: "João Vítor",
    role: "Desenvolvedor",
  },
  {
    text: "As VSLs que vêm nos pacotes de PLR são de cinema! Qualidade absurda e as legendas são perfeitas, sincronizadas direitinho. Só de colocar o vídeo na página, a retenção dos leads subiu demais.",
    name: "Larissa Bueno",
    role: "Copywriter",
  },
  {
    text: "Tô explorando o mercado LATAM com os materiais em espanhol da Lowfy. As VSLs já vêm prontas e legendadas, é só subir a campanha. Tô ganhando em dólar e gastando em real, melhor coisa!",
    name: "Pedro Alencar",
    role: "Empreendedor LATAM",
  },
  {
    text: "A infraestrutura de vocês é de outro mundo. Minhas páginas de vendas nunca carregaram tão rápido. O cliente clica e a página já tá aberta. Isso salvou meu ROI no Facebook Ads.",
    name: "Sofia Martins",
    role: "Performance Marketer",
  },
  {
    text: "O suporte da Lowfy merece nota 10. Mandei um print do meu erro no painel e me explicaram exatamente onde eu tava errando. Quem tá começando precisa dessa segurança de ter pra quem perguntar.",
    name: "Gustavo Lima",
    role: "Iniciante",
  },
  {
    text: "Eu nem sabia falar espanhol, mas baixei o kit completo em espanhol na biblioteca e subi campanha pro México. O material converte muito bem lá fora, tô lucrando 3x mais do que quando tentava vender só no Brasil.",
    name: "Mariana Sales",
    role: "Vendedora Internacional",
  },
];

const firstColumn = testimonials.slice(0, 8);
const secondColumn = testimonials.slice(8, 16);
const thirdColumn = testimonials.slice(16, 23);

export default function Testimonials() {
  return (
    <section className="bg-white dark:bg-[#0f0f0f] py-16 md:py-24 relative overflow-hidden border-t border-gray-200 dark:border-gray-900 transition-colors duration-500">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="flex flex-col items-center justify-center max-w-2xl mx-auto mb-16"
        >
          <div className="inline-block px-3 py-1 border border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400 text-xs font-bold mb-4 rounded-md bg-blue-50 dark:bg-blue-950/30">
            Depoimentos
          </div>

          <h2 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white text-center tracking-tighter mb-4">
            O que nossos <span className="text-blue-600 dark:text-blue-400">usuários dizem</span>
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm md:text-base leading-relaxed">
            Veja como a Lowfy está transformando a vida de empreendedores digitais por todo o Brasil.
          </p>
        </motion.div>

        <div className="flex justify-center gap-6 [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)] max-h-[740px] overflow-hidden">
          <TestimonialsColumn testimonials={firstColumn} duration={25} index={0} />
          <TestimonialsColumn testimonials={secondColumn} className="hidden md:flex" duration={25} index={1} />
          <TestimonialsColumn testimonials={thirdColumn} className="hidden lg:flex" duration={25} index={2} />
        </div>
      </div>
    </section>
  );
}
