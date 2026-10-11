import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "emerald" | "blue" | "amber" | "red" | "neutral";

const TONES: Record<BadgeTone, string> = {
  emerald: "border-emerald-neon/40 bg-emerald-neon/10 text-emerald-glow",
  blue: "border-cyber-blue/40 bg-cyber-blue/10 text-cyber-glow",
  amber: "border-amber-neon/40 bg-amber-neon/10 text-amber-glow",
  red: "border-danger-neon/40 bg-danger-neon/10 text-danger-glow",
  neutral: "border-line-strong bg-surface-raised text-ink-muted",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5",
        "font-mono text-[10px] font-semibold uppercase tracking-wider",
        TONES[tone],
        className,
      )}
      {...rest}
    />
  );
}
