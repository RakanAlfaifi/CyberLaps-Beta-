import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getBrowserStorage, storageKey } from "@/core/persistence/storage";

export type TerminalDock = "bottom" | "right";

export type ActiveModal =
  | { kind: "toolIntro"; toolId: string }
  | { kind: "packetInspector"; packetId: string }
  | null;

/** Terminal size, as a percent of the work area. */
export const TERMINAL_SIZE_MIN = 20;
export const TERMINAL_SIZE_MAX = 65;

const clampTerminalSize = (value: number) =>
  Math.min(TERMINAL_SIZE_MAX, Math.max(TERMINAL_SIZE_MIN, value));

interface UiState {
  ledgerOpen: boolean;
  terminalDock: TerminalDock;
  terminalSize: number;
  activeModal: ActiveModal;
  /** True while a modal (tool intro, packet inspector) has frozen the simulation. */
  simulationPaused: boolean;

  toggleLedger: () => void;
  setLedgerOpen: (open: boolean) => void;
  setTerminalDock: (dock: TerminalDock) => void;
  toggleTerminalDock: () => void;
  setTerminalSize: (percent: number) => void;
  openModal: (modal: NonNullable<ActiveModal>) => void;
  closeModal: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      ledgerOpen: true,
      terminalDock: "bottom",
      terminalSize: 35,
      activeModal: null,
      simulationPaused: false,

      toggleLedger: () => set((s) => ({ ledgerOpen: !s.ledgerOpen })),
      setLedgerOpen: (open) => set({ ledgerOpen: open }),
      setTerminalDock: (dock) => set({ terminalDock: dock }),
      toggleTerminalDock: () =>
        set((s) => ({ terminalDock: s.terminalDock === "bottom" ? "right" : "bottom" })),
      setTerminalSize: (percent) => set({ terminalSize: clampTerminalSize(percent) }),
      openModal: (modal) => set({ activeModal: modal, simulationPaused: true }),
      closeModal: () => set({ activeModal: null, simulationPaused: false }),
    }),
    {
      name: storageKey("ui"),
      version: 1,
      storage: createJSONStorage(getBrowserStorage),
      partialize: (s) => ({
        ledgerOpen: s.ledgerOpen,
        terminalDock: s.terminalDock,
        terminalSize: s.terminalSize,
      }),
    },
  ),
);
