import { beforeEach, describe, expect, it } from "vitest";
import { EMPTY_EVIDENCE, type LevelEvidence } from "@/core/levels/objectives";
import { isLevelProven, migrateCompletion, useProgressStore } from "./progressStore";

const store = () => useProgressStore.getState();

describe("progress store completion guardrail", () => {
  beforeEach(() => store().resetProgress());

  it("completes a level only after every objective is proven", () => {
    store().recordEvidence(2, { commands: ["arp-scan"], devices: ["alice"] });
    expect(store().completedLevelIds).not.toContain(2);

    store().recordEvidence(2, { commands: ["ping"], replies: ["ping>alice"] });
    expect(store().completedLevelIds).toContain(2);
  });

  it("refuses a direct completeLevel call without proof", () => {
    store().completeLevel(3);
    expect(store().completedLevelIds).not.toContain(3);

    store().recordEvidence(3, { devices: ["bob", "printer"] });
    store().completeLevel(3);
    expect(store().completedLevelIds).not.toContain(3);

    store().recordEvidence(3, { commands: ["ping"], replies: ["ping>printer"] });
    expect(store().completedLevelIds).toContain(3);
  });

  it("keeps only saved completions that the saved evidence really backs", () => {
    const proven: LevelEvidence = { ...EMPTY_EVIDENCE, commands: ["ping"], replies: ["ping>router"] };
    const partial = { devices: ["alice"], ports: [], commands: ["arp-scan"], replies: [] } as unknown as LevelEvidence;
    const migrated = migrateCompletion({ completedLevelIds: [1, 2, 4], evidence: { 1: proven, 2: partial } });

    expect(migrated.completedLevelIds).toEqual([1]);
    expect(migrated.evidence?.[2].macs).toEqual([]);
    expect(isLevelProven(1, proven)).toBe(true);
    expect(isLevelProven(2, partial)).toBe(false);
    expect(isLevelProven(99, proven)).toBe(false);
  });
});
