# Kit de motion (global `K`) — já carregado na página

Fontes (Inter, Inter Tight, Instrument Serif, Caveat, JetBrains Mono), cores do tema, sombras realistas e as peças abaixo já existem. Use o kit; não recrie em CSS o que ele já faz.

## Tempo
- `K.prog(t, inicio, dur)` → 0..1 · `K.tween(t, inicio, dur, de, para, ease)` · `K.lerp` · `K.clamp`
- `K.ease`: linear, in, out, inOut, outExpo, inExpo, inOutExpo, outBack, spring
- `K.seed(n)` → gerador aleatório determinístico (nunca use Math.random)

## Estados (somáveis) e aplicação
Cada função `...S` devolve um estado `{x, y, scale, rotate, rx, ry, opacity, blur}`. `K.set(el, estadoA, estadoB, ...)` soma e aplica.
**Um único `K.set` por elemento por quadro** (para combinar, passe vários estados no mesmo `K.set`). O `transform` inline inicial do elemento (ex.: `translate(-50%,-50%)`) é preservado.
- `K.enterS(t, em, {dur:.7, y:40, x:0, blur:18, scale:.96, rotate:0, rx:0, ry:0, ease:"outExpo"})` — entra desfocado → nítido
- `K.exitS(t, ate, {dur:.45, y:-24, blur:16, scale:1.03})` — some até "ate"
- `K.inOutS(t, entra, sai, oIn, oOut)` / atalho `K.show(el, t, entra, sai)`
- `K.popS(t, em, {from:.4})` — pulo elástico (ícones, checks, selos)
- `K.floatS(t, {amp:10, speed:.45, phase:0, rot:0})` — flutuação contínua (use em quase tudo que fica na tela)
- `K.tiltS(t, inicio, fim, {rxFrom:8, rxTo:2, ryFrom:-10, ryTo:6})` — deriva 3D lenta (telas e cartões)
- `K.cameraS(t, inicio, fim, {from:1, to:1.06, x, y})` — aproximação lenta
- `K.slideS(t, em, {x, y, dur:.8})` · `K.shakeS(t, em, {amp:10, dur:.35})` · `K.stampS(t, em)` (carimbo com impacto)

## Cenas
`var c = K.scene(elDaCena, t, i)` → controla a transição da cena i (entra/sai com desfoque e escala, sobrepondo as cenas) e devolve `{on, local, p, start, end}`. Só anime o conteúdo quando `c.on`. Os tempos vêm de `MOTION.scenes[i].start/end`.

## Texto
- `K.headline(el, t, i)` — escreve `MOTION.scenes[i].tela` palavra por palavra **no ritmo da narração** (desfoque → nítido). Use em `<h1 class="k-headline">`.
- `K.words(el, texto, t, {scene:i} | {start, end} | [t1, t2...])` — mesmo efeito para outro texto
- Marcação no texto: `*palavra*` = cor de destaque · `_palavra_` = serifada itálica em destaque · `\n` = quebra de linha
- `K.count(el, t, em, dur, de, para, {prefix, suffix, decimals})` — contador pt-BR (1.600, 4,8)
- `K.type(el, texto, t, em, {cps:26})` — digitação com cursor piscando (bom em `.k-code`)

## Peças prontas (`K.ui.*` devolvem HTML; monte uma vez, fora do renderFrame)
- `K.ui.browser({url, w, h, asset: i | content: html | site: {brand, title, subtitle, cta, tag}})` — janela macOS com site realista
- `K.ui.phone({w:420, asset: i | content | app: {title, subtitle}})` — iPhone · `K.ui.laptop({w:900, asset | content | site})`
- `K.ui.siteMock({...})` / `K.ui.appMock({...})` — telas genéricas realistas quando não há print do cliente
- `K.ui.button(texto, {variant: "primary"|"glow"|"ghost", icon: "arrow"|"whatsapp"|..., iconLeft})` — "glow" = pílula laranja com brilho (premium). Anime o reflexo com `K.sheen(el, t, em)`
- `K.ui.badge(texto, {icon, glass})` · `K.ui.chip(texto, "good"|"bad"|"warn"|"accent")` · `K.ui.price("R$ 5.000", {muted})` · `K.ui.stamp("Vencida")`
- `K.ui.note("quebrado!", {dir: "left"|"right"|"up"|"down", color})` — anotação à mão com seta; desenhe a seta com `K.draw(el.querySelector(".k-arrow"), t, em, .5)`
- `K.ui.stat(valor, legenda)` · `K.ui.check()` · `K.ui.bar()` + `K.bar(el, t, em, dur, pct)` · `K.ui.gauge(tam)` + `K.gauge(el, t, em, dur, valor0a100, cor)`
- `K.ui.toggle()` + `K.toggle(el, t, em)` · `K.ui.avatar("AB")` · `K.ui.bubble(texto, "me"|"them")` (conversa) · `K.ui.lines(n)` (linhas de conteúdo)
- `K.icon(nome, tamanho, cor)` — check, x, arrow, arrowUp, star, bolt, clock, shield, chart, user, cart, mail, globe, phone, lock, heart, sparkle, plug, alert, calendar, rocket, dollar, play, whatsapp, instagram, gift, trend, target, book
- Classes: `.k-card` `.k-card-title` `.k-row` `.k-col` `.k-divider` `.k-h1` `.k-h2` `.k-h3` `.k-giant` `.k-p` `.k-small` `.k-em` `.k-serif` `.k-hand` `.k-grad` `.k-code` `.k-glass` `.k-floor`

## Interação e movimento
- `K.cursor(t, [{t, x, y, click}], {label, hideAt})` — cursor real com etiqueta, clique com onda (registra o som). Chame em todo quadro; fora da cena chame `K.cursor(t, [])`.
- `K.marquee(el, t, velocidade)` — faixa rolando (duplique o conteúdo dentro do elemento)
- `K.draw(pathSvg, t, em, dur)` — desenha traços

## Tema, fundo e ativos
- `K.theme("produto" | "premium", [corDestaque, corDestaque2])` — chame primeiro. Depois `K.background()` (uma vez) e `K.backgroundFrame(t)` (todo quadro).
- `K.asset(i)` → `{url, tipo, descricao}` dos anexos do cliente (logo, prints, fotos) · `K.img(i, estiloCss)` → `<img>`
- `K.W()` / `K.H()` — largura/altura do palco

## Sons
Transições, cliques, carimbos e digitação já registram seus sons sozinhos. Para outros momentos: `K.sfx("pop"|"impacto"|"subida"|"sucesso"|"whoosh", t)` (chame na montagem, fora do renderFrame).
