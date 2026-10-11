import { Server } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { useT, type MessageKey } from "@/i18n";
import type { LedgerAsset, PortState } from "@/types/ledger";

const PORT_TONE: Record<PortState, BadgeTone> = {
  open: "emerald",
  filtered: "amber",
  closed: "neutral",
};

const PORT_HINT: Record<PortState, MessageKey> = {
  open: "ledger.portOpen",
  filtered: "ledger.portFiltered",
  closed: "ledger.portClosed",
};

export function LedgerAssetCard({ asset }: { asset: LedgerAsset }) {
  const t = useT();
  return (
    <article className="animate-fade-in-up rounded-md border border-line bg-surface-raised/80 p-2.5 transition-colors hover:border-cyber-blue/40">
      <div className="flex items-start gap-2">
        <Server className="mt-0.5 h-4 w-4 shrink-0 text-cyber-glow" />
        <div className="min-w-0 flex-1">
          <p dir="ltr" className="text-start font-mono text-sm font-semibold text-ink">
            {asset.ip}
          </p>
          {asset.hostname && <p className="truncate text-xs text-ink-muted">{asset.hostname}</p>}
        </div>
        <span dir="ltr" className="font-mono text-[10px] text-ink-faint" title={t("ledger.foundIn", { n: t.num(asset.discoveredInLevel) })}>
          L{asset.discoveredInLevel}
        </span>
      </div>

      {(asset.kind || asset.mac || asset.vendor) && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px]">
          {asset.kind && (
            <>
              <dt className="text-ink-faint">{t("ledger.type")}</dt>
              <dd className="truncate text-ink-muted">{t(`kind.${asset.kind}`)}</dd>
            </>
          )}
          {asset.mac && (
            <>
              <dt className="text-ink-faint">{t("ledger.mac")}</dt>
              <dd dir="ltr" className="truncate text-start font-mono text-ink-muted">
                {asset.mac}
              </dd>
            </>
          )}
          {asset.vendor && (
            <>
              <dt className="text-ink-faint">{t("ledger.maker")}</dt>
              <dd className="truncate text-ink-muted">{asset.vendor}</dd>
            </>
          )}
        </dl>
      )}

      {asset.ports.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1" aria-label={t("ledger.ports")}>
          {asset.ports.map((p) => (
            <li key={`${p.protocol}/${p.port}`}>
              <Badge tone={PORT_TONE[p.state]} title={t(PORT_HINT[p.state])} dir="ltr">
                {p.port}/{p.protocol}
                {p.service && <span className="normal-case opacity-80">{p.service}</span>}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
