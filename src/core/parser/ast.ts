import type { Cidr } from "@/lib/ip";

/** Character range in the typed line, end exclusive. Used to underline mistakes. */
export interface Span {
  start: number;
  end: number;
}

export interface Token {
  /** Text with quotes removed. */
  text: string;
  span: Span;
}

export type CommandName = "ping" | "arp-scan" | "nmap" | "help" | "clear";

export type FlagValue = { kind: "ports"; ports: number[] } | { kind: "count"; value: number };

export interface FlagNode {
  /** Canonical name from the grammar, e.g. "ports" for `-p`. */
  name: string;
  /** What the user typed, e.g. "-p". */
  written: string;
  value?: FlagValue;
  span: Span;
}

export type ArgNode =
  | { kind: "ip"; ip: string; span: Span }
  | { kind: "cidr"; cidr: Cidr; span: Span }
  | { kind: "topic"; word: string; span: Span };

export interface CommandAst {
  name: CommandName;
  flags: FlagNode[];
  args: ArgNode[];
  source: string;
}

export interface Diagnostic {
  message: string;
  span?: Span;
  hint?: string;
}

export type ParseResult =
  | { kind: "empty" }
  | { kind: "command"; ast: CommandAst }
  | { kind: "error"; error: Diagnostic; source: string };

export function findFlag(ast: CommandAst, name: string): FlagNode | undefined {
  return ast.flags.find((f) => f.name === name);
}

export function hasFlag(ast: CommandAst, name: string): boolean {
  return findFlag(ast, name) !== undefined;
}

export function countValue(ast: CommandAst, name: string): number | undefined {
  const value = findFlag(ast, name)?.value;
  return value?.kind === "count" ? value.value : undefined;
}

export function portsValue(ast: CommandAst, name: string): number[] | undefined {
  const value = findFlag(ast, name)?.value;
  return value?.kind === "ports" ? value.ports : undefined;
}
