import { getCommandSpec, hasFlag, parseCommand, type CommandAst, type Diagnostic } from "@/core/parser";
import { runArpScan } from "./arpScan";
import { commandHelp, runHelp } from "./help";
import { runNmap } from "./nmap";
import { runPing } from "./ping";
import { line, print, type CommandContext, type CommandRun, type OutputLine } from "./types";

export * from "./types";
export { isFeaturedCommand } from "./help";

/** Parses and runs one typed line. Never throws: mistakes come back as printable lines. */
export function runCommandLine(source: string, base: Omit<CommandContext, "source">): CommandRun {
  const parsed = parseCommand(source);
  if (parsed.kind === "empty") return { steps: [] };
  if (parsed.kind === "error") return { steps: [print(...diagnosticLines(parsed.error, source))], rejected: true };

  const { ast } = parsed;
  const ctx: CommandContext = { ...base, source: source.trim() };

  if (hasFlag(ast, "help")) return { steps: [print(...commandHelp(getCommandSpec(ast.name)!))] };

  return { ...dispatch(ast, ctx), command: ast.name };
}

function dispatch(ast: CommandAst, ctx: CommandContext): CommandRun {
  switch (ast.name) {
    case "ping":
      return runPing(ast, ctx);
    case "arp-scan":
      return runArpScan(ast, ctx);
    case "nmap":
      return runNmap(ast, ctx);
    case "help":
      return runHelp(ast, ctx);
    case "clear":
      return { steps: [], clearScreen: true };
  }
}

/** The message, the line again, and carets under the part that is wrong. */
export function diagnosticLines(error: Diagnostic, source: string): OutputLine[] {
  const lines: OutputLine[] = [line(`error: ${error.message}`, "error")];
  if (error.span) {
    const start = Math.min(error.span.start, source.length);
    const width = Math.max(1, Math.min(error.span.end, source.length + 1) - start);
    lines.push(line(`  ${source}`, "muted"), line(`  ${" ".repeat(start)}${"^".repeat(width)}`, "error"));
  }
  if (error.hint) lines.push(line(error.hint, "tip"));
  return lines;
}
