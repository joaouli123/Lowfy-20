// Catálogo curado das ~10 vozes premade mais usadas do ElevenLabs (5 masc + 5 fem),
// puxado ao vivo da API em 2026-09-01 pra confirmar voice_id/preview_url atuais —
// o catálogo "premade" da ElevenLabs muda com o tempo, IDs antigos (ex: Rachel/Antoni)
// já não existem mais. Prévias tocam sem depender da chave no servidor (URLs públicas).
// A geração final usa a voice_id (requer a ELEVENLABS_API_KEY no ambiente + plano pago).
export interface ElevenVoice { voiceId: string; name: string; category: string; previewUrl: string; gender: "masc" | "fem"; tag: string; }

export const ELEVEN_VOICES: ElevenVoice[] = [
  // Masculinas
  { voiceId: "pNInz6obpgDQGcFmaJgB", name: "Adam", category: "premade", gender: "masc", tag: "firme, dominante", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/d6905d7a-dd26-4187-bfff-1bd3a5ea7cac.mp3" },
  { voiceId: "JBFqnCBsd6RMkjVDRZzb", name: "George", category: "premade", gender: "masc", tag: "caloroso, contador de histórias", previewUrl: "https://api.us.elevenlabs.io/v1/voices/JBFqnCBsd6RMkjVDRZzb/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJwcmVtYWRlIiwiZmlsZW5hbWUiOiJlNjIwNmQxYS0wNzIxLTQ3ODctYWFmYi0wNmE2ZTcwNWNhYzUubXAzIiwidGltZXN0YW1wIjoxNzg4Mjc4NDAwMDAwMDAwfQ%3D%3D" },
  { voiceId: "nPczCjzI2devNBz1zQrb", name: "Brian", category: "premade", gender: "masc", tag: "grave, envolvente", previewUrl: "https://api.us.elevenlabs.io/v1/voices/nPczCjzI2devNBz1zQrb/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJwcmVtYWRlIiwiZmlsZW5hbWUiOiIyZGQzZTcyYy00ZmQzLTQyZjEtOTNlYS1hYmM1ZDRlNWFhMWQubXAzIiwidGltZXN0YW1wIjoxNzg4Mjc4NDAwMDAwMDAwfQ%3D%3D" },
  { voiceId: "IKne3meq5aSn9XLyUdCD", name: "Charlie", category: "premade", gender: "masc", tag: "confiante, energético", previewUrl: "https://api.us.elevenlabs.io/v1/voices/IKne3meq5aSn9XLyUdCD/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJwcmVtYWRlIiwiZmlsZW5hbWUiOiIxMDJkZTZmMi0yMmVkLTQzZTAtYTFmMS0xMTFmYTc1YzU0ODEubXAzIiwidGltZXN0YW1wIjoxNzg4Mjc4NDAwMDAwMDAwfQ%3D%3D" },
  { voiceId: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", category: "premade", gender: "masc", tag: "casual, ressonante", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/CwhRBWXzGAHq8TQ4Fs17/58ee3ff5-f6f2-4628-93b8-e38eb31806b0.mp3" },
  // Femininas
  { voiceId: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", category: "premade", gender: "fem", tag: "madura, confiante", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2216a32186.mp3" },
  { voiceId: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", category: "premade", gender: "fem", tag: "clara, educadora", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/Xb7hH8MSUJpSbSDYk0k2/d10f7534-11f6-41fe-a012-2de1e482d336.mp3" },
  { voiceId: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", category: "premade", gender: "fem", tag: "profissional, segura", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/XrExE9yKIg1WjnnlVkGX/b930e18d-6b4d-466e-bab2-0ae97c6d8535.mp3" },
  { voiceId: "cgSgspJ2msm6clMCkdW9", name: "Jessica", category: "premade", gender: "fem", tag: "brincalhona, calorosa", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/cgSgspJ2msm6clMCkdW9/56a97bf8-b69b-448f-846c-c3a11683d45a.mp3" },
  { voiceId: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", category: "premade", gender: "fem", tag: "animada, descontraída", previewUrl: "https://api.us.elevenlabs.io/v1/voices/FGY2WhTYpPnrIDTdsKH5/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJwcmVtYWRlIiwiZmlsZW5hbWUiOiI2NzM0MTc1OS1hZDA4LTQxYTUtYmU2ZS1kZTEyZmU0NDg2MTgubXAzIiwidGltZXN0YW1wIjoxNzg4Mjc4NDAwMDAwMDAwfQ%3D%3D" },
];
