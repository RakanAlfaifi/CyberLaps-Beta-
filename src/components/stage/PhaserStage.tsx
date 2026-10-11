import { useEffect, useRef, useState } from "react";
import type { StageGameHandle } from "@/game";
import { useT } from "@/i18n";
import { cn } from "@/lib/cn";

/**
 * Hosts the Phaser game. Phaser is loaded on demand, after web fonts are ready
 * (canvas text does not re-render when a font arrives late).
 */
export function PhaserStage({ className }: { className?: string }) {
  const t = useT();
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let handle: StageGameHandle | null = null;

    Promise.all([import("@/game"), document.fonts?.ready])
      .then(([{ createStageGame }]) => {
        if (!cancelled) handle = createStageGame(host);
      })
      .catch((error: unknown) => {
        console.error("Visual stage failed to start", error);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      handle?.destroy();
    };
  }, []);

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
