import type { SfxName, SfxOptions } from "@/types/audio";
import { audioManager } from "./AudioManager";

export { audioManager };

export function playSfx(name: SfxName, options?: SfxOptions): void {
  audioManager.play(name, options);
}
