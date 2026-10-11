import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { isLevelPlayable, useProgressStore } from "@/core/state/progressStore";

/** `/lab/:levelId`. Unknown levels redirect to the current level. */
export function LabRoute() {
  const { levelId } = useParams();
  const currentLevelId = useProgressStore((s) => s.currentLevelId);
  const startLevel = useProgressStore((s) => s.startLevel);

  const fallbackId = isLevelPlayable(currentLevelId) ? currentLevelId : 1;
  const requestedId = Number(levelId);
  const valid = levelId !== undefined && isLevelPlayable(requestedId);

  useEffect(() => {
    if (valid) startLevel(requestedId);
  }, [valid, requestedId, startLevel]);

  if (!valid) return <Navigate to={`/lab/${fallbackId}`} replace />;
  return <AppLayout />;
}
