import { Eye, PanelBottom, PanelLeft, PanelRight, ScanEye, Terminal, Zap } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { useProgressStore } from "@/core/state/progressStore";
import { useStageStore } from "@/core/state/stageStore";
import { useUiStore } from "@/core/state/uiStore";
import { useT } from "@/i18n";
import { XtermTerminal } from "./XtermTerminal";

/**
 * Smart CLI panel. Xterm.js attaches inside `#terminal-mount`.
 * Input waits for the "apply" step, but the player can skip straight to it at any time.
 */
export function TerminalPanel() {
  const t = useT();
  const phase = useProgressStore((s) => s.phase);
  const setPhase = useProgressStore((s) => s.setPhase);
  const dock = useUiStore((s) => s.terminalDock);
  const toggleTerminalDock = useUiStore((s) => s.toggleTerminalDock);
  const openModal = useUiStore((s) => s.openModal);
  const lastPacketId = useStageStore((s) => s.recentPackets.at(-1)?.id);
  const standby = phase !== "apply";
  const SideDock = t.dir === "rtl" ? PanelLeft : PanelRight;

  return (
    <Panel aria-label={t("terminal.title")}>
      <PanelHeader
        icon={<Terminal />}
        title={t("terminal.title")}
        subtitle={standby ? t("terminal.subtitleStandby") : t("terminal.subtitleReady")}
        actions={
          <>
            {standby ? (
              <Badge tone="amber">
                <Eye className="h-3 w-3" />
                {t("terminal.standby")}
              </Badge>
            ) : (
              <Badge tone="emerald">{t("terminal.ready")}</Badge>
            )}
            <IconButton
              label={t("terminal.xray")}
              disabled={!lastPacketId}
              onClick={() => lastPacketId && openModal({ kind: "packetInspector", packetId: lastPacketId })}
            >
              <ScanEye className="h-4 w-4" />
            </IconButton>
            <IconButton
              label={dock === "bottom" ? t("terminal.dockRight") : t("terminal.dockBottom")}
              onClick={toggleTerminalDock}
            >
              {dock === "bottom" ? <SideDock className="h-4 w-4" /> : <PanelBottom className="h-4 w-4" />}
            </IconButton>
          </>
        }
      />

      <div className="relative min-h-0 flex-1 bg-void/90">
        <XtermTerminal locked={standby} className="absolute inset-0 py-2 pl-3 pr-1" />

        {standby && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-void/70 px-4 text-center backdrop-blur-[1px]">
            <Eye className="h-5 w-5 text-amber-glow" />
            <p className="text-sm text-ink-muted">{t("terminal.overlay")}</p>
            <Button size="sm" variant="secondary" onClick={() => setPhase("apply")}>
              <Zap />
              {t("terminal.openNow")}
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}
