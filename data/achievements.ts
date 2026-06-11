import { Ionicons } from "@expo/vector-icons";

import { LESSONS } from "@/data/lessons";

// Conquistas computadas inteiramente em local — não precisam de backend.
// Cada uma tem uma função `check` que recebe o estado do learningStore e
// retorna se desbloqueou. As funções são puras pra serem chamadas em qualquer
// momento (ex.: na home pra mostrar quais badges o usuário tem).

export interface AchievementCheck {
  completedLessonIds: string[];
  xpHistory: Record<string, number>;
  streak: number;
  librasDemoVisited: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  // Cor do círculo do badge — verde/laranja/roxo/azul.
  color: string;
  check: (s: AchievementCheck) => boolean;
}

const TOTAL_ALPHABET = LESSONS.filter((l) => l.unitId === "libras-unit-1").length;
const TOTAL_WORDS = LESSONS.filter((l) => l.unitId === "libras-unit-2").length;
const TOTAL_MOTION = LESSONS.filter((l) => l.unitId === "libras-unit-3").length;

function totalXp(history: Record<string, number>): number {
  return Object.values(history).reduce((acc, v) => acc + v, 0);
}

function countCompleted(ids: string[], prefix: string): number {
  return ids.filter((id) => id.startsWith(prefix)).length;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_lesson",
    title: "Primeira lição",
    description: "Você concluiu sua primeira lição em Libras",
    icon: "trophy",
    color: "#ffcb00",
    check: (s) => s.completedLessonIds.length >= 1,
  },
  {
    id: "alphabet_master",
    title: "Mestre do alfabeto",
    description: `Conclua as ${TOTAL_ALPHABET} lições do alfabeto manual`,
    icon: "school",
    color: "#21c16b",
    check: (s) =>
      countCompleted(s.completedLessonIds, "libras-lesson-") >= TOTAL_ALPHABET,
  },
  {
    id: "word_starter",
    title: "Primeira palavra",
    description: "Soletre sua primeira palavra completa em Libras",
    icon: "create",
    color: "#4d88ff",
    check: (s) =>
      countCompleted(s.completedLessonIds, "libras-word-") >= 1,
  },
  {
    id: "word_master",
    title: "Soletrador",
    description: `Soletre todas as ${TOTAL_WORDS} palavras propostas`,
    icon: "library",
    color: "#6c4ef5",
    check: (s) =>
      countCompleted(s.completedLessonIds, "libras-word-") >= TOTAL_WORDS,
  },
  {
    id: "motion_starter",
    title: "Em movimento",
    description: "Acerte sua primeira letra dinâmica (J ou Z)",
    icon: "flash",
    color: "#ff8a00",
    check: (s) =>
      countCompleted(s.completedLessonIds, "libras-motion-") >= 1,
  },
  {
    id: "motion_master",
    title: "Sinaleiro completo",
    description: `Acerte todas as ${TOTAL_MOTION} letras dinâmicas`,
    icon: "rocket",
    color: "#ef4444",
    check: (s) =>
      countCompleted(s.completedLessonIds, "libras-motion-") >= TOTAL_MOTION,
  },
  {
    id: "demo_visitor",
    title: "Explorador",
    description: "Use o leitor livre da câmera ao menos uma vez",
    icon: "videocam",
    color: "#6c4ef5",
    check: (s) => s.librasDemoVisited,
  },
  {
    id: "streak_3",
    title: "Em chamas",
    description: "Treine 3 dias seguidos",
    icon: "flame",
    color: "#ff8a00",
    check: (s) => s.streak >= 3,
  },
  {
    id: "streak_7",
    title: "Semana cheia",
    description: "Treine 7 dias seguidos",
    icon: "flame",
    color: "#ef4444",
    check: (s) => s.streak >= 7,
  },
  {
    id: "streak_30",
    title: "Compromisso",
    description: "Treine 30 dias seguidos — você é fera",
    icon: "ribbon",
    color: "#ffcb00",
    check: (s) => s.streak >= 30,
  },
  {
    id: "xp_100",
    title: "Coletor de XP",
    description: "Acumule 100 XP no histórico",
    icon: "star",
    color: "#21c16b",
    check: (s) => totalXp(s.xpHistory) >= 100,
  },
  {
    id: "xp_500",
    title: "Veterano",
    description: "Acumule 500 XP no histórico",
    icon: "medal",
    color: "#6c4ef5",
    check: (s) => totalXp(s.xpHistory) >= 500,
  },
];

export function computeUnlocked(s: AchievementCheck): string[] {
  return ACHIEVEMENTS.filter((a) => a.check(s)).map((a) => a.id);
}
