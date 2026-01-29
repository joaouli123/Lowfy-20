import { useState, useEffect } from 'react';
import Navbar from '@/components/landing/Navbar';
import { Instagram, Youtube, Facebook, Mail, Phone } from 'lucide-react';

const PrivacyPolicy = () => {
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
            <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-4">Política de Privacidade</h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">Última atualização: Novembro 2024</p>
          </div>

          <div className="prose dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">1. Informações que Coletamos</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Em conformidade com a LGPD (Lei Geral de Proteção de Dados - Lei 13.709/2018), coletamos:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
                <li><strong>Dados de cadastro:</strong> nome, e-mail, telefone, CPF, data de nascimento</li>
                <li><strong>Dados financeiros:</strong> chave PIX, informações de pagamento (processadas por Podpay/Asaas)</li>
                <li><strong>Dados de uso:</strong> páginas visitadas, tempo de acesso, IP, dispositivo utilizado</li>
                <li><strong>Dados de conteúdo:</strong> posts, comentários, produtos vendidos, páginas clonadas</li>
                <li><strong>Cookies e rastreamento:</strong> preferências, sessão de login, analytics</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">2. Como Usamos Suas Informações</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Usamos suas informações para:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
                <li>Fornecer, manter e melhorar nossos serviços</li>
                <li>Processar transações e enviar confirmações</li>
                <li>Enviar notificações e atualizações importantes</li>
                <li>Analisar como você usa a plataforma para melhorias</li>
                <li>Proteger contra fraude e segurança</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">3. Compartilhamento de Dados</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Compartilhamos seus dados apenas quando necessário:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
                <li><strong>Processadores de pagamento:</strong> Podpay e Asaas (para processar transações)</li>
                <li><strong>Serviço de SMS:</strong> Comtele (para verificação de telefone)</li>
                <li><strong>Armazenamento:</strong> Google Drive (para backup de arquivos)</li>
                <li><strong>Autoridades:</strong> quando exigido por lei ou ordem judicial</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                Não vendemos seus dados para terceiros.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">3.1. Conformidade com LGPD</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                De acordo com a LGPD, você tem os seguintes direitos:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
                <li>Confirmação da existência de tratamento de dados</li>
                <li>Acesso aos dados pessoais armazenados</li>
                <li>Correção de dados incompletos, inexatos ou desatualizados</li>
                <li>Anonimização, bloqueio ou eliminação de dados desnecessários</li>
                <li>Portabilidade dos dados a outro fornecedor</li>
                <li>Eliminação dos dados tratados com seu consentimento</li>
                <li>Revogação do consentimento</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                Para exercer esses direitos, entre em contato através de contato@lowfy.com.br
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">4. Segurança de Dados</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Implementamos medidas de segurança técnicas, administrativas e físicas para proteger suas informações contra acesso, alteração ou destruição não autorizados.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">5. Cookies e Tecnologias Similares</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Usamos cookies para melhorar sua experiência, manter você conectado e entender como você usa nossa plataforma. Você pode controlar as preferências de cookies em seu navegador.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">6. Seus Direitos</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Você tem o direito de acessar, corrigir ou excluir suas informações pessoais. Para exercer esses direitos, entre em contato conosco através do e-mail fornecido.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">7. Retenção de Dados</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Retemos suas informações pessoais pelo tempo necessário para fornecer nossos serviços ou conforme exigido por lei. Você pode solicitar a exclusão a qualquer momento.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">8. Alterações nesta Política</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Podemos atualizar esta política de privacidade periodicamente. Recomendamos que você revise esta página regularmente para se manter informado sobre como protegemos suas informações.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">9. Contato</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Se você tiver dúvidas sobre esta Política de Privacidade, entre em contato: contato@lowfy.com.br
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

export default PrivacyPolicy;
