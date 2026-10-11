import { BookOpen, ChevronLeft, ChevronRight, Layers, Monitor, Pause, RotateCcw, ShieldCheck, Workflow, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { getLevelDefinition } from "@/core/levels";
import { useProgressStore } from "@/core/state/progressStore";
import { useStageStore } from "@/core/state/stageStore";
import { useUiStore } from "@/core/state/uiStore";
import { getToolInfo } from "@/core/tools/catalog";
import { getLesson, LESSON_SECTIONS, localizeLevel, useT, type LessonSection, type MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import type { LevelPhase } from "@/types/level";
import type { LevelDefinition } from "@/types/topology";
import { ApplyStep } from "./ApplyStep";
import { PhaserStage } from "./PhaserStage";
import { StageLegend } from "./StageLegend";
import { WalkthroughBar } from "./WalkthroughBar";

const PHASE_BADGE: Record<LevelPhase, { label: MessageKey; tone: BadgeTone }> = {
  watch: { label: "stage.badgeWatch", tone: "blue" },
  learn: { label: "stage.badgeLearn", tone: "blue" },
  apply: { label: "stage.badgeApply", tone: "emerald" },
};

/**
 * Center panel. Phaser draws the network into `#phaser-stage`; React overlays the
 * legend and the step bar (demo controls, guide, or objectives) on top of it.
 */
export function VisualStageViewport() {
  const t = useT();
  const phase = useProgressStore((s) => s.phase);
  const levelId = useProgressStore((s) => s.currentLevelId);
  const modalPaused = useUiStore((s) => s.simulationPaused);
  const demoPaused = useStageStore((s) => s.walkthrough.status === "paused");
  const level = getLevelDefinition(levelId);
  const badge = PHASE_BADGE[phase];

  return (
    <Panel aria-label={t("stage.title")}>
      <PanelHeader
        icon={<Monitor />}
        title={t("stage.title")}
        subtitle={level ? t("stage.subtitle", { n: level.id, title: localizeLevel(level, t.language).title }) : t("stage.fallback")}
        actions={
          <>
            {(modalPaused || demoPaused) && (
              <Badge tone="amber">
                <Pause className="h-3 w-3" />
                {t("stage.paused")}
              </Badge>
            )}
            <Badge tone={badge.tone}>{t(badge.label)}</Badge>
          </>
        }
      />

      <div className="relative min-h-0 flex-1 overflow-hidden bg-stage-ambient">
        <div aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_0_140px_rgba(2,6,23,0.75)]" />
        <PhaserStage className="absolute inset-0" />

        <StageLegend className="absolute start-3 top-3" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3">
          <StepCard key={phase}>
            {phase === "watch" && <WalkthroughBar />}
            {phase === "learn" && <LearnStep level={level} />}
            {phase === "apply" && <ApplyStep />}
          </StepCard>
        </div>
      </div>
    </Panel>
  );
}

function StepCard({ children }: { children: ReactNode }) {
  return (
    <section className="pointer-events-auto w-full max-w-2xl animate-fade-in-up rounded-lg border border-line bg-void/85 px-4 py-3 shadow-panel backdrop-blur">
      {children}
    </section>
  );
}

const LESSON_TABS: Record<LessonSection, { label: MessageKey; icon: LucideIcon }> = {
  packet: { label: "learn.tabPacket", icon: Layers },
  protocol: { label: "learn.tabProtocol", icon: Workflow },
  defense: { label: "learn.tabDefense", icon: ShieldCheck },
};

function LearnStep({ level }: { level: LevelDefinition | undefined }) {
  const t = useT();
  const advancePhase = useProgressStore((s) => s.advancePhase);
  const setPhase = useProgressStore((s) => s.setPhase);
  const openModal = useUiStore((s) => s.openModal);
  const tools = (level?.featuredCommands ?? []).flatMap((id) => getToolInfo(id) ?? []);
  const Forward = t.dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-ink">{t("learn.title")}</h3>
      <p dir="auto" className="text-sm leading-relaxed text-ink-muted">
        {t("learn.body")}
      </p>
      {level && <LessonTabs levelId={level.id} />}
      {tools.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="me-1 font-mono text-[10px] uppercase tracking-wider text-ink-faint">{t("learn.tools")}</span>
          {tools.map((tool) => (
            <Button
              key={tool.id}
              size="sm"
              variant="secondary"
              sfx={false}
              onClick={() => openModal({ kind: "toolIntro", toolId: tool.id })}
            >
              <BookOpen />
              {tool.name}
              {tool.id === level?.newTool && <span className="text-[10px] uppercase text-emerald-glow">{t("common.new")}</span>}
            </Button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setPhase("watch")}>
          <RotateCcw />
          {t("learn.replay")}
        </Button>
        <Button onClick={advancePhase}>
          {t("learn.continue")}
          <Forward />
        </Button>
      </div>
    </div>
  );
}

/** The deeper reading for a level: packet structure, protocol behavior, and how defenders analyze it. */
function LessonTabs({ levelId }: { levelId: number }) {
  const t = useT();
  const [section, setSection] = useState<LessonSection>("packet");
  const lesson = getLesson(levelId, t.language);
  if (!lesson) return null;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-surface/60">
      <div role="tablist" aria-label={t("learn.lessonAria")} className="flex flex-wrap gap-1 border-b border-line p-1">
        {LESSON_SECTIONS.map((id) => {
          const tab = LESSON_TABS[id];
          const selected = id === section;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`lesson-tab-${id}`}
              aria-selected={selected}
              aria-controls={`lesson-panel-${id}`}
              onClick={() => setSection(id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                selected ? "bg-cyber-blue/15 text-cyber-glow" : "text-ink-muted hover:bg-surface-overlay hover:text-ink",
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {t(tab.label)}
            </button>
          );
        })}
      </div>
      <ul
        role="tabpanel"
        id={`lesson-panel-${section}`}
        aria-labelledby={`lesson-tab-${section}`}
        className="flex max-h-[24vh] flex-col gap-2 overflow-y-auto px-3 pb-2"
      >
        {lesson[section].map((point) => (
          <li key={point} dir="auto" className="flex gap-2 text-sm leading-relaxed text-ink">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyber-glow" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
