import { pool } from "../db";
import { logger } from "../utils/logger";
import { recordUsage } from "./usage";

/**
 * Áudio do Motion: vozes brasileiras escolhidas, fala sem erro de pronúncia (números por extenso
 * e conferência por transcrição) e a biblioteca de trilhas/efeitos (gerada uma vez e reaproveitada).
 */

const KEY = () => process.env.ELEVENLABS_API_KEY || "";
const API = "https://api.elevenlabs.io/v1";

// ---------------- vozes ----------------
// As mais usadas da biblioteca da ElevenLabs com sotaque brasileiro (out/2026), 4 masculinas e 4 femininas.
export const MOTION_VOICES = [
  { id: "CstacWqMhJQlnfLPxRG4", owner: "f8d3329a385cb2dc80d1d53ff767f6026653e41f1ec29fc7060c17ee71948dca", nome: "Will", genero: "masc", estilo: "Grave, suave e acolhedor", preview: "https://storage.googleapis.com/eleven-public-prod/database/workspace/1d8116e2c9c14d50affe4a07bc647489/voices/CstacWqMhJQlnfLPxRG4/tAJk8VrzwYKmPAybekMz.mp3" },
  { id: "rpNe0HOx7heUulPiOEaG", owner: "e2491119d7fa73a9999a9963d71caa8ccabf9225c15dc1f6d16c50c94b7124c7", nome: "Diego", genero: "masc", estilo: "Locutor de comercial, confiante", preview: "https://storage.googleapis.com/eleven-public-prod/ExjJpOEYBjb2W5XCccFWBXpJ0pA3/voices/rpNe0HOx7heUulPiOEaG/69643e31-21f1-43c4-8c49-89da52b59157.mp3" },
  { id: "Qrdut83w0Cr152Yb4Xn3", owner: "cafe304c4de57306f4e3fdbca4b97afb21be387b77b5d6f8bfc9760db3289934", nome: "Paulo", genero: "masc", estilo: "Expressivo e firme", preview: "https://storage.googleapis.com/eleven-public-prod/database/user/9BSPmhBJkheqxBPDvE6kddOa9rF3/voices/Qrdut83w0Cr152Yb4Xn3/qIxIJ5ey8adKPaB8poOW.mp3" },
  { id: "7lu3ze7orhWaNeSPowWx", owner: "a56d3da1faab6fa7a219b97da2513f8e61cff99744777c0e87c6bb20f87de9e2", nome: "Lucas", genero: "masc", estilo: "Jovem, de redes sociais", preview: "" },
  { id: "33B4UnXyTNbgLmdEDh5P", owner: "c5b0c3c8dfdca43f9969078cb5a4f26cbf45794aefe2a7fb929d94dc05aee26d", nome: "Keren", genero: "fem", estilo: "Doce e vibrante (a mais usada)", preview: "https://storage.googleapis.com/eleven-public-prod/custom/voices/33B4UnXyTNbgLmdEDh5P/ArnzDsFaz6KDoDcDD8V2.mp3" },
  { id: "GDzHdQOi6jjf8zaXhCYD", owner: "4a19cd68f5f2e5172b5eddbfaafdb226726e0b4035e27e952df6bbac94b8aada", nome: "Raquel", genero: "fem", estilo: "Expressiva e cheia de energia", preview: "https://storage.googleapis.com/eleven-public-prod/database/user/t1nBFVlw8ahi8WVJ0bXtyohGNAI2/voices/GDzHdQOi6jjf8zaXhCYD/LCt0ufE4oVO5zb1QbhsQ.mp3" },
  { id: "RGymW84CSmfVugnA5tvA", owner: "4a19cd68f5f2e5172b5eddbfaafdb226726e0b4035e27e952df6bbac94b8aada", nome: "Roberta", genero: "fem", estilo: "Suave e confiante", preview: "https://storage.googleapis.com/eleven-public-prod/database/workspace/d2d6d8fb79be40a2a3a1599d78da8346/voices/RGymW84CSmfVugnA5tvA/3vmILerGd3NQICCWM4Wa.mp3" },
  { id: "MZxV5lN3cv7hi1376O0m", owner: "70d7fad2f030527331b8ba2ff2c0fc9dce9f3135947cc1d6609f10f07268be02", nome: "Ana Dias", genero: "fem", estilo: "Envolvente e marcante", preview: "https://storage.googleapis.com/eleven-public-prod/S7DSqIREokaHJMqnyVrwMfuKGhs2/voices/MZxV5lN3cv7hi1376O0m/43574a4d-ec20-4440-9271-8323f4db4fd8.mp3" },
] as const;

