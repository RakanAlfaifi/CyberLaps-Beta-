import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { useT } from "@/i18n";
import { cn } from "@/lib/cn";

interface PanelResizeHandleProps {
  /** "horizontal" = a horizontal bar that resizes a panel below it. */
  orientation: "horizontal" | "vertical";
  /** The element whose box the size percent is measured against. */
  containerRef: RefObject<HTMLElement>;
  value: number;
  min: number;
  max: number;
  onChange: (percent: number) => void;
}

export function PanelResizeHandle({ orientation, containerRef, value, min, max, onChange }: PanelResizeHandleProps) {
  const t = useT();
  const dragging = useRef(false);
  const isHorizontal = orientation === "horizontal";

  const updateFromPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // The side-docked terminal sits at the inline end: the right edge in LTR, the left in RTL.
    const rtl = getComputedStyle(el).direction === "rtl";
    const percent = isHorizontal
      ? ((rect.bottom - e.clientY) / rect.height) * 100
      : ((rtl ? e.clientX - rect.left : rect.right - e.clientX) / rect.width) * 100;
    onChange(percent);
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={t("terminal.resize")}
      aria-orientation={orientation}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (dragging.current) updateFromPointer(e);
      }}
      onPointerUp={(e) => {
        dragging.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 10 : 2;
        const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
        const grow = isHorizontal ? "ArrowUp" : rtl ? "ArrowRight" : "ArrowLeft";
        const shrink = isHorizontal ? "ArrowDown" : rtl ? "ArrowLeft" : "ArrowRight";
        if (e.key === grow) {
          e.preventDefault();
          onChange(value + step);
        } else if (e.key === shrink) {
          e.preventDefault();
          onChange(value - step);
        }
      }}
      className={cn(
        "group flex shrink-0 touch-none select-none items-center justify-center",
        isHorizontal ? "h-3 cursor-row-resize" : "w-3 cursor-col-resize",
      )}
    >
      <span
        className={cn(
          "rounded-full bg-line-strong transition-colors group-hover:bg-cyber-blue group-focus-visible:bg-cyber-blue",
          isHorizontal ? "h-0.5 w-12" : "h-12 w-0.5",
        )}
      />
    </div>
  );
}
