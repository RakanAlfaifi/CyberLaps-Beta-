import type { CommandAst, CommandName, Diagnostic, FlagNode } from "./ast";
import { findFlag, hasFlag } from "./ast";

export type ValueKind = "ports" | "count";

export interface FlagSpec {
  name: string;
  /** Every spelling accepted on the command line. The first one is shown in help. */
  forms: string[];
  value?: ValueKind;
  /** Placeholder shown in help, e.g. "<ports>". */
  valueLabel?: string;
  summary: string;
}

export type ArgSpec =
  | { kind: "none" }
  | { kind: "topic" }
  | { kind: "target"; min: number; max: number; allowCidr: boolean };

export interface CommandSpec {
  name: CommandName;
  summary: string;
  usage: string;
  examples: string[];
  flags: FlagSpec[];
  args: ArgSpec;
  /** Rules between flags and targets that the generic parser cannot express. */
  validate?: (ast: CommandAst) => Diagnostic | null;
  /** Real flags of the real tool that the lab does not simulate, with what they do. */
  realOnly?: Record<string, string>;
}

export const HELP_FLAG: FlagSpec = { name: "help", forms: ["-h", "--help"], summary: "Show how to use this command." };

/** Ping sends one echo per second for ever on Linux; the lab defaults to 4 like Windows. */
export const PING_DEFAULT_COUNT = 4;
export const PING_MAX_COUNT = 10;
/** More doors than this at once turns the stage into noise. */
export const MAX_SCAN_PORTS = 24;

function conflict(ast: CommandAst, a: string, b: string, hint: string): Diagnostic | null {
  const first = findFlag(ast, a);
  const second = findFlag(ast, b);
  if (!first || !second) return null;
  const later: FlagNode = first.span.start > second.span.start ? first : second;
  const earlier = later === first ? second : first;
  return { message: `${earlier.written} and ${later.written} cannot be used together.`, span: later.span, hint };
}

const COMMAND_SPECS: CommandSpec[] = [
  {
    name: "ping",
    summary: "Ask one device: are you online?",
    usage: "ping [-c <count>] <ip>",
    examples: ["ping 10.0.0.1", "ping -c 2 10.0.0.20"],
    flags: [
      {
        name: "count",
        forms: ["-c"],
        value: "count",
        valueLabel: "<count>",
        summary: `How many pings to send (1 to ${PING_MAX_COUNT}). Default ${PING_DEFAULT_COUNT}.`,
      },
    ],
    args: { kind: "target", min: 1, max: 1, allowCidr: false },
    realOnly: {
      "-i": "sets the wait between pings",
      "-t": "sets the TTL",
      "-W": "sets how long to wait for a reply",
      "-s": "sets the packet size",
    },
  },
  {
    name: "arp-scan",
    summary: "List the neighbors on your own LAN (IP + MAC).",
    usage: "arp-scan --localnet | arp-scan <ip or range>",
    examples: ["arp-scan --localnet", "arp-scan 10.0.0.0/24"],
    flags: [
      {
        name: "localnet",
        forms: ["--localnet", "-l", "--local"],
        summary: "Scan the whole LAN you are plugged into.",
      },
    ],
    args: { kind: "target", min: 0, max: 1, allowCidr: true },
    realOnly: { "-I": "picks the network card", "--interface": "picks the network card" },
    validate: (ast) => {
      const local = findFlag(ast, "localnet");
      const target = ast.args[0];
      if (local && target) {
        return {
          message: `${local.written} already means "my LAN", so the extra target is confusing.`,
          span: target.span,
          hint: "Use one: arp-scan --localnet  or  arp-scan 10.0.0.0/24",
        };
      }
      if (!local && !target) {
        return {
          message: "arp-scan needs to know where to look.",
          span: { start: ast.source.trimEnd().length, end: ast.source.trimEnd().length + 1 },
          hint: "Try: arp-scan --localnet",
        };
      }
      return null;
    },
  },
  {
    name: "nmap",
    summary: "Knock on a device's doors (ports) to see which are open.",
    usage: "nmap [-p <ports> | -F] [-Pn] <ip>   or   nmap -sn <ip or range>",
    examples: ["nmap -p 22,80 10.0.0.50", "nmap -F 10.0.1.10", "nmap -sn 10.0.0.0/24"],
    flags: [
      {
        name: "ports",
        forms: ["-p"],
        value: "ports",
        valueLabel: "<ports>",
        summary: "Which doors to knock on: 80  or  22,80,443  or  20-25  or  http.",
      },
      { name: "fast", forms: ["-F"], summary: "Fast scan: only a few common doors." },
      { name: "pingScan", forms: ["-sn"], summary: "Only check who is awake. No port knocking." },
      { name: "noPing", forms: ["-Pn"], summary: "Skip the 'are you awake?' check and knock anyway." },
      { name: "synScan", forms: ["-sS"], summary: "SYN scan: knock with a SYN packet. The lab always scans this way." },
    ],
    args: { kind: "target", min: 1, max: 1, allowCidr: true },
    realOnly: {
      "-sV": "asks each open door which program is behind it",
      "-sT": "makes full connections instead of SYN knocks",
      "-sU": "scans UDP doors",
      "-O": "guesses the operating system",
      "-A": "turns on many extra checks at once",
      "-v": "prints more detail",
      "-T4": "sets the speed",
      "-T3": "sets the speed",
    },
    validate: (ast) => {
      const clash =
        conflict(ast, "ports", "fast", "Pick one way to choose doors: -p 22,80  or  -F") ??
        conflict(ast, "pingScan", "ports", "-sn means 'no port scan'. Drop -sn to knock on doors.") ??
        conflict(ast, "pingScan", "fast", "-sn means 'no port scan'. Drop -sn to knock on doors.") ??
        conflict(ast, "pingScan", "noPing", "-sn checks who is awake. -Pn skips that check. Keep one.");
      if (clash) return clash;

      const target = ast.args[0];
      if (target?.kind === "cidr" && !hasFlag(ast, "pingScan")) {
        return {
          message: "In this lab, nmap knocks on doors of one device at a time.",
          span: target.span,
          hint: `Find who is awake first: nmap -sn ${target.cidr.network}/${target.cidr.prefix}`,
        };
      }
      return null;
    },
  },
  {
    name: "help",
    summary: "Show the commands you can use here.",
    usage: "help [command]",
    examples: ["help", "help nmap"],
    flags: [],
    args: { kind: "topic" },
  },
  {
    name: "clear",
    summary: "Clean the screen.",
    usage: "clear",
    examples: ["clear"],
    flags: [],
    args: { kind: "none" },
  },
];

const SPECS = new Map(COMMAND_SPECS.map((s) => [s.name, { ...s, flags: [...s.flags, HELP_FLAG] }]));

export function getCommandSpec(name: string): CommandSpec | undefined {
  return SPECS.get(name as CommandName);
}

export function listCommandSpecs(): CommandSpec[] {
  return [...SPECS.values()];
}

export const COMMAND_NAMES: readonly CommandName[] = COMMAND_SPECS.map((s) => s.name);
