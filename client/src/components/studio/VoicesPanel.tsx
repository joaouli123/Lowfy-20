import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Mic, Upload, Loader2, Trash2, Check, Square, AudioWaveform, Sparkles, ShieldCheck,
} from "lucide-react";
import { useStudio } from "./store";
import { Field, SectionTitle, ToolLayout, VoiceCard, useVoices } from "./ui";

interface Sample { data: string; type: string; name: string }

/**
 * Vozes: clonagem (Instant Voice Cloning da ElevenLabs) + catálogo pronto.
 * A voz escolhida aqui vira a voz do projeto — narração, avatar e vídeo passam a usá-la.
 */
export default function VoicesPanel() {
  const { brief, patchBrief, setTab } = useStudio();
  const { catalog, cloned, refetch } = useVoices();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [samples, setSamples] = useState<Sample[]>([]);
  const [recording, setRecording] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const addSamples = (files?: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, 5).forEach((f) => {
      if (f.size > 12 * 1024 * 1024) {
        toast({ title: "Áudio muito grande", description: "Use até 12MB por amostra.", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setSamples((s) => [...s, { data: String(reader.result), type: f.type || "audio/mpeg", name: f.name }].slice(0, 5));
      reader.readAsDataURL(f);
    });
  };

  const toggleRec = async () => {
    if (recording) { recRef.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => setSamples((s) => [...s, { data: String(reader.result), type: "audio/webm", name: `gravacao-${s.length + 1}.webm` }].slice(0, 5));
        reader.readAsDataURL(blob);
        setRecording(false);
      };
      recRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      toast({ title: "Não foi possível acessar o microfone", variant: "destructive" });
    }
  };

  const cloneMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/ai-studio/clone-voice", { name: name || "Minha voz", samples });
      return (await r.json()) as { voiceId: string; requiresVerification?: boolean };
    },
    onSuccess: (d) => {
      patchBrief({ voice: d.voiceId });
      setSamples([]);
      setName("");
      refetch();
      toast({ title: "Voz clonada!", description: "Ela já é a voz do seu projeto." });
    },
    onError: (e: any) => toast({ title: "Erro ao clonar voz", description: e.message, variant: "destructive" }),
  });

  const useVoice = (voiceId: string) => {
    patchBrief({ voice: voiceId });
    toast({ title: "Voz do projeto atualizada", description: "Narração, avatar e vídeo já vão usar essa voz." });
  };

  return (
    <ToolLayout
      controls={
        <>
          <SectionTitle>Clonar sua voz</SectionTitle>
          <p className="text-[12px] text-muted-foreground leading-snug -mt-1">
            Grave ou envie de 1 a 5 amostras limpas (30s a 2min cada). A IA cria uma cópia da voz e ela fica disponível em todo o Estúdio.
          </p>

          <Field label="Nome da voz">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Minha voz comercial" />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-11" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" /> Enviar áudio
            </Button>
            <Button type="button" variant={recording ? "destructive" : "outline"} className="h-11" onClick={() => void toggleRec()}>
              {recording ? <><Square className="w-4 h-4 mr-2 fill-current" /> Parar</> : <><Mic className="w-4 h-4 mr-2" /> Gravar agora</>}
            </Button>
            <input ref={fileRef} type="file" accept="audio/*" multiple className="hidden" onChange={(e) => addSamples(e.target.files)} />
          </div>

          {recording && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Gravando… fale de forma natural.
            </div>
          )}

          {samples.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{samples.length}/5 amostras</p>
              {samples.map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border bg-muted/20 px-2.5 py-2">
                  <AudioWaveform className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span className="text-[11px] truncate flex-1">{s.name}</span>
                  <audio src={s.data} controls className="h-7 w-32 hidden sm:block" />
                  <button onClick={() => setSamples((l) => l.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button
            className="w-full h-11 font-semibold"
            disabled={!samples.length || cloneMut.isPending}
            onClick={() => cloneMut.mutate()}
          >
            {cloneMut.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Clonando…</> : <><Sparkles className="w-4 h-4 mr-2" /> Clonar voz</>}
          </Button>

          <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            Só clone vozes que são suas ou que você tem autorização para usar.
          </p>
        </>
      }
      preview={
        <>
          <SectionTitle right={<span className="text-[11px] text-muted-foreground">{catalog.length} vozes</span>}>Vozes disponíveis</SectionTitle>

          {cloned.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Suas vozes clonadas</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {cloned.map((v) => (
                  <VoiceCard key={v.voiceId} voice={v} active={brief.voice === v.voiceId} onSelect={() => useVoice(v.voiceId)} />
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Catálogo pronto</p>
          <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {catalog.map((v) => (
              <VoiceCard key={v.voiceId} voice={v} active={brief.voice === v.voiceId} onSelect={() => useVoice(v.voiceId)} />
            ))}
          </div>

          <div className="mt-4 pt-4 border-t flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-primary" /> Voz do projeto definida.
            </p>
            <Button size="sm" variant="outline" onClick={() => setTab("narracao")}>Ir para a narração</Button>
          </div>
        </>
      }
    />
  );
}
