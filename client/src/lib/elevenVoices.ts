// Catálogo de vozes ElevenLabs (premade) com amostra pública — as prévias tocam
// sem depender da chave no servidor. A geração final usa a voice_id (requer a
// ELEVENLABS_API_KEY no ambiente + plano pago).
export interface ElevenVoice { voiceId: string; name: string; category: string; previewUrl: string; tag?: string; }

const B = "https://storage.googleapis.com/eleven-public-prod/premade/voices";
export const ELEVEN_VOICES: ElevenVoice[] = [
  { voiceId: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger — casual, ressonante", category: "premade", previewUrl: `${B}/CwhRBWXzGAHq8TQ4Fs17/58ee3ff5-f6f2-4628-93b8-e38eb31806b0.mp3`, tag: "masc · conversa" },
  { voiceId: "EXAVITQu4vr4xnSDxMaL", name: "Sarah — madura, confiante", category: "premade", previewUrl: `${B}/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2216a32186.mp3`, tag: "fem · profissional" },
  { voiceId: "N2lVS1w4EtoT3dr4eOWO", name: "Callum — rouca, trickster", category: "premade", previewUrl: `${B}/N2lVS1w4EtoT3dr4eOWO/ac833bd8-ffda-4938-9ebc-b0f99ca25481.mp3`, tag: "masc · personagem" },
  { voiceId: "SAz9YHcvj6GT2YYXdXww", name: "River — neutra, informativa", category: "premade", previewUrl: `${B}/SAz9YHcvj6GT2YYXdXww/e6c95f0b-2227-491a-b3d7-2249240decb7.mp3`, tag: "neutra · conversa" },
  { voiceId: "SOYHLrjzK2X1ezoPC6cr", name: "Harry — guerreiro, intenso", category: "premade", previewUrl: `${B}/SOYHLrjzK2X1ezoPC6cr/86d178f6-f4b6-4e0e-85be-3de19f490794.mp3`, tag: "masc · personagem" },
  { voiceId: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam — energético, redes", category: "premade", previewUrl: `${B}/TX3LPaxmHKxFdv7VOQHJ/63148076-6363-42db-aea8-31424308b92c.mp3`, tag: "masc · social" },
  { voiceId: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice — clara, educadora", category: "premade", previewUrl: `${B}/Xb7hH8MSUJpSbSDYk0k2/d10f7534-11f6-41fe-a012-2de1e482d336.mp3`, tag: "fem · educação" },
  { voiceId: "XrExE9yKIg1WjnnlVkGX", name: "Matilda — profissional", category: "premade", previewUrl: `${B}/XrExE9yKIg1WjnnlVkGX/b930e18d-6b4d-466e-bab2-0ae97c6d8535.mp3`, tag: "fem · educação" },
  { voiceId: "bIHbv24MWmeRgasZH58o", name: "Will — relaxado, otimista", category: "premade", previewUrl: `${B}/bIHbv24MWmeRgasZH58o/8caf8f3d-ad29-4980-af41-53f20c72d7a4.mp3`, tag: "masc · conversa" },
  { voiceId: "cgSgspJ2msm6clMCkdW9", name: "Jessica — brincalhona, calorosa", category: "premade", previewUrl: `${B}/cgSgspJ2msm6clMCkdW9/56a97bf8-b69b-448f-846c-c3a11683d45a.mp3`, tag: "fem · conversa" },
  { voiceId: "cjVigY5qzO86Huf0OWal", name: "Eric — suave, confiável", category: "premade", previewUrl: `${B}/cjVigY5qzO86Huf0OWal/d098fda0-6456-4030-b3d8-63aa048c9070.mp3`, tag: "masc · conversa" },
  { voiceId: "hpp4J3VqNfWAUOO0d1Us", name: "Bella — profissional, calorosa", category: "premade", previewUrl: `${B}/hpp4J3VqNfWAUOO0d1Us/dab0f5ba-3aa4-48a8-9fad-f138fea1126d.mp3`, tag: "fem · educação" },
  { voiceId: "iP95p4xoKVk53GoZ742B", name: "Chris — carismático, natural", category: "premade", previewUrl: `${B}/iP95p4xoKVk53GoZ742B/3f4bde72-cc48-40dd-829f-57fbf906f4d7.mp3`, tag: "masc · conversa" },
  { voiceId: "pFZP5JQG7iQjIQuC4Bku", name: "Lily — atriz, aveludada", category: "premade", previewUrl: `${B}/pFZP5JQG7iQjIQuC4Bku/89b68b35-b3dd-4348-a84a-a3c13a3c2b30.mp3`, tag: "fem · narração" },
  { voiceId: "pNInz6obpgDQGcFmaJgB", name: "Adam — firme, dominante", category: "premade", previewUrl: `${B}/pNInz6obpgDQGcFmaJgB/d6905d7a-dd26-4187-bfff-1bd3a5ea7cac.mp3`, tag: "masc · social" },
  { voiceId: "pqHfZKP75CvOlQylNhV4", name: "Bill — sábio, equilibrado", category: "premade", previewUrl: `${B}/pqHfZKP75CvOlQylNhV4/d782b3ff-84ba-4029-848c-acf01285524d.mp3`, tag: "masc · anúncio" },
];
