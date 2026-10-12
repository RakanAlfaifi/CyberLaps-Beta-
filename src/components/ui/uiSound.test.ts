import { afterEach, describe, expect, it, vi } from "vitest";
import { playUiSound, setUiSoundHandler } from "./uiSound";

describe("ui sound hook", () => {
  afterEach(() => {
    setUiSoundHandler(null);
    vi.restoreAllMocks();
  });

  it("is a silent no-op when no handler is connected", () => {
    expect(() => playUiSound("click")).not.toThrow();
  });

  it("forwards sounds to the connected handler", () => {
    const handler = vi.fn();
    setUiSoundHandler(handler);
    playUiSound("modalOpen");
    expect(handler).toHaveBeenCalledWith("modalOpen");
  });

  it("swallows handler errors so the click still goes through", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    setUiSoundHandler(() => {
      throw new Error("AudioContext closed");
    });

    expect(() => playUiSound("click")).not.toThrow();
    expect(() => playUiSound("click")).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
  });

  it("cleanup only disconnects the handler it registered", () => {
    const first = vi.fn();
    const second = vi.fn();
    const disconnectFirst = setUiSoundHandler(first);
    setUiSoundHandler(second);

    disconnectFirst();
    playUiSound("click");

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });
});
