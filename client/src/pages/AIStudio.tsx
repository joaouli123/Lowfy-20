import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sparkles, Image as ImageIcon, Type, Mic, Video, UserSquare2,
  Loader2, Copy, Download, Wand2,
} from "lucide-react";

const COPY_TYPES = [
  { v: "headline", label: "Headlines" },
  { v: "anuncio", label: "Texto de anúncio" },
  { v: "vsl", label: "Roteiro de VSL" },
  { v: "email", label: "E-mail de vendas" },
  { v: "legenda", label: "Legenda p/ redes" },
  { v: "cta", label: "CTA" },
];
const FRAMEWORKS = ["auto", "AIDA", "PAS", "BAB", "4P", "FAB"];
const TTS_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer", "verse", "ballad"];
const VIDEO_FORMATS = [
  { v: "1080x1080", label: "Quadrado (feed)" },
  { v: "1080x1920", label: "Vertical (story/reels)" },
  { v: "1920x1080", label: "Horizontal (YouTube)" },
];

export default function AIStudio() {
  const { toast } = useToast();

  // ---- Criativo (imagem) ----
  const [img, setImg] = useState({ produto: "", estilo: "", headline: "", publico: "" });
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const imageMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/ai-studio/image", img);
      return (await r.json()) as { url: string };
    },
    onSuccess: (d) => setImgUrl(d.url),
    onError: (e: any) => toast({ title: "Erro ao gerar imagem", description: e.message, variant: "destructive" }),
  });

  // ---- Copy ----
  const [copy, setCopy] = useState({ produto: "", publico: "", dor: "", beneficios: "", oferta: "", tipo: "headline", framework: "auto", variacoes: 5 });
  const [copyOut, setCopyOut] = useState<string[]>([]);
  const copyMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/ai-studio/copy", copy);
      return (await r.json()) as { variacoes: string[] };
    },
    onSuccess: (d) => setCopyOut(d.variacoes || []),
    onError: (e: any) => toast({ title: "Erro ao gerar copy", description: e.message, variant: "destructive" }),
  });

  // ---- Narração (TTS) ----
  const [tts, setTts] = useState({ text: "", voice: "nova", instructions: "" });
  const [ttsUrl, setTtsUrl] = useState<string | null>(null);
  const ttsMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/ai-studio/tts", tts);
      return (await r.json()) as { url: string };
    },
    onSuccess: (d) => setTtsUrl(d.url),
    onError: (e: any) => toast({ title: "Erro ao gerar narração", description: e.message, variant: "destructive" }),
  });

  // ---- Avatar (foto + texto → vídeo) ----
  const [avatar, setAvatar] = useState<{ photo: string | null; text: string; voice: string; size: string }>({ photo: null, text: "", voice: "nova", size: "1080x1080" });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/ai-studio/avatar", { imageUrl: avatar.photo, text: avatar.text, voice: avatar.voice, size: avatar.size });
      return (await r.json()) as { url: string };
    },
    onSuccess: (d) => setAvatarUrl(d.url),
    onError: (e: any) => toast({ title: "Erro ao gerar avatar", description: e.message, variant: "destructive" }),
  });

  // ---- Vídeo (descrição + roteiro → vídeo) ----
  const [vid, setVid] = useState({ prompt: "", script: "", voice: "nova", size: "1080x1080" });
  const [vidUrl, setVidUrl] = useState<string | null>(null);
  const videoMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/ai-studio/video", vid);
      return (await r.json()) as { url: string };
    },
    onSuccess: (d) => setVidUrl(d.url),
    onError: (e: any) => toast({ title: "Erro ao gerar vídeo", description: e.message, variant: "destructive" }),
  });

  const onPhotoPick = (file?: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast({ title: "Foto muito grande", description: "Use uma imagem de até 8MB.", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = () => setAvatar((a) => ({ ...a, photo: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const copyToClipboard = (t: string) => {
    navigator.clipboard.writeText(t);
    toast({ title: "Copiado!" });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estúdio de Criação IA</h1>
          <p className="text-sm text-muted-foreground">Gere criativos, copy persuasiva, narração e vídeos para seus anúncios.</p>
        </div>
      </div>

      <Tabs defaultValue="criativo" className="mt-6">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="criativo"><ImageIcon className="w-4 h-4 mr-1.5" /> Criativo</TabsTrigger>
          <TabsTrigger value="copy"><Type className="w-4 h-4 mr-1.5" /> Copy</TabsTrigger>
          <TabsTrigger value="narracao"><Mic className="w-4 h-4 mr-1.5" /> Narração</TabsTrigger>
          <TabsTrigger value="avatar"><UserSquare2 className="w-4 h-4 mr-1.5" /> Avatar</TabsTrigger>
          <TabsTrigger value="video"><Video className="w-4 h-4 mr-1.5" /> Vídeo</TabsTrigger>
        </TabsList>

        {/* ---------- CRIATIVO ---------- */}
        <TabsContent value="criativo" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card><CardContent className="p-5 space-y-3">
              <div><Label>Produto / oferta *</Label><Input value={img.produto} onChange={(e) => setImg({ ...img, produto: e.target.value })} placeholder="Ex.: tênis esportivo branco premium" /></div>
              <div><Label>Headline na imagem (opcional)</Label><Input value={img.headline} onChange={(e) => setImg({ ...img, headline: e.target.value })} placeholder="Ex.: 50% OFF HOJE" /></div>
              <div><Label>Estilo visual</Label><Input value={img.estilo} onChange={(e) => setImg({ ...img, estilo: e.target.value })} placeholder="Ex.: fundo gradiente, estúdio, minimalista" /></div>
              <div><Label>Público-alvo</Label><Input value={img.publico} onChange={(e) => setImg({ ...img, publico: e.target.value })} placeholder="Ex.: corredores iniciantes" /></div>
              <Button className="w-full" disabled={imageMut.isPending || !img.produto} onClick={() => imageMut.mutate()}>
                {imageMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
                Gerar criativo
              </Button>
            </CardContent></Card>
            <Card><CardContent className="p-5 flex flex-col items-center justify-center min-h-[320px]">
              {imageMut.isPending ? (
                <div className="text-center text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />Gerando seu criativo…</div>
              ) : imgUrl ? (
                <div className="w-full space-y-3">
                  <img src={imgUrl} alt="Criativo gerado" className="w-full rounded-lg border" />
                  <div className="flex gap-2">
                    <a href={imgUrl} download className="flex-1"><Button variant="outline" className="w-full"><Download className="w-4 h-4 mr-2" />Baixar</Button></a>
                    <Button variant="outline" className="flex-1" onClick={() => toast({ title: "Edição no Canva", description: "Conecte sua conta Canva nas configurações para editar." })}>
                      <Sparkles className="w-4 h-4 mr-2" />Editar no Canva
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground"><ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />Seu criativo aparecerá aqui</div>
              )}
            </CardContent></Card>
          </div>
        </TabsContent>

        {/* ---------- COPY ---------- */}
        <TabsContent value="copy" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card><CardContent className="p-5 space-y-3">
              <div><Label>Produto / oferta *</Label><Input value={copy.produto} onChange={(e) => setCopy({ ...copy, produto: e.target.value })} placeholder="Ex.: Curso de marketing do zero" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Tipo</Label>
                  <select className="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm" value={copy.tipo} onChange={(e) => setCopy({ ...copy, tipo: e.target.value })}>
                    {COPY_TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                  </select>
                </div>
                <div><Label>Framework</Label>
                  <select className="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm" value={copy.framework} onChange={(e) => setCopy({ ...copy, framework: e.target.value })}>
                    {FRAMEWORKS.map((f) => <option key={f} value={f}>{f === "auto" ? "Automático" : f}</option>)}
                  </select>
                </div>
              </div>
              <div><Label>Público-alvo</Label><Input value={copy.publico} onChange={(e) => setCopy({ ...copy, publico: e.target.value })} placeholder="Ex.: iniciantes" /></div>
              <div><Label>Dor principal</Label><Input value={copy.dor} onChange={(e) => setCopy({ ...copy, dor: e.target.value })} placeholder="Ex.: não sabem por onde começar" /></div>
              <div><Label>Benefícios / oferta</Label><Textarea rows={2} value={copy.beneficios} onChange={(e) => setCopy({ ...copy, beneficios: e.target.value })} placeholder="Ex.: método passo a passo, suporte, garantia" /></div>
              <Button className="w-full" disabled={copyMut.isPending || !copy.produto} onClick={() => copyMut.mutate()}>
                {copyMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
                Gerar copy
              </Button>
            </CardContent></Card>
            <Card><CardContent className="p-5 min-h-[320px]">
              {copyMut.isPending ? (
                <div className="text-center text-muted-foreground py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />Escrevendo…</div>
              ) : copyOut.length ? (
                <div className="space-y-2">
                  {copyOut.map((c, i) => (
                    <div key={i} className="group rounded-lg border p-3 text-sm whitespace-pre-wrap relative hover:border-primary/40">
                      {c}
                      <button onClick={() => copyToClipboard(c)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"><Copy className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-12"><Type className="w-10 h-10 mx-auto mb-2 opacity-40" />Suas copies aparecerão aqui</div>
              )}
            </CardContent></Card>
          </div>
        </TabsContent>

        {/* ---------- NARRAÇÃO ---------- */}
        <TabsContent value="narracao" className="mt-4">
          <Card><CardContent className="p-5 space-y-3 max-w-2xl">
            <div><Label>Texto para narrar *</Label><Textarea rows={4} value={tts.text} onChange={(e) => setTts({ ...tts, text: e.target.value })} placeholder="Cole o roteiro/texto da narração…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Voz</Label>
                <select className="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm" value={tts.voice} onChange={(e) => setTts({ ...tts, voice: e.target.value })}>
                  {TTS_VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div><Label>Tom (emoção)</Label><Input value={tts.instructions} onChange={(e) => setTts({ ...tts, instructions: e.target.value })} placeholder="Ex.: animado e persuasivo" /></div>
            </div>
            <Button disabled={ttsMut.isPending || !tts.text} onClick={() => ttsMut.mutate()}>
              {ttsMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
              Gerar narração
            </Button>
            {ttsUrl && <audio controls src={ttsUrl} className="w-full mt-2" />}
            <p className="text-xs text-muted-foreground">Voz premium (ElevenLabs) disponível ao conectar a chave nas configurações.</p>
          </CardContent></Card>
        </TabsContent>

        {/* ---------- AVATAR ---------- */}
        <TabsContent value="avatar" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card><CardContent className="p-5 space-y-3">
              <div>
                <Label>Foto da pessoa *</Label>
                <label className="mt-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-primary/50 transition">
                  {avatar.photo ? (
                    <img src={avatar.photo} alt="Foto" className="h-32 rounded-md object-cover" />
                  ) : (
                    <div className="text-center text-muted-foreground text-sm py-4"><UserSquare2 className="w-8 h-8 mx-auto mb-1 opacity-40" />Clique para enviar uma foto (rosto)</div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhotoPick(e.target.files?.[0])} />
                </label>
              </div>
              <div><Label>O que a pessoa vai falar *</Label><Textarea rows={4} value={avatar.text} onChange={(e) => setAvatar({ ...avatar, text: e.target.value })} placeholder="Cole o roteiro que será narrado…" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Voz</Label>
                  <select className="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm" value={avatar.voice} onChange={(e) => setAvatar({ ...avatar, voice: e.target.value })}>
                    {TTS_VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div><Label>Formato</Label>
                  <select className="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm" value={avatar.size} onChange={(e) => setAvatar({ ...avatar, size: e.target.value })}>
                    {VIDEO_FORMATS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
                  </select>
                </div>
              </div>
              <Button className="w-full" disabled={avatarMut.isPending || !avatar.photo || !avatar.text} onClick={() => avatarMut.mutate()}>
                {avatarMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
                Gerar avatar
              </Button>
              <p className="text-xs text-muted-foreground">Lip-sync realista (HeyGen / D-ID) ativa ao conectar a chave nas configurações.</p>
            </CardContent></Card>
            <Card><CardContent className="p-5 flex flex-col items-center justify-center min-h-[320px]">
              {avatarMut.isPending ? (
                <div className="text-center text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />Gerando seu avatar… (pode levar alguns segundos)</div>
              ) : avatarUrl ? (
                <div className="w-full space-y-3">
                  <video controls src={avatarUrl} className="w-full rounded-lg border" />
                  <a href={avatarUrl} download className="block"><Button variant="outline" className="w-full"><Download className="w-4 h-4 mr-2" />Baixar vídeo</Button></a>
                </div>
              ) : (
                <div className="text-center text-muted-foreground"><UserSquare2 className="w-10 h-10 mx-auto mb-2 opacity-40" />Seu avatar aparecerá aqui</div>
              )}
            </CardContent></Card>
          </div>
        </TabsContent>

        {/* ---------- VÍDEO ---------- */}
        <TabsContent value="video" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card><CardContent className="p-5 space-y-3">
              <div><Label>Descrição do vídeo / produto *</Label><Textarea rows={3} value={vid.prompt} onChange={(e) => setVid({ ...vid, prompt: e.target.value })} placeholder="Ex.: tênis esportivo premium em fundo escuro com luz de estúdio, foco no produto" /></div>
              <div><Label>Roteiro de narração (opcional)</Label><Textarea rows={4} value={vid.script} onChange={(e) => setVid({ ...vid, script: e.target.value })} placeholder="Cole a copy/voiceover. Deixe vazio para vídeo sem áudio." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Voz</Label>
                  <select className="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm" value={vid.voice} onChange={(e) => setVid({ ...vid, voice: e.target.value })}>
                    {TTS_VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div><Label>Formato</Label>
                  <select className="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm" value={vid.size} onChange={(e) => setVid({ ...vid, size: e.target.value })}>
                    {VIDEO_FORMATS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
                  </select>
                </div>
              </div>
              <Button className="w-full" disabled={videoMut.isPending || !vid.prompt} onClick={() => videoMut.mutate()}>
                {videoMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
                Gerar vídeo
              </Button>
              <p className="text-xs text-muted-foreground">Vídeo super-realista (Seedance 2.0 / Kling 3.0) ativa ao conectar a FAL_KEY.</p>
            </CardContent></Card>
            <Card><CardContent className="p-5 flex flex-col items-center justify-center min-h-[320px]">
              {videoMut.isPending ? (
                <div className="text-center text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />Renderizando seu vídeo…</div>
              ) : vidUrl ? (
                <div className="w-full space-y-3">
                  <video controls src={vidUrl} className="w-full rounded-lg border" />
                  <a href={vidUrl} download className="block"><Button variant="outline" className="w-full"><Download className="w-4 h-4 mr-2" />Baixar vídeo</Button></a>
                </div>
              ) : (
                <div className="text-center text-muted-foreground"><Video className="w-10 h-10 mx-auto mb-2 opacity-40" />Seu vídeo aparecerá aqui</div>
              )}
            </CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
