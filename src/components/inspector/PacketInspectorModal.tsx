import { ArrowRight, Pause, ScanEye, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { getLevelDefinition } from "@/core/levels";
import { describePacket, type HeaderLayer, type LayerId } from "@/core/network/packetAnatomy";
import { useProgressStore } from "@/core/state/progressStore";
import { useStageStore } from "@/core/state/stageStore";
import { useUiStore } from "@/core/state/uiStore";
import { useT, type MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import type { PacketOutcome } from "@/types/topology";

const OUTCOME_BADGE: Record<PacketOutcome, { label: MessageKey; tone: BadgeTone }> = {
  success: { label: "xray.answered", tone: "emerald" },
  rst: { label: "xray.refused", tone: "red" },
  timeout: { label: "xray.noReply", tone: "amber" },
  unreachable: { label: "xray.dropped", tone: "amber" },
};

const VERDICT_STYLE: Record<PacketOutcome, string> = {
  success: "border-emerald-neon/40 bg-emerald-neon/10 text-emerald-glow",
  rst: "border-danger-neon/40 bg-danger-neon/10 text-danger-glow",
  timeout: "border-amber-neon/40 bg-amber-neon/10 text-amber-glow",
  unreachable: "border-amber-neon/40 bg-amber-neon/10 text-amber-glow",
};

const LAYER_ACCENT: Record<LayerId, string> = {
  ethernet: "border-s-ink-faint",
  arp: "border-s-cyber-glow",
  ip: "border-s-cyber-glow",
  icmp: "border-s-emerald-glow",
  tcp: "border-s-emerald-glow",
};

/** X-Ray view of one packet. Opening it freezes the stage; closing lets time run again. */
export function PacketInspectorModal() {
  const t = useT();
  const modal = useUiStore((s) => s.activeModal);
  const closeModal = useUiStore((s) => s.closeModal);
  const packetId = modal?.kind === "packetInspector" ? modal.packetId : null;
  const packet = useStageStore((s) => (packetId ? s.recentPackets.find((p) => p.id === packetId) : undefined));
  const settled = useStageStore((s) => (packetId ? s.settledAt[packetId] !== undefined : false));
  const levelId = useProgressStore((s) => s.currentLevelId);
  const level = getLevelDefinition(levelId);

  const anatomy = useMemo(
    () => (packet && level ? describePacket(packet, level.topology, t.language) : null),
    [packet, level, t.language],
  );

  useEffect(() => {
    if (!packetId) return;
    // The packet can vanish if the map reloads behind the modal.
    if (!anatomy) {
      closeModal();
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [packetId, anatomy, closeModal]);

  if (!packetId || !packet || !anatomy) return null;

  const badge = OUTCOME_BADGE[packet.outcome];
  const protocol = packet.protocol.toUpperCase() + (packet.dstPort !== undefined ? ` :${packet.dstPort}` : "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && closeModal()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="packet-xray-title"
        className="flex max-h-[88vh] w-full max-w-2xl animate-fade-in-up flex-col overflow-hidden rounded-lg border border-line-strong bg-surface shadow-panel"
      >
        <header className="flex items-start gap-3 border-b border-line px-4 py-3">
          <ScanEye className="mt-0.5 h-5 w-5 shrink-0 text-cyber-glow" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="packet-xray-title" className="text-sm font-semibold uppercase tracking-[0.18em] text-ink">
                {t("xray.title")}
              </h2>
              <Badge tone="blue" dir="ltr">
                {protocol}
              </Badge>
              {settled ? <Badge tone={badge.tone}>{t(badge.label)}</Badge> : <Badge tone="blue">{t("xray.inFlight")}</Badge>}
            </div>
            <p dir="auto" className="mt-1 text-sm text-ink-muted">
              {anatomy.summary}
            </p>
          </div>
          <IconButton label={t("xray.close")} onClick={closeModal}>
            <X className="h-4 w-4" />
          </IconButton>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs text-amber-glow">
            <Pause className="h-3.5 w-3.5" />
            {t("xray.frozen")}
          </p>

          <div className="flex flex-col gap-1.5">
            <Label>{t("xray.path")}</Label>
            <ol className="flex flex-wrap items-center gap-1.5">
              {anatomy.route.map((stop, i) => {
                const lastStop = i === anatomy.route.length - 1;
                return (
                  <li key={`${stop.id}-${i}`} className="flex items-center gap-1.5">
                    {i > 0 && <ArrowRight className="h-3.5 w-3.5 text-ink-faint rtl:-scale-x-100" />}
                    <span
                      className={cn(
                        "rounded border border-line-strong bg-surface-raised px-2 py-1 text-xs text-ink",
                        lastStop && anatomy.dropped && settled && "border-amber-neon/50 text-amber-glow",
                      )}
                    >
                      {stop.name} <span className="font-mono text-ink-faint">{stop.ip}</span>
                      {lastStop && anatomy.dropped && settled && <span className="ms-1 font-semibold">{t("xray.droppedMark")}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="text-xs text-ink-faint">
              {packet.command ? (
                <>
                  {t("xray.sentBy")}{" "}
                  <code dir="ltr" className="font-mono text-emerald-glow">
                    {packet.command}
                  </code>
                </>
              ) : (
                t("xray.sentByDemo")
              )}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t("xray.sent")}</Label>
            {anatomy.request.map((layer, i) => (
              <LayerCard key={`req-${layer.id}-${i}`} layer={layer} />
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t("xray.back")}</Label>
            {!settled ? (
              <p className="rounded-md border border-dashed border-line-strong px-3 py-2 text-sm text-ink-muted">
                {t("xray.onItsWay")}
              </p>
            ) : (
              <>
                <div className={cn("rounded-md border px-3 py-2", VERDICT_STYLE[anatomy.verdict.outcome])}>
                  <p className="text-sm font-semibold">{anatomy.verdict.title}</p>
                  <p className="text-sm text-ink-muted">{anatomy.verdict.explain}</p>
                </div>
                {anatomy.reply?.map((layer, i) => <LayerCard key={`rep-${layer.id}-${i}`} layer={layer} />)}
              </>
            )}
          </div>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5">
          <p className="text-xs text-ink-faint">{t("xray.escHint")}</p>
          <Button size="sm" onClick={closeModal} autoFocus>
            {t("xray.letTimeRun")}
          </Button>
        </footer>
      </section>
    </div>
  );
}

function Label({ children }: { children: string }) {
  return <h3 className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{children}</h3>;
}

function LayerCard({ layer }: { layer: HeaderLayer }) {
  const t = useT();
  return (
    <section dir={t.dir} className={cn("rounded-md border border-line border-s-2 bg-void/60", LAYER_ACCENT[layer.id])}>
      <header className="flex flex-wrap items-baseline gap-x-2 border-b border-line px-3 py-1.5">
        <h4 dir="ltr" className="font-mono text-xs font-semibold text-ink">{layer.title}</h4>
        <p className="text-xs text-ink-faint">{layer.role}</p>
      </header>
      <dl className="divide-y divide-line/60">
        {layer.fields.map((field) => (
          <div key={field.label} className="grid grid-cols-[8.5rem_minmax(0,11rem)_1fr] items-baseline gap-x-3 px-3 py-1.5 text-xs">
            <dt className="text-ink-muted">{field.label}</dt>
            <dd dir="ltr" className="truncate text-start font-mono text-cyber-glow" title={field.value}>
              {field.value}
            </dd>
            <dd className="text-ink-faint">{field.explain}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
