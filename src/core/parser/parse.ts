import { portForService } from "@/core/network/services";
import { toCidr } from "@/lib/ip";
import { closestMatch } from "@/lib/text";
import type { ArgNode, CommandAst, Diagnostic, FlagNode, FlagValue, ParseResult, Span, Token } from "./ast";
import {
  COMMAND_NAMES,
  getCommandSpec,
  MAX_SCAN_PORTS,
  PING_MAX_COUNT,
  type CommandSpec,
  type FlagSpec,
  type ValueKind,
} from "./grammar";
import { tokenize } from "./tokenize";

/** Thrown inside the parser and turned into a ParseResult at the top. Never escapes this module. */
class ParseFailure extends Error {
  constructor(readonly diagnostic: Diagnostic) {
    super(diagnostic.message);
  }
}

const fail = (message: string, span?: Span, hint?: string): never => {
  throw new ParseFailure({ message, span, hint });
};

const sub = (span: Span, from: number, length: number): Span => ({
  start: span.start + from,
  end: span.start + from + length,
});

/** Commands people try out of habit, with a nudge toward what the lab offers. */
const FAMILIAR_COMMANDS: Record<string, string> = {
  sudo: "No sudo needed here. Type the command on its own, like: nmap -p 80 10.0.0.50",
  ls: "There are no files in the lab. Try: help",
  cd: "There are no folders in the lab. Try: help",
  ipconfig: "Your IP is shown under 'Your PC' on the map.",
  ifconfig: "Your IP is shown under 'Your PC' on the map.",
  arp: "Use arp-scan to list your neighbors: arp-scan --localnet",
  traceroute: "Ping shows the path on the map: watch which devices the packet passes.",
};

export function parseCommand(source: string): ParseResult {
  try {
    const tokenized = tokenize(source);
    if (!tokenized.ok) throw new ParseFailure(tokenized.error);
    const [head, ...rest] = tokenized.tokens;
    if (!head) return { kind: "empty" };
    return { kind: "command", ast: parseTokens(source, head, rest) };
  } catch (error) {
    if (error instanceof ParseFailure) return { kind: "error", error: error.diagnostic, source };
    throw error;
  }
}

function parseTokens(source: string, head: Token, rest: Token[]): CommandAst {
  const spec = getCommandSpec(head.text.toLowerCase()) ?? unknownCommand(head);
  const flags: FlagNode[] = [];
  const args: ArgNode[] = [];

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (isFlagLike(token.text)) {
      const { node, consumedNext } = parseFlag(spec, token, rest[i + 1]);
      if (consumedNext) i++;
      const existing = flags.findIndex((f) => f.name === node.name);
      if (existing >= 0) flags.splice(existing, 1);
      flags.push(node);
    } else {
      args.push(parseArg(spec, token, args.length));
    }
  }

  const ast: CommandAst = { name: spec.name, flags, args, source };
  if (flags.some((f) => f.name === "help")) return ast;

  if (spec.args.kind === "target" && args.length < spec.args.min) {
    const end = source.trimEnd().length;
    fail(`${spec.name} needs an IP address to talk to.`, { start: end, end: end + 1 }, `Example: ${spec.examples[0]}`);
  }

  const problem = spec.validate?.(ast);
  if (problem) throw new ParseFailure(problem);
  return ast;
}

function unknownCommand(head: Token): never {
  const typed = head.text.toLowerCase();
  const familiar = FAMILIAR_COMMANDS[typed];
  if (familiar) return fail(`"${head.text}" is not part of this lab.`, head.span, familiar);
  const guess = closestMatch(typed, COMMAND_NAMES);
  return fail(
    `Command not found: ${head.text}`,
    head.span,
    guess ? `Did you mean ${guess}?` : `Commands here: ${COMMAND_NAMES.join(", ")}`,
  );
}

/** "-5" style negatives never reach a flag position in this grammar, so any leading dash is a flag. */
function isFlagLike(text: string): boolean {
  return text.length > 1 && text.startsWith("-");
}

