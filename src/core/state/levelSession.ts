import type { LevelId } from "@/types/level";
import { useLedgerStore } from "./ledgerStore";
import { useProgressStore } from "./progressStore";

/**
 * Starts a level over: its goals, the ledger entries it produced, and (through
 * `restartCount`) the stage and the terminal session. Other levels are untouched.
 */
export function restartLevel(id: LevelId): void {
  useLedgerStore.getState().removeAssetsFoundIn(id);
  useProgressStore.getState().restartLevel(id);
}

/** Wipes every level and the whole ledger. */
export function resetAllProgress(): void {
  useLedgerStore.getState().clearLedger();
  useProgressStore.getState().resetProgress();
}
