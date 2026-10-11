import { Bot, ChevronRight, Lightbulb, Pause, TerminalSquare, X } from "lucide-react";
import { useCallback, useEffect, type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { getLevelDefinition } from "@/core/levels";
import { useProgressStore } from "@/core/state/progressStore";
import { useUiStore } from "@/core/state/uiStore";
import { getToolInfo, type ToolInfo } from "@/core/tools/catalog";
import { localizeTool, useT } from "@/i18n";

/**
 * The Lab Agent hands the mic to a tool, which introduces itself in plain words.
 * Opens by itself the first time a level brings a new tool; Learn step can reopen it.
 */
export function LabAgentModal() {
  const t = useT();
  const modal = useUiStore((s) => s.activeModal);
  const openModal = useUiStore((s) => s.openModal);
  const closeModal = useUiStore((s) => s.closeModal);
  const levelId = useProgressStore((s) => s.currentLevelId);
  const introducedTools = useProgressStore((s) => s.introducedTools);
  const markToolIntroduced = useProgressStore((s) => s.markToolIntroduced);

  const newTool = getLevelDefinition(levelId)?.newTool;
  const needsIntro = newTool !== undefined && !introducedTools.includes(newTool) && getToolInfo(newTool) !== undefined;

  useEffect(() => {
    if (needsIntro && modal === null) openModal({ kind: "toolIntro", toolId: newTool! });
  }, [needsIntro, newTool, modal, openModal]);

  const toolId = modal?.kind === "toolIntro" ? modal.toolId : null;
  const info = toolId ? getToolInfo(toolId) : undefined;
  const tool = info ? localizeTool(info, t.language) : undefined;
  const isNew = toolId !== null && toolId === newTool;

  const dismiss = useCallback(() => {
    if (toolId) markToolIntroduced(toolId);
    closeModal();
  }, [toolId, markToolIntroduced, closeModal]);

  useEffect(() => {
    if (!toolId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toolId, dismiss]);

  if (!tool) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && dismiss()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="lab-agent-title"
        aria-describedby="lab-agent-greeting"
        className="flex max-h-[88vh] w-full max-w-xl animate-fade-in-up flex-col overflow-hidden rounded-lg border border-line-strong bg-surface shadow-panel"
      >
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyber-blue/50 bg-cyber-blue/10 shadow-glow-blue">
            <Bot className="h-5 w-5 text-cyber-glow" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse-glow rounded-full bg-emerald-neon" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="lab-agent-title" className="text-sm font-semibold uppercase tracking-[0.18em] text-ink">
                {t("agent.title")}
              </h2>
              {isNew ? <Badge tone="emerald">{t("agent.newTool")}</Badge> : <Badge tone="blue">{t("agent.toolGuide")}</Badge>}
            </div>
            <p className="text-sm text-ink-muted">{isNew ? t("agent.newIntro") : t("agent.refresher")}</p>
          </div>
          <IconButton label={t("agent.close")} sfx={false} onClick={dismiss}>
            <X className="h-4 w-4" />
          </IconButton>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          <ToolGreeting tool={tool} />

          <Section title={t("agent.howItWorks")}>
            <ol className="flex flex-col gap-1.5">
              {tool.howItWorks.map((step, i) => (
                <li key={step} className="flex gap-2.5 text-sm leading-relaxed text-ink">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-[10px] text-cyber-glow">
                    {i + 1}
                  </span>
                  <span dir="auto">{step}</span>
                </li>
              ))}
            </ol>
          </Section>

          <Section title={t("agent.howToCall")}>
            <code dir="ltr" className="block rounded-md border border-line bg-void/80 px-3 py-2 text-start font-mono text-sm text-emerald-glow">
              {tool.syntax}
            </code>
            <dl className="mt-2 flex flex-col gap-1">
              {tool.parts.map((part) => (
                <div key={part.token} className="grid grid-cols-[minmax(0,9rem)_1fr] items-baseline gap-3 text-sm">
                  <dt dir="ltr" className="truncate font-mono text-cyber-glow rtl:text-right" title={part.token}>
                    {part.token}
                  </dt>
                  <dd dir="auto" className="text-ink-muted">
                    {part.meaning}
                  </dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section title={t("agent.tryThis")}>
            <code dir="ltr" className="block rounded-md border border-emerald-neon/30 bg-void/80 px-3 py-2 text-start font-mono text-sm text-ink">
              <span className="select-none text-emerald-neon">$ </span>
              {tool.example}
            </code>
          </Section>

          {tool.tip && (
            <p className="flex items-start gap-2 rounded-md border border-amber-neon/30 bg-amber-neon/5 px-3 py-2 text-sm text-ink-muted">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-glow" />
              <span dir="auto">{tool.tip}</span>
            </p>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5">
          <p className="flex items-center gap-1.5 text-xs text-ink-faint">
            <Pause className="h-3.5 w-3.5" />
            {t("agent.paused")}
          </p>
          <Button sfx={false} onClick={dismiss} autoFocus>
            {t("agent.gotIt")}
            <ChevronRight className="rtl:-scale-x-100" />
          </Button>
        </footer>
      </section>
    </div>
  );
}

function ToolGreeting({ tool }: { tool: ToolInfo }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex shrink-0 flex-col items-center gap-1">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-neon/40 bg-emerald-neon/10 shadow-glow-emerald">
          <TerminalSquare className="h-6 w-6 text-emerald-glow" />
        </span>
        <span className="font-mono text-[10px] text-emerald-glow">{tool.name}</span>
      </span>
      <div className="relative min-w-0 flex-1 rounded-lg rounded-ss-none border border-line-strong bg-surface-raised px-3 py-2.5">
        <p id="lab-agent-greeting" dir="auto" className="text-[15px] leading-relaxed text-ink">
          {tool.greeting}
        </p>
        <p dir="auto" className="mt-1 text-xs text-ink-faint">
          {tool.purpose}
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{title}</h3>
      {children}
    </section>
  );
}
