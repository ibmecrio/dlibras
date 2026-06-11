import { Unit } from "@/types/learning";

export const UNITS: Unit[] = [
  {
    id: "libras-unit-1",
    languageCode: "libras",
    title: "Alfabeto manual — Libras",
    description: "Aprenda o alfabeto estático em Libras com a câmera",
    order: 1,
    lessonIds: [
      "libras-lesson-1",
      "libras-lesson-2",
      "libras-lesson-3",
      "libras-lesson-4",
      "libras-lesson-5",
    ],
  },
  {
    id: "libras-unit-2",
    languageCode: "libras",
    title: "Soletrar palavras",
    description: "Forme palavras curtas com as letras que você já sabe",
    order: 2,
    lessonIds: [
      "libras-word-1",
      "libras-word-2",
      "libras-word-3",
      "libras-word-4",
      "libras-word-5",
      "libras-word-6",
      "libras-word-7",
      "libras-word-8",
    ],
  },
  {
    id: "libras-unit-3",
    languageCode: "libras",
    title: "Letras com movimento",
    description: "Letras dinâmicas que exigem traçado no ar (J, Z)",
    order: 3,
    lessonIds: ["libras-motion-1", "libras-motion-2"],
  },
];
