# Lowfy — Notas para Claude Code

Ver [replit.md](replit.md) para visão geral de arquitetura (stack, features, integrações) e [PLATAFORMA-LOWFY.md](PLATAFORMA-LOWFY.md) para o inventário completo de páginas/UI/fluxos do app web.

## App nativo (futuro)

O projeto tem `app.json`/`eas.json` na raiz (scaffold Expo vazio, sem `package.json` deps de React Native ainda) — reservado para um futuro app mobile do Lowfy. Quando esse app nativo for iniciado, usar **HeroUI Native** como biblioteca de componentes e consultar a documentação via LLMs.txt:

- `https://heroui.com/native/llms.txt` — índice de referência rápida
- `https://heroui.com/native/llms-full.txt` — documentação completa
- `https://heroui.com/native/llms-components.txt` — só componentes
- `https://heroui.com/native/llms-patterns.txt` — padrões/recipes comuns

Buscar (`WebFetch`) a URL relevante antes de escrever código de UI nativa.
