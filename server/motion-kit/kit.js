/* Lowfy Motion Kit (K) — tempo, transições e peças de motion design.
 * Tudo é função do tempo t (segundos): nada de setTimeout/requestAnimationFrame.
 * Os helpers *S devolvem um "estado" (x, y, scale, opacity, blur...) que K.mix soma e K.set aplica. */
(function () {
  "use strict";
  var K = {};
  var M = function () { return window.MOTION || { duration: 10, width: 1080, height: 1920, scenes: [], words: [], assets: [] }; };

  // ---------------- matemática do tempo ----------------
  K.clamp = function (x, a, b) { a = a == null ? 0 : a; b = b == null ? 1 : b; return x < a ? a : x > b ? b : x; };
  K.lerp = function (a, b, p) { return a + (b - a) * p; };
  K.prog = function (t, start, dur) { return dur <= 0 ? (t >= start ? 1 : 0) : K.clamp((t - start) / dur); };
  K.ease = {
    linear: function (p) { return p; },
    in: function (p) { return p * p * p; },
    out: function (p) { return 1 - Math.pow(1 - p, 3); },
    inOut: function (p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; },
    outExpo: function (p) { return p >= 1 ? 1 : 1 - Math.pow(2, -10 * p); },
    inExpo: function (p) { return p <= 0 ? 0 : Math.pow(2, 10 * p - 10); },
    inOutExpo: function (p) { return p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2; },
    outBack: function (p) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
    spring: function (p) { return p >= 1 ? 1 : 1 - Math.exp(-6.5 * p) * Math.cos(10 * p); }
  };
  function E(e) { return typeof e === "function" ? e : (K.ease[e] || K.ease.out); }
  K.tween = function (t, start, dur, from, to, ease) { return K.lerp(from, to, E(ease)(K.prog(t, start, dur))); };
  K.seed = function (n) { var s = (n >>> 0) || 1; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
  K.$ = function (sel, root) { return (root || document).querySelector(sel); };
  K.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  K.esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  // ---------------- estados e aplicação ----------------
  var ZERO = { x: 0, y: 0, rotate: 0, rx: 0, ry: 0, scale: 1, opacity: 1, blur: 0 };
  K.mix = function () {
    var o = { x: 0, y: 0, rotate: 0, rx: 0, ry: 0, scale: 1, opacity: 1, blur: 0 };
    for (var i = 0; i < arguments.length; i++) {
      var s = arguments[i]; if (!s) continue;
      o.x += s.x || 0; o.y += s.y || 0; o.rotate += s.rotate || 0; o.rx += s.rx || 0; o.ry += s.ry || 0;
      o.scale *= s.scale == null ? 1 : s.scale; o.opacity *= s.opacity == null ? 1 : s.opacity; o.blur += s.blur || 0;
      if (s.origin) o.origin = s.origin;
    }
    return o;
  };
  /** Aplica um estado (ou vários, somados) no elemento. Cada elemento deve ter UM K.set por quadro. */
  K.set = function (el) {
    if (!el) return;
    var s = arguments.length > 2 ? K.mix.apply(null, Array.prototype.slice.call(arguments, 1)) : K.mix(arguments[1] || ZERO);
    var tf = "";
    if (s.rx || s.ry) tf += "perspective(2000px) ";
    tf += "translate3d(" + s.x.toFixed(2) + "px," + s.y.toFixed(2) + "px,0)";
    if (s.rx) tf += " rotateX(" + s.rx.toFixed(3) + "deg)";
    if (s.ry) tf += " rotateY(" + s.ry.toFixed(3) + "deg)";
    if (s.rotate) tf += " rotate(" + s.rotate.toFixed(3) + "deg)";
    if (s.scale !== 1) tf += " scale(" + s.scale.toFixed(4) + ")";
    var st = el.style;
    if (el.__base == null) el.__base = st.transform && st.transform !== "none" ? st.transform + " " : "";
    st.transform = el.__base + tf;
    if (s.origin) st.transformOrigin = s.origin;
    var op = K.clamp(s.opacity);
    st.opacity = op.toFixed(3);
    st.visibility = op < 0.002 ? "hidden" : "visible";
    st.filter = s.blur > 0.05 ? "blur(" + s.blur.toFixed(2) + "px)" : "none";
  };

  /** Entrada com desfoque → nítido (o "blur in" dos motions profissionais). */
  K.enterS = function (t, at, o) {
    o = o || {}; var dur = o.dur == null ? 0.7 : o.dur;
    var p = E(o.ease || "outExpo")(K.prog(t, at, dur));
    var q = 1 - p;
    return { x: (o.x || 0) * q, y: (o.y == null ? 40 : o.y) * q, rotate: (o.rotate || 0) * q, rx: (o.rx || 0) * q, ry: (o.ry || 0) * q,
      scale: K.lerp(o.scale == null ? 0.96 : o.scale, 1, p), opacity: K.clamp(K.prog(t, at, dur * 0.55)), blur: (o.blur == null ? 18 : o.blur) * q };
  };
  /** Saída: termina em "at" (começa em at - dur). */
  K.exitS = function (t, at, o) {
    o = o || {}; var dur = o.dur == null ? 0.45 : o.dur;
    var p = E(o.ease || "in")(K.prog(t, at - dur, dur));
    return { x: (o.x || 0) * p, y: (o.y == null ? -24 : o.y) * p, rotate: (o.rotate || 0) * p, scale: K.lerp(1, o.scale == null ? 1.03 : o.scale, p), opacity: 1 - p, blur: (o.blur == null ? 16 : o.blur) * p };
  };
  K.inOutS = function (t, inAt, outAt, oIn, oOut) { return K.mix(K.enterS(t, inAt, oIn), outAt == null ? null : K.exitS(t, outAt, oOut)); };
  K.show = function (el, t, inAt, outAt, oIn, oOut) { K.set(el, K.inOutS(t, inAt, outAt, oIn, oOut)); };
  /** Pulo elástico (ícones, selos, checks). */
  K.popS = function (t, at, o) {
    o = o || {}; var dur = o.dur == null ? 0.55 : o.dur; var p = K.prog(t, at, dur);
    return { scale: K.lerp(o.from == null ? 0.4 : o.from, 1, K.ease.outBack(p)), opacity: K.clamp(p * 3), blur: 6 * (1 - K.clamp(p * 2)) };
  };
  /** Flutuação contínua sutil (nada fica parado). */
  K.floatS = function (t, o) {
    o = o || {}; var a = o.amp == null ? 10 : o.amp, sp = o.speed == null ? 0.45 : o.speed, ph = o.phase || 0;
    return { y: Math.sin((t * sp + ph) * Math.PI * 2) * a, rotate: Math.sin((t * sp * 0.7 + ph) * Math.PI * 2) * (o.rot || 0) };
  };
  /** Deriva 3D lenta (cartões e telas "vivos"). Precisa de K.set com rx/ry. */
  K.tiltS = function (t, start, end, o) {
    o = o || {}; var p = K.ease.inOut(K.prog(t, start, Math.max(0.01, end - start)));
    return { rx: K.lerp(o.rxFrom == null ? 8 : o.rxFrom, o.rxTo == null ? 2 : o.rxTo, p), ry: K.lerp(o.ryFrom == null ? -10 : o.ryFrom, o.ryTo == null ? 6 : o.ryTo, p) };
  };
  /** Câmera: aproximação lenta durante a cena. */
  K.cameraS = function (t, start, end, o) {
    o = o || {}; var p = K.ease.inOut(K.prog(t, start, Math.max(0.01, end - start)));
    return { scale: K.lerp(o.from == null ? 1 : o.from, o.to == null ? 1.06 : o.to, p), x: K.lerp(0, o.x || 0, p), y: K.lerp(0, o.y || 0, p) };
  };
  /** Tremida curta (impacto). */
  K.shakeS = function (t, at, o) {
    o = o || {}; var dur = o.dur == null ? 0.35 : o.dur, amp = o.amp == null ? 10 : o.amp;
    var p = K.prog(t, at, dur); if (p <= 0 || p >= 1) return {};
    var d = (1 - p) * amp; return { x: Math.sin(p * 60) * d, y: Math.cos(p * 47) * d * 0.6, rotate: Math.sin(p * 40) * d * 0.08 };
  };
  /** Carimbo: cai grande, gira e assenta com impacto. Registra o som "carimbo". */
  K.stampS = function (t, at, o) {
    o = o || {}; cue("carimbo", at + 0.18, "stamp" + at);
    var p = K.prog(t, at, 0.32), e = K.ease.inExpo(p);
    var after = K.shakeS(t, at + 0.32, { amp: 6, dur: 0.3 });
    return K.mix({ scale: K.lerp(2.6, 1, e), rotate: K.lerp(o.rotFrom == null ? -22 : o.rotFrom, o.rot == null ? -9 : o.rot, e), opacity: K.clamp(p * 4), blur: 10 * (1 - e) }, after);
  };
  /** Desliza de um ponto (x,y) até a posição natural. */
  K.slideS = function (t, at, o) {
    o = o || {}; var p = E(o.ease || "outExpo")(K.prog(t, at, o.dur == null ? 0.8 : o.dur));
    return { x: (o.x || 0) * (1 - p), y: (o.y || 0) * (1 - p), opacity: K.clamp(K.prog(t, at, 0.25)), blur: (o.blur == null ? 10 : o.blur) * (1 - p) };
  };

  // ---------------- cenas ----------------
  /**
   * Controla o container da cena i: entra desfocando para nítido e sai desfocando (com sobreposição
   * entre cenas, como nos motions profissionais). Devolve { on, local, p, start, end }.
   */
  K.scene = function (el, t, i, o) {
    o = o || {}; var sc = M().scenes[i] || { start: 0, end: M().duration };
    var start = o.start == null ? sc.start : o.start, end = o.end == null ? sc.end : o.end;
    var last = i >= M().scenes.length - 1, first = i === 0;
    var tin = o.inDur == null ? 0.55 : o.inDur, tout = o.outDur == null ? 0.5 : o.outDur;
    var on = t >= start - 0.2 && (last || t <= end + 0.25);
    if (el) {
      el.style.display = on ? "block" : "none";
      if (on) {
        if (!first) cue("whoosh", start - 0.12, "scene" + i);
        K.set(el, first ? null : K.enterS(t, start - 0.15, { dur: tin + 0.15, y: 0, blur: 26, scale: 1.05 }),
          last ? null : K.exitS(t, end + 0.2, { dur: tout, y: 0, blur: 22, scale: 0.97 }));
      }
    }
    return { on: on, local: t - start, p: K.prog(t, start, Math.max(0.01, end - start)), start: start, end: end };
  };
  /** Índice da cena no tempo t. */
  K.sceneAt = function (t) { var s = M().scenes; for (var i = s.length - 1; i >= 0; i--) if (t >= s[i].start) return i; return 0; };

  // ---------------- texto ----------------
  function norm(w) { return String(w || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9%$]/g, ""); }
  /** Monta as palavras (uma vez). Marcação: *destaque* (cor de acento), _serifada itálica_, "\n" quebra linha. */
  function buildWords(el, text) {
    if (el.__words && el.__text === text) return el.__words;
    el.__text = text; el.innerHTML = "";
    var words = [], parts = String(text).split(/(\n)/);
    parts.forEach(function (part) {
      if (part === "\n") { el.appendChild(document.createElement("br")); return; }
      // destaque pode vir colado na pontuação: "*lento*?" → palavra "lento" em destaque + "?"
      var re = /(\*[^*]+\*[^\s*_]*|_[^_]+_[^\s*_]*|\S+)/g, m;
      while ((m = re.exec(part))) {
        var tok = m[1], cls = "", tail = "";
        var mm = /^([*_])([^*_]+)\1(.*)$/.exec(tok);
        if (mm) { cls = mm[1] === "*" ? "k-em" : "k-serif k-em"; tok = mm[2]; tail = mm[3]; }
        var list = tok.split(/\s+/).filter(Boolean);
        list.forEach(function (w, k) {
          var s = document.createElement("span"); s.className = "k-word";
          var last = k === list.length - 1;
          s.innerHTML = (cls ? '<span class="' + cls + '">' + K.esc(w) + "</span>" : K.esc(w)) + (last ? K.esc(tail) : "") + " ";
          el.appendChild(s); words.push({ el: s, w: w });
        });
      }
    });
    el.__words = words; return words;
  }
  /** Horário de cada palavra da tela casando com a fala da cena (MOTION.words). */
  function sceneTimes(words, i) {
    var sc = M().scenes[i] || { start: 0, end: M().duration };
    var spoken = (M().words || []).filter(function (w) { return w.start >= sc.start - 0.05 && w.start < sc.end; });
    var times = [], j = 0;
    words.forEach(function (w) {
      var n = norm(w.w), found = -1;
      for (var k = j; k < Math.min(spoken.length, j + 8); k++) if (norm(spoken[k].w) === n) { found = k; break; }
      if (found >= 0) { times.push(spoken[found].start); j = found + 1; } else times.push(null);
    });
    // palavras sem par: espalha entre as vizinhas (ou pelo começo da cena)
    var speechEnd = spoken.length ? spoken[spoken.length - 1].end : sc.end;
    for (var a = 0; a < times.length; a++) {
      if (times[a] != null) continue;
      var prev = a ? times[a - 1] : sc.start + 0.05, b = a; while (b < times.length && times[b] == null) b++;
      var next = b < times.length ? times[b] : Math.min(speechEnd, prev + 0.35 * (b - a + 1));
      for (var c = a; c < b; c++) times[c] = prev + ((next - prev) * (c - a + 1)) / (b - a + 1);
      a = b - 1;
    }
    return times;
  }
  /**
   * Revela o texto palavra por palavra com desfoque. timing:
   *  { scene: i }  → no ritmo da narração da cena i (recomendado para a manchete)
   *  { start, end } → espalha no intervalo;  [t1, t2, ...] → horário de cada palavra
   */
  K.words = function (el, text, t, timing, o) {
    if (!el) return; o = o || {};
    var words = buildWords(el, text), times;
    if (Array.isArray(timing)) times = timing;
    else if (timing && timing.scene != null) { var key = "s" + timing.scene + "|" + text; if (el.__tkey !== key) { el.__times = sceneTimes(words, timing.scene); el.__tkey = key; } times = el.__times; }
    else { var st = (timing && timing.start) || 0, en = (timing && timing.end) || st + words.length * 0.18; times = words.map(function (_, k) { return st + ((en - st) * k) / Math.max(1, words.length); }); }
    words.forEach(function (w, k) { K.set(w.el, K.enterS(t, (times[k] || 0) - (o.lead == null ? 0.06 : o.lead), { dur: o.dur || 0.5, y: o.y == null ? 26 : o.y, blur: o.blur == null ? 14 : o.blur, scale: 1 })); });
  };
  /** Manchete da cena i: o texto curto da tela, sincronizado com a voz. */
  K.headline = function (el, t, i, text, o) { K.words(el, text != null ? text : (M().scenes[i] || {}).tela || "", t, { scene: i }, o); };
  /** Contador numérico (pt-BR). */
  K.count = function (el, t, at, dur, from, to, o) {
    if (!el) return; o = o || {};
    var v = K.lerp(from, to, E(o.ease || "outExpo")(K.prog(t, at, dur)));
    var d = o.decimals || 0;
    el.textContent = (o.prefix || "") + v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: o.sep !== false }) + (o.suffix || "");
  };
  /** Digitação com cursor piscando. */
  K.type = function (el, text, t, at, o) {
    if (!el) return; o = o || {}; var cps = o.cps || 26;
    var n = Math.floor(K.clamp((t - at) * cps, 0, text.length));
    var caret = o.caret === false ? "" : '<span class="k-caret" style="opacity:' + (n < text.length || Math.floor(t * 2.2) % 2 === 0 ? 1 : 0) + '"></span>';
    el.innerHTML = K.esc(text.slice(0, n)).replace(/\n/g, "<br>") + caret;
    if (n > 0 && n < text.length) cue("digitar", at, "type" + at);
  };
  /** Desenha um traço SVG (setas, sublinhados, gráficos). */
  K.draw = function (path, t, at, dur, ease) {
    if (!path) return;
    if (!path.__len) { path.__len = path.getTotalLength ? path.getTotalLength() : 1000; path.style.strokeDasharray = path.__len; }
    path.style.strokeDashoffset = (path.__len * (1 - E(ease || "inOut")(K.prog(t, at, dur)))).toFixed(1);
  };
  /** Barra de progresso (.k-bar > i). */
  K.bar = function (el, t, at, dur, pct) { if (el && el.firstElementChild) el.firstElementChild.style.width = (pct * E("outExpo")(K.prog(t, at, dur))).toFixed(2) + "%"; };
  /** Medidor semicircular criado por K.ui.gauge(). */
  K.gauge = function (el, t, at, dur, value, color) {
    var p = el && el.querySelector(".k-gauge-val"); if (!p) return;
    if (!p.__len) { p.__len = p.getTotalLength(); p.style.strokeDasharray = p.__len; }
    var v = K.clamp(value / 100) * E("outExpo")(K.prog(t, at, dur));
    p.style.strokeDashoffset = (p.__len * (1 - v)).toFixed(1);
    if (color) p.style.stroke = color;
  };
  /** Faixa rolando em loop (o conteúdo deve estar duplicado dentro do elemento). */
  K.marquee = function (el, t, speed, dir) {
    if (!el) return; var w = el.__w || (el.__w = el.scrollWidth / 2 || 1);
    var x = ((t * (speed || 60)) % w) * (dir === 1 ? 1 : -1);
    el.style.transform = "translate3d(" + (dir === 1 ? x - w : x).toFixed(1) + "px,0,0)";
  };
  /** Reflexo especular passando no botão (.k-sheen dentro dele). */
  K.sheen = function (btn, t, at, o) {
    var s = btn && btn.querySelector(".k-sheen"); if (!s) return; o = o || {};
    var every = o.every || 2.6, p = K.prog(((t - at) % every + every) % every, 0, 0.9);
    s.style.left = K.lerp(-30, 120, K.ease.inOut(p)).toFixed(1) + "%";
    s.style.opacity = t < at ? 0 : 1;
  };
  /** Granulado de filme "vivo" (troca 12 vezes por segundo). */
  K.grain = function (el, t) { if (!el) return; var r = K.seed(Math.floor(t * 12) + 7); el.style.transform = "translate(" + ((r() - 0.5) * 120).toFixed(0) + "px," + ((r() - 0.5) * 120).toFixed(0) + "px)"; };

  // ---------------- cursor ----------------
  /**
   * Cursor com etiqueta. keys: [{ t, x, y, click }] em pixels do palco. Clique encolhe o cursor,
   * solta uma onda e registra o som "clique".
   */
  K.cursor = function (t, keys, o) {
    o = o || {}; var stage = K.stage();
    var cur = document.getElementById("k-cursor");
    if (!cur) {
      cur = document.createElement("div"); cur.id = "k-cursor";
      cur.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 2.5l15.5 9.2-7 1.6-3.6 6.6z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>' + (o.label ? '<span class="k-cursor-tag">' + K.esc(o.label) + "</span>" : "");
      stage.appendChild(cur);
      var rp = document.createElement("div"); rp.className = "k-ripple"; rp.id = "k-ripple"; stage.appendChild(rp);
    }
    var rip = document.getElementById("k-ripple");
    if (!keys || !keys.length) { cur.style.opacity = 0; return; }
    keys.forEach(function (k) { if (k.click) cue("clique", k.t, "click" + k.t); });
    var first = keys[0], lastK = keys[keys.length - 1];
    var vis = K.clamp(K.prog(t, first.t - 0.35, 0.3)) * (o.hideAt != null ? 1 - K.prog(t, o.hideAt, 0.3) : 1);
    var x = first.x, y = first.y;
    for (var i = 0; i < keys.length - 1; i++) {
      var a = keys[i], b = keys[i + 1];
      if (t >= a.t && t <= b.t) { var p = K.ease.inOut(K.prog(t, a.t + (a.click ? 0.18 : 0), b.t - a.t - (a.click ? 0.18 : 0))); x = K.lerp(a.x, b.x, p); y = K.lerp(a.y, b.y, p); break; }
      if (t > b.t) { x = b.x; y = b.y; }
    }
    if (t < first.t) { x = first.x + 140; y = first.y + 180; x = K.lerp(x, first.x, K.ease.outExpo(K.prog(t, first.t - 0.35, 0.35))); y = K.lerp(y, first.y, K.ease.outExpo(K.prog(t, first.t - 0.35, 0.35))); }
    var press = 1, ripP = -1;
    keys.forEach(function (k) {
      if (!k.click) return;
      var d = t - k.t;
      if (d >= 0 && d < 0.2) press = 1 - 0.18 * Math.sin((d / 0.2) * Math.PI);
      if (d >= 0 && d < 0.6) ripP = d / 0.6;
    });
    cur.style.opacity = vis.toFixed(3);
    cur.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0) scale(" + press.toFixed(3) + ")";
    if (rip) {
      rip.style.left = x + 6 + "px"; rip.style.top = y + 6 + "px";
      rip.style.opacity = ripP < 0 ? 0 : (1 - ripP).toFixed(3);
      rip.style.transform = "scale(" + (ripP < 0 ? 0.2 : 0.2 + ripP * 1.2).toFixed(3) + ")";
    }
    void lastK;
  };

  // ---------------- palco, tema e ativos ----------------
  K.stage = function () {
    var s = document.getElementById("stage");
    if (!s) { s = document.createElement("div"); s.id = "stage"; document.body.appendChild(s); }
    if (!s.__sized) { s.style.width = M().width + "px"; s.style.height = M().height + "px"; s.classList.add("k-stage"); s.__sized = true; }
    return s;
  };
  K.W = function () { return M().width; };
  K.H = function () { return M().height; };
  /** Anexos do cliente (logo, prints, fotos): { url, tipo, descricao }. */
  K.asset = function (i) { return (M().assets || [])[i] || null; };
  K.assets = function (tipo) { return (M().assets || []).filter(function (a) { return !tipo || a.tipo === tipo; }); };
  K.img = function (i, style) { var a = K.asset(i); return a ? '<img src="' + K.esc(a.url) + '" alt="" style="' + (style || "") + '">' : ""; };

  var THEMES = {
    produto: { bg: "#f2f4f7", bg2: "#e9edf2", ink: "#0f172a", ink2: "#334155", muted: "#64748b", card: "#ffffff", line: "rgba(15,23,42,0.08)", accent: "#4f46e5", accent2: "#06b6d4", glow: "rgba(79,70,229,0.35)", dark: false },
    premium: { bg: "#0a0a0c", bg2: "#131317", ink: "#f7f7f8", ink2: "#d4d4d8", muted: "#a1a1aa", card: "#141418", line: "rgba(255,255,255,0.09)", accent: "#ff5a1f", accent2: "#ff9a3d", glow: "rgba(255,90,31,0.45)", dark: true }
  };
  /** Aplica o tema ("produto" claro ou "premium" escuro) e as cores da marca [acento, acento2]. */
  K.theme = function (name, palette) {
    var th = Object.assign({}, THEMES[name] || THEMES.produto);
    var pal = palette || M().palette || [];
    if (pal[0]) { th.accent = pal[0]; th.glow = hexA(pal[0], th.dark ? 0.45 : 0.35); }
    if (pal[1]) th.accent2 = pal[1];
    var r = document.documentElement.style;
    ["bg", "bg2", "ink", "ink2", "muted", "card", "line", "accent", "accent2", "glow"].forEach(function (k) { r.setProperty("--k-" + k, th[k]); });
    var s = K.stage(); s.classList.toggle("k-dark", !!th.dark);
    K.theme.current = name; K.theme.dark = !!th.dark;
    return th;
  };
  function hexA(hex, a) {
    var m = String(hex).replace("#", ""); if (m.length === 3) m = m.split("").map(function (c) { return c + c; }).join("");
    var n = parseInt(m, 16); if (isNaN(n)) return hex;
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }
  /** Fundo pronto do tema atual (pontos claros ou escuro com brilho quente, vinheta e granulado). */
  K.background = function () {
    var s = K.stage(), bg = document.getElementById("k-bg");
    if (bg) return bg;
    bg = document.createElement("div"); bg.id = "k-bg"; bg.className = "k-layer";
    if (K.theme.dark) {
      bg.classList.add("k-bg-dark");
      bg.innerHTML = '<div class="k-glow" id="k-glow1" style="width:1400px;height:1400px;left:-300px;top:-200px"></div><div class="k-glow" id="k-glow2" style="width:1100px;height:1100px;right:-400px;bottom:-300px;opacity:.7"></div><div class="k-vignette"></div><div class="k-grain" id="k-grain"></div>';
    } else {
      bg.classList.add("k-bg-dots");
    }
    s.insertBefore(bg, s.firstChild);
    return bg;
  };
  /** Anima o fundo (brilho respirando, granulado). Chame em todo renderFrame. */
  K.backgroundFrame = function (t) {
    var g1 = document.getElementById("k-glow1"), g2 = document.getElementById("k-glow2");
    if (g1) K.set(g1, { x: Math.sin(t * 0.3) * 80, y: Math.cos(t * 0.23) * 60, scale: 1 + Math.sin(t * 0.5) * 0.06 });
    if (g2) K.set(g2, { x: Math.cos(t * 0.27) * 90, y: Math.sin(t * 0.31) * 70, scale: 1 + Math.cos(t * 0.4) * 0.08, opacity: 0.7 });
    K.grain(document.getElementById("k-grain"), t);
  };

  // ---------------- sons (deixas) ----------------
  // Cada deixa é { t, sfx }. O player toca se o cliente ligou os efeitos.
  K.cues = [];
  var seen = {};
  function cue(sfx, t, key) { key = key || sfx + t; if (seen[key]) return; seen[key] = 1; K.cues.push({ t: Math.max(0, +t), sfx: sfx }); }
  /** Registra um efeito sonoro em t: "whoosh", "clique", "pop", "carimbo", "digitar", "subida", "impacto", "sucesso". */
  K.sfx = function (name, t) { cue(name, t, "u" + name + t); };

  // ---------------- ícones (traço, 24x24) ----------------
  var IC = {
    check: "M20 6 9 17l-5-5", x: "M18 6 6 18M6 6l12 12", arrow: "M5 12h14M13 6l6 6-6 6", arrowUp: "M12 19V5M6 11l6-6 6 6",
    star: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z", bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
    clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z", shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
    chart: "M4 20V10M10 20V4M16 20v-7M22 20H2", user: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
    cart: "M3 4h2l2.4 11h11l2-8H6.2M9 20a1 1 0 1 0 0-.1M18 20a1 1 0 1 0 0-.1", mail: "M3 6h18v12H3zM3 7l9 6 9-6",
    globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18",
    phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
    lock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4", heart: "M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z",
    sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18",
    plug: "M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5", alert: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
    calendar: "M4 5h16v16H4zM4 10h16M9 3v4M15 3v4", rocket: "M5 15c-1.5 1.3-2 4-2 6 2 0 4.7-.5 6-2M9 15l-3-3a12 12 0 0 1 9-9c2 0 3 0 3 0s0 1 0 3a12 12 0 0 1-9 9zM14 9h.01",
    dollar: "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6", play: "M7 4v16l13-8z",
    whatsapp: "M3 21l1.6-4.7A9 9 0 1 1 8 19.6zM9 8.5c0 3.5 3 6.5 6.5 6.5l1.2-1.6-2-1-1 .8a5 5 0 0 1-2.4-2.4l.8-1-1-2z",
    instagram: "M4 4h16v16H4zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17.5 6.5h.01", gift: "M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8c-2-4-6-4-6-1s6 1 6 1 6 2 6-1-4-3-6 1",
    trend: "M3 17l6-6 4 4 8-8M15 7h6v6", target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", book: "M4 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H4zM20 4h-5a3 3 0 0 0-3 3"
  };
  K.icon = function (name, size, color, stroke) {
    var d = IC[name] || IC.sparkle; size = size || 32;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + (color || "currentColor") + '" stroke-width="' + (stroke || 2) + '" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>';
  };

  // ---------------- peças prontas (HTML) ----------------
  var ui = {};
  /** Desenha o conteúdo numa largura-base e reduz/aumenta para caber na tela (nada corta em telas menores). */
  function fit(html, baseW, w, h) {
    var k = w / baseW;
    return '<div style="width:' + baseW + 'px;height:' + Math.round(h / k) + 'px;transform:scale(' + k.toFixed(4) + ');transform-origin:0 0;overflow:hidden">' + html + "</div>";
  }
  /** Janela de navegador estilo macOS. content = HTML ou asset = índice do anexo (print). */
  ui.browser = function (o) {
    o = o || {}; var w = o.w || 900, h = o.h || 560;
    var body = o.asset != null ? K.img(o.asset) : fit(o.content || ui.siteMock(o.site || {}), 900, w, h);
    return '<div class="k-browser" style="width:' + w + 'px"><div class="k-browser-bar"><div class="k-dots"><i></i><i></i><i></i></div><div class="k-url">' + K.icon("lock", 18) + K.esc(o.url || "seusite.com.br") + '</div></div><div class="k-browser-body" style="height:' + h + 'px">' + body + "</div></div>";
  };
  /** iPhone com ilha dinâmica. */
  ui.phone = function (o) {
    o = o || {}; var w = o.w || 420, h = Math.round(w * 2.05), k = w / 420;
    var pad = Math.round(16 * k), r = Math.round(74 * k), sr = Math.round(58 * k);
    var body = o.asset != null ? K.img(o.asset) : fit(o.content || ui.appMock(o.app || {}), 388, w - pad * 2, h - pad * 2);
    // ilha, relógio e bordas acompanham o tamanho do aparelho (num iPhone pequeno nada fica por cima da tela)
    var island = '<div class="k-island" style="top:' + Math.round(18 * k) + 'px;height:' + Math.round(42 * k) + 'px;border-radius:' + Math.round(30 * k) + 'px"></div>';
    var status = o.asset != null ? "" : '<div class="k-status" style="top:' + Math.round(20 * k) + 'px;padding:0 ' + Math.round(44 * k) + 'px;font-size:' + Math.max(10, Math.round(24 * k)) + 'px"><span>' + (o.time || "9:41") + "</span><span>" + K.icon("bolt", Math.max(10, Math.round(20 * k))) + "</span></div>";
    return '<div class="k-phone" style="width:' + w + 'px;height:' + h + 'px;padding:' + pad + 'px;border-radius:' + r + 'px"><div class="k-phone-screen" style="border-radius:' + sr + 'px">' + island + status + body + "</div></div>";
  };
  /** Notebook. */
  ui.laptop = function (o) {
    o = o || {}; var w = o.w || 900;
    var body = o.asset != null ? K.img(o.asset) : fit(o.content || ui.siteMock(o.site || {}), 900, w - 36, Math.round((w - 36) / 1.6));
    return '<div class="k-laptop" style="width:' + w + 'px"><div class="k-laptop-lid"><div class="k-laptop-screen">' + body + '</div></div><div class="k-laptop-base"></div></div>';
  };
  /** Site genérico realista (quando não há print do cliente). */
  ui.siteMock = function (o) {
    o = o || {}; var brand = K.esc(o.brand || "Sua Marca"), title = o.title || "Um título forte que *vende*", sub = K.esc(o.subtitle || "Descrição curta do que a empresa entrega e para quem.");
    var acc = o.accent || "var(--k-accent)";
    var t = K.esc(title).replace(/\*([^*]+)\*/g, '<span style="color:' + acc + '">$1</span>');
    return '<div style="font-family:var(--k-text);color:#0f172a;background:#fff;height:100%;padding:30px 40px">' +
      '<div style="display:flex;align-items:center;gap:12px;font:700 24px var(--k-text)"><span style="width:34px;height:34px;border-radius:9px;background:' + acc + ';display:inline-block"></span>' + brand +
      '<span style="margin-left:auto;display:flex;gap:26px;font:500 17px var(--k-text);color:#64748b"><span>Início</span><span>Serviços</span><span>Contato</span></span><span style="margin-left:22px;padding:10px 20px;border-radius:999px;background:' + acc + ';color:#fff;font:600 16px var(--k-text)">' + K.esc(o.cta || "Fale conosco") + "</span></div>" +
      '<div style="display:grid;grid-template-columns:1.1fr 1fr;gap:34px;margin-top:44px;align-items:center"><div><div style="display:inline-block;padding:6px 14px;border-radius:999px;background:#f1f5f9;font:600 15px var(--k-text);color:#475569">' + K.esc(o.tag || "Novidade") + '</div><div style="font:800 46px/1.05 var(--k-display);letter-spacing:-0.03em;margin-top:16px">' + t + '</div><div style="font:400 19px/1.45 var(--k-text);color:#64748b;margin-top:14px">' + sub + '</div><div style="display:flex;gap:12px;margin-top:22px"><span style="padding:14px 24px;border-radius:999px;background:' + acc + ';color:#fff;font:600 17px var(--k-text)">' + K.esc(o.cta || "Fale conosco") + '</span><span style="padding:14px 24px;border-radius:999px;border:1px solid #e2e8f0;font:600 17px var(--k-text)">Saiba mais</span></div></div>' +
      '<div style="height:290px;border-radius:22px;background:linear-gradient(135deg,' + acc + ',var(--k-accent2));opacity:.9;position:relative;overflow:hidden">' + (o.asset != null ? K.img(o.asset, "width:100%;height:100%;object-fit:cover") : '<div style="position:absolute;inset:auto 18px 18px 18px;height:70px;border-radius:14px;background:rgba(255,255,255,.92)"></div>') + "</div></div>" +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:30px">' + [0, 1, 2].map(function (i) { return '<div style="height:86px;border-radius:16px;border:1px solid #eef2f6;padding:16px;display:flex;gap:12px;align-items:center"><span style="width:40px;height:40px;border-radius:12px;background:#f1f5f9"></span><span style="flex:1"><i style="display:block;height:12px;width:70%;border-radius:6px;background:#e2e8f0"></i><i style="display:block;height:10px;width:50%;border-radius:6px;background:#f1f5f9;margin-top:8px"></i></span></div>'; }).join("") + "</div></div>";
  };
  /** Tela de app genérica (para o iPhone). */
  ui.appMock = function (o) {
    o = o || {}; var acc = o.accent || "var(--k-accent)";
    return '<div style="padding:90px 26px 26px;font-family:var(--k-text);height:100%;background:#f8fafc;color:#0f172a"><div style="font:800 40px/1.05 var(--k-display);letter-spacing:-0.03em">' + K.esc(o.title || "Olá!") + '</div><div style="font:400 20px var(--k-text);color:#64748b;margin-top:8px">' + K.esc(o.subtitle || "Tudo em um só lugar") + '</div><div style="height:200px;border-radius:24px;margin-top:24px;background:linear-gradient(135deg,' + acc + ',var(--k-accent2))"></div>' + [0, 1, 2].map(function () { return '<div style="height:84px;border-radius:20px;background:#fff;margin-top:14px;box-shadow:0 1px 2px rgba(0,0,0,.05);display:flex;align-items:center;gap:14px;padding:0 18px"><span style="width:46px;height:46px;border-radius:14px;background:#eef2ff"></span><span style="flex:1"><i style="display:block;height:12px;width:70%;border-radius:6px;background:#e2e8f0"></i><i style="display:block;height:10px;width:45%;border-radius:6px;background:#f1f5f9;margin-top:8px"></i></span></div>'; }).join("") + "</div>";
  };
  /** Botão. variant: "primary" | "glow" (laranja com brilho, estilo premium) | "ghost". icon: nome do ícone ou false. */
  ui.button = function (label, o) {
    o = o || {}; var v = o.variant || "primary", ic = o.icon === false ? "" : K.icon(o.icon || "arrow", v === "glow" ? 96 : 40, "currentColor", v === "glow" ? 2.6 : 2.2);
    return '<div class="k-btn' + (v === "glow" ? " k-btn-glow" : v === "ghost" ? " k-btn-ghost" : "") + '"' + (o.style ? ' style="' + o.style + '"' : "") + ">" + (o.iconLeft ? ic : "") + "<span>" + K.esc(label) + "</span>" + (o.iconLeft ? "" : ic) + '<span class="k-sheen"></span></div>';
  };
  ui.badge = function (label, o) { o = o || {}; return '<div class="k-badge' + (o.glass ? " k-glass" : "") + '"><span class="k-ic">' + K.icon(o.icon || "check", 22, "#fff", 3) + "</span>" + K.esc(label) + "</div>"; };
  ui.chip = function (label, tone) { return '<span class="k-chip ' + (tone || "") + '">' + K.esc(label) + "</span>"; };
  ui.price = function (text, o) { o = o || {}; return '<div class="k-price' + (o.muted ? " muted" : "") + '">' + K.esc(text) + "</div>"; };
  ui.stamp = function (text) { return '<div class="k-stamp">' + K.esc(text) + "</div>"; };
  /** Anotação escrita à mão com seta desenhada (anime a seta com K.draw no path .k-arrow). dir: "left" | "right" | "down" | "up". */
  ui.note = function (text, o) {
    o = o || {}; var dir = o.dir || "left";
    var paths = { left: "M150 10 C 110 40, 70 60, 12 70 M12 70 l 22 -22 M12 70 l 28 10", right: "M10 10 C 50 40, 90 60, 148 70 M148 70 l -22 -22 M148 70 l -28 10", down: "M20 10 C 60 40, 70 90, 60 140 M60 140 l -20 -22 M60 140 l 18 -24", up: "M60 140 C 70 90, 60 40, 20 10 M20 10 l 4 28 M20 10 l 28 4" };
    var svg = '<svg width="160" height="150" viewBox="0 0 160 150" style="display:block"><path class="k-arrow" d="' + paths[dir] + '" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return '<div class="k-note" style="display:flex;flex-direction:' + (dir === "down" ? "column" : dir === "up" ? "column-reverse" : dir === "right" ? "row" : "row-reverse") + ';align-items:center;gap:6px' + (o.color ? ";color:" + o.color : "") + '">' + svg + "<span>" + K.esc(text) + "</span></div>";
  };
  ui.stat = function (value, label) { return '<div><div class="k-stat-value">' + K.esc(value) + '</div><div class="k-stat-label">' + K.esc(label || "") + "</div></div>"; };
  ui.check = function () { return '<span class="k-check">' + K.icon("check", 26, "#fff", 3.2) + "</span>"; };
  ui.bar = function () { return '<div class="k-bar"><i></i></div>'; };
  ui.gauge = function (size) {
    size = size || 220;
    return '<svg class="k-gauge" width="' + size + '" height="' + size * 0.6 + '" viewBox="0 0 100 60"><path d="M10 52 A40 40 0 0 1 90 52" fill="none" stroke="rgba(15,23,42,.1)" stroke-width="9" stroke-linecap="round"/><path class="k-gauge-val" d="M10 52 A40 40 0 0 1 90 52" fill="none" stroke="var(--k-good)" stroke-width="9" stroke-linecap="round"/></svg>';
  };
  ui.avatar = function (initials) { return '<span class="k-avatar">' + K.esc(initials || "A") + "</span>"; };
  ui.bubble = function (text, who) { return '<div class="k-bubble ' + (who === "me" ? "me" : "them") + '">' + K.esc(text) + "</div>"; };
  ui.toggle = function () { return '<span class="k-toggle"><i></i></span>'; };
  /** Linhas cinza de "conteúdo" para telas genéricas. */
  ui.lines = function (n, w) { var s = ""; for (var i = 0; i < (n || 3); i++) s += '<i style="display:block;height:14px;border-radius:7px;background:rgba(15,23,42,.08);margin:12px 0;width:' + (w || [92, 76, 58, 84, 66][i % 5]) + '%"></i>'; return s; };
  K.ui = ui;

  /** Liga o toggle (.k-toggle) em "at". */
  K.toggle = function (el, t, at) {
    if (!el) return; var p = K.ease.outBack(K.prog(t, at, 0.35));
    var knob = el.firstElementChild; if (knob) knob.style.transform = "translateX(" + (36 * p).toFixed(1) + "px)";
    el.style.background = p > 0.5 ? "var(--k-good)" : "#cbd5e1";
  };

  // ---------------- inicialização ----------------
  // Depois do primeiro quadro, varre a linha do tempo para coletar as deixas de som
  // (registradas pelos helpers) e avisa o player.
  K._ready = function () {
    try {
      var d = M().duration || 10, rf = window.renderFrame;
      if (typeof rf === "function") { for (var t = 0; t <= d + 0.01; t += 0.2) rf(t); rf(0); }
    } catch (e) { /* uma cena com erro não pode travar o vídeo */ }
    K.cues.sort(function (a, b) { return a.t - b.t; });
    try { window.parent && window.parent.postMessage({ motionCues: K.cues }, "*"); } catch (e) { }
    window.MOTION_CUES = K.cues;
  };
  if (document.readyState === "complete") setTimeout(K._ready, 0);
  else window.addEventListener("load", function () { setTimeout(K._ready, 0); });

  window.K = K;
})();
