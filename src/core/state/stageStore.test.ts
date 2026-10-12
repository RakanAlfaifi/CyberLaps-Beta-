import { beforeEach, describe, expect, it } from "vitest";
import type { PacketRequest } from "@/types/packet";
import { useStageStore } from "./stageStore";

const store = () => useStageStore.getState();

const ping = (over: Partial<PacketRequest> = {}): PacketRequest => ({
  srcId: "player",
  dstId: "router",
  protocol: "icmp",
  outcome: "success",
  ...over,
});

describe("stage store packets", () => {
  beforeEach(() => useStageStore.setState(useStageStore.getInitialState(), true));

  it("ignores an empty emit without touching state", () => {
    const before = store();
    expect(store().emitPackets([])).toEqual([]);
    expect(store()).toBe(before);
  });

  it("gives each packet a unique id and queues it for the scene", () => {
    const flows = store().emitPackets([ping(), ping({ seq: 2 })]);

    expect(new Set(flows.map((f) => f.id)).size).toBe(2);
    expect(flows.every((f) => typeof f.emittedAt === "number")).toBe(true);
    expect(store().outbox).toEqual(flows);
    expect(store().recentPackets).toEqual(flows);
  });

  it("drains the outbox exactly once", () => {
    const flows = store().emitPackets([ping()]);

    expect(store().drainOutbox()).toEqual(flows);
    expect(store().outbox).toEqual([]);
    expect(store().drainOutbox()).toEqual([]);
    expect(store().recentPackets).toEqual(flows);
  });

  it("keeps only the 50 most recent packets and forgets settle times of evicted ones", () => {
    const [first] = store().emitPackets([ping()]);
    store().packetSettled(first!.id);
    expect(store().settledAt[first!.id]).toBeDefined();

    store().emitPackets(Array.from({ length: 50 }, (_, i) => ping({ seq: i })));

    expect(store().recentPackets).toHaveLength(50);
    expect(store().recentPackets.some((p) => p.id === first!.id)).toBe(false);
    expect(store().settledAt[first!.id]).toBeUndefined();
  });

  it("records a settle time once and ignores unknown packets", () => {
    const [flow] = store().emitPackets([ping()]);
    store().packetSettled(flow!.id);
    const settled = store().settledAt;

    store().packetSettled(flow!.id);
    store().packetSettled("pkt-unknown");

    expect(store().settledAt).toBe(settled);
    expect(Object.keys(settled)).toEqual([flow!.id]);
  });
});

describe("stage store walkthrough", () => {
  beforeEach(() => useStageStore.setState(useStageStore.getInitialState(), true));

  const walkthrough = () => store().walkthrough;

  it("will not play a level without beats", () => {
    store().playWalkthrough();
    expect(walkthrough().status).toBe("idle");
  });

  it("plays from the start, bumping runId and clearing the highlight", () => {
    store().stageLoaded(1, 3);
    store().setHighlightedDevice("router");
    store().playWalkthrough();

    expect(walkthrough()).toMatchObject({ status: "playing", beatIndex: -1, caption: null, runId: 1 });
    expect(store().highlightedDeviceId).toBeNull();
  });

  it("steps, pauses and resumes only while a demo is running", () => {
    store().stageLoaded(1, 3);
    store().nextWalkthroughStep();
    store().togglePauseWalkthrough();
    expect(walkthrough()).toMatchObject({ status: "idle", stepId: 0 });

    store().playWalkthrough();
    store().togglePauseWalkthrough();
    expect(walkthrough().status).toBe("paused");

    store().nextWalkthroughStep();
    expect(walkthrough()).toMatchObject({ status: "playing", stepId: 1 });
  });

  it("skips to finished only from an active demo", () => {
    store().stageLoaded(1, 3);
    store().skipWalkthrough();
    expect(walkthrough().status).toBe("idle");

    store().playWalkthrough();
    store().skipWalkthrough();
    expect(walkthrough().status).toBe("finished");

    store().togglePauseWalkthrough();
    expect(walkthrough().status).toBe("finished");
  });

  it("stops back to idle, and stopping an idle demo is a no-op", () => {
    store().stageLoaded(1, 3);
    const idle = store();
    store().stopWalkthrough();
    expect(store()).toBe(idle);

    store().playWalkthrough();
    store().setWalkthroughBeat(1, "Hello");
    store().stopWalkthrough();
    expect(walkthrough()).toMatchObject({ status: "idle", beatIndex: -1, caption: null, beatCount: 3 });
  });

  it("loading a level clears packets but keeps run counters monotonic", () => {
    store().stageLoaded(1, 3);
    store().playWalkthrough();
    store().nextWalkthroughStep();
    store().emitPackets([ping()]);

    store().stageLoaded(2, 5);

    expect(store()).toMatchObject({ ready: true, levelId: 2, outbox: [], recentPackets: [], settledAt: {} });
    expect(walkthrough()).toMatchObject({ status: "idle", beatCount: 5, runId: 1, stepId: 1 });
  });

  it("unloading resets the stage", () => {
    store().stageLoaded(1, 3);
    store().emitPackets([ping()]);
    store().stageUnloaded();

    expect(store()).toMatchObject({ ready: false, levelId: null, outbox: [], recentPackets: [] });
    expect(walkthrough().beatCount).toBe(0);
  });
});