const naConta = new Set<string>();
/** Vozes da biblioteca precisam estar na conta para a API falar com elas: adiciona na 1ª vez. */
export async function ensureVoice(id: string): Promise<void> {
  if (!KEY() || naConta.has(id)) return;
  const v = MOTION_VOICES.find((x) => x.id === id);
  const r = await fetch(`${API}/voices/${id}`, { headers: { "xi-api-key": KEY() } });
  if (r.ok) { naConta.add(id); return; }
  if (!v) return; // voz da própria conta (clonada etc.): a API responde do jeito dela
  const add = await fetch(`${API}/voices/add/${v.owner}/${v.id}`, {
    method: "POST",
    headers: { "xi-api-key": KEY(), "Content-Type": "application/json" },
    body: JSON.stringify({ new_name: `Lowfy · ${v.nome}` }),
  });
  if (!add.ok) {
    const t = await add.text().catch(() => "");
    logger.warn(`[Motion] não adicionou a voz ${v.nome}: ${add.status} ${t.slice(0, 160)}`);
    if (/voice_limit|limit/i.test(t)) throw new Error("A conta da ElevenLabs chegou ao limite de vozes salvas. Apague alguma voz que não usa no painel da ElevenLabs.");
    return;
  }
  naConta.add(id);
}

// ---------------- números por extenso ----------------
const UN = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZ = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CEN = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
const FEM: Record<string, string> = { um: "uma", dois: "duas", duzentos: "duzentas", trezentos: "trezentas", quatrocentos: "quatrocentas", quinhentos: "quinhentas", seiscentos: "seiscentas", setecentos: "setecentas", oitocentos: "oitocentas", novecentos: "novecentas" };

function ate999(n: number): string {
  if (n === 100) return "cem";
  const c = Math.floor(n / 100), r = n % 100, out: string[] = [];
  if (c) out.push(CEN[c]);
  if (r) out.push(r < 20 ? UN[r] : DEZ[Math.floor(r / 10)] + (r % 10 ? " e " + UN[r % 10] : ""));
  return out.join(" e ");
}

/** Inteiro por extenso (até bilhões). fem = concorda com substantivo feminino ("duas pessoas"). */
export function extenso(n: number, fem = false): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "zero";
  const partes: { txt: string; val: number }[] = [];
  let r = n;
  for (const [v, s, p] of [[1e9, "bilhão", "bilhões"], [1e6, "milhão", "milhões"]] as [number, string, string][]) {
    const q = Math.floor(r / v);
    if (q) { partes.push({ txt: `${ate999(q)} ${q === 1 ? s : p}`, val: q * v }); r %= v; }
  }
  const mil = Math.floor(r / 1000);
  if (mil) { partes.push({ txt: mil === 1 ? "mil" : `${genero(ate999(mil), fem)} mil`, val: mil * 1000 }); r %= 1000; }
  if (r) partes.push({ txt: genero(ate999(r), fem), val: r });
  // "mil e seiscentos", "mil duzentos e trinta": o "e" só entra antes do último grupo redondo ou < 100
  let out = partes[0].txt;
  for (let k = 1; k < partes.length; k++) {
    const v = partes[k].val, ultimo = k === partes.length - 1;
    out += (ultimo && (v < 100 || v % 100 === 0) ? " e " : " ") + partes[k].txt;
  }
  return out;
}
function genero(s: string, fem: boolean) { return fem ? s.split(" ").map((w) => FEM[w] || w).join(" ") : s; }

const FEMININOS = /^(vezes|vez|pessoas|horas|hora|semanas|semana|parcelas|aulas|dicas|receitas|páginas|unidades|empresas|mulheres|crianças|famílias|vagas|vendas|marcas|lojas|cidades|estrelas|avaliações|ferramentas|opções|ideias|mil)$/i;

/**
 * Deixa o texto pronto para a voz: números, dinheiro, porcentagem e "12x" por extenso, para a
 * ElevenLabs não errar a leitura. O roteiro já vem por extenso; isto pega o que escapar.
 */
