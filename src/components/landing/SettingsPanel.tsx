import { PanelBottom, PanelRight, RotateCcw, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { VolumeSlider } from "@/components/audio/VolumeSlider";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { playSfx } from "@/core/audio";
import { useAudioStore } from "@/core/state/audioStore";
import { resetAllProgress } from "@/core/state/levelSession";
import { useUiStore, type TerminalDock } from "@/core/state/uiStore";
import { useT } from "@/i18n";
import { cn } from "@/lib/cn";

export function SettingsPanel() {
  const t = useT();
  const muted = useAudioStore((s) => s.muted);
  const setMuted = useAudioStore((s) => s.setMuted);
  const musicEnabled = useAudioStore((s) => s.musicEnabled);
  const toggleMusic = useAudioStore((s) => s.toggleMusic);
  const masterVolume = useAudioStore((s) => s.masterVolume);
  const setMasterVolume = useAudioStore((s) => s.setMasterVolume);
  const dock = useUiStore((s) => s.terminalDock);
  const setDock = useUiStore((s) => s.setTerminalDock);
  const [confirmingReset, setConfirmingReset] = useState(false);

  return (
    <article className="flex h-full flex-col gap-1 rounded-xl border border-line bg-surface/80 p-6 shadow-panel">
      <Row label={t("settings.language")}>
        <LanguageToggle />
      </Row>

      <Row label={t("settings.sound")}>
        <Switch
          checked={!muted}
          label={muted ? t("settings.soundOff") : t("settings.soundOn")}
          onChange={(on) => {
            setMuted(!on);
            if (on) playSfx("click");
          }}
        />
      </Row>

      <Row label={t("settings.music")}>
        <Switch checked={musicEnabled} label={musicEnabled ? t("settings.soundOn") : t("settings.soundOff")} onChange={toggleMusic} />
      </Row>

      <Row label={t("settings.volume")}>
        <VolumeSlider
          id="settings-master-volume"
          label={t("settings.volume")}
          value={masterVolume}
          onChange={setMasterVolume}
          onCommit={() => playSfx("success")}
          dimmed={muted}
        />
      </Row>

      <Row label={t("settings.dock")}>
        <div role="radiogroup" aria-label={t("settings.dock")} className="flex gap-0.5 rounded-md border border-line bg-surface-raised/70 p-0.5">
          {(["bottom", "right"] as TerminalDock[]).map((option) => {
            const Icon = option === "bottom" ? PanelBottom : PanelRight;
            const active = dock === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  playSfx("click");
                  setDock(option);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium transition-colors",
                  active ? "bg-cyber-blue/20 text-cyber-glow" : "text-ink-faint hover:text-ink",
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", option === "right" && "rtl:-scale-x-100")} />
                {t(option === "bottom" ? "settings.dockBottom" : "settings.dockRight")}
              </button>
            );
          })}
        </div>
      </Row>

      <div className="mt-auto flex flex-col gap-2 border-t border-dashed border-danger-neon/30 pt-4">
        <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-danger-glow">
          <RotateCcw className="h-3 w-3" />
          {t("settings.danger")}
        </p>
        <div>
          <Button variant="danger" size="sm" onClick={() => setConfirmingReset(true)}>
            <Trash2 />
            {t("settings.reset")}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingReset}
        title={t("settings.resetTitle")}
        description={t("settings.resetBody")}
        confirmLabel={t("settings.resetConfirm")}
        onCancel={() => setConfirmingReset(false)}
        onConfirm={() => {
          setConfirmingReset(false);
          resetAllProgress();
        }}
      />
    </article>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 border-b border-line/60 py-2 last-of-type:border-b-0">
      <span className="text-sm text-ink-muted">{label}</span>
      {children}
    </div>
  );
}

function Switch({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-xs font-medium text-ink-muted"
    >
      <span className="min-w-8 text-end">{label}</span>
      <span
        className={cn(
          "relative h-5 w-9 rounded-full border transition-colors",
          checked ? "border-emerald-neon/60 bg-emerald-neon/30" : "border-line-strong bg-surface-raised",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all",
            checked ? "start-[1.125rem] bg-emerald-glow shadow-glow-emerald" : "start-0.5 bg-ink-faint",
          )}
        />
      </span>
    </button>
  );
}
