import { useEffect, useRef, useState } from "react";
import type { StageGameHandle, StageInsets } from "@/game";
import { useT } from "@/i18n";
import { cn } from "@/lib/cn";

/**
 * Hosts the Phaser game. Phaser is loaded on demand, after web fonts are ready
 * (canvas text does not re-render when a font arrives late). `insets` are the CSS pixels
 * along each edge that overlays cover; the camera frames the map in what is left.
 */
export function PhaserStage({ className, insets }: { className?: string; insets?: StageInsets }) {
  const t = useT();
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<StageGameHandle | null>(null);
  const insetsRef = useRef(insets);
  insetsRef.current = insets;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;

    Promise.all([import("@/game"), document.fonts?.ready])
      .then(([{ createStageGame }]) => {
        if (!cancelled) handleRef.current = createStageGame(host, insetsRef.current);
      })
      .catch((error: unknown) => {
        console.error("Visual stage failed to start", error);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (insets) handleRef.current?.setInsets(insets);
  }, [insets]);

  return (
    <div
      id="phaser-stage"
      ref={hostRef}
      dir="ltr"
      className={cn("overflow-hidden [&>canvas]:block", className)}
      data-failed={failed || undefined}
    >
      {failed && (
        <p dir={t.dir} className="flex h-full items-center justify-center text-sm text-danger-glow">
          {t("stage.failed")}
        </p>
      )}
    </div>
  );
}
