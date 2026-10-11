import { ChevronLeft, ChevronRight, CircleCheck, Lock } from "lucide-react";
import { forwardRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { playSfx } from "@/core/audio";
import { listLevelDefinitions } from "@/core/levels";
import { localizeLevel, useT } from "@/i18n";
import { cn } from "@/lib/cn";
import { TRAINING_MODULES, type TrainingModule } from "@/modules/catalog";
import { MODULE_ICONS } from "@/modules/icons";
import { useReconSummary } from "./useReconSummary";

const pad = (n: number) => String(n).padStart(2, "0");

export const DomainHub = forwardRef<HTMLElement>(function DomainHub(_props, ref) {
  const t = useT();
  const [featured, ...upcoming] = TRAINING_MODULES;

  return (
    <section ref={ref} id="domains" aria-labelledby="domains-title" className="scroll-mt-20 py-12">
      <SectionHeading id="domains-title" title={t("landing.domainsTitle")} body={t("landing.domainsBody")} />
      <div className="mt-8 flex flex-col gap-5">
        <ReconCard module={featured} />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {upcoming.map((module) => (
            <li key={module.id}>
              <ComingSoonCard module={module} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
});

export function SectionHeading({ id, title, body }: { id: string; title: string; body?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span aria-hidden className="h-px w-8 bg-gradient-to-r from-transparent to-emerald-neon rtl:bg-gradient-to-l" />
        <h2 id={id} className="font-mono text-sm font-semibold uppercase tracking-[0.3em] text-emerald-glow">
          {title}
        </h2>
      </div>
      {body && <p className="max-w-2xl text-sm text-ink-muted">{body}</p>}
    </div>
  );
}

function ReconCard({ module }: { module: TrainingModule }) {
  const t = useT();
  const navigate = useNavigate();
  const recon = useReconSummary();
  const Icon = MODULE_ICONS[module.id];
  const Forward = t.dir === "rtl" ? ChevronLeft : ChevronRight;
  const percent = (recon.doneCount / recon.total) * 100;

  return (
    <article className="group relative overflow-hidden rounded-xl border border-emerald-neon/30 bg-surface/80 p-6 shadow-panel transition-shadow hover:shadow-glow-emerald">
      <div aria-hidden className="absolute -end-24 -top-24 h-64 w-64 rounded-full bg-emerald-neon/10 opacity-60 blur-3xl transition-opacity group-hover:opacity-100" />
      <div aria-hidden className="absolute inset-0 bg-grid-faint bg-grid opacity-50" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-emerald-neon/50 bg-emerald-neon/10 shadow-glow-emerald">
              <Icon className="h-7 w-7 text-emerald-glow" />
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold text-ink">{t(module.titleKey)}</h3>
                <Badge tone="emerald">{t("landing.domainLevels", { n: recon.total })}</Badge>
              </div>
              <p className="text-sm leading-relaxed text-ink-muted">{t(module.summaryKey)}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-muted">{t("profile.progress")}</span>
              <span className="font-mono text-emerald-glow">
                {t("landing.domainProgress", { done: recon.doneCount, total: recon.total })}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-neon to-cyber-glow shadow-glow-emerald transition-[width] duration-700 rtl:bg-gradient-to-l"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          <div>
            <Button sfx="success" onClick={() => navigate(`/lab/${recon.currentLevelId}`)}>
              {recon.started ? t("landing.domainContinue") : t("landing.domainEnter")}
              <Forward />
            </Button>
          </div>
        </div>

        <ol aria-label={t("landing.levelGridAria")} className="grid grid-cols-5 gap-2 lg:w-[22rem]">
          {listLevelDefinitions().map((level) => {
            const done = recon.completed.includes(level.id);
            const current = level.id === recon.currentLevelId;
            const copy = localizeLevel(level, t.language);
            return (
              <li key={level.id}>
                <Link
                  to={`/lab/${level.id}`}
                  title={`${pad(level.id)} · ${copy.title}`}
                  aria-label={`${t("levelMap.level")} ${level.id}: ${copy.title}`}
                  aria-current={current ? "step" : undefined}
                  onClick={() => playSfx("click")}
                  className={cn(
                    "relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border font-mono text-sm font-semibold transition-all hover:-translate-y-0.5",
                    done
                      ? "border-emerald-neon/50 bg-emerald-neon/15 text-emerald-glow hover:shadow-glow-emerald"
                      : "border-line-strong bg-void/70 text-ink-muted hover:border-cyber-blue/60 hover:text-cyber-glow hover:shadow-glow-blue",
                    current && "ring-2 ring-cyber-glow ring-offset-2 ring-offset-surface",
                  )}
                >
                  {done && <CircleCheck className="absolute end-1 top-1 h-3 w-3" />}
                  {pad(level.id)}
                  {level.newTool && <span className="text-[8px] font-normal uppercase opacity-70">{level.newTool}</span>}
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </article>
  );
}

function ComingSoonCard({ module }: { module: TrainingModule }) {
  const t = useT();
  const Icon = MODULE_ICONS[module.id];
  return (
    <article
      aria-disabled="true"
      className="relative flex h-full flex-col gap-3 overflow-hidden rounded-xl border border-line bg-surface/50 p-5 transition-colors hover:border-line-strong"
    >
      <div aria-hidden className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent_0_10px,rgba(255,255,255,0.015)_10px_20px)]" />
      <div className="relative flex items-start justify-between gap-2">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-line-strong bg-void/60">
          <Icon className="h-5 w-5 text-ink-faint" />
        </span>
        <Badge tone="amber">{t("common.comingSoon")}</Badge>
      </div>
      <h3 className="relative text-base font-semibold text-ink-muted">{t(module.titleKey)}</h3>
      <p className="relative flex-1 text-sm leading-relaxed text-ink-faint">{t(module.summaryKey)}</p>
      <p className="relative flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
        <Lock className="h-3 w-3" />
        {t("landing.domainLocked")}
      </p>
    </article>
  );
}
