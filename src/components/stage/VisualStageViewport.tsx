import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Layers,
  ListChecks,
  Monitor,
  Pause,
  RotateCcw,
  ShieldCheck,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { playUiSound } from "@/components/ui/uiSound";
import { getLevelDefinition } from "@/core/levels";
import { useProgressStore } from "@/core/state/progressStore";
import { useStageStore } from "@/core/state/stageStore";
import { useUiStore } from "@/core/state/uiStore";
import { getToolInfo } from "@/core/tools/catalog";
import { sameInsets, type StageInsets } from "@/game/stageInsets";
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
 * Center panel. Phaser draws the network edge to edge into `#phaser-stage`; React overlays the
 * legend and the step card (demo controls, guide, or objectives) on top of it, and tells the
 * stage how much room they take so the camera frames the map in the space that is left.
 */
export function VisualStageViewport() {
  const t = useT();
  const phase = useProgressStore((s) => s.phase);
  const levelId = useProgressStore((s) => s.currentLevelId);
  const modalPaused = useUiStore((s) => s.simulationPaused);
  const demoPaused = useStageStore((s) => s.walkthrough.status === "paused");
  const level = getLevelDefinition(levelId);
  const badge = PHASE_BADGE[phase];
  const stageRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  // Collapsing lasts until the step changes, so a new phase or level always shows its instructions.
  const stepKey = `${levelId}:${phase}`;
  const [collapsedStep, setCollapsedStep] = useState<string | null>(null);
  const collapsed = collapsedStep === stepKey;
  const insets = useOverlayInsets(stageRef, legendRef, cardRef, collapsed, phase);

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

      <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden bg-stage-ambient">
        <PhaserStage className="absolute inset-0" insets={insets} />
        <div aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_0_48px_rgba(2,6,23,0.45)]" />

        <div ref={legendRef} className="absolute start-3 top-3">
          <StageLegend />
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3">
          <StepCard
            key={phase}
            cardRef={cardRef}
            phaseLabel={t(badge.label)}
            collapsed={collapsed}
            onToggle={() => setCollapsedStep(collapsed ? null : stepKey)}
          >
            {phase === "watch" && <WalkthroughBar />}
            {phase === "learn" && <LearnStep level={level} />}
            {phase === "apply" && <ApplyStep />}
          </StepCard>
        </div>
      </div>
    </Panel>
  );
}

/** Spacing between the stage's edge and an overlay that hugs it (`top-3`, `p-3`). */
const OVERLAY_GAP = 12;
/** How far the open card's fold handle sticks up above its top edge (`-top-3`). */
const HANDLE_OVERHANG = 12;

/**
 * Live CSS-pixel insets for the stage camera: the legend's band along the top and the step card's
 * band along the bottom. Updates whenever either overlay or the stage itself changes size.
 * `phase` remounts the card, so the observer has to pick up the new element.
 */
function useOverlayInsets(
  stageRef: RefObject<HTMLElement>,
  legendRef: RefObject<HTMLElement>,
  cardRef: RefObject<HTMLElement>,
  collapsed: boolean,
  phase: LevelPhase,
): StageInsets | undefined {
  const [insets, setInsets] = useState<StageInsets>();

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const box = stage.getBoundingClientRect();
      const legend = legendRef.current?.getBoundingClientRect();
      const card = cardRef.current?.getBoundingClientRect();
      const cardTop = card ? card.top - (collapsed ? 0 : HANDLE_OVERHANG) : box.bottom - OVERLAY_GAP;
      const next: StageInsets = {
        top: legend ? Math.round(legend.bottom - box.top) : OVERLAY_GAP,
        right: OVERLAY_GAP,
        bottom: Math.round(box.bottom - cardTop),
        left: OVERLAY_GAP,
      };
      setInsets((prev) => (prev && sameInsets(prev, next) ? prev : next));
    };
    const observer = new ResizeObserver(measure);
    for (const el of [stage, legendRef.current, cardRef.current]) if (el) observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [stageRef, legendRef, cardRef, collapsed, phase]);

  return insets;
}

interface StepCardProps {
  cardRef: RefObject<HTMLElement>;
  phaseLabel: string;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/**
 * Frosted card for the current step. A handle on its top edge folds it down to a small pill,
 * handing the space back to the stage; the pill unfolds it again.
 */
function StepCard({ cardRef, phaseLabel, collapsed, onToggle, children }: StepCardProps) {
  const t = useT();
  const bodyId = useId();
  const toggle = () => {
    playUiSound("click");
    onToggle();
  };

  return (
    <section
      ref={cardRef}
      aria-label={t("stage.tasksTitle")}
      className={cn(
        "pointer-events-auto relative animate-fade-in-up rounded-lg border border-line bg-void/85 shadow-panel backdrop-blur",
        collapsed ? "rounded-full" : "w-full max-w-2xl px-4 py-3",
      )}
    >
      {collapsed ? (
        <button
          type="button"
          aria-expanded={false}
          aria-controls={bodyId}
          title={t("stage.showTasks")}
          onClick={toggle}
          className="flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-glow"
        >
          <ListChecks aria-hidden className="h-4 w-4 text-cyber-glow" />
          <span>{t("stage.tasksTitle")}</span>
          <span aria-hidden className="text-ink-faint">
            ·
          </span>
          <span className="font-medium text-ink-muted">{phaseLabel}</span>
          <ChevronUp aria-hidden className="h-4 w-4 text-ink-muted" />
          <span className="sr-only">{t("stage.showTasks")}</span>
        </button>
      ) : (
        <button
          type="button"
          aria-expanded
          aria-controls={bodyId}
          aria-label={t("stage.hideTasks")}
          title={t("stage.hideTasks")}
          onClick={toggle}
          className="absolute -top-3 left-1/2 flex h-6 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-void/95 text-ink-muted shadow-panel transition-colors hover:border-cyber-glow/60 hover:text-cyber-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-glow"
        >
          <ChevronDown aria-hidden className="h-4 w-4" />
        </button>
      )}
      <div id={bodyId} hidden={collapsed}>
        {children}
      </div>
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
