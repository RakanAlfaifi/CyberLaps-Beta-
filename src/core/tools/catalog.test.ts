import { describe, expect, it } from "vitest";
import { runCommandLine } from "@/core/commands";
import { getPlayerDevice, listLevelDefinitions } from "@/core/levels";
import { getToolInfo, listToolInfo } from "./catalog";

const introLevels = listLevelDefinitions().filter((l) => l.newTool);

describe("tool catalog", () => {
  it("has an intro for every tool a level introduces", () => {
    expect(introLevels.map((l) => l.newTool)).toEqual(["ping", "arp-scan", "nmap"]);
    for (const level of introLevels) expect(getToolInfo(level.newTool!)).toBeDefined();
  });

  it.each(introLevels.map((l) => [l.newTool!, l] as const))("the %s example runs in the level that introduces it", (tool, level) => {
    const info = getToolInfo(tool)!;
    const run = runCommandLine(info.example, { level, player: getPlayerDevice(level) });
    expect(run.rejected).toBeFalsy();
    expect(run.command).toBe(tool);
    expect(run.steps.some((s) => s.kind === "probes")).toBe(true);
  });

  it("starts every syntax with the tool's own name", () => {
    for (const info of listToolInfo()) {
      expect(info.syntax.startsWith(info.name)).toBe(true);
      expect(info.parts[0].token).toBe(info.name);
    }
  });
});
