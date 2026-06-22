import { type QuizSpec, type QComponent, type QuizStep } from "./quizSchema";

const uid = () => Math.random().toString(36).slice(2, 9);
const mk = (type: any, props: Record<string, any> = {}, visibility: any = { mode: "always" }): QComponent => ({ id: uid(), type, props: { ...props, _pk: type }, visibility });
const st = (name: string, components: QComponent[]): QuizStep => ({ id: uid(), name, header: { showLogo: true, showProgress: true, allowBack: true }, components });
const opt = (label: string, score = 0) => ({ id: uid(), label, score });

export interface QuizTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  build: () => Partial<QuizSpec>;
}

/** Modelos prontos (estilo "Modelos" do Inlead) usados na criação e no "+ Modelos". */
export const TEMPLATES: QuizTemplate[] = [
  {
    id: "blank", name: "Em branco", description: "Comece do zero", icon: "Plus",
    build: () => ({ steps: [st("Etapa 1", [])] }),
  },
  {
    id: "reco", name: "Quiz de recomendação", description: "Perguntas → resultado personalizado", icon: "Sparkles",
    build: () => ({
      steps: [
        st("Boas-vindas", [mk("texto", { text: "Descubra a opção ideal para você", variant: "title" }), mk("texto", { text: "Responda 3 perguntas rápidas e receba uma recomendação.", variant: "paragraph" }), mk("botao", { label: "Começar agora", action: "next", full: true })]),
        st("Pergunta 1", [mk("opcoes", { name: "objetivo", question: "Qual é o seu principal objetivo?", options: [opt("Opção A", 1), opt("Opção B", 2), opt("Opção C", 3)], required: true, autoAdvance: true })]),
        st("Pergunta 2", [mk("opcoes", { name: "experiencia", question: "Qual o seu nível de experiência?", options: [opt("Iniciante", 1), opt("Intermediário", 2), opt("Avançado", 3)], required: true, autoAdvance: true })]),
        st("Captura", [mk("captura", { title: "Quase lá!", fields: [{ type: "name", name: "nome", label: "Seu nome", required: true }, { type: "email", name: "email", label: "Seu melhor e-mail", required: true }], buttonText: "Ver minha recomendação" })]),
        st("Resultado", [mk("texto", { text: "Pronto, {{nome}}! 🎉", variant: "title" }), mk("texto", { text: "Com base nas suas respostas, preparamos a recomendação ideal para você.", variant: "paragraph" }), mk("botao", { label: "Quero saber mais", action: "url", url: "" })]),
      ],
    }),
  },
  {
    id: "leads", name: "Captura de leads", description: "Isca → captura → obrigado", icon: "UserPlus",
    build: () => ({
      steps: [
        st("Oferta", [mk("texto", { text: "Receba o material gratuito", variant: "title" }), mk("texto", { text: "Preencha abaixo para receber agora no seu e-mail.", variant: "paragraph" }), mk("captura", { title: "", fields: [{ type: "name", name: "nome", label: "Nome", required: true }, { type: "email", name: "email", label: "E-mail", required: true }, { type: "phone", name: "telefone", label: "WhatsApp", required: false }], buttonText: "Quero receber" })]),
        st("Obrigado", [mk("texto", { text: "Obrigado, {{nome}}! 🙌", variant: "title" }), mk("texto", { text: "Enviamos o material para o seu e-mail. Confira a caixa de entrada.", variant: "paragraph" })]),
      ],
    }),
  },
  {
    id: "diag", name: "Diagnóstico (score)", description: "Pontuação → resultado por faixa", icon: "Activity",
    build: () => ({
      steps: [
        st("Introdução", [mk("texto", { text: "Faça o seu diagnóstico gratuito", variant: "title" }), mk("texto", { text: "Leva menos de 2 minutos.", variant: "paragraph" }), mk("botao", { label: "Iniciar", action: "next" })]),
        st("Pergunta 1", [mk("opcoes", { name: "p1", question: "Como você avalia sua situação atual?", options: [opt("Ruim", 0), opt("Mediana", 5), opt("Boa", 10)], required: true, autoAdvance: true })]),
        st("Pergunta 2", [mk("opcoes", { name: "p2", question: "Com que frequência você age sobre isso?", options: [opt("Nunca", 0), opt("Às vezes", 5), opt("Sempre", 10)], required: true, autoAdvance: true })]),
        st("Captura", [mk("captura", { fields: [{ type: "name", name: "nome", label: "Nome", required: true }, { type: "email", name: "email", label: "E-mail", required: true }], buttonText: "Ver meu resultado" })]),
        st("Resultado", [
          mk("nivel", { label: "Sua pontuação", fromScore: true }),
          mk("texto", { text: "Atenção: há muito a melhorar.", variant: "title" }, { mode: "score", op: "<", value: 10 }),
          mk("texto", { text: "Bom trabalho! Você está no caminho certo.", variant: "title" }, { mode: "score", op: ">=", value: 10 }),
          mk("botao", { label: "Quero evoluir", action: "url", url: "" }),
        ]),
      ],
    }),
  },
  {
    id: "vsl", name: "VSL + Oferta", description: "Vídeo → prova → preço", icon: "PlayCircle",
    build: () => ({
      steps: [
        st("Apresentação", [mk("texto", { text: "Assista antes de decidir", variant: "title" }), mk("video", { url: "" }), mk("botao", { label: "Quero garantir", action: "next" })]),
        st("Prova social", [mk("texto", { text: "O que dizem nossos clientes", variant: "title" }), mk("depoimentos", { layout: "list", items: [{ name: "Maria Silva", handle: "@maria", text: "Mudou minha vida!", stars: 5 }, { name: "João Souza", handle: "@joao", text: "Resultado em poucos dias.", stars: 5 }] }), mk("botao", { label: "Ver oferta", action: "next" })]),
        st("Oferta", [mk("alerta", { text: "Oferta por tempo limitado!", variant: "warning" }), mk("timer", { minutes: 10, text: "A oferta termina em" }), mk("preco", { title: "Plano Completo", price: "R$ 297", suffix: "à vista", installments: "ou 12x de R$ 29,70", highlightText: "MAIS POPULAR", ctaLabel: "Comprar agora", url: "", priceType: "redirect", highlight: true })]),
      ],
    }),
  },
];
