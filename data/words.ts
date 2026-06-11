// Palavras compostas em Libras — vocabulário de soletração para o aluno.
// O aluno soletra cada palavra letra-por-letra usando o alfabeto manual.
// Lista baseada em padrões do INES/FENEIS para vocabulário inicial.

export interface LibrasWord {
  word: string; // ex: "PAI", "MAE", "AMOR", "CASA"
  category:
    | "familia"
    | "emocoes"
    | "lugares"
    | "objetos"
    | "cores"
    | "comida";
  difficulty: 1 | 2 | 3;
  emoji_visual?: string; // emoji que ilustra o conceito
  letters: string[]; // ex: ["P", "A", "I"]
  pronunciation_pt: string; // descrição em português do significado
}

export const WORDS: LibrasWord[] = [
  // ─── FAMÍLIA ──────────────────────────────────────────────────────────
  {
    word: "PAI",
    category: "familia",
    difficulty: 1,
    emoji_visual: "👨",
    letters: ["P", "A", "I"],
    pronunciation_pt: "Pai — genitor masculino",
  },
  {
    word: "MAE",
    category: "familia",
    difficulty: 1,
    emoji_visual: "👩",
    letters: ["M", "A", "E"],
    pronunciation_pt: "Mãe — genitora feminina",
  },
  {
    word: "AVO",
    category: "familia",
    difficulty: 1,
    emoji_visual: "👵",
    letters: ["A", "V", "O"],
    pronunciation_pt: "Avó — mãe do pai ou da mãe",
  },
  {
    word: "FILHO",
    category: "familia",
    difficulty: 2,
    emoji_visual: "👦",
    letters: ["F", "I", "L", "H", "O"],
    pronunciation_pt: "Filho — descendente masculino",
  },
  {
    word: "IRMAO",
    category: "familia",
    difficulty: 2,
    emoji_visual: "👬",
    letters: ["I", "R", "M", "A", "O"],
    pronunciation_pt: "Irmão — parente masculino direto",
  },

  // ─── EMOÇÕES ──────────────────────────────────────────────────────────
  {
    word: "AMOR",
    category: "emocoes",
    difficulty: 2,
    emoji_visual: "❤️",
    letters: ["A", "M", "O", "R"],
    pronunciation_pt: "Amor — sentimento de afeto profundo",
  },
  {
    word: "RAIVA",
    category: "emocoes",
    difficulty: 3,
    emoji_visual: "😡",
    letters: ["R", "A", "I", "V", "A"],
    pronunciation_pt: "Raiva — sentimento de fúria",
  },
  {
    word: "MEDO",
    category: "emocoes",
    difficulty: 2,
    emoji_visual: "😨",
    letters: ["M", "E", "D", "O"],
    pronunciation_pt: "Medo — sensação de receio",
  },
  {
    word: "FELIZ",
    category: "emocoes",
    difficulty: 2,
    emoji_visual: "😊",
    letters: ["F", "E", "L", "I", "Z"],
    pronunciation_pt: "Feliz — estado de alegria",
  },

  // ─── LUGARES ──────────────────────────────────────────────────────────
  {
    word: "CASA",
    category: "lugares",
    difficulty: 1,
    emoji_visual: "🏠",
    letters: ["C", "A", "S", "A"],
    pronunciation_pt: "Casa — moradia",
  },
  {
    word: "RUA",
    category: "lugares",
    difficulty: 1,
    emoji_visual: "🛣️",
    letters: ["R", "U", "A"],
    pronunciation_pt: "Rua — via pública",
  },
  {
    word: "ESCOLA",
    category: "lugares",
    difficulty: 3,
    emoji_visual: "🏫",
    letters: ["E", "S", "C", "O", "L", "A"],
    pronunciation_pt: "Escola — lugar onde se aprende",
  },

  // ─── OBJETOS ──────────────────────────────────────────────────────────
  {
    word: "LIVRO",
    category: "objetos",
    difficulty: 2,
    emoji_visual: "📖",
    letters: ["L", "I", "V", "R", "O"],
    pronunciation_pt: "Livro — objeto para leitura",
  },
  {
    word: "MESA",
    category: "objetos",
    difficulty: 2,
    emoji_visual: "🪑",
    letters: ["M", "E", "S", "A"],
    pronunciation_pt: "Mesa — móvel de apoio",
  },
  {
    word: "AGUA",
    category: "objetos",
    difficulty: 2,
    emoji_visual: "💧",
    letters: ["A", "G", "U", "A"],
    pronunciation_pt: "Água — líquido essencial à vida",
  },
  {
    word: "BOLA",
    category: "objetos",
    difficulty: 2,
    emoji_visual: "⚽",
    letters: ["B", "O", "L", "A"],
    pronunciation_pt: "Bola — objeto esférico",
  },

  // ─── CORES ────────────────────────────────────────────────────────────
  {
    word: "AZUL",
    category: "cores",
    difficulty: 2,
    emoji_visual: "🟦",
    letters: ["A", "Z", "U", "L"],
    pronunciation_pt: "Azul — cor primária fria",
  },
  {
    word: "VERDE",
    category: "cores",
    difficulty: 2,
    emoji_visual: "🟩",
    letters: ["V", "E", "R", "D", "E"],
    pronunciation_pt: "Verde — cor da natureza",
  },
  {
    word: "BRANCO",
    category: "cores",
    difficulty: 3,
    emoji_visual: "⬜",
    letters: ["B", "R", "A", "N", "C", "O"],
    pronunciation_pt: "Branco — ausência de cor",
  },

  // ─── COMIDA ───────────────────────────────────────────────────────────
  {
    word: "PAO",
    category: "comida",
    difficulty: 1,
    emoji_visual: "🍞",
    letters: ["P", "A", "O"],
    pronunciation_pt: "Pão — alimento básico de farinha",
  },
  {
    word: "ARROZ",
    category: "comida",
    difficulty: 3,
    emoji_visual: "🍚",
    letters: ["A", "R", "R", "O", "Z"],
    pronunciation_pt: "Arroz — cereal básico da culinária brasileira",
  },
];
