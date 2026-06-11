import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { LanguageCode } from "@/types/learning";

// DLibras is single-language: the picker is gone and Libras is always selected.
interface LanguageState {
  selectedLanguage: LanguageCode;
  setSelectedLanguage: (code: LanguageCode) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      selectedLanguage: "libras",
      setSelectedLanguage: (code) => set({ selectedLanguage: code }),
    }),
    {
      name: "language-storage",
      version: 2,
      migrate: () => ({ selectedLanguage: "libras" as LanguageCode }),
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
