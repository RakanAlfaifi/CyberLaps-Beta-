import { Check, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { getLevelDefinition } from "@/core/levels";
import { useProgressStore } from "@/core/state/progressStore";
import { useStageStore } from "@/core/state/stageStore";
import { localizeBeat, useT } from "@/i18n";
import { cn } from "@/lib/cn";

/** Watch step: the demo caption, step dots and playback controls. The learner moves on with "Next step". */
export function WalkthroughBar() {
  const t = useT();
  const ready = useStageStore((s) => s.ready);
  const { status, beatIndex, beatCount } = useStageStore((s) => s.walkthrough);
  const play = useStageStore((s) => s.playWalkthrough);
  const next = useStageStore((s) => s.nextWalkthroughStep);
  const togglePause = useStageStore((s) => s.togglePauseWalkthrough);
  const skip = useStageStore((s) => s.skipWalkthrough);
  const advancePhase = useProgressStore((s) => s.advancePhase);
  const level = getLevelDefinition(useProgressStore((s) => s.currentLevelId));
  const Forward = t.dir === "rtl" ? ChevronLeft : ChevronRight;

  const active = status === "playing" || status === "paused";
  const finished = status === "finished";
  const onLastBeat = beatIndex >= 0 && beatIndex === beatCount - 1;
  const caption = level && beatIndex >= 0 ? localizeBeat(level, beatIndex, t.language) : null;

  const text = !ready ? t("walk.loading") : (caption ?? (active ? t("walk.watching") : t("walk.pressPlay")));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <StepDots count={beatCount} current={beatIndex} />
        <span className="font-mono text-[11px] text-ink-faint">
          {beatIndex >= 0 ? t("walk.step", { i: t.num(beatIndex + 1), n: t.num(beatCount) }) : t("walk.steps", { n: t.num(beatCount) })}
        </span>
        <div className="flex-1" />
        {active && (
          <IconButton label={status === "paused" ? t("walk.resume") : t("walk.pause")} onClick={togglePause}>
            {status === "paused" ? <Play className="h-4 w-4 rtl:-scale-x-100" /> : <Pause className="h-4 w-4" />}
          </IconButton>
        )}
        <IconButton label={status === "idle" ? t("walk.play") : t("walk.again")} onClick={play} disabled={!ready}>
          {status === "idle" ? <Play className="h-4 w-4 rtl:-scale-x-100" /> : <RotateCcw className="h-4 w-4" />}
        </IconButton>
        {active && (
          <IconButton label={t("walk.skip")} onClick={skip}>
            <SkipForward className="h-4 w-4 rtl:-scale-x-100" />
          </IconButton>
        )}
      </div>

      <p key={`${beatIndex}-${text}`} aria-live="polite" dir="auto" className="min-h-[2.5rem] animate-fade-in-up text-sm leading-relaxed text-ink">
        {text}
      </p>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {active && <p className="me-auto text-xs text-ink-faint">{t("walk.selfPaced")}</p>}
        {active && (
          <Button onClick={next}>
            {onLastBeat ? <Check /> : null}
            {onLastBeat ? t("walk.finish") : t("walk.next")}
            {!onLastBeat && <Forward />}
          </Button>
        )}
        <Button variant={finished ? "primary" : "ghost"} size={finished ? "md" : "sm"} onClick={advancePhase}>
          {t("walk.continue")}
          <Forward />
        </Button>
      </div>
    </div>
  );
}

function StepDots({ count, current }: { count: number; current: number }) {
  return (
    <ol aria-hidden className="flex items-center gap-1">
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all",
            i === current ? "w-5 bg-cyber-glow shadow-glow-blue" : "w-1.5",
            i < current && "bg-emerald-neon",
            i > current && "bg-line-strong",
          )}
        />
      ))}
    </ol>
  );
}
