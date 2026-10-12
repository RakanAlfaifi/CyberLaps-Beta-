import { useEffect, type ReactNode } from "react";
import { setUiSoundHandler } from "@/components/ui/uiSound";
import { audioManager, playSfx } from "@/core/audio";
import { useAudioStore } from "@/core/state/audioStore";

/**
 * Keeps the AudioManager in sync with saved settings and the browser's audio rules,
 * and connects UI primitives (buttons, toggles) to it for click sounds.
 */
export function AudioProvider({ children }: { children: ReactNode }) {
  useEffect(() => setUiSoundHandler((name) => playSfx(name)), []);

  useEffect(() => {
    audioManager.applySettings(useAudioStore.getState());
    return useAudioStore.subscribe((state) => audioManager.applySettings(state));
  }, []);

  useEffect(() => {
    const unlock = () => audioManager.unlock();
    const options = { capture: true } as const;
    window.addEventListener("pointerdown", unlock, options);
    window.addEventListener("keydown", unlock, options);
    return () => {
      window.removeEventListener("pointerdown", unlock, options);
      window.removeEventListener("keydown", unlock, options);
    };
  }, []);

  useEffect(() => {
    const onVisibility = () => audioManager.setBackgrounded(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return <>{children}</>;
}
