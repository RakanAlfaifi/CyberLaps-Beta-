import { useEffect, useMemo } from "react";
import { useLanguageStore } from "./languageStore";
import {
  directionOf,
  formatNumber,
  translate,
  translateCount,
  type Language,
  type MessageKey,
  type MessageVars,
  type PluralKey,
} from "./translate";

export { useLanguageStore } from "./languageStore";
export { localizeBeat, localizeLevel, localizeObjective } from "./levels";
export { localizeTool } from "./tools";
export { getLesson, LESSON_SECTIONS, type Lesson, type LessonSection } from "./lessons";
export * from "./translate";

export function useLanguage(): Language {
  return useLanguageStore((s) => s.language);
}

export interface Translator {
  (key: MessageKey, vars?: MessageVars): string;
  count: (base: PluralKey, n: number) => string;
  num: (n: number) => string;
  language: Language;
  dir: "ltr" | "rtl";
}

export function useT(): Translator {
  const language = useLanguage();
  return useMemo(
    () =>
      Object.assign((key: MessageKey, vars?: MessageVars) => translate(language, key, vars), {
        count: (base: PluralKey, n: number) => translateCount(language, base, n),
        num: (n: number) => formatNumber(language, n),
        language,
        dir: directionOf(language),
      }),
    [language],
  );
}

/** Keeps `<html lang dir>` in step with the chosen language so the browser lays text out correctly. */
export function useDocumentLanguage(): void {
  const language = useLanguage();
  useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = directionOf(language);
  }, [language]);
}
