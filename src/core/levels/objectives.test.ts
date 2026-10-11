import { describe, expect, it } from "vitest";
import { runCommandLine } from "@/core/commands";
import { PLAYABLE_LEVEL_COUNT } from "@/core/state/progressStore";
import type { LevelId } from "@/types/level";
import type { LevelDefinition } from "@/types/topology";
import {
  deviceIntel,
  EMPTY_EVIDENCE,
  evaluateObjectives,
  evidenceOfProbe,
  mergeEvidence,
  objectivesMet,
  verifiedFinds,
  type LevelEvidence,
} from "./objectives";
import { getLevelDefinition, getPlayerDevice } from "./registry";

/** Plays commands the way the terminal does when the stage is not drawn: every probe lands at once. */
function play(levelId: LevelId, lines: string[], start: LevelEvidence = EMPTY_EVIDENCE): LevelEvidence {
  const level = getLevelDefinition(levelId)!;
  let evidence = start;
  for (const source of lines) {
    const run = runCommandLine(source, { level, player: getPlayerDevice(level) });
    if (!run.command) continue;
    evidence = mergeEvidence(evidence, { commands: [run.command] });
    for (const step of run.steps) {
      if (step.kind !== "probes") continue;
      for (const probe of step.probes) evidence = mergeEvidence(evidence, evidenceOfProbe(run.command, probe));
    }
  }
  return evidence;
}

const met = (levelId: LevelId, evidence: LevelEvidence) => objectivesMet(getLevelDefinition(levelId)!, evidence);

const SOLUTIONS: Record<LevelId, string[]> = {
  1: ["ping 10.0.0.1"],
  2: ["arp-scan --local", "ping 10.0.0.20"],
  3: ["arp-scan --local", "ping -c 1 10.0.0.40"],
  4: ["nmap -p 22,80 10.0.0.50"],
  5: ["nmap -p 21,22,80,443 10.0.0.50"],
  6: ["nmap -sn 10.0.1.0/24"],
  7: ["nmap -p 22,80,3389 10.0.1.10"],
  8: ["arp-scan --local", "nmap -p 80 10.0.0.77"],
  9: ["nmap -p 80 10.0.1.10", "nmap -p 53 10.0.1.53", "nmap -p 21 10.0.1.20"],
  10: ["nmap -p 389 10.0.2.15", "nmap -p 22 10.0.2.40"],
};

describe("level objectives", () => {
  it.each(Array.from({ length: PLAYABLE_LEVEL_COUNT }, (_, i) => i + 1))("level %i can be finished from the terminal", (id) => {
    expect(met(id, EMPTY_EVIDENCE)).toBe(false);
    expect(met(id, play(id, SOLUTIONS[id]))).toBe(true);
  });

  it("needs every part of an objective, not just the first scan", () => {
    const afterScan = play(3, ["arp-scan --local"]);
    expect(met(3, afterScan)).toBe(false);
    const [status] = evaluateObjectives(getLevelDefinition(3)!, afterScan);
    expect(status.done).toBe(false);
    expect(status.requirements.map((r) => [r.requirement, r.done])).toEqual([
      [{ kind: "find", deviceId: "bob" }, true],
      [{ kind: "find", deviceId: "printer" }, true],
      [{ kind: "reply", command: "ping", deviceId: "printer" }, false],
    ]);
    expect(met(3, play(3, ["ping -c 1 10.0.0.40"], afterScan))).toBe(true);
  });

  it("does not finish a level when only one of its objectives is done", () => {
    const level = getLevelDefinition(2)!;
    const afterScan = play(2, ["arp-scan --local"]);
    expect(evaluateObjectives(level, afterScan).map((s) => [s.id, s.done])).toEqual([
      ["find-alice", true],
      ["ping-alice", false],
    ]);
    expect(met(2, afterScan)).toBe(false);

    const pingOnly = play(2, ["ping 10.0.0.20"]);
    expect(evaluateObjectives(level, pingOnly).map((s) => s.done)).toEqual([false, true]);
    expect(met(2, pingOnly)).toBe(false);

    expect(met(2, play(2, ["ping 10.0.0.20"], afterScan))).toBe(true);
  });

  it("never treats an objective with nothing to prove as done", () => {
    const base = getLevelDefinition(1)!;
    const empty: LevelDefinition = { ...base, objectives: [{ id: "nothing", text: "Nothing to check" }] };
    expect(evaluateObjectives(empty, EMPTY_EVIDENCE)[0].done).toBe(false);
    expect(objectivesMet(empty, play(1, ["ping 10.0.0.1"]))).toBe(false);

    const mixed: LevelDefinition = { ...base, objectives: [...base.objectives, { id: "nothing", text: "Nothing" }] };
    expect(objectivesMet(mixed, play(1, ["ping 10.0.0.1"]))).toBe(false);
    expect(objectivesMet({ ...base, objectives: [] }, play(1, ["ping 10.0.0.1"]))).toBe(false);
  });

  it("does not count help pages, typos or wrong targets", () => {
    expect(play(1, ["ping --help", "pnig 10.0.0.1", "ping 10.0.0.2"]).commands).toEqual(["ping"]);
    expect(met(1, play(1, ["ping 10.0.0.2", "help"]))).toBe(false);
  });

  it("counts a filtered port as checked, since the silence is the lesson", () => {
    const evidence = play(7, ["nmap -p 22 10.0.1.10"]);
    expect(evidence.ports).toContain("web:22");
  });

  it("a ping-quiet host is found through ARP, not ping", () => {
    expect(play(8, ["ping 10.0.0.77"]).devices).not.toContain("stealth");
    expect(play(8, ["arp-scan --local"]).devices).toContain("stealth");
  });

  it("merging returns the same object when nothing is new", () => {
    const evidence = play(1, ["ping 10.0.0.1"]);
    expect(mergeEvidence(evidence, { commands: ["ping"], replies: ["ping>router"] })).toBe(evidence);
  });

  it("merges into evidence saved before MAC tracking existed", () => {
    const old = { devices: ["router"], ports: [], commands: ["ping"], replies: [] } as unknown as LevelEvidence;
    expect(mergeEvidence(old, { macs: ["router"] }).macs).toEqual(["router"]);
  });
});