export function paraFala(txt: string): string {
  let s = ` ${String(txt || "")} `;
  const num = (v: string) => Number(v.replace(/\./g, "").replace(",", "."));
  // R$ 1.234,56
  s = s.replace(/R\$\s?(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?/g, (_m, i, c) => {
    const reais = num(i), cent = c ? Number(c.padEnd(2, "0")) : 0;
    const r = `${extenso(reais)} ${reais === 1 ? "real" : "reais"}`;
    return cent ? `${r} e ${extenso(cent)} ${cent === 1 ? "centavo" : "centavos"}` : r;
  });
  s = s.replace(/\/\s?(mês|mes|ano|dia|hora|semana)/gi, " por $1");
  s = s.replace(/(\d+(?:,\d+)?)\s?%/g, (_m, v) => `${lerDecimal(v)} por cento`);
  s = s.replace(/\b(\d{1,3})\s?x\b/gi, (_m, v) => `${extenso(Number(v), true)} ${Number(v) === 1 ? "vez" : "vezes"}`);
  s = s.replace(/\b(\d{1,2})h(\d{2})?\b/g, (_m, h, m) => `${extenso(Number(h), true)} ${Number(h) === 1 ? "hora" : "horas"}${m && Number(m) ? ` e ${extenso(Number(m))} minutos` : ""}`);
  s = s.replace(/(^|\s)\+\s?(?=\d)/g, "$1mais de ");
  s = s.replace(/\b(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?\b(\s+)(\S+)/g, (_m, i, d, sp, prox) => {
    const fem = FEMININOS.test(prox.replace(/[^\p{L}]/gu, ""));
    return (d ? lerDecimal(`${i},${d}`) : extenso(num(i), fem)) + sp + prox;
  });
  s = s.replace(/\b(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?\b/g, (_m, i, d) => (d ? lerDecimal(`${i},${d}`) : extenso(num(i))));
  return s.replace(/\s+/g, " ").trim();
}
function lerDecimal(v: string) {
  const [i, d] = v.split(",");
  return d ? `${extenso(Number(i.replace(/\./g, "")))} vírgula ${d.split("").length <= 2 ? extenso(Number(d)) : d.split("").map((x) => extenso(Number(x))).join(" ")}` : extenso(Number(i.replace(/\./g, "")));
}

// ---------------- conferência de pronúncia ----------------
const base = (s: string) => paraFala(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

function lcs(a: string[], b: string[]): boolean[] {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const hit = new Array<boolean>(a.length).fill(false);
  let i = 0, j = 0;
  while (i < a.length && j < b.length) { if (a[i] === b[j]) { hit[i] = true; i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++; }
  return hit;
}
function charRatio(a: string, b: string): number {
  a = a.replace(/\s/g, ""); b = b.replace(/\s/g, "");
  if (!a.length && !b.length) return 1;
  const prev = new Array(b.length + 1).fill(0).map((_, k) => k);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]; prev[0] = i;
    for (let j = 1; j <= b.length; j++) { const tmp = prev[j]; prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1)); diag = tmp; }
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}

export interface Checagem { ok: boolean; score: number; faltando: string[]; ouvido: string }

/** Transcreve a dublagem (ElevenLabs Scribe) e compara com o texto: acusa palavra pulada ou trocada. */
export async function conferirPronuncia(audio: Buffer, texto: string): Promise<Checagem | null> {
  if (!KEY()) return null;
  try {
    const fd = new FormData();
    fd.append("model_id", "scribe_v1");
    fd.append("language_code", "por");
    fd.append("tag_audio_events", "false");
    fd.append("file", new Blob([new Uint8Array(audio)], { type: "audio/mpeg" }), "fala.mp3");
    const r = await fetch(`${API}/speech-to-text`, { method: "POST", headers: { "xi-api-key": KEY() }, body: fd, signal: AbortSignal.timeout(90_000) });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) { logger.warn(`[Motion] transcrição falhou: ${r.status}`); return null; }
    const dur = Array.isArray(j.words) && j.words.length ? j.words[j.words.length - 1].end : 0;
    recordUsage({ provider: "elevenlabs", model: "scribe_v1", kind: "stt", costUsd: (dur / 3600) * 0.4, meta: { segundos: dur } });
    const ouvido = String(j.text || "");
    const a = base(texto).split(" ").filter(Boolean), b = base(ouvido).split(" ").filter(Boolean);
    const hit = lcs(a, b);
    const faltando = a.filter((_, k) => !hit[k]);
    const score = charRatio(a.join(" "), b.join(" "));
    return { ok: score >= 0.93 && faltando.length <= Math.max(1, Math.round(a.length * 0.03)), score: Number(score.toFixed(3)), faltando: faltando.slice(0, 20), ouvido };
  } catch (e: any) {
    logger.warn(`[Motion] conferência de pronúncia: ${e?.message}`);
    return null;
  }
}

// ---------------- trilhas e efeitos ----------------
export const CLIMAS: Record<string, { label: string; prompt: string }> = {
  animada: { label: "Animada", prompt: "Upbeat modern pop instrumental for a social media ad, light percussion, plucky synths, positive and energetic, no vocals, steady groove, loopable" },
  corporativa: { label: "Corporativa", prompt: "Clean corporate tech instrumental, soft piano and warm pads, light electronic beat, confident and trustworthy, no vocals, loopable" },
  emocional: { label: "Emocional", prompt: "Warm emotional cinematic instrumental, gentle piano and strings, hopeful and heartfelt, no vocals, loopable" },
  tecnologica: { label: "Tecnológica", prompt: "Minimal futuristic electronic instrumental, deep bass pulse, glassy synth arpeggios, sleek and premium, no vocals, loopable" },
};

export const SFX: Record<string, { prompt: string; dur: number }> = {
  whoosh: { prompt: "Fast clean cinematic whoosh transition, airy swoosh, short, modern motion graphics", dur: 0.8 },
  clique: { prompt: "Crisp soft mouse click, UI interface click, clean, short", dur: 0.3 },
  pop: { prompt: "Soft bubbly UI pop, friendly notification pop, short", dur: 0.4 },
  carimbo: { prompt: "Rubber stamp hitting paper, punchy thud with slight paper texture, short", dur: 0.5 },
  digitar: { prompt: "Fast soft laptop keyboard typing, clean, close", dur: 1.2 },
  subida: { prompt: "Short cinematic riser swell building tension, clean, modern", dur: 1.5 },
  impacto: { prompt: "Deep cinematic boom hit impact with short tail, modern trailer, clean", dur: 1 },
  sucesso: { prompt: "Bright positive success chime, UI achievement sparkle, short", dur: 0.8 },
};

type Lib = { music: Record<string, string>; sfx: Record<string, string> };
let libCache: Lib | null = null;
async function getLib(): Promise<Lib> {
  if (libCache) return libCache;
  try {
    const r = await pool.query("SELECT value FROM platform_settings WHERE key = 'motion_audio'");
    libCache = { music: {}, sfx: {}, ...(r.rows[0]?.value || {}) };
  } catch { libCache = { music: {}, sfx: {} }; }
  return libCache!;
}
async function saveLib(lib: Lib) {
  libCache = lib;
  await pool.query(
    `INSERT INTO platform_settings (key, value, updated_at) VALUES ('motion_audio', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(lib)],
  ).catch((e) => logger.warn(`[Motion] não salvou a biblioteca de áudio: ${e?.message}`));
}

type Upload = (buf: Buffer, mime: string) => Promise<string>;
const gerando = new Map<string, Promise<string | null>>();

async function elevenAudio(path: string, body: any): Promise<Buffer> {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "xi-api-key": KEY(), "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${path} (${r.status}): ${(await r.text().catch(() => "")).slice(0, 160)}`);
  return Buffer.from(await r.arrayBuffer());
}

/** Trilha do clima (gerada 1 vez, ~60s, instrumental). null se não der. */
export async function trilha(clima: string, upload: Upload): Promise<string | null> {
  const c = CLIMAS[clima]; if (!c || !KEY()) return null;
  const lib = await getLib();
  if (lib.music[clima]) return lib.music[clima];
  const key = "m:" + clima;
  if (!gerando.has(key)) {
    gerando.set(key, (async () => {
      try {
        const buf = await elevenAudio("/music", { prompt: c.prompt, music_length_ms: 60_000, model_id: "music_v1", force_instrumental: true });
        recordUsage({ provider: "elevenlabs", model: "music_v1", kind: "music", tool: "motion/trilha", costUsd: 0.5, meta: { clima } });
        const url = await upload(buf, "audio/mpeg");
        const l = await getLib(); l.music[clima] = url; await saveLib(l);
        return url;
      } catch (e: any) {
        logger.warn(`[Motion] trilha ${clima}: ${e?.message}`);
        return null;
      } finally { gerando.delete(key); }
    })());
  }
  return gerando.get(key)!;
}

/** Efeitos sonoros pedidos (gerados 1 vez cada). Devolve { nome: url } dos que existirem. */
export async function efeitos(nomes: string[], upload: Upload): Promise<Record<string, string>> {
  if (!KEY()) return {};
  const lib = await getLib();
  const out: Record<string, string> = {};
  await Promise.all([...new Set(nomes)].filter((n) => SFX[n]).map(async (n) => {
    if (lib.sfx[n]) { out[n] = lib.sfx[n]; return; }
    const key = "s:" + n;
    if (!gerando.has(key)) {
      gerando.set(key, (async () => {
        try {
          const buf = await elevenAudio("/sound-generation", { text: SFX[n].prompt, duration_seconds: SFX[n].dur, prompt_influence: 0.6 });
          recordUsage({ provider: "elevenlabs", model: "sound-generation", kind: "sfx", tool: "motion/efeitos", costUsd: 0.02, meta: { efeito: n } });
          const url = await upload(buf, "audio/mpeg");
          const l = await getLib(); l.sfx[n] = url; await saveLib(l);
          return url;
        } catch (e: any) {
          logger.warn(`[Motion] efeito ${n}: ${e?.message}`);
          return null;
        } finally { gerando.delete(key); }
      })());
    }
    const url = await gerando.get(key)!;
    if (url) out[n] = url;
  }));
  return out;
}