function parseFlag(
  spec: CommandSpec,
  token: Token,
  next: Token | undefined,
): { node: FlagNode; consumedNext: boolean } {
  const { text, span } = token;

  // --name=value
  const eq = text.startsWith("--") ? text.indexOf("=") : -1;
  if (eq > 0) {
    const flag = matchFlag(spec, text.slice(0, eq)) ?? unknownFlag(spec, token, text.slice(0, eq));
    if (!flag.value) fail(`${flag.forms[0]} does not take a value.`, sub(span, eq, text.length - eq));
    const valueSpan = sub(span, eq + 1, text.length - eq - 1);
    return {
      node: makeFlag(flag, text.slice(0, eq), parseValue(flag, text.slice(eq + 1), valueSpan), span),
      consumedNext: false,
    };
  }

  const exact = matchFlag(spec, text);
  if (exact) {
    if (!exact.value) return { node: makeFlag(exact, text, undefined, span), consumedNext: false };
    if (!next || isFlagLike(next.text)) {
      fail(
        `${text} needs a value right after it.`,
        { start: span.end, end: span.end + 1 },
        exact.value === "ports" ? `Example: ${text} 22,80` : `Example: ${text} 2`,
      );
    }
    const value = parseValue(exact, next!.text, next!.span);
    return { node: makeFlag(exact, text, value, { start: span.start, end: next!.span.end }), consumedNext: true };
  }

  // Glued value: -p80, -c3, and nmap's -p- ("every port"). Letters after the flag are a typo, not a value.
  const gluedForm = (f: FlagSpec) =>
    f.forms.find((form) => !form.startsWith("--") && text.startsWith(form) && /^[\d-]/.test(text.slice(form.length)));
  const glued = spec.flags.find((f) => f.value && gluedForm(f));
  if (glued) {
    const form = gluedForm(glued)!;
    const value = parseValue(glued, text.slice(form.length), sub(span, form.length, text.length - form.length));
    return { node: makeFlag(glued, form, value, span), consumedNext: false };
  }

  return unknownFlag(spec, token, text);
}

function matchFlag(spec: CommandSpec, written: string): FlagSpec | undefined {
  return spec.flags.find((f) => f.forms.includes(written));
}

function unknownFlag(spec: CommandSpec, token: Token, written: string): never {
  const realOnly = spec.realOnly?.[written];
  if (realOnly) {
    return fail(
      `${written} is a real ${spec.name} flag (it ${realOnly}), but the lab does not use it.`,
      { start: token.span.start, end: token.span.start + written.length },
      `Remove it, or see what works here: ${spec.name} --help`,
    );
  }
  const forms = spec.flags.flatMap((f) => f.forms);
  const sameLetters = forms.find((f) => f.toLowerCase() === written.toLowerCase());
  const guess = sameLetters ?? closestMatch(written, forms, written.length <= 3 ? 1 : 2);
  const span = { start: token.span.start, end: token.span.start + written.length };
  if (sameLetters) {
    return fail(`${spec.name} does not know ${written}.`, span, `Flags care about capital letters. Did you mean ${guess}?`);
  }
  return fail(
    `${spec.name} does not know the flag ${written}.`,
    span,
    guess ? `Did you mean ${guess}?` : `See the flags with: ${spec.name} --help`,
  );
}

function makeFlag(flag: FlagSpec, written: string, value: FlagValue | undefined, span: Span): FlagNode {
  return value ? { name: flag.name, written, value, span } : { name: flag.name, written, span };
}

function parseValue(flag: FlagSpec, text: string, span: Span): FlagValue {
  const kind: ValueKind = flag.value!;
  return kind === "ports" ? { kind, ports: parsePorts(text, span) } : { kind, value: parseCount(text, span) };
}

function parseCount(text: string, span: Span): number {
  if (!/^\d+$/.test(text)) fail(`"${text}" is not a whole number.`, span, "Example: -c 3");
  const value = Number(text);
  if (value < 1 || value > PING_MAX_COUNT) {
    fail(`Pick a count from 1 to ${PING_MAX_COUNT}.`, span, "Each ping is one packet on the map. A few is plenty.");
  }
  return value;
}

function parsePorts(text: string, span: Span): number[] {
  if (text === "" || text === "-") {
    fail(
      text === "-" ? "-p- means all 65,535 ports. That is too many to watch." : "-p needs at least one port.",
      span,
      "List a few doors, like -p 22,80,443",
    );
  }

  const ports: number[] = [];
  let offset = 0;
  for (const item of text.split(",")) {
    const itemSpan = sub(span, offset, Math.max(item.length, 1));
    offset += item.length + 1;
    if (item === "") fail("There is an extra comma here.", itemSpan, "Separate ports with one comma: 22,80");
    ports.push(...parsePortItem(item, itemSpan));
  }

  const unique = [...new Set(ports)];
  if (unique.length > MAX_SCAN_PORTS) {
    fail(`That is ${unique.length} ports. The lab scans up to ${MAX_SCAN_PORTS} at once.`, span, "Pick the doors you care about most.");
  }
  return unique;
}

