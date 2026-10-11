import { create } from "zustand";
import type { LevelId } from "@/types/level";
import type { PacketFlow, PacketRequest } from "@/types/packet";

export type WalkthroughStatus = "idle" | "playing" | "paused" | "finished";

export interface WalkthroughState {
  status: WalkthroughStatus;
  /** Index of the beat on screen, -1 before the first one. */
  beatIndex: number;
  beatCount: number;
  caption: string | null;
  /** Bumped on every (re)start so the stage knows to rewind even if status was already "playing". */
  runId: number;
  /** Bumped each time the learner asks for the next beat. */
  stepId: number;
}

/** How many past packets stay around for inspection. */
const RECENT_PACKET_LIMIT = 50;

interface StageState {
  /** True once the Phaser scene has drawn the current level. */
  ready: boolean;
  levelId: LevelId | null;
  highlightedDeviceId: string | null;
  walkthrough: WalkthroughState;
  /** Packets waiting for the scene to animate. The scene drains this. */
  outbox: PacketFlow[];
  recentPackets: PacketFlow[];
  /** When each recent packet finished its animation (reply home, dropped, or timed out). */
  settledAt: Record<string, number>;

  // Anyone (React UI, terminal engine, walkthrough)
  emitPackets: (requests: PacketRequest[]) => PacketFlow[];
  setHighlightedDevice: (deviceId: string | null) => void;
  playWalkthrough: () => void;
  /** Show the next beat (or finish after the last one). Also resumes a paused demo. */
  nextWalkthroughStep: () => void;
  togglePauseWalkthrough: () => void;
  skipWalkthrough: () => void;
  stopWalkthrough: () => void;

  // Stage only
  stageLoaded: (levelId: LevelId, beatCount: number) => void;
  stageUnloaded: () => void;
  drainOutbox: () => PacketFlow[];
  packetSettled: (id: string) => void;
  setWalkthroughBeat: (beatIndex: number, caption: string) => void;
  finishWalkthrough: () => void;
}

const IDLE_WALKTHROUGH: Omit<WalkthroughState, "runId" | "stepId" | "beatCount"> = {
  status: "idle",
  beatIndex: -1,
  caption: null,
};

let packetSeq = 0;
const nextPacketId = () => `pkt-${Date.now().toString(36)}-${(++packetSeq).toString(36)}`;

/** Live view state for the Visual Stage. Not persisted: it is rebuilt from the level on load. */
export const useStageStore = create<StageState>()((set, get) => ({
  ready: false,
  levelId: null,
  highlightedDeviceId: null,
  walkthrough: { ...IDLE_WALKTHROUGH, beatCount: 0, runId: 0, stepId: 0 },
  outbox: [],
  recentPackets: [],
  settledAt: {},

  emitPackets: (requests) => {
    if (requests.length === 0) return [];
    const now = Date.now();
    const flows = requests.map((r) => ({ ...r, id: nextPacketId(), emittedAt: now }));
    set((s) => {
      const recentPackets = [...s.recentPackets, ...flows].slice(-RECENT_PACKET_LIMIT);
      const kept = new Set(recentPackets.map((p) => p.id));
      const settledAt = Object.fromEntries(Object.entries(s.settledAt).filter(([id]) => kept.has(id)));
      return { outbox: [...s.outbox, ...flows], recentPackets, settledAt };
    });
    return flows;
  },

  packetSettled: (id) =>
    set((s) =>
      s.settledAt[id] !== undefined || !s.recentPackets.some((p) => p.id === id)
        ? s
        : { settledAt: { ...s.settledAt, [id]: Date.now() } },
    ),

  setHighlightedDevice: (deviceId) => set({ highlightedDeviceId: deviceId }),

  playWalkthrough: () =>
    set((s) => {
      if (s.walkthrough.beatCount === 0) return s;
      return {
        highlightedDeviceId: null,
        walkthrough: { ...s.walkthrough, ...IDLE_WALKTHROUGH, status: "playing", runId: s.walkthrough.runId + 1 },
      };
    }),

  nextWalkthroughStep: () =>
    set((s) => {
      const { status } = s.walkthrough;
      if (status !== "playing" && status !== "paused") return s;
      return { walkthrough: { ...s.walkthrough, status: "playing", stepId: s.walkthrough.stepId + 1 } };
    }),

  togglePauseWalkthrough: () =>
    set((s) => {
      const { status } = s.walkthrough;
      if (status !== "playing" && status !== "paused") return s;
      return { walkthrough: { ...s.walkthrough, status: status === "playing" ? "paused" : "playing" } };
    }),

  skipWalkthrough: () => {
    const { status } = get().walkthrough;
    if (status === "playing" || status === "paused") get().finishWalkthrough();
  },

  stopWalkthrough: () =>
    set((s) =>
      s.walkthrough.status === "idle"
        ? s
        : { highlightedDeviceId: null, walkthrough: { ...s.walkthrough, ...IDLE_WALKTHROUGH } },
    ),

  stageLoaded: (levelId, beatCount) =>
    set((s) => ({
      ready: true,
      levelId,
      highlightedDeviceId: null,
      outbox: [],
      recentPackets: [],
      settledAt: {},
      walkthrough: { ...IDLE_WALKTHROUGH, beatCount, runId: s.walkthrough.runId, stepId: s.walkthrough.stepId },
    })),

  stageUnloaded: () =>
    set((s) => ({
      ready: false,
      levelId: null,
      highlightedDeviceId: null,
      outbox: [],
      recentPackets: [],
      settledAt: {},
      walkthrough: { ...IDLE_WALKTHROUGH, beatCount: 0, runId: s.walkthrough.runId, stepId: s.walkthrough.stepId },
    })),

  drainOutbox: () => {
    const { outbox } = get();
    if (outbox.length > 0) set({ outbox: [] });
    return outbox;
  },

  setWalkthroughBeat: (beatIndex, caption) =>
    set((s) => ({ walkthrough: { ...s.walkthrough, beatIndex, caption } })),

  finishWalkthrough: () =>
    set((s) => ({ walkthrough: { ...s.walkthrough, status: "finished" } })),
}));
