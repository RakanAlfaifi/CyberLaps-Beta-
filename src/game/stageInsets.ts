/** CSS pixels along each edge of the stage that React overlays cover, so the camera frames the map around them. */
export interface StageInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Game registry key the current insets live under; it outlives scene restarts. */
export const STAGE_INSETS_KEY = "stageInsets";

export const DEFAULT_STAGE_INSETS: StageInsets = { top: 44, right: 12, bottom: 164, left: 12 };

export function sameInsets(a: StageInsets, b: StageInsets): boolean {
  return a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
}
