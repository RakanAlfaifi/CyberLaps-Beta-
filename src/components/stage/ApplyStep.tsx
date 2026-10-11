import { Check, ChevronLeft, ChevronRight, Circle, CircleCheck, LayoutDashboard, Sparkles, Trophy } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { evaluateObjectives, getLevelDefinition, type ObjectiveStatus, type Requirement } from "@/core/levels";
import { PLAYABLE_LEVEL_COUNT, useProgressStore } from "@/core/state/progressStore";
import { localizeLevel, localizeObjective, useT, type Translator } from "@/i18n";
import { cn } from "@/lib/cn";
import type { LevelDefinition } from "@/types/topology";

function requirementLabel(t: Translator, level: LevelDefinition, req: Requirement): string {
  const name = (id: string) => level.topology.devices.find((d) => d.id === id)?.name ?? id;
  switch (req.kind) {
    case "run":
      return t("req.run", { command: req.command });
    case "find":
      return t("req.find", { name: name(req.deviceId) });
    case "port":
      return t("req.port", { port: req.port, name: name(req.deviceId) });
    case "reply":
      return t("req.reply", { name: name(req.deviceId), command: req.command });
  }
}

/** Do step: the level's objectives, ticked off live as commands prove each part. */
export function ApplyStep() {
  const t = useT();
  const levelId = useProgressStore((s) => s.currentLevelId);
  const evidence = useProgressStore((s) => s.evidence[s.currentLevelId]);
  const flaggedComplete = useProgressStore((s) => s.completedLevelIds.includes(s.currentLevelId));
  const level = getLevelDefinition(levelId);
  const statuses = useMemo(() => (level ? evaluateObjectives(level, evidence) : []), [level, evidence]);
  const doneCount = statuses.filter((s) => s.done).length;
  const complete = flaggedComplete && statuses.length > 0 && doneCount === statuses.length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 className="flex-1 text-sm font-semibold text-ink">{complete ? t("apply.complete") : t("apply.title")}</h3>
        <Badge tone={complete ? "emerald" : "blue"}>
          {t("apply.count", { done: t.num(doneCount), total: t.num(statuses.length) })}
        </Badge>
      </div>

      <ul className="flex flex-col gap-2">
        {level && statuses.map((status) => <ObjectiveRow key={status.id} level={level} status={status} />)}
      </ul>

      {complete ? (
        <CompletionBanner levelId={levelId} />
      ) : (
        <p className="text-xs text-ink-faint">{t("apply.hint")}</p>
      )}
    </div>
  );
}

function ObjectiveRow({ level, status }: { level: LevelDefinition; status: ObjectiveStatus }) {
  const t = useT();
  const Icon = status.done ? CircleCheck : Circle;
  return (
    <li className="flex flex-col gap-1">
      <p className={cn("flex items-start gap-2 text-sm leading-relaxed", status.done ? "text-emerald-glow" : "text-ink")}>
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", status.done ? "text-emerald-neon" : "text-ink-faint")} />
        <span dir="auto">{localizeObjective(level, status.id, t.language)}</span>
      </p>
      {status.requirements.length > 1 && (
        <ul aria-label={t("apply.partsAria")} className="ms-6 flex flex-wrap gap-1.5">
          {status.requirements.map((req) => (
            <li
              key={req.key}
              dir="auto"
              className={cn(
                "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] transition-colors",
                req.done ? "border-emerald-neon/40 bg-emerald-neon/10 text-emerald-glow" : "border-line-strong text-ink-muted",
              )}
            >
              {req.done ? <Check className="h-3 w-3" /> : <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-line-strong" />}
              <span className="sr-only">{req.done ? t("apply.partDone") : t("apply.partTodo")}</span>
              {requirementLabel(t, level, req.requirement)}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function CompletionBanner({ levelId }: { levelId: number }) {
  const t = useT();
  const navigate = useNavigate();
  const next = levelId < PLAYABLE_LEVEL_COUNT ? getLevelDefinition(levelId + 1) : undefined;
  const Forward = t.dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <div className="flex animate-fade-in-up flex-wrap items-center gap-3 rounded-md border border-emerald-neon/40 bg-emerald-neon/10 px-3 py-2">
      {next ? <Trophy className="h-5 w-5 shrink-0 text-emerald-neon" /> : <Sparkles className="h-5 w-5 shrink-0 text-emerald-neon" />}
      <p className="min-w-0 flex-1 text-sm text-emerald-glow">
        {next ? t("apply.nextUp", { n: t.num(next.id), title: localizeLevel(next, t.language).title }) : t("apply.allDone")}
      </p>
      {next ? (
        <Button sfx="success" onClick={() => navigate(`/lab/${next.id}`)}>
          {t("apply.nextLevel")}
          <Forward />
        </Button>
      ) : (
        <Button sfx="success" onClick={() => navigate("/")}>
          <LayoutDashboard />
          {t("apply.dashboard")}
        </Button>
      )}
    </div>
  );
}
