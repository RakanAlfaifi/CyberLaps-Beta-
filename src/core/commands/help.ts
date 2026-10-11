import { COMMAND_NAMES, getCommandSpec, listCommandSpecs, type CommandAst, type CommandSpec } from "@/core/parser";
import { closestMatch } from "@/lib/text";
import type { LevelDefinition } from "@/types/topology";
import { blank, line, print, type CommandContext, type CommandRun, type OutputLine } from "./types";

export function isFeaturedCommand(name: string, level: LevelDefinition): boolean {
  return level.featuredCommands.includes(name);
}

export function commandHelp(spec: CommandSpec): OutputLine[] {
  const lines: OutputLine[] = [
    [
      { text: spec.name, tone: "heading" },
      { text: ` - ${spec.summary}` },
    ],
    line(`Usage: ${spec.usage}`, "info"),
  ];

  const flags = spec.flags
    .filter((f) => f.name !== "help")
    .map((f) => ({ written: `${f.forms.join(", ")}${f.valueLabel ? ` ${f.valueLabel}` : ""}`, summary: f.summary }));
  if (flags.length > 0) {
    const width = Math.max(...flags.map((f) => f.written.length)) + 2;
    lines.push(blank, line("Flags:", "muted"));
    for (const flag of flags) lines.push([{ text: `  ${flag.written.padEnd(width)}`, tone: "info" }, { text: flag.summary }]);
  }

  lines.push(blank, line("Examples:", "muted"), ...spec.examples.map((ex) => line(`  ${ex}`, "success")));
  return lines;
}

export function runHelp(ast: CommandAst, ctx: CommandContext): CommandRun {
  const topic = ast.args[0]?.kind === "topic" ? ast.args[0].word : undefined;
  if (topic) {
    const spec = getCommandSpec(topic);
    if (spec) return { steps: [print(...commandHelp(spec))] };
    const guess = closestMatch(topic, COMMAND_NAMES);
    return {
      steps: [print(line(`There is no help page for "${topic}".`, "error"), line(guess ? `Did you mean help ${guess}?` : "Type help to see every command.", "tip"))],
    };
  }

  const lines: OutputLine[] = [line("Commands (every tool works in every level):", "heading")];
  for (const spec of listCommandSpecs()) {
    const featured = isFeaturedCommand(spec.name, ctx.level) && spec.name !== "help" && spec.name !== "clear";
    lines.push([
      { text: `  ${spec.name.padEnd(10)}`, tone: "success" },
      { text: spec.summary },
      ...(featured ? [{ text: "  ★ this level", tone: "info" as const }] : []),
    ]);
  }
  lines.push(
    blank,
    line("Type help <command> or <command> --help to see its flags.", "tip"),
    line("Arrow Up brings back your last command. Tab finishes a command name. Ctrl+C stops a scan.", "tip"),
  );
  return { steps: [print(...lines)] };
}
