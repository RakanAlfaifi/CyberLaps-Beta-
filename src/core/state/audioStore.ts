import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getBrowserStorage, storageKey } from "@/core/persistence/storage";
import { DEFAULT_AUDIO_SETTINGS } from "@/core/audio/defaults";
import type { AudioSettings } from "@/types/audio";

export { DEFAULT_AUDIO_SETTINGS };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

interface AudioStore extends AudioSettings {
  toggleMuted: () => void;
  setMuted: (muted: boolean) => void;
  toggleMusic: () => void;
  /** Moving a slider also turns sound back on. */
  setMasterVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
}

export const useAudioStore = create<AudioStore>()(
  persist(
    (set) => ({
      ...DEFAULT_AUDIO_SETTINGS,

      toggleMuted: () => set((s) => ({ muted: !s.muted })),
      setMuted: (muted) => set({ muted }),
      toggleMusic: () => set((s) => ({ musicEnabled: !s.musicEnabled })),
      setMasterVolume: (volume) => set({ masterVolume: clamp01(volume), muted: false }),
      setMusicVolume: (volume) => set({ musicVolume: clamp01(volume), muted: false }),
      setSfxVolume: (volume) => set({ sfxVolume: clamp01(volume), muted: false }),
    }),
    {
      name: storageKey("audio"),
      version: 2,
      storage: createJSONStorage(getBrowserStorage),
      partialize: (s): AudioSettings => ({
        muted: s.muted,
        musicEnabled: s.musicEnabled,
        masterVolume: s.masterVolume,
        musicVolume: s.musicVolume,
        sfxVolume: s.sfxVolume,
      }),
      migrate: (persisted) => ({ ...DEFAULT_AUDIO_SETTINGS, ...(persisted as Partial<AudioSettings>) }),
    },
  ),
);
