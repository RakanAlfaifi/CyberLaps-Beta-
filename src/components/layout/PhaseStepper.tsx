import { BookOpen, Check, ChevronLeft, ChevronRight, Eye, Wrench, type LucideIcon } from "lucide-react";
import { LEVEL_PHASES, useProgressStore } from "@/core/state/progressStore";
import { useT, type MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import type { LevelPhase } from "@/types/level";

const STEPS: { phase: LevelPhase; label: MessageKey; hint: MessageKey; icon: LucideIcon }[] = [
  { phase: "watch", label: "phase.watch", hint: "phase.watchHint", icon: Eye },
  { phase: "learn", label: "phase.learn", hint: "phase.learnHint", icon: BookOpen },
  { phase: "apply", label: "phase.apply", hint: "phase.applyHint", icon: Wrench },
];

export function PhaseStepper() {
  const t = useT();
  const phase = useProgressStore((s) => s.phase);
  const current = LEVEL_PHASES.indexOf(phase);
  const Arrow = t.dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <ol aria-label={t("phase.aria")} className="hidden items-center gap-1 xl:flex">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const Icon = done ? Check : step.icon;
        return (
          <li key={step.phase} className="flex items-center gap-1">
            {i > 0 && <Arrow aria-hidden className="h-3.5 w-3.5 text-ink-faint" />}
            <span
              title={t(step.hint)}
              aria-current={active ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                active && "border-cyber-blue/50 bg-cyber-blue/10 text-cyber-glow shadow-glow-blue",
                done && "border-emerald-neon/30 text-emerald-glow",
                !active && !done && "border-transparent text-ink-faint",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {i + 1}. {t(step.label)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
