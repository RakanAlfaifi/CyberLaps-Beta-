import { afterEach, describe, expect, it, vi } from "vitest";
import level01 from "@/content/levels/level-01.json";
import level02 from "@/content/levels/level-02.json";
import { PLAYABLE_LEVEL_COUNT } from "@/core/state/progressStore";
import {
  buildComingSoonList,
  buildLevelRegistry,
  getLevelDefinition,
  listComingSoonLevels,
  listLevelDefinitions,
} from "./registry";
import { levelFileSchema } from "./schema";

describe("level registry", () => {
  it("loads every playable level", () => {
    const ids = listLevelDefinitions().map((l) => l.id);
    expect(ids).toEqual(Array.from({ length: PLAYABLE_LEVEL_COUNT }, (_, i) => i + 1));
  });

  it("exposes topology and walkthrough beats", () => {
    const level = getLevelDefinition(1);
    expect(level?.topology.devices.some((d) => d.kind === "router")).toBe(true);
    expect(level?.walkthrough.length).toBeGreaterThan(0);
  });

  it("includes an IoT device", () => {
    const kinds = listLevelDefinitions().flatMap((l) => l.topology.devices.map((d) => d.kind));
    expect(kinds).toContain("iot");
  });

  it("lists Coming Soon levels right after the playable ones", () => {
    const ids = listComingSoonLevels().map((l) => l.id);
    expect(ids[0]).toBe(PLAYABLE_LEVEL_COUNT + 1);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });
});

describe("level registry fault tolerance", () => {
  afterEach(() => vi.restoreAllMocks());

  const silenceWarnings = () => vi.spyOn(console, "warn").mockImplementation(() => undefined);

  it("skips a malformed level file and keeps the valid ones", () => {
    const warn = silenceWarnings();
    const levels = buildLevelRegistry([level01, { title: "broken" }, null, level02]);

    expect([...levels.keys()]).toEqual([1, 2]);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0]?.[0]).toContain("#2");
  });

  it("keeps the first file when two claim the same level number", () => {
    const warn = silenceWarnings();
    const levels = buildLevelRegistry([level01, { ...level01, title: "Duplicate" }]);

    expect(levels.size).toBe(1);
    expect(levels.get(1)?.title).toBe(level01.title);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("returns an empty registry when every file is broken", () => {
    silenceWarnings();
    expect(buildLevelRegistry(["not a level", 42]).size).toBe(0);
  });

  it("falls back to no Coming Soon levels when that file is invalid", () => {
    const warn = silenceWarnings();
    expect(buildComingSoonList({ levels: "nope" }, new Map())).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("level schema", () => {
  const withObjective = (objective: object) => ({ ...level01, objectives: [objective] });

  it("rejects objectives that point at missing devices, ports or commands", () => {
    const bad = [
      { id: "x", text: "x", requiredDeviceIds: ["ghost"] },
      { id: "x", text: "x", requiredPorts: [{ deviceId: "router", port: 22 }] },
      { id: "x", text: "x", requiredCommands: [{ command: "nmap" }] },
      { id: "x", text: "x" },
    ];
    for (const objective of bad) expect(levelFileSchema.safeParse(withObjective(objective)).success).toBe(false);
  });

  it("accepts a command objective with a real target", () => {
    const ok = { id: "x", text: "x", requiredCommands: [{ command: "ping", targetDeviceId: "router" }] };
    expect(levelFileSchema.safeParse(withObjective(ok)).success).toBe(true);
  });
});
