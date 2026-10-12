import { beforeEach, describe, expect, it } from "vitest";
import { useLedgerStore } from "./ledgerStore";
import { resetAllProgress, restartLevel } from "./levelSession";
import { useProgressStore } from "./progressStore";

const ledger = () => useLedgerStore.getState();
const progress = () => useProgressStore.getState();

/** Proves level 1 (ping the router) and records one asset in level 1 and one in level 2. */
function playTwoLevels() {
  progress().startLevel(1);
  ledger().upsertAsset({ ip: "10.0.0.1" });
  progress().recordEvidence(1, { commands: ["ping"], replies: ["ping>router"] });

  progress().startLevel(2);
  ledger().upsertAsset({ ip: "10.0.0.2" });
  progress().recordEvidence(2, { commands: ["arp-scan"] });
}

describe("level session", () => {
  beforeEach(() => {
    ledger().clearLedger();
    progress().resetProgress();
    progress().startLevel(1);
  });

  it("restarting a level forgets only that level's goals and ledger finds", () => {
    playTwoLevels();
    expect(progress().completedLevelIds).toContain(1);
    const restarts = progress().restartCount;

    restartLevel(1);

    expect(Object.keys(ledger().assets)).toEqual(["10.0.0.2"]);
    expect(progress().completedLevelIds).not.toContain(1);
    expect(progress().evidence[1]).toBeUndefined();
    expect(progress().evidence[2]).toBeDefined();
    expect(progress().restartCount).toBe(restarts + 1);
  });

  it("restarting the current level sends the player back to the watch phase", () => {
    playTwoLevels();
    progress().setPhase("apply");

    restartLevel(2);
    expect(progress().phase).toBe("watch");
  });

  it("restarting a level with no progress is harmless", () => {
    playTwoLevels();
    restartLevel(7);

    expect(Object.keys(ledger().assets)).toHaveLength(2);
    expect(progress().completedLevelIds).toContain(1);
  });

  it("resetting wipes every level and the whole ledger", () => {
    playTwoLevels();
    const restarts = progress().restartCount;

    resetAllProgress();

    expect(ledger().assets).toEqual({});
    expect(progress()).toMatchObject({ currentLevelId: 1, phase: "watch", completedLevelIds: [], evidence: {} });
    expect(progress().restartCount).toBe(restarts + 1);
  });
});
