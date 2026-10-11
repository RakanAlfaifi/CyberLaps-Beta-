export type SfxName =
  | "packet"
  | "success"
  | "reject"
  | "rst"
  | "keypress"
  | "click"
  | "modalOpen"
  | "modalClose"
  | "levelComplete";

export interface SfxOptions {
  /** Pitch multiplier. 1 = normal. */
  pitch?: number;
  /** Per-call volume multiplier, 0..1. */
  volume?: number;
}

export interface AudioSettings {
  muted: boolean;
  musicEnabled: boolean;
  /** 0..1. Scales music and sound effects together. */
  masterVolume: number;
  /** 0..1 */
  musicVolume: number;
  /** 0..1 */
  sfxVolume: number;
}
