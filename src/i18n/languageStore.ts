import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getBrowserStorage, storageKey } from "@/core/persistence/storage";
import type { Language } from "./translate";

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: "en",
      setLanguage: (language) => set({ language }),
      toggleLanguage: () => set((s) => ({ language: s.language === "en" ? "ar" : "en" })),
    }),
    {
      name: storageKey("language"),
      version: 1,
      storage: createJSONStorage(getBrowserStorage),
      partialize: (s) => ({ language: s.language }),
    },
  ),
);
