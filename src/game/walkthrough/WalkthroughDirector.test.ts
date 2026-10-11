import { describe, expect, it, vi } from "vitest";
import type { WalkthroughBeat } from "@/types/topology";
import { WalkthroughDirector, type Scheduler } from "./WalkthroughDirector";

/** Manual clock: `advance(ms)` fires whatever is due, in order. */
function fakeScheduler() {
  let now = 0;
  let timers: { at: number; fn: () => void; id: number }[] = [];
  let seq = 0;
  const scheduler: Scheduler = {
    after(ms, fn) {
      const id = ++seq;
      timers.push({ at: now + ms, fn, id });
      return () => {
        timers = timers.filter((t) => t.id !== id);
      };
    },
  };
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at || a.id - b.id);
      const next = timers[0];
      if (!next || next.at > end) break;
      timers.shift();
      now = next.at;
      next.fn();
    }
    now = end;
  };
  return { scheduler, advance, pending: () => timers.length };
}

const beats: WalkthroughBeat[] = [
  { delayMs: 100, text: "one", highlightDeviceId: "you" },
  { delayMs: 200, text: "two", packet: { src: "you", dst: "router", proto: "icmp", outcome: "success" } },
  { delayMs: 300, text: "three" },
];

function setup() {
  const clock = fakeScheduler();
  const output = { beat: vi.fn(), finished: vi.fn() };
  const director = new WalkthroughDirector(clock.scheduler, output);
  return { clock, output, director };
}

describe("WalkthroughDirector", () => {
  it("shows the first beat on its delay, then waits for the learner", () => {
    const { clock, output, director } = setup();
    director.start(beats);

    clock.advance(99);
    expect(output.beat).not.toHaveBeenCalled();
    clock.advance(1);
    expect(output.beat).toHaveBeenLastCalledWith(0, beats[0], true);

    clock.advance(60_000);
    expect(output.beat).toHaveBeenCalledOnce();
    expect(output.finished).not.toHaveBeenCalled();
    expect(clock.pending()).toBe(0);
  });

  it("advances one beat per next(), with its packet, and finishes after the last", () => {
    const { clock, output, director } = setup();
    director.start(beats);
    clock.advance(100);

    director.next();
    expect(output.beat).toHaveBeenLastCalledWith(1, beats[1], true);
    director.next();
    expect(output.beat).toHaveBeenLastCalledWith(2, beats[2], true);
    expect(director.current).toBe(2);
    expect(output.finished).not.toHaveBeenCalled();

    director.next();
    expect(output.finished).toHaveBeenCalledOnce();
    expect(director.isRunning).toBe(false);

    director.next();
    expect(output.beat).toHaveBeenCalledTimes(3);
    expect(output.finished).toHaveBeenCalledOnce();
  });

  it("next() before the first beat appears shows it right away", () => {
    const { clock, output, director } = setup();
    director.start(beats);
    director.next();
    expect(output.beat).toHaveBeenLastCalledWith(0, beats[0], true);
    clock.advance(10_000);
    expect(output.beat).toHaveBeenCalledOnce();
  });

  it("skips to the last beat without its packet and finishes once", () => {
    const { clock, output, director } = setup();
    director.start(beats);
    clock.advance(100);

    director.skipToEnd();
    expect(output.beat).toHaveBeenLastCalledWith(2, beats[2], false);
    expect(output.finished).toHaveBeenCalledOnce();
    expect(clock.pending()).toBe(0);

    director.skipToEnd();
    clock.advance(10_000);
    expect(output.finished).toHaveBeenCalledOnce();
  });

  it("restarts from the first beat", () => {
    const { clock, output, director } = setup();
    director.start(beats);
    clock.advance(100);
    director.next();
    director.start(beats);
    expect(director.current).toBe(-1);
    clock.advance(100);
    expect(output.beat).toHaveBeenLastCalledWith(0, beats[0], true);
  });

  it("finishes straight away when there are no beats", () => {
    const { clock, output, director } = setup();
    director.start([]);
    clock.advance(0);
    expect(output.finished).toHaveBeenCalledOnce();
  });

  it("stops without reporting completion", () => {
    const { clock, output, director } = setup();
    director.start(beats);
    director.stop();
    clock.advance(10_000);
    director.next();
    expect(output.beat).not.toHaveBeenCalled();
    expect(output.finished).not.toHaveBeenCalled();
  });
});
