import type Phaser from "phaser";
import type { DeviceKind } from "@/types/topology";
import { MYSTERY } from "../theme";
import { paintDeviceModel, paintMysteryCrate, paintPlinth, plinthColors } from "./deviceModels";
import type { Ctx } from "./clayPainter";

/**
 * Texture pixels per model unit. High enough to stay crisp at the stage's maximum zoom on
 * HiDPI screens; sheets are power-of-two sized so WebGL can mipmap them when zoomed out.
 */
const RES = 4;

/** A sheet's size and the model's floor point inside it, in model units. */
interface Sheet {
  w: number;
  h: number;
  ox: number;
  oy: number;
}

const MODEL_SHEET: Sheet = { w: 128, h: 128, ox: 64, oy: 108 };
const PLINTH_SHEET: Sheet = { w: 128, h: 64, ox: 64, oy: 36 };

/** A baked clay painting and where its floor point sits. `top` is the painting's highest screen y, in model units. */
export interface ClayArt {
  key: string;
  originX: number;
  originY: number;
  top: number;
}

/** Textures outlive scenes, so a level restart reuses them; this remembers each one's measured top. */
const baked = new Map<string, ClayArt>();

function bake(scene: Phaser.Scene, key: string, sheet: Sheet, paint: (ctx: Ctx) => number): ClayArt {
  const known = baked.get(key);
  if (known && scene.textures.exists(key)) return known;
  if (scene.textures.exists(key)) scene.textures.remove(key);

  const canvas = document.createElement("canvas");
  canvas.width = sheet.w * RES;
  canvas.height = sheet.h * RES;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available");
  ctx.setTransform(RES, 0, 0, RES, sheet.ox * RES, sheet.oy * RES);
  ctx.lineJoin = "round";
  const top = paint(ctx);
  scene.textures.addCanvas(key, canvas);

  const art = { key, originX: sheet.ox / sheet.w, originY: sheet.oy / sheet.h, top };
  baked.set(key, art);
  return art;
}

const hex = (color: number) => color.toString(16).padStart(6, "0");

export function modelArt(scene: Phaser.Scene, kind: DeviceKind, accent: number): ClayArt {
  return bake(scene, `clay-model-${kind}-${hex(accent)}`, MODEL_SHEET, (ctx) => paintDeviceModel(ctx, kind, accent));
}

export function crateArt(scene: Phaser.Scene): ClayArt {
  return bake(scene, "clay-crate", MODEL_SHEET, paintMysteryCrate);
}

export function plinthArt(scene: Phaser.Scene, accent: number | null): ClayArt {
  if (accent === null) {
    return bake(scene, "clay-plinth-dark", PLINTH_SHEET, (ctx) => {
      paintPlinth(ctx, MYSTERY.plinthTrim, MYSTERY.plinth, null);
      return 0;
    });
  }
  return bake(scene, `clay-plinth-${hex(accent)}`, PLINTH_SHEET, (ctx) => {
    const { trim, surface, lights } = plinthColors(accent);
    paintPlinth(ctx, trim, surface, lights);
    return 0;
  });
}

/**
 * A soft round disc, densest in the middle, shown squashed into an isometric ellipse.
 * "shadow" is black; "glow" is white so it can be tinted and added as light.
 */
export function softDiscKey(scene: Phaser.Scene, kind: "shadow" | "glow"): string {
  const key = `clay-disc-${kind}`;
  if (scene.textures.exists(key)) return key;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available");
  const rgb = kind === "shadow" ? "0,0,0" : "255,255,255";
  const c = size / 2;
  const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.35, `rgba(${rgb},0.7)`);
  grad.addColorStop(0.7, `rgba(${rgb},0.22)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  scene.textures.addCanvas(key, canvas);
  return key;
}

/** Adds a baked painting as an image whose position is the painting's floor point. */
export function clayImage(scene: Phaser.Scene, art: ClayArt, y = 0): Phaser.GameObjects.Image {
  return scene.add.image(0, y, art.key).setOrigin(art.originX, art.originY).setScale(1 / RES);
}
