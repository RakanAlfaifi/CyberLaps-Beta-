import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { playSfx } from "@/core/audio";
import { runCommandLine, type OutputLine, type Probe } from "@/core/commands";
import { evidenceOfProbe, getLevelDefinition, getPlayerDevice, verifiedFinds } from "@/core/levels";
import { COMMAND_NAMES } from "@/core/parser";
import { useLedgerStore } from "@/core/state/ledgerStore";
import { PLAYABLE_LEVEL_COUNT, useProgressStore } from "@/core/state/progressStore";
import type { LevelId } from "@/types/level";
import { useStageStore } from "@/core/state/stageStore";
import { paint, PROMPT, PROMPT_WIDTH, renderLine, TERMINAL_THEME } from "./ansi";

const HISTORY_LIMIT = 50;
const MAX_INPUT = 160;

/** Escape sequences xterm sends for editing keys. */
const KEYS: Record<string, string> = {
  "\x1b[A": "up",
  "\x1b[B": "down",
  "\x1b[C": "right",
  "\x1b[D": "left",
  "\x1b[H": "home",
  "\x1bOH": "home",
  "\x1b[1~": "home",
  "\x1b[F": "end",
  "\x1bOF": "end",
  "\x1b[4~": "end",
  "\x1b[3~": "delete",
};
const ESCAPE_SEQUENCE = /^\x1b(?:\[[0-9;]*[A-Za-z~]|O[A-Za-z])/;

interface Run {
  cancelled: boolean;
  cancel: () => void;
  levelId: LevelId;
  command?: string;
}

/**
 * The Smart CLI: a small line editor on top of xterm, plus a runner that plays a
 * command's steps. Probe steps emit packets to the stage and print each result
 * only when that packet's animation finishes, so text and picture stay in sync.
 */
export class TerminalSession {
  private readonly term: Terminal;
  private readonly fitAddon = new FitAddon();
  private buffer = "";
  private cursor = 0;
  /** Row of the cursor relative to the prompt's row, for redrawing wrapped input. */
  private cursorRow = 0;
  private history: string[] = [];
  private historyIndex: number | null = null;
  private draft = "";
  private running: Run | null = null;
  private locked = true;
  private disposed = false;
  private readonly unsubscribers: (() => void)[] = [];

  constructor(host: HTMLElement) {
    this.term = new Terminal({
      allowTransparency: true,
      cursorBlink: true,
      cursorStyle: "block",
      disableStdin: true,
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 13,
      lineHeight: 1.2,
      scrollback: 2000,
      theme: TERMINAL_THEME,
    });
    this.term.loadAddon(this.fitAddon);
    this.term.open(host);
    this.term.onData((data) => this.onData(data));
    this.term.attachCustomKeyEventHandler((e) => {
      // Ctrl+C copies when text is selected, like a desktop terminal.
      if (e.type === "keydown" && e.ctrlKey && e.key === "c" && this.term.hasSelection()) {
        void navigator.clipboard?.writeText(this.term.getSelection());
        this.term.clearSelection();
        return false;
      }
      return true;
    });

    // Glyph width is measured on open; measure again once the web font is in.
    void document.fonts?.ready.then(() => {
      if (this.disposed) return;
      this.term.options.fontFamily = '"JetBrains Mono", ui-monospace, monospace';
      this.fit();
    });
    this.fit();

    this.writeBanner();
    this.prompt();

    let levelId = useProgressStore.getState().currentLevelId;
    let restartCount = useProgressStore.getState().restartCount;
    this.unsubscribers.push(
      useProgressStore.subscribe((s) => {
        if (s.restartCount !== restartCount) {
          restartCount = s.restartCount;
          levelId = s.currentLevelId;
          this.restart();
          return;
        }
        if (s.currentLevelId === levelId) return;
        levelId = s.currentLevelId;
        this.onLevelChange();
      }),
    );
  }

  private writeBanner(): void {
    this.writeLines([
      [{ text: "CyberLaps Smart CLI", tone: "heading" }],
      [
        { text: "Type ", tone: "muted" },
        { text: "help", tone: "success" },
        { text: " to see every command. All tools work in every level. Click any moving packet to X-Ray it.", tone: "muted" },
      ],
      [],
    ]);
  }

  fit(): void {
    if (this.disposed) return;
    try {
      this.fitAddon.fit();
    } catch {
      // The host is hidden or has no size yet; the next resize will fit.
    }
  }

  setLocked(locked: boolean): void {
    this.locked = locked;
    this.term.options.disableStdin = locked;
    this.term.options.cursorBlink = !locked;
    if (!locked) this.term.focus();
  }

  dispose(): void {
    this.disposed = true;
    this.running?.cancel();
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.term.dispose();
  }

  // ── Input ────────────────────────────────────────────────────────────────

  private onData(data: string): void {
    if (this.running) {
      if (data.includes("\x03")) this.interrupt();
      return;
    }
    if (this.locked) return;

    let i = 0;
    let typed = "";
    const flushTyped = () => {
      if (typed) this.insert(typed);
      typed = "";
    };

    while (i < data.length && !this.running) {
      const rest = data.slice(i);
      const escape = rest.match(ESCAPE_SEQUENCE)?.[0];
      if (escape) {
        flushTyped();
        this.onKey(KEYS[escape]);
        i += escape.length;
        continue;
      }

      const ch = data[i++];
      if (ch === "\r" || ch === "\n") {
        flushTyped();
        this.submit();
      } else if (ch === "\x7f" || ch === "\b") {
        flushTyped();
        this.backspace();
      } else if (ch === "\x03") {
        flushTyped();
        this.interrupt();
      } else if (ch === "\x0c") {
        flushTyped();
        this.term.clear();
        this.cursorRow = 0;
        this.render();
      } else if (ch === "\t") {
        flushTyped();
        this.complete();
      } else if (ch >= " ") {
        typed += ch;
      }
    }
    flushTyped();
  }

  private onKey(key: string | undefined): void {
    switch (key) {
      case "left":
        this.moveCursor(this.cursor - 1);
        break;
      case "right":
        this.moveCursor(this.cursor + 1);
        break;
      case "home":
        this.moveCursor(0);
        break;
      case "end":
        this.moveCursor(this.buffer.length);
        break;
      case "delete":
        if (this.cursor < this.buffer.length) {
          this.buffer = this.buffer.slice(0, this.cursor) + this.buffer.slice(this.cursor + 1);
          this.render();
        }
        break;
      case "up":
        this.recall(-1);
        break;
      case "down":
        this.recall(1);
        break;
    }
  }

  private insert(text: string): void {
    const room = MAX_INPUT - this.buffer.length;
    if (room <= 0) return;
    const chunk = text.slice(0, room);
    this.buffer = this.buffer.slice(0, this.cursor) + chunk + this.buffer.slice(this.cursor);
    this.cursor += chunk.length;
    playSfx("keypress");
    this.render();
  }

  private backspace(): void {
    if (this.cursor === 0) return;
    this.buffer = this.buffer.slice(0, this.cursor - 1) + this.buffer.slice(this.cursor);
    this.cursor--;
    playSfx("keypress", { pitch: 0.8 });
    this.render();
  }

  private moveCursor(to: number): void {
    const next = Math.max(0, Math.min(this.buffer.length, to));
    if (next === this.cursor) return;
    this.cursor = next;
    this.render();
  }

  private recall(direction: -1 | 1): void {
    if (this.history.length === 0) return;
    if (this.historyIndex === null) {
      if (direction === 1) return;
      this.draft = this.buffer;
      this.historyIndex = this.history.length - 1;
    } else {
      const next = this.historyIndex + direction;
      if (next < 0) return;
      this.historyIndex = next >= this.history.length ? null : next;
    }
    this.buffer = this.historyIndex === null ? this.draft : this.history[this.historyIndex];
    this.cursor = this.buffer.length;
    this.render();
  }

  /** Completes the command name (first word) only. Flags are explained by --help. */
  private complete(): void {
    const before = this.buffer.slice(0, this.cursor);
    if (/\s/.test(before.trimStart())) return;
    const partial = before.trimStart().toLowerCase();
    const matches = COMMAND_NAMES.filter((name) => name.startsWith(partial));
    if (matches.length === 1) {
      const lead = before.length - before.trimStart().length;
      this.buffer = `${this.buffer.slice(0, lead)}${matches[0]} ${this.buffer.slice(this.cursor).trimStart()}`;
      this.cursor = lead + matches[0].length + 1;
      this.render();
    } else if (matches.length > 1 && partial) {
      this.printAbove([[{ text: matches.join("   "), tone: "muted" }]]);
    }
  }

  private interrupt(): void {
    if (this.running) {
      this.term.write(`${paint("^C", "90")}\r\n`);
      this.running.cancel();
      return;
    }
    this.moveCursor(this.buffer.length);
    this.term.write(`${paint("^C", "90")}\r\n`);
    this.buffer = "";
    this.cursor = 0;
    this.historyIndex = null;
    this.prompt();
  }

  private submit(): void {
    const source = this.buffer;
    this.moveCursor(source.length);
    this.term.write("\r\n");
    this.buffer = "";
    this.cursor = 0;
    this.cursorRow = 0;
    this.historyIndex = null;
    if (source.trim() && this.history.at(-1) !== source) {
      this.history = [...this.history, source].slice(-HISTORY_LIMIT);
    }
    if (source.trim()) playSfx("click");
    void this.execute(source);
  }

  // ── Output ───────────────────────────────────────────────────────────────

  private prompt(): void {
    this.cursorRow = 0;
    this.render();
  }

  /** Redraws prompt + input in place, coping with input that wraps onto several rows. */
  private render(): void {
    const cols = Math.max(1, this.term.cols);
    let out = this.cursorRow > 0 ? `\x1b[${this.cursorRow}A` : "";
    out += `\r\x1b[J${PROMPT}${this.buffer}`;

    const end = PROMPT_WIDTH + this.buffer.length;
    // Writing exactly to the last column leaves the cursor parked on that row until the next char.
    const endRow = end > 0 && end % cols === 0 ? end / cols - 1 : Math.floor(end / cols);
    if (this.cursor === this.buffer.length) {
      this.cursorRow = endRow;
    } else {
      const target = PROMPT_WIDTH + this.cursor;
      const row = Math.floor(target / cols);
      if (endRow > row) out += `\x1b[${endRow - row}A`;
      out += `\x1b[${(target % cols) + 1}G`;
      this.cursorRow = row;
    }
    this.term.write(out);
  }

  private writeLines(lines: OutputLine[]): void {
    if (lines.length === 0) return;
    this.term.write(lines.map((l) => `${renderLine(l)}\r\n`).join(""));
  }

  /** Prints while the user is at the prompt, then puts their half-typed input back. */
  private printAbove(lines: OutputLine[]): void {
    if (this.running) {
      this.writeLines(lines);
      return;
    }
    const up = this.cursorRow > 0 ? `\x1b[${this.cursorRow}A` : "";
    this.term.write(`${up}\r\x1b[J`);
    this.writeLines(lines);
    this.prompt();
  }

  private onLevelChange(): void {
    this.running?.cancel();
    const level = getLevelDefinition(useProgressStore.getState().currentLevelId);
    if (!level) return;
    this.printAbove([[], [{ text: `── Level ${level.id}: ${level.title} ──`, tone: "info" }]]);
  }

  /** Level restart: stop any scan, wipe the screen, scrollback and command history, start fresh. */
  private restart(): void {
    this.running?.cancel();
    this.running = null;
    this.buffer = "";
    this.cursor = 0;
    this.cursorRow = 0;
    this.history = [];
    this.historyIndex = null;
    this.draft = "";
    this.term.reset();
    this.writeBanner();
    const level = getLevelDefinition(useProgressStore.getState().currentLevelId);
    if (level) this.writeLines([[{ text: `── Level ${level.id}: ${level.title} (restarted) ──`, tone: "info" }]]);
    this.prompt();
  }

  // ── Running commands ─────────────────────────────────────────────────────

  private async execute(source: string): Promise<void> {
    const level = getLevelDefinition(useProgressStore.getState().currentLevelId);
    if (!level) {
      this.writeLines([[{ text: "The lab is still loading. Try again in a moment.", tone: "warning" }]]);
      this.prompt();
      return;
    }

    const run = runCommandLine(source, { level, player: getPlayerDevice(level) });
    if (run.clearScreen) this.term.clear();
    if (run.rejected) playSfx("reject");

    const progress = useProgressStore.getState();
    const wasComplete = progress.completedLevelIds.includes(level.id);
    if (run.command) progress.recordEvidence(level.id, { commands: [run.command] });

    const token: Run = { cancelled: false, cancel: () => (token.cancelled = true), levelId: level.id, command: run.command };
    this.running = token;
    for (const step of run.steps) {
      if (token.cancelled) break;
      if (step.kind === "print") this.writeLines(step.lines);
      else await this.playProbes(step.probes, token);
    }
    // Disposed, or a restart already took over the screen and printed its own prompt.
    if (this.disposed || this.running !== token) return;
    this.running = null;
    if (!wasComplete && useProgressStore.getState().completedLevelIds.includes(level.id)) this.announceComplete(level.id);
    this.prompt();
  }

  private announceComplete(levelId: LevelId): void {
    playSfx("levelComplete");
    const next =
      levelId < PLAYABLE_LEVEL_COUNT
        ? `Up next: Level ${levelId + 1}. Press "Next level" on the stage when you are ready.`
        : "You finished every Recon level. More domains are coming soon.";
    this.writeLines([[], [{ text: `✔ Level ${levelId} complete!`, tone: "success" }], [{ text: next, tone: "tip" }]]);
  }

  /** Emits the packets and resolves once each has settled on the stage (or the run is cancelled). */
  private playProbes(probes: Probe[], token: Run): Promise<void> {
    const stage = useStageStore.getState();
    if (!stage.ready) {
      for (const probe of probes) this.land(probe, token);
      return Promise.resolve();
    }

    const flows = stage.emitPackets(probes.map((p) => p.packet));
    const order = new Map(flows.map((f, i) => [f.id, i]));
    const pending = new Set(order.keys());

    return new Promise<void>((resolve) => {
      let unsubscribe = () => {};
      const finish = () => {
        unsubscribe();
        resolve();
      };
      const check = () => {
        const { settledAt, recentPackets } = useStageStore.getState();
        const landed = [...pending]
          .filter((id) => settledAt[id] !== undefined)
          .sort((a, b) => settledAt[a] - settledAt[b] || order.get(a)! - order.get(b)!);
        for (const id of landed) {
          pending.delete(id);
          this.land(probes[order.get(id)!], token);
        }
        if (pending.size === 0) return finish();

        // The map was rebuilt (level change): these packets will never land.
        const live = new Set(recentPackets.map((p) => p.id));
        if ([...pending].some((id) => !live.has(id))) {
          token.cancelled = true;
          finish();
        }
      };

      token.cancel = () => {
        token.cancelled = true;
        finish();
      };
      unsubscribe = useStageStore.subscribe(check);
      check();
    });
  }

  private land(probe: Probe, run: Run): void {
    this.writeLines(probe.output);
    if (!run.command) return;
    const upsert = useLedgerStore.getState().upsertAsset;
    for (const asset of verifiedFinds(run.command, probe)) upsert(asset);
    useProgressStore.getState().recordEvidence(run.levelId, evidenceOfProbe(run.command, probe));
  }
}
