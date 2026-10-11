import type { WalkthroughBeat } from "@/types/topology";

/** Runs `fn` after `ms` and returns a cancel function. The scene backs this with its own clock. */
export interface Scheduler {
  after(ms: number, fn: () => void): () => void;
}

export interface WalkthroughOutput {
  /** Show one beat. `withPacket` is false when the beat is reached by skipping. */
  beat(index: number, beat: WalkthroughBeat, withPacket: boolean): void;
  finished(): void;
}

/**
 * Plays a level's "Watch & Observe" beats one at a time. The first beat appears after
 * its own `delayMs` (so the map can settle); every later beat waits for the learner to
 * call `next()`. Calling `next()` on the last beat finishes the demo.
 */
export class WalkthroughDirector {
  private beats: readonly WalkthroughBeat[] = [];
  private shown = -1;
  private cancelPending: (() => void) | null = null;
  private running = false;

  constructor(
    private readonly scheduler: Scheduler,
    private readonly output: WalkthroughOutput,
  ) {}

  get isRunning(): boolean {
    return this.running;
  }

  /** Index of the beat on screen, -1 before the first one. */
  get current(): number {
    return this.shown;
  }

  start(beats: readonly WalkthroughBeat[]): void {
    this.stop();
    this.beats = beats;
    this.shown = -1;
    this.running = true;
    if (beats.length === 0) {
      this.cancelPending = this.scheduler.after(0, () => this.complete());
      return;
    }
    this.cancelPending = this.scheduler.after(beats[0].delayMs, () => {
      this.cancelPending = null;
      this.show(0, true);
    });
  }

  /** Learner pressed "Next step": show the following beat, or finish after the last one. */
  next(): void {
    if (!this.running) return;
    this.clearPending();
    const index = this.shown + 1;
    if (index < this.beats.length) this.show(index, true);
    else this.complete();
  }

  /** Jump to the final beat (its caption and highlight, not its packet) and finish. */
  skipToEnd(): void {
    if (!this.running) return;
    this.clearPending();
    const last = this.beats.length - 1;
    if (last >= 0 && this.shown < last) this.show(last, false);
    this.complete();
  }

  stop(): void {
    this.clearPending();
    this.running = false;
  }

  private show(index: number, withPacket: boolean): void {
    this.shown = index;
    this.output.beat(index, this.beats[index], withPacket);
  }

  private complete(): void {
    this.clearPending();
    if (!this.running) return;
    this.running = false;
    this.output.finished();
  }

  private clearPending(): void {
    this.cancelPending?.();
    this.cancelPending = null;
  }
}
