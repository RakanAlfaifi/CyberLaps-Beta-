import { UserRound } from "lucide-react";
import type { OperatorProfile } from "@/core/state/profileStore";
import { cn } from "@/lib/cn";

const initialsOf = (callsign: string) =>
  [...callsign.replace(/[-_]+/g, " ").trim()]
    .filter((_, i, all) => i === 0 || all[i - 1] === " ")
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function OperatorAvatar({ profile, size = "md" }: { profile: OperatorProfile | null; size?: "sm" | "md" | "lg" }) {
  const box = { sm: "h-7 w-7 text-[11px]", md: "h-10 w-10 text-sm", lg: "h-16 w-16 text-xl" }[size];
  if (!profile) {
    return (
      <span className={cn("flex shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface-raised text-ink-faint", box)}>
        <UserRound className="h-1/2 w-1/2" />
      </span>
    );
  }
  const hue = profile.avatarHue;
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-full font-mono font-bold text-void ring-2 ring-void", box)}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 85% 60%), hsl(${(hue + 60) % 360} 80% 45%))`,
        boxShadow: `0 0 16px hsl(${hue} 85% 55% / 0.45)`,
      }}
    >
      {initialsOf(profile.callsign) || "?"}
    </span>
  );
}
