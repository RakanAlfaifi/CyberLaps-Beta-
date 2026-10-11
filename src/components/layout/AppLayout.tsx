import { useEffect, useRef } from "react";
import { LabAgentModal } from "@/components/agent/LabAgentModal";
import { PacketInspectorModal } from "@/components/inspector/PacketInspectorModal";
import { ReconLedgerSidebar } from "@/components/ledger/ReconLedgerSidebar";
import { VisualStageViewport } from "@/components/stage/VisualStageViewport";
import { TerminalPanel } from "@/components/terminal/TerminalPanel";
import { playSfx } from "@/core/audio";
import { TERMINAL_SIZE_MAX, TERMINAL_SIZE_MIN, useUiStore } from "@/core/state/uiStore";
import { cn } from "@/lib/cn";
import { ModuleTabs } from "./ModuleTabs";
import { PanelResizeHandle } from "./PanelResizeHandle";
import { TopBar } from "./TopBar";

/**
 * Lab shell (mirrored in RTL):
 *  ┌──── TopBar (dashboard, level nav, restart, steps, language, audio) ────┐
 *  ├──────────────── Training domain tabs ────────────────────────┤
 *  │ Recon   │            Visual Stage (Phaser)                   │
 *  │ Ledger  ├──────────────── resize ────────────────────────────┤
 *  │         │            Smart CLI (bottom or right dock)        │
 *  └─────────┴────────────────────────────────────────────────────┘
 */
export function AppLayout() {
  useModalSfx();
  return (
    <div className="flex h-full flex-col overflow-hidden bg-void">
      <TopBar />
      <ModuleTabs />
      <div className="flex min-h-0 flex-1">
        <ReconLedgerSidebar />
        <WorkArea />
      </div>
      <PacketInspectorModal />
      <LabAgentModal />
    </div>
  );
}

function useModalSfx() {
  const open = useUiStore((s) => s.activeModal !== null);
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open !== wasOpen.current) playSfx(open ? "modalOpen" : "modalClose");
    wasOpen.current = open;
  }, [open]);
}

function WorkArea() {
  const dock = useUiStore((s) => s.terminalDock);
  const size = useUiStore((s) => s.terminalSize);
  const setSize = useUiStore((s) => s.setTerminalSize);
  const containerRef = useRef<HTMLElement>(null);
  const isBottom = dock === "bottom";

  return (
    <main
      ref={containerRef}
      className={cn("flex min-h-0 min-w-0 flex-1 p-3", isBottom ? "flex-col" : "flex-row")}
    >
      <div className="min-h-0 min-w-0 flex-1">
        <VisualStageViewport />
      </div>

      <PanelResizeHandle
        orientation={isBottom ? "horizontal" : "vertical"}
        containerRef={containerRef}
        value={size}
        min={TERMINAL_SIZE_MIN}
        max={TERMINAL_SIZE_MAX}
        onChange={setSize}
      />

      <div
        className="min-h-0 min-w-0 shrink-0"
        style={isBottom ? { height: `${size}%` } : { width: `${size}%` }}
      >
        <TerminalPanel />
      </div>
    </main>
  );
}
