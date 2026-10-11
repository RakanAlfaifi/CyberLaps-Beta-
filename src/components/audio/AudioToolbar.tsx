import { Music, Volume2, VolumeX, Waves } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { playSfx } from "@/core/audio";
import { useAudioStore } from "@/core/state/audioStore";
import { useT } from "@/i18n";
import { cn } from "@/lib/cn";
import { VolumeSlider } from "./VolumeSlider";

export function AudioToolbar({ className }: { className?: string }) {
  const t = useT();
  const muted = useAudioStore((s) => s.muted);
  const musicEnabled = useAudioStore((s) => s.musicEnabled);
  const masterVolume = useAudioStore((s) => s.masterVolume);
  const setMasterVolume = useAudioStore((s) => s.setMasterVolume);
  const musicVolume = useAudioStore((s) => s.musicVolume);
  const sfxVolume = useAudioStore((s) => s.sfxVolume);
  const toggleMuted = useAudioStore((s) => s.toggleMuted);
  const toggleMusic = useAudioStore((s) => s.toggleMusic);
  const setMusicVolume = useAudioStore((s) => s.setMusicVolume);
  const setSfxVolume = useAudioStore((s) => s.setSfxVolume);

  return (
    <div
      role="group"
      aria-label={t("audio.aria")}
      className={cn(
        "flex items-center gap-1 rounded-lg border border-line bg-surface-raised/70 px-1.5 py-1",
        className,
      )}
    >
      <IconButton
        label={muted ? t("audio.soundOff") : t("audio.soundOn")}
        active={!muted}
        sfx={false}
        onClick={() => {
          toggleMuted();
          playSfx("click");
        }}
      >
        {muted ? <VolumeX className="h-4 w-4 text-amber-glow" /> : <Volume2 className="h-4 w-4" />}
      </IconButton>
      <VolumeSlider
        id="master-volume"
        label={t("audio.master")}
        value={masterVolume}
        onChange={setMasterVolume}
        onCommit={() => playSfx("success")}
        dimmed={muted}
      />

      <span aria-hidden className="mx-1 h-5 w-px bg-line" />

      <IconButton
        label={musicEnabled ? t("audio.musicOn") : t("audio.musicOff")}
        active={musicEnabled && !muted}
        onClick={toggleMusic}
      >
        <Music className={cn("h-4 w-4", !musicEnabled && "opacity-40")} />
      </IconButton>
      <VolumeSlider
        id="music-volume"
        label={t("audio.music")}
        value={musicVolume}
        onChange={setMusicVolume}
        dimmed={muted || !musicEnabled}
      />

      <span aria-hidden className="mx-1 h-5 w-px bg-line" />

      <span className="inline-flex h-8 w-8 items-center justify-center text-ink-muted" title={t("audio.sfxLabel")}>
        <Waves className="h-4 w-4" />
      </span>
      <VolumeSlider
        id="sfx-volume"
        label={t("audio.sfx")}
        value={sfxVolume}
        onChange={setSfxVolume}
        onCommit={() => playSfx("success")}
        dimmed={muted}
      />
    </div>
  );
}
