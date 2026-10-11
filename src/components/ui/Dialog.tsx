import { X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconButton } from "./IconButton";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  description?: string;
  closeLabel: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** Centered modal with backdrop click and Escape to close. */
export function Dialog({ open, onClose, title, icon, description, closeLabel, children, footer, className }: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/75 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "flex max-h-[88vh] w-full max-w-md animate-fade-in-up flex-col overflow-hidden rounded-lg border border-line-strong bg-surface shadow-panel",
          className,
        )}
      >
        <header className="flex items-start gap-3 border-b border-line px-4 py-3">
          {icon && <span className="mt-0.5 shrink-0 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold uppercase tracking-[0.14em] text-ink">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-ink-muted">
                {description}
              </p>
            )}
          </div>
          <IconButton label={closeLabel} sfx={false} onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </header>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>}
        {footer && <footer className="flex items-center justify-end gap-2 border-t border-line px-4 py-2.5">{footer}</footer>}
      </section>
    </div>
  );
}
