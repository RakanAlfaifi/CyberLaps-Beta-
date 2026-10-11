import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getLevelDefinition } from "@/core/levels/registry";
import { EMPTY_EVIDENCE, mergeEvidence, objectivesMet, type LevelEvidence } from "@/core/levels/objectives";
import { getBrowserStorage, storageKey } from "@/core/persistence/storage";
import type { LevelId, LevelPhase } from "@/types/level";

/** Levels 1..N are playable. Anything above is shown as "Coming Soon". */
export const PLAYABLE_LEVEL_COUNT = 10;

export const LEVEL_PHASES: readonly LevelPhase[] = ["watch", "learn", "apply"];

/** Every playable level is open: players can jump around freely. */
export function isLevelPlayable(id: LevelId): boolean {
  return Number.isInteger(id) && id >= 1 && id <= PLAYABLE_LEVEL_COUNT;
}

interface ProgressState {
  currentLevelId: LevelId;
  phase: LevelPhase;
  completedLevelIds: LevelId[];
  /** What the player proved in each level. Kept after completion so the checklist stays ticked. */
  evidence: Record<LevelId, LevelEvidence>;
  /** Tools the Lab Agent has already introduced, so the intro shows once. */
  introducedTools: string[];
  /** Bumped on every level restart so the stage and terminal know to start over. Not persisted. */
  restartCount: number;

  /** Returns false (and changes nothing) if the level does not exist. */
  startLevel: (id: LevelId) => boolean;
  setPhase: (phase: LevelPhase) => void;
  advancePhase: () => void;
  /** Marks a level done, but only if its saved evidence already proves every objective. */
  completeLevel: (id: LevelId) => void;
  /** Adds proof to a level and completes it once every objective is met. */
  recordEvidence: (id: LevelId, add: Partial<LevelEvidence>) => void;
  markToolIntroduced: (toolId: string) => void;
  /** Forgets everything the player did in one level and sends them back to its first step. */
  restartLevel: (id: LevelId) => void;
  resetProgress: () => void;
}

const INITIAL = {
  currentLevelId: 1,
  phase: "watch" as LevelPhase,
  completedLevelIds: [] as LevelId[],
  evidence: {} as Record<LevelId, LevelEvidence>,
  introducedTools: [] as string[],
};

const withCompleted = (ids: LevelId[], id: LevelId) => (ids.includes(id) ? ids : [...ids, id].sort((a, b) => a - b));

/** The single rule for "this level is finished": every objective is proven by this level's own evidence. */
export function isLevelProven(id: LevelId, evidence: LevelEvidence | undefined): boolean {
  const level = getLevelDefinition(id);
  return level !== undefined && objectivesMet(level, evidence);
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      restartCount: 0,

      startLevel: (id) => {
        if (!isLevelPlayable(id)) return false;
        if (id !== get().currentLevelId) set({ currentLevelId: id, phase: "watch" });
        return true;
      },

      setPhase: (phase) => set({ phase }),

      advancePhase: () => {
        const index = LEVEL_PHASES.indexOf(get().phase);
        const next = LEVEL_PHASES[index + 1];
        if (next) set({ phase: next });
      },

      completeLevel: (id) =>
        set((s) =>
          s.completedLevelIds.includes(id) || !isLevelProven(id, s.evidence[id])
            ? s
            : { completedLevelIds: withCompleted(s.completedLevelIds, id) },
        ),

      recordEvidence: (id, add) =>
        set((s) => {
          const before = s.evidence[id] ?? EMPTY_EVIDENCE;
          const after = mergeEvidence(before, add);
          if (after === before) return s;
          const done = !s.completedLevelIds.includes(id) && isLevelProven(id, after);
          return {
            evidence: { ...s.evidence, [id]: after },
            ...(done ? { completedLevelIds: withCompleted(s.completedLevelIds, id) } : {}),
          };
        }),

      markToolIntroduced: (toolId) =>
        set((s) => (s.introducedTools.includes(toolId) ? s : { introducedTools: [...s.introducedTools, toolId] })),

      restartLevel: (id) =>
        set((s) => {
          const evidence = { ...s.evidence };
          delete evidence[id];
          const newTool = getLevelDefinition(id)?.newTool;
          return {
            evidence,
            completedLevelIds: s.completedLevelIds.filter((done) => done !== id),
            introducedTools: newTool ? s.introducedTools.filter((t) => t !== newTool) : s.introducedTools,
            phase: s.currentLevelId === id ? "watch" : s.phase,
            restartCount: s.restartCount + 1,
          };
        }),

      resetProgress: () =>
        set((s) => ({
          ...INITIAL,
          completedLevelIds: [],
          evidence: {},
          introducedTools: [],
          restartCount: s.restartCount + 1,
        })),
    }),
    {
      name: storageKey("progress"),
      version: 3,
      storage: createJSONStorage(getBrowserStorage),
      partialize: (s) => ({
        currentLevelId: s.currentLevelId,
        phase: s.phase,
        completedLevelIds: s.completedLevelIds,
        evidence: s.evidence,
        introducedTools: s.introducedTools,
      }),
      migrate: (persisted, version) => {
        const saved = (persisted ?? {}) as Partial<typeof INITIAL>;
        if (version < 2) return { ...INITIAL, ...saved, evidence: {}, introducedTools: [] };
        return migrateCompletion(saved);
      },
    },
  ),
);

/**
 * Older saves could hold a level as complete without proof of every objective. Fill in
 * evidence fields added since, and keep only completions the evidence really backs.
 */
export function migrateCompletion(saved: Partial<typeof INITIAL>): Partial<typeof INITIAL> {
  const evidence = Object.fromEntries(
    Object.entries(saved.evidence ?? {}).map(([id, proof]) => [id, { ...EMPTY_EVIDENCE, ...proof }]),
  ) as Record<LevelId, LevelEvidence>;
  const completedLevelIds = (saved.completedLevelIds ?? []).filter((id) => isLevelProven(id, evidence[id]));
  return { ...saved, evidence, completedLevelIds };
}
