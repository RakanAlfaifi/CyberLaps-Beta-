import { Languages } from "lucide-react";
import { LANGUAGES, useLanguageStore, useT } from "@/i18n";
import { cn } from "@/lib/cn";
import { playUiSound } from "./uiSound";

/** EN / ع segmented switch. Changing it flips the whole page between LTR and RTL. */
export function LanguageToggle({ className }: { className?: string }) {
  const t = useT();
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  return (
    <div
      role="radiogroup"
      aria-label={t("lang.label")}
      title={t("lang.switch")}
      className={cn("flex items-center gap-0.5 rounded-md border border-line bg-surface-raised/70 p-0.5", className)}
    >
      <Languages aria-hidden className="mx-1 h-3.5 w-3.5 text-ink-faint" />
      {LANGUAGES.map((lang) => {
        const active = lang === language;
        return (
          <button
            key={lang}
            type="button"
            role="radio"
            aria-checked={active}
            lang={lang}
            onClick={() => {
              if (active) return;
              playUiSound("click");
              setLanguage(lang);
            }}
            className={cn(
              "rounded px-2 py-0.5 text-xs font-semibold transition-colors",
              active ? "bg-cyber-blue/20 text-cyber-glow shadow-glow-blue" : "text-ink-faint hover:text-ink",
            )}
          >
            {lang === "en" ? "EN" : "ع"}
            <span className="sr-only"> {t(lang === "en" ? "lang.en" : "lang.ar")}</span>
          </button>
        );
      })}
    </div>
  );
}
