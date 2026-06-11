import { Lesson } from "@/types/learning";

// Sign-mode lessons: the student performs each letter in front of the camera.
// A FastAPI service (libras-vision API) runs MediaPipe HandLandmarker + KNN
// and tells the app which letter is being signed. The AI teacher narrates the
// lesson over a Stream video call.

export const LESSONS: Lesson[] = [
  {
    id: "libras-lesson-1",
    unitId: "libras-unit-1",
    title: "Alfabeto — A, B, C",
    description: "Suas primeiras três letras do alfabeto manual",
    icon: "🤟",
    xpReward: 15,
    mode: "sign",
    signTargets: [
      { letter: "A", word: "A", translation: "Letra A", emoji: "🅰️" },
      { letter: "B", word: "B", translation: "Letra B", emoji: "🅱️" },
      { letter: "C", word: "C", translation: "Letra C", emoji: "🔤" },
    ],
    goals: [
      { description: "Reproduzir A, B e C com a câmera", xpReward: 10 },
      { description: "Acertar cada letra ao menos uma vez", xpReward: 5 },
    ],
    vocabulary: [
      {
        word: "A",
        translation: "Letra A",
        pronunciation: "mão fechada, polegar ao lado",
        emoji: "🤚",
      },
      {
        word: "B",
        translation: "Letra B",
        pronunciation: "mão aberta, polegar encostado na palma",
        emoji: "✋",
      },
      {
        word: "C",
        translation: "Letra C",
        pronunciation: "mão em forma de C",
        emoji: "🤏",
      },
    ],
    phrases: [
      {
        text: "A · B · C",
        translation: "As três primeiras letras",
        pronunciation: "sinais estáticos com uma mão",
      },
    ],
    activities: [
      {
        id: "libras-lesson-1-act-1",
        type: "multiple-choice",
        question: "Quantas letras estáticas o alfabeto manual de Libras tem?",
        correctAnswer: "21",
        options: ["21", "26", "15", "10"],
      },
    ],
    aiTeacherPrompt: {
      systemPrompt:
        "You are Bia, a warm Brazilian Sign Language (Libras) teacher in a real video lesson. The student signs the letter with their hand and a computer-vision model tells you in real time which letter they showed via a custom event named 'libras_sign_matched'. INTERACTIVE — not a lecture. Each turn: name the target letter, give a short tip about how to form it with the hand, then END YOUR TURN and wait. When the system tells you the student showed the correct letter, celebrate in one sentence and move on. Stay strictly within letters A, B and C. Speak Brazilian Portuguese.",
      introMessage:
        "Oi! Eu sou a Bia — vamos aprender suas primeiras letras em Libras: A, B e C. Mostre a mão para a câmera quando estiver pronto!",
      topics: ["alfabeto manual", "sinais estáticos", "A", "B", "C"],
    },
  },

  {
    id: "libras-lesson-2",
    unitId: "libras-unit-1",
    title: "Alfabeto — D, E, F, G",
    description: "Quatro letras novas para você praticar",
    icon: "🤟",
    xpReward: 15,
    mode: "sign",
    signTargets: [
      { letter: "D", word: "D", translation: "Letra D", emoji: "🔤" },
      { letter: "E", word: "E", translation: "Letra E", emoji: "🔤" },
      { letter: "F", word: "F", translation: "Letra F", emoji: "🔤" },
      { letter: "G", word: "G", translation: "Letra G", emoji: "🔤" },
    ],
    goals: [
      { description: "Reproduzir D, E, F e G na câmera", xpReward: 10 },
      { description: "Manter o gesto firme por ~1 segundo", xpReward: 5 },
    ],
    vocabulary: [
      {
        word: "D",
        translation: "Letra D",
        pronunciation: "indicador apontado, demais dedos fechados",
        emoji: "☝️",
      },
      {
        word: "E",
        translation: "Letra E",
        pronunciation: "dedos dobrados sobre a palma",
        emoji: "✊",
      },
      {
        word: "F",
        translation: "Letra F",
        pronunciation: "polegar e indicador formam círculo",
        emoji: "👌",
      },
      {
        word: "G",
        translation: "Letra G",
        pronunciation: "polegar e indicador estendidos lado a lado",
        emoji: "🫳",
      },
    ],
    phrases: [
      {
        text: "D · E · F · G",
        translation: "Sequência de letras",
        pronunciation: "sinais estáticos",
      },
    ],
    activities: [
      {
        id: "libras-lesson-2-act-1",
        type: "multiple-choice",
        question: "Qual letra exige um círculo entre polegar e indicador?",
        correctAnswer: "F",
        options: ["D", "E", "F", "G"],
      },
    ],
    aiTeacherPrompt: {
      systemPrompt:
        "You are Bia, a warm Libras teacher in a real video lesson. The student signs in front of the camera and our vision model tells you each detection via a 'libras_sign_matched' custom event. INTERACTIVE: name the target letter, give one short hand-shape tip, then STOP and wait. React to the detection — praise or correct in one sentence. Stay strictly within D, E, F and G. Speak Brazilian Portuguese.",
      introMessage:
        "Vamos continuar! Agora você vai aprender as letras D, E, F e G. Prepare a mão e mostre para a câmera!",
      topics: ["alfabeto manual", "D", "E", "F", "G"],
    },
  },

  {
    id: "libras-lesson-3",
    unitId: "libras-unit-1",
    title: "Alfabeto — I, L, M, N",
    description: "Mais quatro letras estáticas",
    icon: "🤟",
    xpReward: 15,
    mode: "sign",
    signTargets: [
      { letter: "I", word: "I", translation: "Letra I", emoji: "🔤" },
      { letter: "L", word: "L", translation: "Letra L", emoji: "🔤" },
      { letter: "M", word: "M", translation: "Letra M", emoji: "🔤" },
      { letter: "N", word: "N", translation: "Letra N", emoji: "🔤" },
    ],
    goals: [
      { description: "Reproduzir I, L, M e N na câmera", xpReward: 10 },
      { description: "Diferenciar M e N", xpReward: 5 },
    ],
    vocabulary: [
      {
        word: "I",
        translation: "Letra I",
        pronunciation: "apenas o mindinho levantado",
        emoji: "🤙",
      },
      {
        word: "L",
        translation: "Letra L",
        pronunciation: "polegar e indicador formam um L",
        emoji: "🤟",
      },
      {
        word: "M",
        translation: "Letra M",
        pronunciation: "polegar sob três dedos",
        emoji: "✊",
      },
      {
        word: "N",
        translation: "Letra N",
        pronunciation: "polegar sob dois dedos",
        emoji: "✊",
      },
    ],
    phrases: [
      {
        text: "I · L · M · N",
        translation: "Sequência de letras",
        pronunciation: "sinais estáticos",
      },
    ],
    activities: [
      {
        id: "libras-lesson-3-act-1",
        type: "multiple-choice",
        question: "Qual letra usa apenas o mindinho?",
        correctAnswer: "I",
        options: ["L", "I", "M", "N"],
      },
    ],
    aiTeacherPrompt: {
      systemPrompt:
        "You are Bia, a warm Libras teacher. The student signs in front of the camera and our vision model fires a 'libras_sign_matched' custom event on every correct match. Stay strictly within I, L, M and N. Name the target, give a one-line shape tip, STOP. React in one sentence to each detection.",
      introMessage:
        "Boa! Vamos para mais quatro: I, L, M e N. Cuidado com M e N — eles parecem, mas têm dedos diferentes!",
      topics: ["alfabeto manual", "I", "L", "M", "N"],
    },
  },

  {
    id: "libras-lesson-4",
    unitId: "libras-unit-1",
    title: "Alfabeto — O, P, Q, R, S",
    description: "Cinco letras importantes para palavras comuns",
    icon: "🤟",
    xpReward: 15,
    mode: "sign",
    signTargets: [
      { letter: "O", word: "O", translation: "Letra O", emoji: "🔤" },
      { letter: "P", word: "P", translation: "Letra P", emoji: "🔤" },
      { letter: "Q", word: "Q", translation: "Letra Q", emoji: "🔤" },
      { letter: "R", word: "R", translation: "Letra R", emoji: "🔤" },
      { letter: "S", word: "S", translation: "Letra S", emoji: "🔤" },
    ],
    goals: [
      { description: "Reproduzir O, P, Q, R e S", xpReward: 10 },
      { description: "Acertar duas letras seguidas", xpReward: 5 },
    ],
    vocabulary: [
      {
        word: "O",
        translation: "Letra O",
        pronunciation: "dedos formam um O",
        emoji: "⭕",
      },
      {
        word: "P",
        translation: "Letra P",
        pronunciation: "indicador e médio para baixo",
        emoji: "👇",
      },
      {
        word: "Q",
        translation: "Letra Q",
        pronunciation: "polegar e indicador apontam para baixo",
        emoji: "👇",
      },
      {
        word: "R",
        translation: "Letra R",
        pronunciation: "indicador e médio cruzados",
        emoji: "🤞",
      },
      {
        word: "S",
        translation: "Letra S",
        pronunciation: "punho fechado, polegar à frente",
        emoji: "✊",
      },
    ],
    phrases: [
      {
        text: "O · P · Q · R · S",
        translation: "Sequência de letras",
        pronunciation: "sinais estáticos",
      },
    ],
    activities: [
      {
        id: "libras-lesson-4-act-1",
        type: "multiple-choice",
        question: "Qual letra é feita cruzando indicador e médio?",
        correctAnswer: "R",
        options: ["P", "R", "Q", "S"],
      },
    ],
    aiTeacherPrompt: {
      systemPrompt:
        "You are Bia, a warm Libras teacher. Stay strictly within O, P, Q, R, S. Name target, one-line tip, STOP. React to each detection in one sentence. Speak Brazilian Portuguese.",
      introMessage:
        "Estamos quase lá! Cinco letras agora: O, P, Q, R e S. Vou te guiar uma de cada vez.",
      topics: ["alfabeto manual", "O", "P", "Q", "R", "S"],
    },
  },

  {
    id: "libras-lesson-5",
    unitId: "libras-unit-1",
    title: "Alfabeto — T, U, V, W, Y",
    description: "Encerre o alfabeto estático em Libras",
    icon: "🎉",
    xpReward: 20,
    mode: "sign",
    signTargets: [
      { letter: "T", word: "T", translation: "Letra T", emoji: "🔤" },
      { letter: "U", word: "U", translation: "Letra U", emoji: "🔤" },
      { letter: "V", word: "V", translation: "Letra V", emoji: "✌️" },
      { letter: "W", word: "W", translation: "Letra W", emoji: "🔤" },
      { letter: "Y", word: "Y", translation: "Letra Y", emoji: "🤙" },
    ],
    goals: [
      { description: "Reproduzir T, U, V, W e Y", xpReward: 15 },
      { description: "Mostrar V e W na sequência", xpReward: 5 },
    ],
    vocabulary: [
      {
        word: "T",
        translation: "Letra T",
        pronunciation: "polegar entre indicador e médio",
        emoji: "✊",
      },
      {
        word: "U",
        translation: "Letra U",
        pronunciation: "indicador e médio juntos para cima",
        emoji: "☝️",
      },
      {
        word: "V",
        translation: "Letra V",
        pronunciation: "indicador e médio separados",
        emoji: "✌️",
      },
      {
        word: "W",
        translation: "Letra W",
        pronunciation: "indicador, médio e anelar separados",
        emoji: "🖐️",
      },
      {
        word: "Y",
        translation: "Letra Y",
        pronunciation: "polegar e mindinho estendidos",
        emoji: "🤙",
      },
    ],
    phrases: [
      {
        text: "T · U · V · W · Y",
        translation: "Encerramento do alfabeto",
        pronunciation: "sinais estáticos",
      },
    ],
    activities: [
      {
        id: "libras-lesson-5-act-1",
        type: "multiple-choice",
        question: "Qual letra usa três dedos separados?",
        correctAnswer: "W",
        options: ["U", "V", "W", "Y"],
      },
      {
        id: "libras-lesson-5-act-2",
        type: "multiple-choice",
        question: "As letras H, J, K, X e Z são…",
        correctAnswer: "dinâmicas (têm movimento)",
        options: [
          "dinâmicas (têm movimento)",
          "estáticas",
          "inexistentes",
          "apenas usadas em palavras",
        ],
      },
    ],
    aiTeacherPrompt: {
      systemPrompt:
        "You are Bia, a Libras teacher closing the static alphabet. Stay strictly within T, U, V, W, Y. Name target, one-line tip, STOP. Celebrate when the student finishes the whole unit. Speak Brazilian Portuguese.",
      introMessage:
        "Última lição da unidade! T, U, V, W e Y. Termine forte e depois você terá visto todo o alfabeto estático!",
      topics: ["alfabeto manual", "T", "U", "V", "W", "Y", "encerramento"],
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // UNIDADE 2 — SOLETRAR PALAVRAS
  // O aluno forma palavras sinalizando letra por letra. Usa só letras
  // estáticas (sem H/J/K/X/Z) pra funcionar 100% com o modelo KNN.
  // ─────────────────────────────────────────────────────────────────────
  ...wordLesson("libras-word-1", "OI", "Sua primeira palavra"),
  ...wordLesson("libras-word-2", "EU", "Apresente-se em Libras"),
  ...wordLesson("libras-word-3", "BOA", "Como em \"boa noite\""),
  ...wordLesson("libras-word-4", "PAI", "Família — pai"),
  ...wordLesson("libras-word-5", "MAE", "Família — mãe"),
  ...wordLesson("libras-word-6", "AMOR", "Sentimento básico"),
  ...wordLesson("libras-word-7", "CASA", "Lugar onde mora"),
  ...wordLesson("libras-word-8", "AMAR", "Verbo amar"),

  // ─────────────────────────────────────────────────────────────────────
  // UNIDADE 3 — LETRAS COM MOVIMENTO (J, Z) — modo motion
  // ─────────────────────────────────────────────────────────────────────
  motionLesson("libras-motion-1", "J", "Letra J — movimento", "Mindinho desenha um J no ar"),
  motionLesson("libras-motion-2", "Z", "Letra Z — movimento", "Indicador desenha um Z no ar"),
];

// ─────────────────────────────────────────────────────────────────────
// HELPERS — geram lições programaticamente
// ─────────────────────────────────────────────────────────────────────

function wordLesson(id: string, word: string, description: string): Lesson[] {
  const letters = word.split("");
  return [
    {
      id,
      unitId: "libras-unit-2",
      title: `Palavra — ${word}`,
      description,
      icon: "📝",
      xpReward: 20,
      mode: "sign",
      signTargets: letters.map((l) => ({
        letter: l,
        word: l,
        translation: `Letra ${l}`,
        emoji: "🔤",
      })),
      goals: [
        { description: `Soletrar a palavra ${word}`, xpReward: 15 },
        { description: "Manter cada gesto por ~1 segundo", xpReward: 5 },
      ],
      vocabulary: letters.map((l) => ({
        word: l,
        translation: `Letra ${l}`,
        pronunciation: "sinal estático com uma mão",
      })),
      phrases: [
        {
          text: word,
          translation: `Palavra: ${word}`,
          pronunciation: letters.join(" · "),
        },
      ],
      activities: [
        {
          id: `${id}-act-1`,
          type: "vocabulary",
          question: `Quantas letras tem a palavra "${word}"?`,
          correctAnswer: String(letters.length),
          options: ["2", "3", "4", "5"].slice(0, 4),
        },
      ],
      aiTeacherPrompt: {
        systemPrompt: `You are Bia, a Libras teacher. The student spells the word "${word}" letter by letter on camera. Each correct letter fires 'libras_sign_matched'. Praise in one sentence and announce the next letter. Speak Brazilian Portuguese.`,
        introMessage: `Vamos soletrar "${word}"! Mostre as letras na ordem para a câmera.`,
        topics: ["soletrar", word, ...letters],
      },
    },
  ];
}

function motionLesson(
  id: string,
  letter: string,
  title: string,
  pronunciation: string,
): Lesson {
  return {
    id,
    unitId: "libras-unit-3",
    title,
    description: `Letra dinâmica ${letter} — exige movimento`,
    icon: "💫",
    xpReward: 25,
    mode: "sign",
    signTargets: [
      {
        letter,
        word: letter,
        translation: `Letra ${letter} (com movimento)`,
        emoji: "💫",
      },
    ],
    goals: [
      { description: `Reproduzir a letra ${letter} com o movimento certo`, xpReward: 20 },
      { description: "Manter a câmera enxergando a mão durante todo o gesto", xpReward: 5 },
    ],
    vocabulary: [
      {
        word: letter,
        translation: `Letra ${letter}`,
        pronunciation,
      },
    ],
    phrases: [
      {
        text: letter,
        translation: `Letra dinâmica ${letter}`,
        pronunciation,
      },
    ],
    activities: [
      {
        id: `${id}-act-1`,
        type: "multiple-choice",
        question: `A letra ${letter} é estática ou tem movimento?`,
        correctAnswer: "tem movimento",
        options: ["estática", "tem movimento", "não existe", "depende"],
      },
    ],
    aiTeacherPrompt: {
      systemPrompt: `You are Bia, a Libras teacher demonstrating the dynamic letter ${letter}. ${pronunciation}. The student must trace the motion in front of the camera. Speak Brazilian Portuguese.`,
      introMessage: `Agora uma letra com movimento — ${letter}! ${pronunciation}.`,
      topics: ["letra dinâmica", letter, "movimento"],
    },
  };
}
