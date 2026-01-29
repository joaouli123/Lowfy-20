import { useState, useEffect } from 'react';
import Navbar from '@/components/landing/Navbar';
import { Instagram, Youtube, Facebook, Mail, Phone } from 'lucide-react';

const Copyright = () => {
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
            <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-4">Direitos Autorais</h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">Copyright © 2025 Lowfy Tecnologia Ltda. Todos os direitos reservados.</p>
          </div>

          <div className="prose dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">1. Propriedade Intelectual</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Todo o conteúdo, materiais, código-fonte, designs, gráficos, imagens, vídeos e texto contidos na plataforma Lowfy são propriedade exclusiva da Lowfy Tecnologia Ltda. ou de seus fornecedores licenciados.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">2. Restrições de Uso</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Proibido reproduzir, distribuir, transmitir, exibir ou utilizar qualquer conteúdo sem autorização prévia por escrito, exceto:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
                <li>Para uso pessoal e não comercial</li>
                <li>Para fins de educação e treinamento conforme permitido pela plataforma</li>
                <li>Conforme explicitamente autorizado em licenças PLR</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">3. Aviso de Detenção de Direitos Autorais</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                © 2025 Lowfy Tecnologia Ltda. Todos os direitos reservados. Nenhuma parte desta plataforma pode ser reproduzida ou transmitida em qualquer forma ou por qualquer meio sem consentimento prévio por escrito.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">4. Garantias Sobre PLR</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Garantimos que todo o conteúdo PLR foi criado originalmente ou adquirido com permissão legal. A Lowfy garante que o conteúdo não viola direitos autorais de terceiros. Qualquer alegação de violação deve ser reportada imediatamente.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">5. Lei de Direitos Autorais Brasileira</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                A Lowfy respeita a Lei 9.610/98 (Lei de Direitos Autorais) e remove prontamente conteúdo que viole direitos de terceiros. Se você acredita que algum conteúdo em nossa plataforma viola seus direitos:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
                <li>Envie notificação para contato@lowfy.com.br</li>
                <li>Inclua seus dados completos (nome, CPF/CNPJ, endereço)</li>
                <li>Descreva a obra protegida e onde encontrou a violação</li>
                <li>Forneça prova de titularidade dos direitos autorais</li>
                <li>Declaração de boa-fé sobre a violação</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                Analisaremos em até 5 dias úteis e tomaremos as medidas cabíveis.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">6. Procedimento para Denúncia de Violação</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Para relatar violação de direitos autorais:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
                <li>Envie um e-mail para contato@lowfy.com.br</li>
                <li>Inclua descrição do trabalho protegido</li>
                <li>Descreva especificamente onde o conteúdo se encontra</li>
                <li>Forneça evidência de sua propriedade dos direitos autorais</li>
                <li>Assine digitalmente a denúncia</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">7. Marcas Registradas</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Lowfy, e seus logotipos, são marcas registradas de Lowfy Tecnologia Ltda. Você não pode usar essas marcas sem permissão por escrito.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">8. Contato para Questões de Copyright</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Para questões de copyright ou direitos autorais, entre em contato:
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                E-mail: contato@lowfy.com.br<br/>
                Telefone: +55 (41) 99907-7637
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

export default Copyright;
