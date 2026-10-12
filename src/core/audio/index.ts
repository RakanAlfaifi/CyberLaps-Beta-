import type { SfxName, SfxOptions } from "@/types/audio";
import { audioManager } from "./AudioManager";

export { audioManager };

const failedSfx = new Set<SfxName>();

/**
 * Plays a sound effect. Never throws: sound is decoration, so an audio failure
 * must not interrupt the click, keystroke or animation that triggered it.
 * Each failing effect is reported once.
 */
export function playSfx(name: SfxName, options?: SfxOptions): void {
  try {
    audioManager.play(name, options);
  } catch (error) {
    if (failedSfx.has(name)) return;
    failedSfx.add(name);
    console.warn(`[audio] Could not play "${name}".`, error);
  }
}
