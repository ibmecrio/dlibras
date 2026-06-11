// Mini-histórias / narrativas em Libras — contação de história para
// o aluno acompanhar sequências de sinais formando narrativa.
// Cada história introduz vocabulário novo e tem 3-5 frases.

export interface LibrasStorySentence {
  libras_sequence: string[]; // ex: ["MENINA", "ENCONTRAR", "GATO"]
  portuguese: string; // tradução completa
  illustration?: string; // emoji ou descrição ilustrativa
}

export interface LibrasStory {
  id: string;
  title: string; // ex: "A menina e o gato"
  emoji_cover: string; // ex: "👧🐈"
  description: string;
  sentences: LibrasStorySentence[];
  vocabulary: string[]; // sinais novos introduzidos na história
  level: "iniciante" | "intermediario" | "avancado";
  xp_reward: number;
}

export const STORIES: LibrasStory[] = [
  // ─── HISTÓRIA 1 — A MENINA E O GATO ──────────────────────────────────
  {
    id: "story-menina-gato",
    title: "A menina e o gato",
    emoji_cover: "👧🐈",
    description: "Uma menina encontra um gato perdido e leva para casa",
    level: "iniciante",
    xp_reward: 30,
    vocabulary: [
      "MENINA",
      "GATO",
      "ENCONTRAR",
      "RUA",
      "PEGAR",
      "LEVAR",
      "CASA",
      "FELIZ",
    ],
    sentences: [
      {
        libras_sequence: ["MENINA", "ANDAR", "RUA"],
        portuguese: "A menina andava pela rua.",
        illustration: "👧🚶‍♀️",
      },
      {
        libras_sequence: ["MENINA", "ENCONTRAR", "GATO", "PEQUENO"],
        portuguese: "A menina encontrou um gato pequeno.",
        illustration: "👧🐈",
      },
      {
        libras_sequence: ["GATO", "TRISTE", "FOME"],
        portuguese: "O gato estava triste e com fome.",
        illustration: "🐈😿",
      },
      {
        libras_sequence: ["MENINA", "PEGAR", "GATO", "LEVAR", "CASA"],
        portuguese: "A menina pegou o gato e levou para casa.",
        illustration: "👧🏠🐈",
      },
      {
        libras_sequence: ["AGORA", "GATO", "FELIZ"],
        portuguese: "Agora o gato está feliz.",
        illustration: "🐈😺",
      },
    ],
  },

  // ─── HISTÓRIA 2 — O DIA NA ESCOLA ────────────────────────────────────
  {
    id: "story-dia-escola",
    title: "O dia na escola",
    emoji_cover: "🏫📚",
    description: "Um dia comum de um aluno na escola",
    level: "iniciante",
    xp_reward: 30,
    vocabulary: [
      "ACORDAR",
      "ESCOLA",
      "PROFESSORA",
      "AMIGOS",
      "ESTUDAR",
      "LIVRO",
      "ALMOÇAR",
      "VOLTAR",
    ],
    sentences: [
      {
        libras_sequence: ["EU", "ACORDAR", "CEDO"],
        portuguese: "Eu acordei cedo.",
        illustration: "⏰",
      },
      {
        libras_sequence: ["EU", "IR", "ESCOLA"],
        portuguese: "Eu fui para a escola.",
        illustration: "🚶🏫",
      },
      {
        libras_sequence: ["PROFESSORA", "ENSINAR", "LIVRO"],
        portuguese: "A professora ensinou com o livro.",
        illustration: "👩‍🏫📖",
      },
      {
        libras_sequence: ["EU", "AMIGOS", "ESTUDAR", "JUNTOS"],
        portuguese: "Eu e meus amigos estudamos juntos.",
        illustration: "👫📚",
      },
      {
        libras_sequence: ["TARDE", "EU", "VOLTAR", "CASA", "FELIZ"],
        portuguese: "À tarde eu voltei feliz para casa.",
        illustration: "🏠😊",
      },
    ],
  },

  // ─── HISTÓRIA 3 — ANIVERSÁRIO DO AMIGO ───────────────────────────────
  {
    id: "story-aniversario",
    title: "Aniversário do amigo",
    emoji_cover: "🎂🎉",
    description: "Uma festa de aniversário cheia de surpresas",
    level: "intermediario",
    xp_reward: 40,
    vocabulary: [
      "AMIGO",
      "ANIVERSARIO",
      "FESTA",
      "BOLO",
      "PRESENTE",
      "CANTAR",
      "PARABENS",
      "ABRAÇAR",
    ],
    sentences: [
      {
        libras_sequence: ["HOJE", "AMIGO", "MEU", "ANIVERSARIO"],
        portuguese: "Hoje é aniversário do meu amigo.",
        illustration: "🎉",
      },
      {
        libras_sequence: ["EU", "COMPRAR", "PRESENTE", "BONITO"],
        portuguese: "Eu comprei um presente bonito.",
        illustration: "🎁",
      },
      {
        libras_sequence: ["FESTA", "CASA", "AMIGO", "MUITOS", "AMIGOS"],
        portuguese: "A festa foi na casa dele com muitos amigos.",
        illustration: "🏠👥",
      },
      {
        libras_sequence: ["TODOS", "CANTAR", "PARABENS"],
        portuguese: "Todos cantamos parabéns.",
        illustration: "🎂🎵",
      },
      {
        libras_sequence: ["AMIGO", "FELIZ", "ABRAÇAR", "EU", "OBRIGADO"],
        portuguese: "Meu amigo, feliz, me abraçou e agradeceu.",
        illustration: "🤗",
      },
    ],
  },
];
