import { Badge } from "@/components/ui/badge";

export function BentoFeatures() {
  const features = [
    {
      title: "Sua Campanha Pronta em Minutos Criada 100% por IA",
      desc: "A ferramenta que cria toda a sua campanha no Meta Ads automaticamente: copys dos criativos, variações e estrutura completa tudo otimizado para a nova atualização Andromeda. É só clicar e gerar.",
      image: "/meta-ads.webp",
      span: "",
    },
    {
      title: "O Arsenal Premium Que Todo Site Profissional Precisa",
      desc: "Acesse mais de 17 plugins premium atualizados Elementor Pro, JetEngine, WP Rocket, Smush Pro e muito mais. Tudo o que seu WordPress precisa para ficar rápido, poderoso e ilimitado.",
      image: "/wordpress-arsenal.webp",
      span: "",
    },
    {
      title: "Automatize Tudo com N8N e Escale Sem Limites",
      desc: "153 templates prontos de automação para N8N. Organize e-mails, integre Telegram, automatize WordPress e conecte tudo o que importa instantaneamente.",
      image: "/n8n-automation.webp",
      span: "",
    },
    {
      title: "Templates Prontos Que Transformam Seu Site em Máquina de Vendas",
      desc: "Acesse mais de 250 landing pages, sites e templates profissionais para WordPress e Elementor. Designs prontos para negócios, produtos e serviços — basta editar e publicar.",
      image: "/templates-collection.webp",
      span: "",
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-white dark:bg-[#0f0f0f] relative overflow-hidden border-t border-gray-200 dark:border-gray-800 transition-colors duration-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10">
          {/* Header */}
          <div className="flex gap-4 flex-col items-start">
            <div className="inline-block px-3 py-1 border border-[#ff6b35] dark:border-[#ff8c00] text-[#ff6b35] dark:text-[#ff8c00] text-xs font-bold rounded-md bg-[#ff6b35]/5 dark:bg-[#ff8c00]/5">
              Bônus Exclusivo
            </div>
            <div className="flex gap-2 flex-col">
              <h2 className="text-3xl md:text-5xl tracking-tighter max-w-xl font-black text-gray-900 dark:text-white">
                Achou que tinha acabado? Ainda tem <span className="text-[#ff6b35] dark:text-[#ff8c00]">muito mais…</span>
              </h2>
              <p className="text-base md:text-lg max-w-2xl leading-relaxed tracking-tight text-gray-600 dark:text-gray-400">
                Além de tudo que você já viu que a Lowfy vai te entregar, você ainda desbloqueia um pacote EXTRA de recursos exclusivos — feito para aumentar sua performance e encurtar seu caminho até os resultados:
              </p>
            </div>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {features.map((feature, idx) => {
              return (
                <div
                  key={idx}
                  className={`${feature.span} bg-gray-50 dark:bg-[#0f0f0f] rounded-2xl overflow-hidden border border-gray-200 dark:border-[#333] hover:border-[#ff6b35] dark:hover:border-[#ff8c00] transition-all duration-300 hover:shadow-lg dark:hover:shadow-[#ff6b35]/20 flex flex-col h-full group`}
                >
                  {/* Image Container */}
                  <div className="w-full h-48 md:h-56 overflow-hidden bg-gray-200 dark:bg-[#2a2a2a]">
                    <img
                      src={feature.image}
                      alt={`${feature.title} - Lowfy Plataforma de Marketing Digital`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      decoding="async"
                      width="340"
                      height="224"
                    />
                  </div>

                  {/* Content Container */}
                  <div className="p-6 md:p-8 flex flex-col justify-between flex-1">
                    <div>
                      <h3 className="text-lg md:text-xl font-black text-gray-900 dark:text-white mb-3 tracking-tight leading-snug">
                        {feature.title}
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                        {feature.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Text */}
          <div className="text-center mt-8 md:mt-12">
            <p className="text-base md:text-lg max-w-3xl mx-auto font-medium text-gray-600 dark:text-gray-400 leading-relaxed">
              Tudo isso incluso, sem custos adicionais — porque a Lowfy foi criada para você competir como os <span className="text-[#ff6b35] dark:text-[#ff8c00] font-bold">grandes players</span>.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
