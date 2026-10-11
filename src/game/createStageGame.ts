import Phaser from "phaser";
import { NetworkScene } from "./scenes/NetworkScene";

export interface StageGameHandle {
  destroy: () => void;
}

/**
 * Boots Phaser inside `parent` and keeps it sized to it.
 * The canvas is rendered at device-pixel resolution and shown at CSS size (zoom = 1 / dpr),
 * so lines and text stay sharp on HiDPI screens. A ResizeObserver catches panel drags,
 * which do not fire window resize events.
 */
export function createStageGame(parent: HTMLElement): StageGameHandle {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const toPixels = (cssSize: number) => Math.max(1, Math.round(cssSize * dpr));
  const rect = parent.getBoundingClientRect();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    transparent: true,
    antialias: true,
    // The baked clay textures are power-of-two sheets; mipmaps keep them smooth when zoomed out.
    render: { mipmapFilter: "LINEAR_MIPMAP_LINEAR" },
    banner: false,
    // Sound goes through the app's Howler AudioManager, not Phaser.
    audio: { noAudio: true },
    width: toPixels(rect.width),
    height: toPixels(rect.height),
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
    scene: [NetworkScene],
  });

  const observer = new ResizeObserver(([entry]) => {
    if (!entry) return;
    const { width, height } = entry.contentRect;
    game.scale.resize(toPixels(width), toPixels(height));
  });
  observer.observe(parent);

  return {
    destroy: () => {
      observer.disconnect();
      game.destroy(true);
    },
  };
}
