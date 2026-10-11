import type { LedgerAssetInput } from "@/types/ledger";
import type { PacketRequest } from "@/types/packet";
import type { LevelDefinition, NetworkDevice } from "@/types/topology";

export type Tone = "plain" | "muted" | "heading" | "info" | "success" | "warning" | "error" | "tip";

export interface Segment {
  text: string;
  tone?: Tone;
}

export type OutputLine = Segment[];

/** One packet on the stage, plus what to print and record once it lands. */
export interface Probe {
  packet: PacketRequest;
  output: OutputLine[];
  discover?: LedgerAssetInput[];
}

/** A run is played top to bottom; a probe step waits for all its packets before the next step. */
export type Step = { kind: "print"; lines: OutputLine[] } | { kind: "probes"; probes: Probe[] };

export interface CommandRun {
  steps: Step[];
  clearScreen?: boolean;
  /** Set only when the command really ran (not on --help or typos). */
  command?: string;
  /** The line was refused: a typo or a bad value. */
  rejected?: boolean;
}

export interface CommandContext {
  level: LevelDefinition;
  player: NetworkDevice;
  /** The line as typed, stamped on every packet so the X-Ray can show it. */
  source: string;
}

export const line = (text: string, tone: Tone = "plain"): OutputLine => [{ text, tone }];
export const blank: OutputLine = [];
export const print = (...lines: OutputLine[]): Step => ({ kind: "print", lines });
export const probes = (list: Probe[]): Step => ({ kind: "probes", probes: list });
