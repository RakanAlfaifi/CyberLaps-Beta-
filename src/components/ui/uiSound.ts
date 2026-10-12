import type { SfxName } from "@/types/audio";

/** Plays a named UI sound effect. Supplied by the app shell; primitives never import the audio engine. */
export type UiSoundHandler = (name: SfxName) => void;

let handler: UiSoundHandler | null = null;
let warned = false;

/**
 * Connects UI primitives to a sound engine. Only one handler is active at a time.
 *
 * @param next The handler to use, or null to silence UI sounds.
 * @returns A cleanup function that disconnects `next` if it is still the active handler.
 */
export function setUiSoundHandler(next: UiSoundHandler | null): () => void {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}

/**
 * Plays a UI sound if a handler is connected. Never throws: an audio failure is
 * logged once and swallowed so it can't block the click that triggered it.
 */
export function playUiSound(name: SfxName): void {
  try {
    handler?.(name);
  } catch (error) {
    if (!warned) {
      warned = true;
      console.warn("[ui] Sound effect failed; continuing without it.", error);
    }
  }
}
