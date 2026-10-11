import { useLedgerStore } from "@/core/state/ledgerStore";
import { PLAYABLE_LEVEL_COUNT, useProgressStore } from "@/core/state/progressStore";
import type { MessageKey } from "@/i18n";

export interface ReconSummary {
  currentLevelId: number;
  completed: number[];
  doneCount: number;
  total: number;
  devicesFound: number;
  /** True once the player has done anything, so CTAs can say "Continue" instead of "Start". */
  started: boolean;
  rankKey: MessageKey;
}

const RANKS: readonly { min: number; key: MessageKey }[] = [
  { min: PLAYABLE_LEVEL_COUNT, key: "profile.rank4" },
  { min: 7, key: "profile.rank3" },
  { min: 4, key: "profile.rank2" },
  { min: 1, key: "profile.rank1" },
  { min: 0, key: "profile.rank0" },
];

export function rankFor(doneCount: number): MessageKey {
  return RANKS.find((r) => doneCount >= r.min)!.key;
}

export function useReconSummary(): ReconSummary {
  const currentLevelId = useProgressStore((s) => s.currentLevelId);
  const completed = useProgressStore((s) => s.completedLevelIds);
  const hasEvidence = useProgressStore((s) => Object.keys(s.evidence).length > 0);
  const devicesFound = useLedgerStore((s) => Object.keys(s.assets).length);
  const doneCount = completed.filter((id) => id <= PLAYABLE_LEVEL_COUNT).length;

  return {
    currentLevelId,
    completed,
    doneCount,
    total: PLAYABLE_LEVEL_COUNT,
    devicesFound,
    started: currentLevelId > 1 || doneCount > 0 || hasEvidence,
    rankKey: rankFor(doneCount),
  };
}