describe("device intel (unverified placeholders)", () => {
  it("starts every device except the player as unverified", () => {
    const intel = deviceIntel(getLevelDefinition(5)!, undefined);
    expect(intel.get("you")).toEqual({ verified: true, macKnown: true, ports: [] });
    for (const [id, info] of intel) {
      if (id !== "you") expect(info).toEqual({ verified: false, macKnown: false, ports: [] });
    }
  });

  it("reveals a device and its MAC only after a valid reply on the LAN", () => {
    const level = getLevelDefinition(2)!;
    const intel = deviceIntel(level, play(2, ["arp-scan --local"]));
    expect(intel.get("alice")).toMatchObject({ verified: true, macKnown: true });
  });

  it("does not reveal a target that never answered", () => {
    expect(deviceIntel(getLevelDefinition(8)!, play(8, ["ping 10.0.0.77"])).get("stealth")?.verified).toBe(false);
    expect(deviceIntel(getLevelDefinition(1)!, play(1, ["ping 10.0.0.2"])).get("router")?.verified).toBe(false);
    expect(deviceIntel(getLevelDefinition(7)!, play(7, ["nmap -Pn -p 22 10.0.1.10"])).get("web")?.verified).toBe(false);
  });

  it("only reveals devices through arp-scan or nmap, never through a ping reply", () => {
    const pinged = play(6, ["ping 10.0.1.10", "ping 10.0.0.1"]);
    expect(pinged.replies).toEqual(["ping>web", "ping>router"]);
    expect(pinged.devices).toEqual([]);
    expect(deviceIntel(getLevelDefinition(6)!, pinged).get("web")?.verified).toBe(false);

    const swept = deviceIntel(getLevelDefinition(6)!, play(6, ["nmap -sn 10.0.1.0/24"]));
    expect(swept.get("web")?.verified).toBe(true);
    expect(swept.get("files")?.verified).toBe(true);
  });

  it("never lets a non-discovery command write to the ledger", () => {
    const level = getLevelDefinition(1)!;
    const probe = {
      packet: { srcId: "you", dstId: "router", dstIp: "10.0.0.1", protocol: "icmp" as const, outcome: "success" as const },
      output: [],
      discover: [{ ip: "10.0.0.1", hostname: "Gateway Router" }],
    };
    expect(verifiedFinds("ping", probe)).toEqual([]);
    expect(evidenceOfProbe("ping", probe).devices).toEqual([]);
    const [scan] = runCommandLine("arp-scan --localnet", { level, player: getPlayerDevice(level) }).steps.flatMap((s) =>
      s.kind === "probes" ? s.probes : [],
    );
    expect(verifiedFinds("arp-scan", scan)).toEqual([expect.objectContaining({ ip: "10.0.0.1" })]);
  });

  it("learns no MAC across a router, but does learn the services nmap reported", () => {
    const level = getLevelDefinition(7)!;
    const web = deviceIntel(level, play(7, ["nmap -p 22,80 10.0.1.10"])).get("web");
    expect(web?.verified).toBe(true);
    expect(web?.macKnown).toBe(false);
    expect(web?.ports.map((p) => [p.number, p.state])).toEqual([
      [80, "open"],
      [22, "filtered"],
    ]);
  });
});
