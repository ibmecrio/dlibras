import { Language } from "@/types/learning";

export const LANGUAGES: Language[] = [
  {
    code: "libras",
    name: "Libras",
    nativeName: "Língua Brasileira de Sinais",
    flag: "https://flagcdn.com/w320/br.png",
    color: "#21c16b",
    learners: "2.5M",
  },
];

export const DEFAULT_LANGUAGE: Language = LANGUAGES[0];
