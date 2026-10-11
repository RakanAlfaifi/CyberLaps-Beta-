import { ChevronDown, CircleCheck, Hourglass, Map as MapIcon, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { playSfx } from "@/core/audio";
import { listComingSoonLevels, listLevelDefinitions } from "@/core/levels";
import { PLAYABLE_LEVEL_COUNT, useProgressStore } from "@/core/state/progressStore";
import { localizeLevel, useT } from "@/i18n";
import { cn } from "@/lib/cn";

const pad = (n: number) => String(n).padStart(2, "0");

/** Top-bar level picker: every level with its done / current state, then the Coming Soon ones. */
export function LevelMapMenu() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const currentLevelId = useProgressStore((s) => s.currentLevelId);
  const completed = useProgressStore((s) => s.completedLevelIds);
  const doneCount = completed.filter((id) => id <= PLAYABLE_LEVEL_COUNT).length;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (id: number) => {
    setOpen(false);
    if (id !== currentLevelId) navigate(`/lab/${id}`);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          playSfx("click");
          setOpen((v) => !v);
        }}
        className={cn(
          "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
          open ? "border-cyber-blue/50 bg-cyber-blue/10" : "border-line hover:border-line-strong hover:bg-surface-overlay",
        )}
      >
        <MapIcon className="h-3.5 w-3.5 text-cyber-glow" />
        <span className="text-ink-faint">{t("levelMap.level")}</span>
        <span className="font-mono font-semibold text-cyber-glow">{pad(currentLevelId)}</span>
        <span className="text-ink-faint">{t("levelMap.of", { total: PLAYABLE_LEVEL_COUNT })}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-ink-faint transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t("levelMap.aria")}
          className="absolute start-0 top-full z-40 mt-2 flex max-h-[70vh] w-80 animate-fade-in-up flex-col overflow-hidden rounded-lg border border-line-strong bg-surface shadow-panel"
        >
          <header className="flex flex-col gap-2 border-b border-line px-3 py-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink">{t("levelMap.title")}</h2>
              <span className="font-mono text-[11px] text-ink-faint">
                {t("levelMap.done", { done: doneCount, total: PLAYABLE_LEVEL_COUNT })}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-emerald-neon transition-[width] duration-500"
                style={{ width: `${(doneCount / PLAYABLE_LEVEL_COUNT) * 100}%` }}
              />
            </div>
          </header>

          <ol className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {listLevelDefinitions().map((level) => {
              const isDone = completed.includes(level.id);
              const isCurrent = level.id === currentLevelId;
              const Icon = isDone ? CircleCheck : Play;
              const copy = localizeLevel(level, t.language);
              return (
                <li key={level.id}>
                  <button
                    type="button"
                    role="menuitem"
                    aria-current={isCurrent ? "page" : undefined}
                    title={isCurrent ? t("levelMap.current") : copy.summary}
                    onClick={() => {
                      playSfx("click");
                      go(level.id);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-start transition-colors hover:bg-surface-overlay",
                      isCurrent && "bg-cyber-blue/10 ring-1 ring-cyber-blue/40",
                    )}
                  >
                    <span className="w-5 font-mono text-[11px] text-ink-faint">{pad(level.id)}</span>
                    <Icon className={cn("h-4 w-4 shrink-0", isDone ? "text-emerald-neon" : "text-cyber-glow")} />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{copy.title}</span>
                    {level.newTool && <Badge tone="blue">{level.newTool}</Badge>}
                  </button>
                </li>
              );
            })}

            <li aria-hidden className="mx-2 my-1.5 border-t border-dashed border-line-strong" />

            {listComingSoonLevels().map((level) => {
              const copy = localizeLevel(level, t.language);
              return (
                <li
                  key={level.id}
                  role="menuitem"
                  aria-disabled="true"
                  title={copy.summary}
                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5 opacity-70"
                >
                  <span className="w-5 font-mono text-[11px] text-ink-faint">{pad(level.id)}</span>
                  <Hourglass className="h-4 w-4 shrink-0 text-ink-faint" />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-faint">{copy.title}</span>
                  <Badge tone="neutral">{t("common.comingSoon")}</Badge>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
