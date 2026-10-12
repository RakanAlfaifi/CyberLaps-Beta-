import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AUDIO_SETTINGS } from "@/core/state/audioStore";
import { AudioManager } from "./AudioManager";
import { audioManager, playSfx } from "./index";

const { pad, recipes } = vi.hoisted(() => ({
  pad: { start: vi.fn(), stop: vi.fn() },
  recipes: {
    click: { minIntervalMs: 50, play: vi.fn() },
    packet: { minIntervalMs: 0, play: vi.fn() },
  },
}));

vi.mock("howler", () => ({ Howl: vi.fn() }));
vi.mock("./ambientPad", () => ({ createAmbientPad: () => pad }));
vi.mock("./sfxRecipes", () => ({ SFX_RECIPES: recipes }));

const param = () => ({
  value: 0,
  cancelScheduledValues: vi.fn(),
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
});

/** Just enough of the Web Audio API for AudioManager to build its graph. */
class FakeAudioContext {
  static initialState: AudioContextState = "running";
  static instances = 0;
  static last: FakeAudioContext | null = null;

  state: AudioContextState = FakeAudioContext.initialState;
  currentTime = 0;
  sampleRate = 8;
  destination = {};
  resume = vi.fn(() => {
    this.state = "running";
    return Promise.resolve();
  });
  suspend = vi.fn(() => Promise.resolve());

  constructor() {
    FakeAudioContext.instances++;
    FakeAudioContext.last = this;
  }

  createDynamicsCompressor() {
    return { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), connect: vi.fn() };
  }
  createGain() {
    return { gain: param(), connect: vi.fn() };
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
}

const clock = (ms: number) => vi.spyOn(performance, "now").mockReturnValue(ms);
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("AudioManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeAudioContext.initialState = "running";
    FakeAudioContext.instances = 0;
    FakeAudioContext.last = null;
    vi.stubGlobal("window", { AudioContext: FakeAudioContext });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("stays silent until a user gesture unlocks it", () => {
    new AudioManager().play("click");
    expect(recipes.click.play).not.toHaveBeenCalled();
    expect(FakeAudioContext.instances).toBe(0);
  });

  it("plays a recipe with default pitch and gain, or the caller's overrides", () => {
    const manager = new AudioManager();
    manager.unlock();

    manager.play("packet");
    manager.play("packet", { pitch: 2, volume: 0.5 });

    expect(recipes.packet.play).toHaveBeenNthCalledWith(1, expect.objectContaining({ pitch: 1, gain: 1 }));
    expect(recipes.packet.play).toHaveBeenNthCalledWith(2, expect.objectContaining({ pitch: 2, gain: 0.5 }));
  });

  it("drops repeats that arrive inside a recipe's minimum interval", () => {
    const manager = new AudioManager();
    manager.unlock();

    clock(1_000);
    manager.play("click");
    clock(1_020);
    manager.play("click");
    expect(recipes.click.play).toHaveBeenCalledTimes(1);

    clock(1_060);
    manager.play("click");
    expect(recipes.click.play).toHaveBeenCalledTimes(2);
  });

  it("skips effects entirely while muted", () => {
    const manager = new AudioManager();
    manager.unlock();
    manager.applySettings({ ...DEFAULT_AUDIO_SETTINGS, muted: true });

    manager.play("packet");
    expect(recipes.packet.play).not.toHaveBeenCalled();
  });

  it("does nothing when the browser has no Web Audio support", () => {
    vi.stubGlobal("window", {});
    const manager = new AudioManager();

    expect(() => manager.unlock()).not.toThrow();
    manager.play("packet");
    expect(recipes.packet.play).not.toHaveBeenCalled();
  });

  it("survives a context that fails to start, without retrying on every gesture", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const Broken = vi.fn(() => {
      throw new Error("too many AudioContexts");
    });
    vi.stubGlobal("window", { AudioContext: Broken });
    const manager = new AudioManager();

    expect(() => manager.unlock()).not.toThrow();
    manager.unlock();
    manager.play("packet");

    expect(Broken).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledOnce();
    expect(recipes.packet.play).not.toHaveBeenCalled();
  });

  it("starts the ambient pad on unlock and stops it when music is turned off", () => {
    const manager = new AudioManager();
    manager.unlock();
    expect(pad.start).toHaveBeenCalledTimes(1);

    manager.applySettings({ ...DEFAULT_AUDIO_SETTINGS, musicEnabled: false });
    expect(pad.stop).toHaveBeenCalledTimes(1);

    manager.unlock();
    expect(pad.start).toHaveBeenCalledTimes(1);
  });

  it("resumes a suspended context before starting music", async () => {
    FakeAudioContext.initialState = "suspended";
    const manager = new AudioManager();
    manager.unlock();
    expect(pad.start).not.toHaveBeenCalled();

    await flushPromises();
    expect(pad.start).toHaveBeenCalledTimes(1);
  });

  it("suspends while backgrounded and resumes only once unlocked", () => {
    const manager = new AudioManager();
    manager.setBackgrounded(true);
    expect(FakeAudioContext.instances).toBe(0);

    manager.unlock();
    const ctx = FakeAudioContext.last!;
    manager.setBackgrounded(true);
    expect(ctx.suspend).toHaveBeenCalledOnce();

    manager.setBackgrounded(false);
    expect(ctx.resume).toHaveBeenCalledOnce();
  });
});

describe("playSfx", () => {
  afterEach(() => vi.restoreAllMocks());

  it("never lets an audio error escape to the caller, and reports it once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(audioManager, "play").mockImplementation(() => {
      throw new Error("InvalidStateError");
    });

    expect(() => playSfx("rst")).not.toThrow();
    expect(() => playSfx("rst")).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
  });
});
