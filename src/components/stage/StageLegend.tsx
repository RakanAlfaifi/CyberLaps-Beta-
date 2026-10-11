import { useT, type MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";

const ITEMS: readonly { label: MessageKey; dot: string }[] = [
  { label: "legend.moving", dot: "bg-cyber-glow shadow-glow-blue" },
  { label: "legend.reply", dot: "bg-emerald-glow shadow-glow-emerald" },
  { label: "legend.refused", dot: "bg-danger-glow shadow-glow-red" },
  { label: "legend.noReply", dot: "bg-amber-glow shadow-glow-amber" },
];

/** What packet colors mean. Mirrors OUTCOME_COLOR in the Phaser theme. */
export function StageLegend({ className }: { className?: string }) {
  const t = useT();
  return (
    <ul
      aria-label={t("legend.aria")}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-line bg-void/80 px-2.5 py-1.5 backdrop-blur",
        className,
      )}
    >
      {ITEMS.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[11px] text-ink-muted">
          <span aria-hidden className={cn("h-2 w-2 rounded-full", item.dot)} />
          {t(item.label)}
        </li>
      ))}
      <li className="flex items-center gap-1.5 text-[11px] text-ink-muted">
        <span
          aria-hidden
          className="flex h-3.5 w-3.5 items-center justify-center rounded bg-[#3A4760] text-[9px] font-extrabold text-slate-200 shadow-[0_2px_0_#232D40]"
        >
          ?
        </span>
        {t("legend.unverified")}
      </li>
    </ul>
  );
}
