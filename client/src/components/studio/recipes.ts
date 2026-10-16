import type { Recipe } from "./types";

// Receitas = atalhos prontos para quem não sabe (nem quer saber) qual ferramenta usar.
// Cada uma encadeia as ferramentas do Estúdio e entrega uma peça pronta pra anunciar.
export const RECIPES: Recipe[] = [
  {
    id: "anuncio",
    name: "Anúncio pronto",
    tagline: "Texto do anúncio + criativo combinando, prontos pra subir.",
    delivers: "1 copy de anúncio + 1 imagem",
    badge: "Mais usado",
    ratio: "1:1",
    steps: [
      { kind: "copy", title: "Escrever o anúncio", outcome: "Texto persuasivo com gancho e chamada", opts: { tipo: "anuncio", framework: "AIDA", variacoes: 3 } },
      { kind: "image", title: "Criar o criativo", outcome: "Imagem do produto com a headline aplicada" },
    ],
  },
  {
    id: "video-ads",
    name: "Vídeo de anúncio",
    tagline: "Do texto ao vídeo narrado, sem você tocar em editor.",
    delivers: "Copy + imagem base + vídeo narrado",
    badge: "Completo",
    ratio: "9:16",
    steps: [
      { kind: "copy", title: "Roteiro do vídeo", outcome: "Roteiro curto pensado pra 15–30 segundos", opts: { tipo: "anuncio", framework: "PAS", variacoes: 2 } },
      { kind: "image", title: "Cena base", outcome: "Imagem que será animada no vídeo" },
      { kind: "video", title: "Montar o vídeo", outcome: "MP4 com movimento e narração" },
    ],
  },
  {
    id: "reels-avatar",
    name: "Reels com avatar",
    tagline: "Sua foto (ou de um modelo) falando o roteiro, com lip-sync.",
    delivers: "Roteiro + vídeo de avatar falando",
    badge: "Presença",
    ratio: "9:16",
    needsPhoto: true,
    steps: [
      { kind: "copy", title: "Roteiro de fala", outcome: "Texto natural pra ser falado em câmera", opts: { tipo: "anuncio", framework: "AIDA", variacoes: 2 } },
      { kind: "avatar", title: "Gerar o avatar", outcome: "Vídeo da pessoa falando o roteiro" },
    ],
  },
  {
    id: "vsl",
    name: "VSL narrada",
    tagline: "Roteiro de vídeo de vendas + narração profissional + vídeo.",
    delivers: "Roteiro de VSL + MP3 + MP4",
    badge: "Vendas",
    ratio: "16:9",
    steps: [
      { kind: "copy", title: "Roteiro da VSL", outcome: "Estrutura de vídeo de vendas completa", opts: { tipo: "vsl", framework: "PAS", variacoes: 1 } },
      { kind: "tts", title: "Narrar o roteiro", outcome: "Áudio com voz realista" },
      { kind: "image", title: "Cena de abertura", outcome: "Imagem base do vídeo" },
      { kind: "video", title: "Montar a VSL", outcome: "Vídeo com a narração aplicada" },
    ],
  },
  {
    id: "pack",
    name: "Pack de headlines",
    tagline: "Várias headlines pra testar + o criativo da campeã.",
    delivers: "5 headlines + 1 criativo",
    badge: "Teste A/B",
    ratio: "1:1",
    steps: [
      { kind: "copy", title: "Gerar headlines", outcome: "5 variações curtas pra testar", opts: { tipo: "headline", framework: "auto", variacoes: 5 } },
      { kind: "image", title: "Criativo da campeã", outcome: "Imagem usando a primeira headline" },
    ],
  },
  {
    id: "conteudo",
    name: "Post + narração",
    tagline: "Legenda pra redes e o áudio pronto pra virar Reels.",
    delivers: "Legenda + narração MP3",
    badge: "Orgânico",
    ratio: "4:5",
    steps: [
      { kind: "copy", title: "Escrever a legenda", outcome: "Legenda com gancho e CTA", opts: { tipo: "legenda", framework: "auto", variacoes: 3 } },
      { kind: "image", title: "Imagem do post", outcome: "Criativo no formato de feed" },
      { kind: "tts", title: "Narrar a legenda", outcome: "Áudio pra usar em Reels/Stories" },
    ],
  },
];

export const recipeById = (id: string) => RECIPES.find((r) => r.id === id);
