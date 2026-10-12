import { beforeEach, describe, expect, it } from "vitest";
import { TERMINAL_SIZE_MAX, TERMINAL_SIZE_MIN, useUiStore } from "./uiStore";

const ui = () => useUiStore.getState();

describe("ui store", () => {
  beforeEach(() => useUiStore.setState(useUiStore.getInitialState(), true));

  it("starts with the ledger open, terminal at the bottom and nothing paused", () => {
    expect(ui()).toMatchObject({
      ledgerOpen: true,
      terminalDock: "bottom",
      terminalSize: 35,
      activeModal: null,
      simulationPaused: false,
    });
  });

  it("toggles and sets the ledger panel", () => {
    ui().toggleLedger();
    expect(ui().ledgerOpen).toBe(false);
    ui().setLedgerOpen(true);
    expect(ui().ledgerOpen).toBe(true);
  });

  it("flips the terminal dock between bottom and right", () => {
    ui().toggleTerminalDock();
    expect(ui().terminalDock).toBe("right");
    ui().toggleTerminalDock();
    expect(ui().terminalDock).toBe("bottom");
    ui().setTerminalDock("right");
    expect(ui().terminalDock).toBe("right");
  });

  it("clamps the terminal size to its allowed range", () => {
    ui().setTerminalSize(50);
    expect(ui().terminalSize).toBe(50);
    ui().setTerminalSize(0);
    expect(ui().terminalSize).toBe(TERMINAL_SIZE_MIN);
    ui().setTerminalSize(100);
    expect(ui().terminalSize).toBe(TERMINAL_SIZE_MAX);
  });

  it("pauses the simulation while a modal is open", () => {
    ui().openModal({ kind: "toolIntro", toolId: "nmap" });
    expect(ui()).toMatchObject({ activeModal: { kind: "toolIntro", toolId: "nmap" }, simulationPaused: true });

    ui().openModal({ kind: "packetInspector", packetId: "pkt-1" });
    expect(ui().activeModal).toEqual({ kind: "packetInspector", packetId: "pkt-1" });

    ui().closeModal();
    expect(ui()).toMatchObject({ activeModal: null, simulationPaused: false });
  });

  it("persists layout preferences but never an open modal", () => {
    ui().openModal({ kind: "toolIntro", toolId: "nmap" });
    const saved = useUiStore.persist.getOptions().partialize?.(ui());
    expect(saved).toEqual({ ledgerOpen: true, terminalDock: "bottom", terminalSize: 35 });
  });
});
