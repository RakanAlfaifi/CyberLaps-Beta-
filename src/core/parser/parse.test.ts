import { describe, expect, it } from "vitest";
import type { CommandAst, ParseResult } from "./ast";
import { parseCommand } from "./parse";

function ok(source: string): CommandAst {
  const result = parseCommand(source);
  if (result.kind !== "command") throw new Error(`expected a command, got ${JSON.stringify(result)}`);
  return result.ast;
}

function err(source: string) {
  const result: ParseResult = parseCommand(source);
  if (result.kind !== "error") throw new Error(`expected an error, got ${JSON.stringify(result)}`);
  const { span } = result.error;
  return { ...result.error, marked: span ? source.slice(span.start, span.end) : undefined };
}

describe("parseCommand: structure", () => {
  it("treats blank input as empty", () => {
    expect(parseCommand("   ").kind).toBe("empty");
  });

  it("parses ping with a count", () => {
    const ast = ok("ping -c 2 10.0.0.1");
    expect(ast.name).toBe("ping");
    expect(ast.flags).toEqual([expect.objectContaining({ name: "count", value: { kind: "count", value: 2 } })]);
    expect(ast.args).toEqual([expect.objectContaining({ kind: "ip", ip: "10.0.0.1" })]);
  });

  it("accepts flags after the target and glued values", () => {
    const ast = ok("nmap 10.0.0.50 -p22,80");
    expect(ast.flags[0]).toMatchObject({ name: "ports", value: { ports: [22, 80] } });
    expect(ast.args[0]).toMatchObject({ ip: "10.0.0.50" });
  });

  it("expands ranges and service names, dropping duplicates", () => {
    expect(ok("nmap -p 20-23,http,22 10.0.0.5").flags[0].value).toEqual({ kind: "ports", ports: [20, 21, 22, 23, 80] });
  });

  it("supports --name=value", () => {
    expect(ok("nmap --help").flags[0].name).toBe("help");
    expect(ok("arp-scan --localnet").flags[0].name).toBe("localnet");
    expect(ok("arp-scan --local").flags[0].name).toBe("localnet");
  });

  it("parses CIDR targets and normalizes host bits", () => {
    expect(ok("nmap -sn 10.0.0.77/24").args[0]).toMatchObject({ kind: "cidr", cidr: { network: "10.0.0.0", prefix: 24 } });
  });

  it("is case-insensitive for the command name only", () => {
    expect(ok("PING 10.0.0.1").name).toBe("ping");
    expect(err("nmap -pn 10.0.0.1").hint).toContain("-Pn");
  });

  it("lets --help skip the missing-target check", () => {
    expect(ok("ping --help").flags[0].name).toBe("help");
  });
});

describe("parseCommand: diagnostics point at the mistake", () => {
  it("suggests the nearest command", () => {
    expect(err("nmpa 10.0.0.1")).toMatchObject({ marked: "nmpa", hint: "Did you mean nmap?" });
  });

  it("explains habits from real shells", () => {
    expect(err("sudo nmap 10.0.0.1").hint).toContain("No sudo");
  });

  it("marks the octet that is too big", () => {
    expect(err("ping 10.0.0.300")).toMatchObject({ marked: "300", message: "300 is too big." });
  });

  it("spots a letter l typed for a 1", () => {
    expect(err("ping 10.0.0.l").message).toContain("letter l");
  });

  it("rejects names because the lab has no DNS", () => {
    expect(err("ping alice")).toMatchObject({ marked: "alice" });
  });

  it("marks the bad port inside a list", () => {
    expect(err("nmap -p 22,8o 10.0.0.5")).toMatchObject({ marked: "8o" });
  });

  it("refuses -p- and oversized ranges", () => {
    expect(err("nmap -p- 10.0.0.5").message).toContain("65,535");
    expect(err("nmap -p 1-1000 10.0.0.5").message).toContain("1000 ports");
  });

  it("requires a value after -p", () => {
    expect(err("nmap -p 10.0.0.5").message).not.toBe("");
    expect(err("nmap 10.0.0.5 -p").message).toContain("needs a value");
  });

  it("requires a target", () => {
    expect(err("ping").message).toContain("needs an IP");
  });

  it("allows only one target", () => {
    expect(err("ping 10.0.0.1 10.0.0.2")).toMatchObject({ marked: "10.0.0.2" });
  });

  it("does not let ping take a range", () => {
    expect(err("ping 10.0.0.0/24")).toMatchObject({ marked: "/24" });
  });

  it("enforces nmap flag conflicts and one-host port scans", () => {
    expect(err("nmap -sn -p 80 10.0.0.1").message).toContain("cannot be used together");
    expect(err("nmap -p 80 10.0.0.0/24").hint).toContain("nmap -sn 10.0.0.0/24");
  });

  it("needs --localnet or a target for arp-scan", () => {
    expect(err("arp-scan").hint).toContain("--localnet");
    expect(err("arp-scan -l 10.0.0.0/24")).toMatchObject({ marked: "10.0.0.0/24" });
  });

  it("rejects pipes and unclosed quotes", () => {
    expect(err("ping 10.0.0.1 | grep ttl")).toMatchObject({ marked: "|" });
    expect(err('ping "10.0.0.1').message).toContain("never closed");
  });

  it("recognizes real flags the lab does not simulate", () => {
    expect(err("nmap -sV 10.0.0.5")).toMatchObject({ marked: "-sV" });
    expect(err("nmap -sV 10.0.0.5").message).toContain("real nmap flag");
    expect(ok("nmap -sS -p 80 10.0.0.5").flags[0].name).toBe("synScan");
  });

  it("names unknown flags and suggests close ones", () => {
    expect(err("ping -x 10.0.0.1")).toMatchObject({ marked: "-x" });
    expect(err("arp-scan --localnte").hint).toBe("Did you mean --localnet?");
  });
});
