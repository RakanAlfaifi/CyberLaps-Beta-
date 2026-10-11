import { forwardRef, type ButtonHTMLAttributes } from "react";
import { playSfx } from "@/core/audio";
import { cn } from "@/lib/cn";
import type { SfxName } from "@/types/audio";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Used for both the tooltip and the screen-reader label. */
  label: string;
  active?: boolean;
  sfx?: SfxName | false;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, active = false, sfx = "click", className, onClick, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      onClick={(e) => {
        if (sfx) playSfx(sfx);
        onClick?.(e);
      }}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors",
        "hover:bg-surface-overlay hover:text-ink disabled:pointer-events-none disabled:opacity-40",
        active && "text-cyber-glow",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
