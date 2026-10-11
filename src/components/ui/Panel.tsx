import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Panel({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-surface/80 shadow-panel",
        className,
      )}
      {...rest}
    />
  );
}

interface PanelHeaderProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PanelHeader({ icon, title, subtitle, actions, className }: PanelHeaderProps) {
  return (
    <header
      className={cn("flex min-h-10 shrink-0 items-center gap-2 border-b border-line px-3 py-1.5", className)}
    >
      {icon && <span className="text-cyber-glow [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-ink">{title}</h2>
        {subtitle && <p className="truncate text-[11px] text-ink-faint">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </header>
  );
}
