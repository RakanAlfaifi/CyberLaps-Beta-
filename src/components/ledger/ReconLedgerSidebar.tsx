import { useMemo, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Radar, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconButton } from "@/components/ui/IconButton";
import { useLedgerStore } from "@/core/state/ledgerStore";
import { useUiStore } from "@/core/state/uiStore";
import { useT } from "@/i18n";
import { cn } from "@/lib/cn";
import { compareIp } from "@/lib/ip";
import { LedgerAssetCard } from "./LedgerAssetCard";

export function ReconLedgerSidebar() {
  const t = useT();
  const open = useUiStore((s) => s.ledgerOpen);
  const toggleLedger = useUiStore((s) => s.toggleLedger);
  const assets = useLedgerStore((s) => s.assets);
  const clearLedger = useLedgerStore((s) => s.clearLedger);
  const [confirming, setConfirming] = useState(false);

  const list = useMemo(() => Object.values(assets).sort((a, b) => compareIp(a.ip, b.ip)), [assets]);
  const openPorts = useMemo(
    () => list.reduce((n, a) => n + a.ports.filter((p) => p.state === "open").length, 0),
    [list],
  );

  // The sidebar sits at the inline start, so its collapse arrows mirror in RTL.
  const OpenIcon = t.dir === "rtl" ? PanelRightOpen : PanelLeftOpen;
  const CloseIcon = t.dir === "rtl" ? PanelRightClose : PanelLeftClose;

  return (
    <aside
      aria-label={t("ledger.aria")}
      className={cn(
        "flex shrink-0 flex-col overflow-hidden border-e border-line bg-surface/60 transition-[width] duration-300 ease-out",
        open ? "w-72" : "w-14",
      )}
    >
      {!open ? (
        <div className="flex flex-col items-center gap-4 py-3">
          <IconButton label={t("ledger.open")} onClick={toggleLedger}>
            <OpenIcon className="h-4 w-4" />
          </IconButton>
          <div className="relative" title={t("ledger.found", { count: t.count("ledger.devices", list.length) })}>
            <Radar className="h-5 w-5 text-cyber-glow" />
            {list.length > 0 && (
              <span className="absolute -end-2.5 -top-2 min-w-4 rounded-full bg-emerald-neon px-1 text-center font-mono text-[9px] font-bold leading-4 text-void">
                {list.length}
              </span>
            )}
          </div>
        </div>
      ) : (
        <>
          <header className="flex min-h-12 items-center gap-2 border-b border-line px-3 py-2">
            <Radar className="h-4 w-4 shrink-0 text-cyber-glow" />
            <div className="min-w-0 flex-1">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink">{t("ledger.title")}</h2>
              <p className="text-[11px] text-ink-faint">{t("ledger.subtitle")}</p>
            </div>
            <IconButton label={t("ledger.close")} onClick={toggleLedger}>
              <CloseIcon className="h-4 w-4" />
            </IconButton>
          </header>

          <div className="flex gap-2 border-b border-line px-3 py-2">
            <Badge tone="blue">{t.count("ledger.devices", list.length)}</Badge>
            <Badge tone="emerald">{t.count("ledger.openPorts", openPorts)}</Badge>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {list.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-2 py-10 text-center">
                <Radar className="h-8 w-8 animate-pulse-glow text-cyber-blue/60" />
                <p className="text-sm font-medium text-ink-muted">{t("ledger.emptyTitle")}</p>
                <p className="text-xs leading-relaxed text-ink-faint">{t("ledger.emptyBody")}</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {list.map((asset) => (
                  <li key={asset.ip}>
                    <LedgerAssetCard asset={asset} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {list.length > 0 && (
            <footer className="border-t border-line p-3">
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setConfirming(true)}>
                <Trash2 />
                {t("ledger.clear")}
              </Button>
            </footer>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirming}
        title={t("ledger.clear")}
        description={t("ledger.clearConfirm")}
        confirmLabel={t("ledger.clear")}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          clearLedger();
        }}
      />
    </aside>
  );
}
