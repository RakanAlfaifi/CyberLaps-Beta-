import { describe, expect, it } from "vitest";
import { getLevelDefinition, getPlayerDevice } from "@/core/levels";
import type { LevelId } from "@/types/level";
import { runCommandLine, type CommandRun, type OutputLine, type Probe } from "./index";

function run(levelId: LevelId, source: string): CommandRun {
  const level = getLevelDefinition(levelId)!;
  return runCommandLine(source, { level, player: getPlayerDevice(level) });
}

const probesOf = (r: CommandRun): Probe[] => r.steps.flatMap((s) => (s.kind === "probes" ? s.probes : []));
const textOf = (lines: OutputLine[]) => lines.map((l) => l.map((s) => s.text).join("")).join("\n");
const allText = (r: CommandRun) =>
  textOf(r.steps.flatMap((s) => (s.kind === "print" ? s.lines : s.probes.flatMap((p) => p.output))));

describe("ping", () => {
  it("gets green replies from the router without revealing who it is", () => {
    const r = run(1, "ping -c 2 10.0.0.1");
    const sent = probesOf(r);
    expect(sent.map((p) => [p.packet.protocol, p.packet.dstId, p.packet.outcome, p.packet.seq])).toEqual([
      ["icmp", "router", "success", 1],
      ["icmp", "router", "success", 2],
    ]);
    expect(sent.every((p) => p.discover === undefined)).toBe(true);
    expect(allText(r)).toContain("2 packets transmitted, 2 received, 0% packet loss");
  });

  it("animates a wrong IP to the router instead of only printing an error", () => {
    const r = run(1, "ping -c 1 10.0.0.2");
    expect(probesOf(r)[0].packet).toMatchObject({ dstId: null, dstIp: "10.0.0.2", outcome: "unreachable" });
    expect(allText(r)).toContain("Destination Host Unreachable");
    expect(allText(r)).toContain("Did you mean 10.0.0.1?");
  });

  it("explains the network address", () => {
    expect(allText(run(1, "ping -c 1 10.0.0.0"))).toContain("name of the whole network");
  });

  it("lowers the TTL for each router crossed", () => {
    expect(allText(run(6, "ping -c 1 10.0.1.10"))).toContain("ttl=63");
  });

  it("times out on a host that ignores ping, without recording it", () => {
    const sent = probesOf(run(8, "ping -c 1 10.0.0.77"));
    expect(sent[0].packet.outcome).toBe("timeout");
    expect(sent[0].discover).toBeUndefined();
  });
});

describe("arp-scan", () => {
  it("works before the level that features it, like every tool", () => {
    const sent = probesOf(run(1, "arp-scan --localnet"));
    expect(sent.map((p) => p.packet.dstId)).toEqual(["router"]);
    expect(sent[0].discover?.[0]).toMatchObject({ ip: "10.0.0.1", mac: "aa:aa:aa:00:00:01", kind: "router" });
  });

  it("finds every LAN neighbor with its MAC", () => {
    const sent = probesOf(run(3, "arp-scan --localnet"));
    expect(sent.length).toBeGreaterThan(2);
    expect(sent.every((p) => p.packet.protocol === "arp" && p.packet.outcome === "success")).toBe(true);
    expect(sent.every((p) => p.discover?.[0].mac)).toBe(true);
  });

  it("only sees the local side of a routed network", () => {
    const sent = probesOf(run(6, "arp-scan --localnet"));
    expect(sent.map((p) => p.packet.dstId).sort()).toEqual(["alice", "bob", "router"]);
  });

  it("drops at the router when asked about a remote subnet", () => {
    const r = run(6, "arp-scan 10.0.1.0/24");
    expect(probesOf(r)).toEqual([expect.objectContaining({ packet: expect.objectContaining({ dstId: null, outcome: "unreachable" }) })]);
    expect(allText(r)).toContain("ARP only asks neighbors");
  });
});

describe("nmap", () => {
  it("checks the host, then knocks on each port with the right colors", () => {
    const r = run(4, "nmap -p 22,80 10.0.0.50");
    const [check, ...knocks] = probesOf(r);
    expect(check.packet.protocol).toBe("arp");
    expect(knocks.map((p) => [p.packet.dstPort, p.packet.outcome])).toEqual([
      [22, "rst"],
      [80, "success"],
    ]);
    expect(new Set(knocks.map((p) => p.packet.srcPort)).size).toBe(1);
    expect(knocks[1].discover?.[0].ports).toEqual([{ port: 80, protocol: "tcp", state: "open", service: "http" }]);
  });

  it("shows filtered ports as timeouts", () => {
    const knocks = probesOf(run(7, "nmap -p 22,80 10.0.1.10")).filter((p) => p.packet.protocol === "tcp");
    expect(knocks.find((p) => p.packet.dstPort === 22)?.packet.outcome).toBe("timeout");
  });

  it("records a host whose check came back up, even when no listed port is known", () => {
    const [check] = probesOf(run(4, "nmap -p 9999 10.0.0.50"));
    expect(check.discover?.[0]).toMatchObject({ ip: "10.0.0.50", kind: "server", mac: "aa:aa:aa:00:00:50" });
  });

  it("stops after the host check when nobody owns the IP", () => {
    const r = run(4, "nmap -p 80 10.0.0.51");
    expect(probesOf(r)).toHaveLength(1);
    expect(probesOf(r)[0].packet.outcome).toBe("unreachable");
    expect(allText(r)).toContain("Host seems down");
  });

  it("with -Pn knocks anyway and every knock gets lost", () => {
    const sent = probesOf(run(4, "nmap -Pn -p 22,80 10.0.0.51"));
    expect(sent.map((p) => p.packet.outcome)).toEqual(["unreachable", "unreachable"]);
  });

  it("with -Pn records nothing when every knock goes unanswered", () => {
    const sent = probesOf(run(7, "nmap -Pn -p 22 10.0.1.10"));
    expect(sent.map((p) => p.packet.outcome)).toEqual(["timeout"]);
    expect(sent[0].discover).toBeUndefined();
  });

  it("finds a ping-quiet host on the LAN through ARP", () => {
    const r = run(8, "nmap -p 80 10.0.0.77");
    expect(probesOf(r).at(-1)?.packet.outcome).toBe("success");
  });

  it("sweeps a range with -sn", () => {
    const r = run(6, "nmap -sn 10.0.1.0/24");
    expect(probesOf(r).map((p) => p.packet.dstIp)).toEqual(["10.0.1.1", "10.0.1.10", "10.0.1.20"]);
    expect(allText(r)).toContain("256 IP addresses (3 hosts up)");
  });
});

describe("help, clear and errors", () => {
  it("lists every tool and stars the ones this level features", () => {
    const text = allText(run(1, "help"));
    expect(text).toMatch(/ping .*★ this level/);
    expect(text).toMatch(/nmap /);
    expect(text).not.toMatch(/nmap .*★ this level/);
  });

  it("clears the screen", () => {
    expect(run(1, "clear").clearScreen).toBe(true);
  });

  it("prints a caret under parse errors", () => {
    const text = allText(run(1, "ping 10.0.0.300"));
    expect(text).toContain("error: 300 is too big.");
    expect(text).toContain("            ^^^");
  });
});
