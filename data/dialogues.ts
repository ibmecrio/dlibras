// Mini-diálogos em Libras — conversações curtas para prática de turnos.
// Cada diálogo tem 4-6 turnos alternando entre aluno e outro interlocutor.
// O aluno pratica sinais lexicais comuns em situações reais.

export interface LibrasDialogueTurn {
  speaker: "aluno" | "outro";
  libras: string; // sequência em Libras, ex: "BOM-DIA"
  portugues: string; // tradução em português
  hint?: string; // dica visual ou contextual
}

export interface LibrasDialogue {
  id: string;
  title: string; // ex: "No café da manhã"
  description: string; // ex: "Aprenda a pedir comida"
  scenario_emoji: string; // ex: "☕"
  turns: LibrasDialogueTurn[];
  xp_reward: number; // entre 20 e 30
}

export const DIALOGUES: LibrasDialogue[] = [
  // ─── DIÁLOGO 1 — CAFÉ DA MANHÃ ────────────────────────────────────────
  {
    id: "dialogue-cafe-manha",
    title: "No café da manhã",
    description: "Aprenda a cumprimentar e pedir comida pela manhã",
    scenario_emoji: "☕",
    xp_reward: 20,
    turns: [
      {
        speaker: "outro",
        libras: "BOM-DIA",
        portugues: "Bom dia!",
        hint: "Cumprimento matinal — sorria ao sinalizar",
      },
      {
        speaker: "aluno",
        libras: "BOM-DIA TUDO-BEM",
        portugues: "Bom dia! Tudo bem?",
        hint: "Devolva o cumprimento e pergunte como está",
      },
      {
        speaker: "outro",
        libras: "BEM OBRIGADO VOCE QUERER COMER",
        portugues: "Bem, obrigado. Você quer comer?",
      },
      {
        speaker: "aluno",
        libras: "SIM EU QUERER PAO",
        portugues: "Sim, eu quero pão.",
        hint: "Soletre P-A-O para a palavra pão",
      },
      {
        speaker: "outro",
        libras: "AQUI PAO BOM-APETITE",
        portugues: "Aqui está o pão. Bom apetite!",
      },
      {
        speaker: "aluno",
        libras: "OBRIGADO",
        portugues: "Obrigado!",
        hint: "Finalize com gratidão",
      },
    ],
  },

  // ─── DIÁLOGO 2 — APRESENTAÇÃO ────────────────────────────────────────
  {
    id: "dialogue-conhecer",
    title: "Conhecendo alguém novo",
    description: "Apresente-se e pergunte sobre a outra pessoa",
    scenario_emoji: "🤝",
    xp_reward: 25,
    turns: [
      {
        speaker: "outro",
        libras: "OI EU NOME ANA",
        portugues: "Oi! Meu nome é Ana.",
        hint: "Ela soletra o nome A-N-A após sinalizar NOME",
      },
      {
        speaker: "aluno",
        libras: "OI EU NOME ...",
        portugues: "Oi! Meu nome é... (soletre seu nome)",
        hint: "Aponte para si, sinalize NOME e soletre",
      },
      {
        speaker: "outro",
        libras: "MUITO PRAZER VOCE MORAR ONDE",
        portugues: "Muito prazer. Onde você mora?",
        hint: "Note a expressão de pergunta no final",
      },
      {
        speaker: "aluno",
        libras: "EU MORAR CASA",
        portugues: "Eu moro em casa.",
        hint: "Aponte para si, sinalize MORAR e depois CASA",
      },
      {
        speaker: "outro",
        libras: "LEGAL FELIZ CONHECER VOCE",
        portugues: "Legal! Fico feliz em te conhecer.",
      },
    ],
  },

  // ─── DIÁLOGO 3 — SALA DE AULA ────────────────────────────────────────
  {
    id: "dialogue-sala-aula",
    title: "Na sala de aula",
    description: "Faça perguntas e responda durante a aula",
    scenario_emoji: "📚",
    xp_reward: 25,
    turns: [
      {
        speaker: "outro",
        libras: "PROFESSORA PERGUNTAR ALUNO",
        portugues: "A professora pergunta ao aluno.",
        hint: "Cenário inicial — só observação",
      },
      {
        speaker: "outro",
        libras: "VOCE ENTENDER LICAO",
        portugues: "Você entendeu a lição?",
        hint: "Expressão facial de pergunta",
      },
      {
        speaker: "aluno",
        libras: "NAO EU TER DUVIDA",
        portugues: "Não, eu tenho uma dúvida.",
        hint: "Balance a cabeça negativamente ao sinalizar NAO",
      },
      {
        speaker: "outro",
        libras: "PODER PERGUNTAR",
        portugues: "Pode perguntar.",
      },
      {
        speaker: "aluno",
        libras: "LIVRO ONDE",
        portugues: "Onde está o livro?",
        hint: "Soletre L-I-V-R-O e use expressão de pergunta",
      },
      {
        speaker: "outro",
        libras: "LIVRO MESA OBRIGADO",
        portugues: "O livro está na mesa. Obrigada pela pergunta!",
      },
    ],
  },

  // ─── DIÁLOGO 4 — MERCADO ─────────────────────────────────────────────
  {
    id: "dialogue-mercado",
    title: "Comprando no mercado",
    description: "Pratique números, escolha de produtos e agradecimento",
    scenario_emoji: "🛒",
    xp_reward: 30,
    turns: [
      {
        speaker: "outro",
        libras: "OI POSSO AJUDAR",
        portugues: "Oi! Posso ajudar?",
        hint: "Atendente cumprimenta o cliente",
      },
      {
        speaker: "aluno",
        libras: "EU QUERER COMPRAR ARROZ",
        portugues: "Eu quero comprar arroz.",
        hint: "Soletre A-R-R-O-Z após sinalizar COMPRAR",
      },
      {
        speaker: "outro",
        libras: "QUANTOS",
        portugues: "Quantos?",
        hint: "Pergunta com sobrancelhas franzidas",
      },
      {
        speaker: "aluno",
        libras: "DOIS",
        portugues: "Dois.",
        hint: "Mão configurada em 2 (indicador e médio levantados)",
      },
      {
        speaker: "outro",
        libras: "DEZ REAIS",
        portugues: "Dez reais.",
        hint: "Mão em 10 (palma aberta) + sinal de DINHEIRO",
      },
      {
        speaker: "aluno",
        libras: "AQUI OBRIGADO",
        portugues: "Aqui está. Obrigado!",
        hint: "Entregue o dinheiro e finalize com gratidão",
      },
    ],
  },
];
