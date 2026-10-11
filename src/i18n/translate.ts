import { ar } from "./messages/ar";
import { en, type MessageKey } from "./messages/en";

export type Language = "en" | "ar";
export type { MessageKey };

export const LANGUAGES: readonly Language[] = ["en", "ar"];

const DICTIONARIES: Record<Language, Record<MessageKey, string>> = { en, ar };

export const directionOf = (language: Language): "ltr" | "rtl" => (language === "ar" ? "rtl" : "ltr");

export type MessageVars = Record<string, string | number>;

/** Fills `{name}` slots. Unknown slots are left as typed so a typo is visible on screen. */
export function format(template: string, vars?: MessageVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (slot, name: string) => (name in vars ? String(vars[name]) : slot));
}

export function translate(language: Language, key: MessageKey, vars?: MessageVars): string {
  return format(DICTIONARIES[language][key] ?? en[key], vars);
}

type PluralBase<K> = K extends `${infer B}.one` ? B : never;
export type PluralKey = PluralBase<MessageKey>;

/** Picks `<base>.one` or `<base>.other` and passes `n` in. */
export function translateCount(language: Language, base: PluralKey, n: number): string {
  const key = `${base}.${n === 1 ? "one" : "other"}` as MessageKey;
  return translate(language, key, { n });
}

export function formatNumber(language: Language, n: number): string {
  return new Intl.NumberFormat(language === "ar" ? "ar" : "en").format(n);
}
