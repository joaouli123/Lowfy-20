import { useState, useEffect } from 'react';
import Navbar from '@/components/landing/Navbar';
import { Instagram, Youtube, Facebook, Mail, Phone } from 'lucide-react';

const TermsOfUse = () => {
  const [theme, setTheme] = useState<string>('dark');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('lowfy-theme') || 'dark';
      setTheme(savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('lowfy-theme', newTheme);
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(newTheme);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-[#050505] dark:text-gray-100 font-sans overflow-x-hidden transition-colors duration-500">
      <Navbar toggleTheme={toggleTheme} isDark={theme === 'dark'} />

      {/* Main Content */}
      <main className="pt-32 pb-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-4">Termos de Uso</h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">Última atualização: Novembro 2024</p>
          </div>

          <div className="prose dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">1. Aceitação dos Termos</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Ao acessar e utilizar a plataforma Lowfy, você concorda em cumprir e estar vinculado por estes Termos de Uso. Se você não concorda com qualquer parte destes termos, você não deve utilizar nossa plataforma.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">2. Acesso à Plataforma</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Você é responsável por manter a confidencialidade de suas credenciais de acesso e por todas as atividades que ocorrem em sua conta. Você concorda em notificar imediatamente sobre qualquer uso não autorizado de sua conta.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">3. Assinatura e Pagamentos</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                A Lowfy oferece planos de assinatura mensais e anuais. Ao assinar:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
                <li>Os pagamentos são processados via PIX ou cartão de crédito através de nossos parceiros Podpay e Asaas</li>
                <li>A assinatura renova automaticamente até o cancelamento</li>
                <li>Não oferecemos reembolso após confirmação do pagamento, exceto em casos de falha técnica da plataforma</li>
                <li>Você deve ativar sua conta em até 7 dias após o pagamento</li>
                <li>O cancelamento pode ser feito a qualquer momento, mas não gera reembolso proporcional</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">4. Marketplace e Comissões</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Nossa plataforma permite que usuários vendam produtos PLR através do marketplace:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
                <li>A Lowfy cobra uma comissão de 20% sobre cada venda realizada</li>
                <li>Os vendedores recebem 80% do valor da venda</li>
                <li>Pagamentos aos vendedores são liberados 7 dias após confirmação da compra</li>
                <li>Transferências são realizadas via PIX para a chave cadastrada</li>
                <li>Vendedores são responsáveis por declarar seus ganhos às autoridades fiscais</li>
                <li>A Lowfy não se responsabiliza por disputas entre compradores e vendedores</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">5. Programa de Afiliados</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Usuários podem indicar novos assinantes e receber comissões:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
                <li>Comissão de 30% sobre assinaturas indicadas</li>
                <li>Pagamento liberado 7 dias após confirmação da assinatura</li>
                <li>Comissões são pagas mensalmente via PIX</li>
                <li>É proibido usar métodos enganosos para gerar indicações</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">6. Uso Aceitável</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Você concorda em não utilizar a plataforma para:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
                <li>Transmitir conteúdo ilegal, abusivo, pornográfico ou prejudicial</li>
                <li>Violar direitos autorais ou propriedade intelectual de terceiros</li>
                <li>Realizar fraudes, golpes ou atividades enganosas</li>
                <li>Prejudicar a funcionalidade ou segurança da plataforma</li>
                <li>Criar múltiplas contas para burlar limitações</li>
                <li>Revender acesso à plataforma sem autorização</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">7. Propriedade Intelectual</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Todo o conteúdo da plataforma (textos, gráficos, logotipos, imagens, vídeos, software, templates, cursos) é propriedade da Lowfy ou de seus licenciadores. Conteúdos com licença PLR seguem termos específicos descritos na página de Licença PLR.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">8. Cancelamento e Suspensão</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Cancelamento de assinatura:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
                <li>Pode ser feito a qualquer momento pelo painel do usuário</li>
                <li>Não gera reembolso de valores já pagos</li>
                <li>Acesso permanece até o fim do período contratado</li>
                <li>A Lowfy reserva o direito de suspender contas que violem estes termos</li>
                <li>Suspensão por violação não gera direito a reembolso</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">6. Limitação de Responsabilidade</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                A Lowfy não será responsável por danos indiretos, incidentais, especiais, consequentes ou punitivos resultantes do uso ou incapacidade de usar a plataforma.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">7. Modificações dos Termos</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Reservamos o direito de modificar estes Termos de Uso a qualquer momento. As alterações entram em vigor imediatamente após a publicação. Seu uso contínuo da plataforma constitui aceitação das mudanças.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">8. Obrigações Fiscais</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Usuários que obtêm receita através da plataforma são responsáveis por:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
                <li>Declarar ganhos na Receita Federal conforme legislação vigente</li>
                <li>Emitir notas fiscais quando aplicável</li>
                <li>Pagar impostos devidos sobre comissões e vendas</li>
                <li>Manter regularidade fiscal</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                A Lowfy não se responsabiliza por obrigações tributárias dos usuários.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">9. Contato</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Para dúvidas sobre estes Termos de Uso, entre em contato: contato@lowfy.com.br
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-[#050505] pt-16 pb-8 border-t border-gray-200 dark:border-gray-900 transition-colors duration-500 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center gap-3 mb-6">
                <img src="/logo-white.webp" alt="Lowfy - Plataforma de Marketing Digital" className="h-8 w-auto hidden dark:block transition-all" width="120" height="32" loading="lazy" decoding="async" />
                <img src="/logo-dark.webp" alt="Lowfy - Plataforma de Marketing Digital" className="h-8 w-auto block dark:hidden transition-all" width="120" height="32" loading="lazy" decoding="async" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
                O ecossistema definitivo para quem quer dominar o marketing digital sem gastar uma fortuna.
              </p>
              <div className="flex gap-4">
                <a href="https://www.instagram.com/lowfybr/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-dark-800 flex items-center justify-center text-gray-500 hover:text-[#29654f] hover:bg-[#29654f]/10 transition-colors">
                  <Instagram size={18} />
                </a>
                <a href="https://www.facebook.com/p/Lowfy-61551759668769/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-dark-800 flex items-center justify-center text-gray-500 hover:text-[#29654f] hover:bg-[#29654f]/10 transition-colors">
                  <Facebook size={18} />
                </a>
                <a href="https://www.youtube.com/@lowfy_plrs" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-dark-800 flex items-center justify-center text-gray-500 hover:text-[#29654f] hover:bg-[#29654f]/10 transition-colors">
                  <Youtube size={18} />
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-gray-900 dark:text-white text-base mb-6">Plataforma</h4>
              <ul className="space-y-4 text-gray-600 dark:text-gray-400">
                <li><a href="/#features" className="hover:text-[#29654f] dark:hover:text-[#4ade80] transition-colors">Ferramentas</a></li>
                <li><a href="/#cloner" className="hover:text-[#29654f] dark:hover:text-[#4ade80] transition-colors">Clonador de Páginas</a></li>
                <li><a href="/#community" className="hover:text-[#29654f] dark:hover:text-[#4ade80] transition-colors">Comunidade</a></li>
                <li><a href="/#pricing" className="hover:text-[#29654f] dark:hover:text-[#4ade80] transition-colors">Assinar Agora</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-gray-900 dark:text-white text-base mb-6">Legal</h4>
              <ul className="space-y-4 text-gray-600 dark:text-gray-400">
                <li><a href="/termos" className="hover:text-[#29654f] dark:hover:text-[#4ade80] transition-colors">Termos de Uso</a></li>
                <li><a href="/privacidade" className="hover:text-[#29654f] dark:hover:text-[#4ade80] transition-colors">Política de Privacidade</a></li>
                <li><a href="/licenca-plr" className="hover:text-[#29654f] dark:hover:text-[#4ade80] transition-colors">Licença de PLR</a></li>
                <li><a href="/direitos-autorais" className="hover:text-[#29654f] dark:hover:text-[#4ade80] transition-colors">Direitos Autorais</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-gray-900 dark:text-white text-base mb-6">Contato</h4>
              <ul className="space-y-4 text-gray-600 dark:text-gray-400">
                <li className="flex items-center gap-3">
                  <Mail size={16} className="text-[#29654f]" />
                  contato@lowfy.com.br
                </li>
                <li className="flex items-center gap-3">
                  <Phone size={16} className="text-[#29654f]" />
                  +55 (41) 99907-7637
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-800 pt-8">
            <p className="text-gray-500 text-xs">
              © 2025 Lowfy Tecnologia Ltda. CNPJ 47.394.596/0001-15. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TermsOfUse;