function parsePortItem(item: string, span: Span): number[] {
  const range = item.match(/^(\d+)-(\d+)$/);
  if (range) {
    const [low, high] = [checkPort(range[1], span), checkPort(range[2], span)];
    if (low > high) fail(`The range ${item} goes backwards.`, span, `Write the small number first: ${high}-${low}`);
    if (high - low + 1 > MAX_SCAN_PORTS) {
      fail(`${item} is ${high - low + 1} ports. The lab scans up to ${MAX_SCAN_PORTS} at once.`, span);
    }
    return Array.from({ length: high - low + 1 }, (_, i) => low + i);
  }
  if (/^\d+$/.test(item)) return [checkPort(item, span)];

  const byName = portForService(item);
  if (byName !== undefined) return [byName];
  return fail(`"${item}" is not a port number.`, span, "Ports are numbers like 22 or 80. Names like http also work.");
}

function checkPort(text: string, span: Span): number {
  const port = Number(text);
  if (port < 1 || port > 65535) fail(`Port ${text} does not exist.`, span, "Ports go from 1 to 65535.");
  return port;
}

function parseArg(spec: CommandSpec, token: Token, index: number): ArgNode {
  const { args } = spec;
  if (args.kind === "none") {
    return fail(`${spec.name} does not take anything after it.`, token.span, `Just type: ${spec.name}`);
  }
  if (args.kind === "topic") {
    if (index > 0) fail("Ask about one command at a time.", token.span, "Example: help nmap");
    return { kind: "topic", word: token.text.toLowerCase(), span: token.span };
  }
  if (index >= args.max) {
    fail(`${spec.name} talks to one target at a time.`, token.span, "Run the command again for the next target.");
  }
  return parseTarget(token, args.allowCidr, spec.name);
}

function parseTarget(token: Token, allowCidr: boolean, command: string): ArgNode {
  const { text, span } = token;
  const slash = text.indexOf("/");
  if (slash === -1) return { kind: "ip", ip: parseIp(text, span), span };

  if (!allowCidr) {
    fail(`${command} talks to one device, not a whole range.`, sub(span, slash, text.length - slash), "Drop the /24 part. Example: ping 10.0.0.1");
  }
  const ip = parseIp(text.slice(0, slash), sub(span, 0, slash));
  const bits = text.slice(slash + 1);
  const bitsSpan = sub(span, slash + 1, Math.max(bits.length, 1));
  if (!/^\d{1,2}$/.test(bits) || Number(bits) > 32) {
    fail(`/${bits} is not a range size.`, bitsSpan, "Use a number from 0 to 32. /24 means 'the 256 addresses that share the first three numbers'.");
  }
  return { kind: "cidr", cidr: toCidr(ip, Number(bits)), span };
}

/** Validates a dotted IPv4 address and points at the exact part that is wrong. */
function parseIp(text: string, span: Span): string {
  const dots = text.split(".").length - 1;
  if (!/\d/.test(text) || (/[a-z]/i.test(text) && dots !== 3)) {
    fail(
      `"${text}" is not an IP address.`,
      span,
      "There is no name lookup in the lab. Use the number address shown on the map, like 10.0.0.1",
    );
  }

  const parts = text.split(".");
  if (parts.length !== 4) {
    fail(`An IP has 4 numbers split by dots. This one has ${parts.length}.`, span, "Example: 10.0.0.1");
  }

  let offset = 0;
  for (const part of parts) {
    const partSpan = sub(span, offset, Math.max(part.length, 1));
    offset += part.length + 1;
    if (part === "") fail("Part of this IP is missing.", partSpan, "Each of the 4 parts needs a number: 10.0.0.1");
    if (!/^\d+$/.test(part)) {
      const lookalike = /[lIoO]/.test(part) ? " Check for a letter l or O where a 1 or 0 should be." : "";
      fail(`"${part}" is not a number.${lookalike}`, partSpan, "IP parts are numbers from 0 to 255.");
    }
    if (Number(part) > 255) fail(`${part} is too big.`, partSpan, "Each part of an IP goes from 0 to 255.");
  }
  return parts.map(Number).join(".");
}
