import { Badge } from "@/components/ui/Badge";
import { useT } from "@/i18n";
import { cn } from "@/lib/cn";
import { TRAINING_MODULES } from "@/modules/catalog";
import { MODULE_ICONS } from "@/modules/icons";

/** Training domains. Recon is the lab you are in; the others are announced as Coming Soon. */
export function ModuleTabs() {
  const t = useT();
  return (
    <nav aria-label={t("domains.aria")} className="flex h-9 shrink-0 items-end gap-1 overflow-x-auto border-b border-line bg-surface/30 px-3">
      {TRAINING_MODULES.map((module) => {
        const Icon = MODULE_ICONS[module.id];
        return (
          <span
            key={module.id}
            role="tab"
            aria-selected={module.available}
            aria-disabled={!module.available}
            title={module.available ? t(module.summaryKey) : t("domains.comingSoonHint", { summary: t(module.summaryKey) })}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-md border border-b-0 px-3 py-1.5 text-xs",
              module.available
                ? "border-line bg-void font-medium text-ink shadow-[inset_0_2px_0_0_theme(colors.cyber.blue)]"
                : "cursor-not-allowed border-transparent text-ink-faint",
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", module.available ? "text-cyber-glow" : "opacity-60")} />
            {t(module.available ? module.titleKey : module.shortKey)}
            {!module.available && <Badge tone="neutral">{t("common.comingSoon")}</Badge>}
          </span>
        );
      })}
    </nav>
  );
}
