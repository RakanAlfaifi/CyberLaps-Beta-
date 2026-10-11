import { forwardRef, type ButtonHTMLAttributes } from "react";
import { playSfx } from "@/core/audio";
import { cn } from "@/lib/cn";
import type { SfxName } from "@/types/audio";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:
    "border-emerald-neon/50 bg-emerald-neon/15 text-emerald-glow hover:bg-emerald-neon/25 hover:shadow-glow-emerald",
  secondary:
    "border-cyber-blue/40 bg-cyber-blue/10 text-cyber-glow hover:bg-cyber-blue/20 hover:shadow-glow-blue",
  ghost: "border-transparent text-ink-muted hover:bg-surface-overlay hover:text-ink",
  danger: "border-danger-neon/40 bg-danger-neon/10 text-danger-glow hover:bg-danger-neon/20",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 gap-1.5 px-2.5 text-xs [&>svg]:h-3.5 [&>svg]:w-3.5",
  md: "h-9 gap-2 px-4 text-sm [&>svg]:h-4 [&>svg]:w-4",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  sfx?: SfxName | false;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", sfx = "click", className, onClick, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      onClick={(e) => {
        if (sfx) playSfx(sfx);
        onClick?.(e);
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-md border font-medium transition-all",
        "disabled:pointer-events-none disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    />
  );
});
