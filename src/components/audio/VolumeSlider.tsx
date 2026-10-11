import { useT } from "@/i18n";
import { cn } from "@/lib/cn";

interface VolumeSliderProps {
  id: string;
  label: string;
  /** 0..1 */
  value: number;
  onChange: (value: number) => void;
  /** Fired when the user lets go, e.g. to play a preview sound. */
  onCommit?: () => void;
  dimmed?: boolean;
}

export function VolumeSlider({ id, label, value, onChange, onCommit, dimmed = false }: VolumeSliderProps) {
  const t = useT();
  const percent = Math.round(value * 100);

  return (
    <label htmlFor={id} className="flex items-center gap-2" title={`${label}: ${percent}%`}>
      <span className="sr-only">{label}</span>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={percent}
        aria-valuetext={t("audio.percent", { n: percent })}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className={cn(
          "h-1 w-16 cursor-pointer accent-cyber-blue transition-opacity lg:w-24",
          dimmed && "opacity-40",
        )}
      />
      <span className="hidden w-8 text-end font-mono text-[10px] text-ink-faint xl:inline">{percent}%</span>
    </label>
  );
}
