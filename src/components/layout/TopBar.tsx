import { ChevronLeft, ChevronRight, LayoutDashboard, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AudioToolbar } from "@/components/audio/AudioToolbar";
import { LevelMapMenu } from "@/components/hub/LevelMapMenu";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconButton } from "@/components/ui/IconButton";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { playSfx } from "@/core/audio";
import { restartLevel } from "@/core/state/levelSession";
import { PLAYABLE_LEVEL_COUNT, useProgressStore } from "@/core/state/progressStore";
import { useT } from "@/i18n";
import { BrandMark } from "./BrandMark";
import { PhaseStepper } from "./PhaseStepper";

export function TopBar() {
  const t = useT();
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface/60 px-3">
      <Link
        to="/"
        title={t("nav.dashboardHint")}
        onClick={() => playSfx("click")}
        className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-surface-overlay"
      >
        <BrandMark compact />
      </Link>

      <Link
        to="/"
        onClick={() => playSfx("click")}
        className="hidden items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-ink-muted transition-colors hover:border-line-strong hover:bg-surface-overlay hover:text-ink sm:flex"
      >
        <LayoutDashboard className="h-3.5 w-3.5 text-cyber-glow" />
        {t("nav.dashboard")}
      </Link>

      <span aria-hidden className="h-5 w-px bg-line" />

      <LevelNavigator />

      <PhaseStepper />

      <div className="flex-1" />

      <LanguageToggle />
      <AudioToolbar className="hidden lg:flex" />
    </header>
  );
}

/** Previous / level map / next, plus a restart for the level on screen. */
function LevelNavigator() {
  const t = useT();
  const navigate = useNavigate();
  const levelId = useProgressStore((s) => s.currentLevelId);
  const [confirming, setConfirming] = useState(false);
  const hasPrev = levelId > 1;
  const hasNext = levelId < PLAYABLE_LEVEL_COUNT;

  // Chevrons point along the reading direction, so they swap in RTL.
  const Back = t.dir === "rtl" ? ChevronRight : ChevronLeft;
  const Forward = t.dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <nav aria-label={t("levelMap.aria")} className="flex items-center gap-1">
      <IconButton label={t("nav.prevLevel")} disabled={!hasPrev} onClick={() => navigate(`/lab/${levelId - 1}`)}>
        <Back className="h-4 w-4" />
      </IconButton>
      <LevelMapMenu />
      <IconButton label={t("nav.nextLevel")} disabled={!hasNext} onClick={() => navigate(`/lab/${levelId + 1}`)}>
        <Forward className="h-4 w-4" />
      </IconButton>

      <Button variant="ghost" size="sm" title={t("nav.restartHint")} onClick={() => setConfirming(true)} className="ms-1">
        <RotateCcw />
        <span className="hidden md:inline">{t("nav.restart")}</span>
      </Button>

      <ConfirmDialog
        open={confirming}
        title={t("nav.restartTitle", { n: levelId })}
        description={t("nav.restartBody")}
        confirmLabel={t("nav.restartConfirm")}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          restartLevel(levelId);
        }}
      />
    </nav>
  );
}
