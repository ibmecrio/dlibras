// Frases básicas em Libras — situações cotidianas mais comuns.
// Cada frase mapeia para uma sequência de sinais lexicais (não soletrados),
// que são gestos próprios em Libras. Útil pra aluno entender que Libras
// não é apenas o alfabeto manual.

export interface LibrasPhrase {
  id: string;
  text: string; // tradução em português, ex: "Bom dia, tudo bem?"
  signs: string[]; // ex: ["BOM-DIA", "TUDO", "BEM"]
  context: string; // ex: "Cumprimento informal"
  audio_hint?: string; // descrição do gesto ou pronúncia
}

export const PHRASES: LibrasPhrase[] = [
  // ─── CUMPRIMENTOS ─────────────────────────────────────────────────────
  {
    id: "phrase-greet-1",
    text: "Oi",
    signs: ["OI"],
    context: "Cumprimento informal",
    audio_hint: "Mão aberta acenando próximo ao rosto",
  },
  {
    id: "phrase-greet-2",
    text: "Bom dia",
    signs: ["BOM-DIA"],
    context: "Cumprimento matinal",
    audio_hint: "Mão direita encosta na bochecha, depois desce com sorriso",
  },
  {
    id: "phrase-greet-3",
    text: "Boa noite",
    signs: ["BOA-NOITE"],
    context: "Cumprimento noturno ou despedida",
    audio_hint: "Mão configurada em B desce em curva diante do corpo",
  },

  // ─── CORTESIA ─────────────────────────────────────────────────────────
  {
    id: "phrase-courtesy-1",
    text: "Obrigado",
    signs: ["OBRIGADO"],
    context: "Agradecimento",
    audio_hint: "Mão aberta toca o queixo e desce em direção ao interlocutor",
  },
  {
    id: "phrase-courtesy-2",
    text: "Por favor",
    signs: ["POR-FAVOR"],
    context: "Pedido educado",
    audio_hint: "Mão aberta circula sobre o peito em movimento suave",
  },
  {
    id: "phrase-courtesy-3",
    text: "Desculpe",
    signs: ["DESCULPE"],
    context: "Pedido de desculpas",
    audio_hint: "Mão em S faz movimento circular sobre o peito",
  },

  // ─── APRESENTAÇÃO ─────────────────────────────────────────────────────
  {
    id: "phrase-intro-1",
    text: "Meu nome é...",
    signs: ["EU", "NOME", "..."],
    context: "Apresentação pessoal — soletre o nome em seguida",
    audio_hint: "Aponte para si, sinalize NOME, depois soletre o nome",
  },
  {
    id: "phrase-intro-2",
    text: "Muito prazer",
    signs: ["MUITO", "PRAZER"],
    context: "Resposta cordial ao conhecer alguém",
    audio_hint: "Mão direita toca o peito e se estende ao interlocutor",
  },
  {
    id: "phrase-intro-3",
    text: "Onde você mora?",
    signs: ["VOCE", "MORAR", "ONDE"],
    context: "Pergunta na apresentação — sobrancelhas franzidas",
    audio_hint:
      "Aponte para a pessoa, sinalize MORAR, finalize com a expressão de pergunta",
  },

  // ─── NECESSIDADES ────────────────────────────────────────────────────
  {
    id: "phrase-need-1",
    text: "Preciso de água",
    signs: ["EU", "PRECISAR", "AGUA"],
    context: "Pedido em situação de sede",
    audio_hint:
      "Aponte para si, mão em Y bate no queixo (PRECISAR), depois sinalize AGUA",
  },
  {
    id: "phrase-need-2",
    text: "Estou com fome",
    signs: ["EU", "FOME"],
    context: "Expressão de necessidade alimentar",
    audio_hint:
      "Aponte para si, mão em C desce do peito ao abdome representando FOME",
  },
  {
    id: "phrase-need-3",
    text: "Ajuda-me, por favor",
    signs: ["AJUDAR", "EU", "POR-FAVOR"],
    context: "Pedido de auxílio em situação de necessidade",
    audio_hint:
      "Mão direita em A pousa sobre a esquerda em punho e se eleva (AJUDAR)",
  },
];
