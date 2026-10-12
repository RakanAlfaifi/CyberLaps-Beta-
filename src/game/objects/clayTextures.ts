import type Phaser from "phaser";
import type { DeviceKind } from "@/types/topology";
import { SPACE } from "../theme";
import { paintDeviceModel, paintMysteryCrate, paintPedestal } from "./deviceModels";
import { rgba, type Ctx } from "./clayPainter";
import { seeded, type BlinkLight } from "./hardwarePainter";
import { ISO_SLOPE } from "./iso";

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
const PEDESTAL_SHEET: Sheet = { w: 128, h: 64, ox: 64, oy: 37 };
/** Distinct smoke puffs, so a cloud of them never looks tiled. */
const SMOKE_VARIANTS = 4;

/** A baked painting and where its floor point sits. `top` is the painting's highest screen y, in model units. */
export interface ClayArt {
  key: string;
  originX: number;
  originY: number;
  top: number;
  /** Activity lights painted on it, to blink on the stage. */
  lights: readonly BlinkLight[];
}

/** Textures outlive scenes, so a level restart reuses them; this remembers each one's measured top. */
const baked = new Map<string, ClayArt>();

function canvas2d(w: number, h: number): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available");
  return { canvas, ctx };
}

function bake(scene: Phaser.Scene, key: string, sheet: Sheet, paint: (ctx: Ctx, lights: BlinkLight[]) => number): ClayArt {
  const known = baked.get(key);
  if (known && scene.textures.exists(key)) return known;
  if (scene.textures.exists(key)) scene.textures.remove(key);

  const { canvas, ctx } = canvas2d(sheet.w * RES, sheet.h * RES);
  ctx.setTransform(RES, 0, 0, RES, sheet.ox * RES, sheet.oy * RES);
  ctx.lineJoin = "round";
  const lights: BlinkLight[] = [];
  const top = paint(ctx, lights);
  scene.textures.addCanvas(key, canvas);

  const art = { key, originX: sheet.ox / sheet.w, originY: sheet.oy / sheet.h, top, lights };
  baked.set(key, art);
  return art;
}

/** Paints a texture once per game; later calls return the cached key. */
function once(scene: Phaser.Scene, key: string, w: number, h: number, paint: (ctx: Ctx) => void): string {
  if (scene.textures.exists(key)) return key;
  const { canvas, ctx } = canvas2d(w, h);
  paint(ctx);
  scene.textures.addCanvas(key, canvas);
  return key;
}

const hex = (color: number) => color.toString(16).padStart(6, "0");

export function modelArt(scene: Phaser.Scene, kind: DeviceKind, accent: number): ClayArt {
  return bake(scene, `hw-model-${kind}-${hex(accent)}`, MODEL_SHEET, (ctx, lights) => paintDeviceModel(ctx, kind, accent, lights));
}

export function crateArt(scene: Phaser.Scene): ClayArt {
  return bake(scene, "hw-crate", MODEL_SHEET, paintMysteryCrate);
}

/** The glass pedestal, with its neon on (`lit`) or off. */
export function pedestalArt(scene: Phaser.Scene, lit: boolean): ClayArt {
  return bake(scene, lit ? "hw-pedestal-lit" : "hw-pedestal-off", PEDESTAL_SHEET, (ctx) => {
    paintPedestal(ctx, lit);
    return 0;
  });
}

/**
 * A soft round disc, densest in the middle, shown squashed into an isometric ellipse.
 * "shadow" is black; "glow" is white so it can be tinted and added as light.
 */
export function softDiscKey(scene: Phaser.Scene, kind: "shadow" | "glow"): string {
  return once(scene, `clay-disc-${kind}`, 256, 256, (ctx) => {
    const rgb = kind === "shadow" ? "0,0,0" : "255,255,255";
    const c = 128;
    const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0, `rgba(${rgb},1)`);
    grad.addColorStop(0.35, `rgba(${rgb},0.7)`);
    grad.addColorStop(0.7, `rgba(${rgb},0.22)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  });
}

/**
 * Billowing white smoke puffs, to be tinted: overlapping soft blobs with a few
 * wisps eaten out of them, rounded off at the edge.
 */
export function smokeKeys(scene: Phaser.Scene): string[] {
  return Array.from({ length: SMOKE_VARIANTS }, (_, variant) =>
    once(scene, `fx-smoke-${variant}`, 256, 256, (ctx) => {
      const rand = seeded(101 + variant * 37);
      const c = 128;
      const blob = (x: number, y: number, r: number, alpha: number) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,255,255,${alpha})`);
        g.addColorStop(0.55, `rgba(255,255,255,${alpha * 0.45})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      };
      for (let k = 0; k < 24; k++) {
        const angle = rand() * Math.PI * 2;
        const dist = Math.pow(rand(), 0.7) * 70;
        blob(c + Math.cos(angle) * dist, c + Math.sin(angle) * dist * 0.85, 32 + rand() * 42, 0.2 + rand() * 0.32);
      }
      ctx.globalCompositeOperation = "destination-out";
      for (let k = 0; k < 9; k++) {
        const angle = rand() * Math.PI * 2;
        const dist = 20 + rand() * 60;
        blob(c + Math.cos(angle) * dist, c + Math.sin(angle) * dist, 10 + rand() * 18, 0.3);
      }
      ctx.globalCompositeOperation = "destination-in";
      const edge = ctx.createRadialGradient(c, c, 0, c, c, c);
      edge.addColorStop(0, "rgba(0,0,0,1)");
      edge.addColorStop(0.55, "rgba(0,0,0,1)");
      edge.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, 256, 256);
    }),
  );
}

/** An opaque disc with a feathered rim; scaled up as a bitmap mask it opens a soft round hole. */
export function dissolveKey(scene: Phaser.Scene): string {
  return once(scene, "fx-dissolve", 256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.6, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });
}

/** Deep space behind the lab: a navy core falling off to black, faint nebulae and a scatter of stars. */
export function spaceKey(scene: Phaser.Scene): string {
  const w = 1024;
  const h = 640;
  return once(scene, "fx-space", w, h, (ctx) => {
    const rand = seeded(7);
    ctx.fillStyle = rgba(SPACE.edge);
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h * 0.46);
    ctx.scale(1, h / w);
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.62);
    core.addColorStop(0, rgba(SPACE.core));
    core.addColorStop(1, rgba(SPACE.edge));
    ctx.fillStyle = core;
    ctx.fillRect(-w, -w, w * 2, w * 2);
    ctx.restore();

    ctx.globalCompositeOperation = "lighter";
    const nebulae: readonly [number, number, number, number][] = [
      [0.24, 0.3, 300, 0.1],
      [0.8, 0.62, 340, 0.08],
      [0.55, 0.2, 220, 0.06],
    ];
    nebulae.forEach(([x, y, r, alpha], i) => {
      const g = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r);
      g.addColorStop(0, rgba(SPACE.nebula[i % SPACE.nebula.length], alpha));
      g.addColorStop(1, rgba(SPACE.nebula[i % SPACE.nebula.length], 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    for (let i = 0; i < 260; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 0.35 + Math.pow(rand(), 3) * 1.2;
      ctx.fillStyle = `rgba(${rand() > 0.7 ? "191,219,254" : "226,232,240"},${0.15 + rand() * 0.6})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Darkens toward the edges; stretched over the viewport it becomes an elliptical vignette. */
export function vignetteKey(scene: Phaser.Scene): string {
  return once(scene, "fx-vignette", 512, 512, (ctx) => {
    const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 362);
    g.addColorStop(0, "rgba(2,4,10,0)");
    g.addColorStop(0.62, "rgba(2,4,10,0)");
    g.addColorStop(0.86, "rgba(2,4,10,0.28)");
    g.addColorStop(1, "rgba(2,4,10,0.6)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
  });
}

/** Grid floor texture size and tile spacing, in texture pixels. */
export const GRID_FLOOR = { w: 2048, h: 1280, spacing: 40 } as const;

/**
 * An isometric grid stretching out into the dark: neon lines at ±30°, brighter every
 * fourth line with a dot at each major crossing, fading out toward the edges.
 */
export function gridFloorKey(scene: Phaser.Scene): string {
  const { w, h, spacing } = GRID_FLOOR;
  return once(scene, "fx-grid-floor", w, h, (ctx) => {
    for (const m of [ISO_SLOPE, -ISO_SLOPE]) {
      const span = Math.abs(m) * w + h;
      for (let k = -Math.ceil(span / spacing); k <= Math.ceil(span / spacing); k++) {
        const b = h / 2 + k * spacing - m * (w / 2);
        const major = k % 4 === 0;
        ctx.strokeStyle = rgba(SPACE.grid, major ? 0.22 : 0.09);
        ctx.lineWidth = major ? 1.4 : 1;
        ctx.beginPath();
        ctx.moveTo(0, b);
        ctx.lineTo(w, m * w + b);
        ctx.stroke();
      }
    }
    // Major crossings sit where both families hit a multiple of four.
    const step = spacing * 4;
    const dx = step / (2 * ISO_SLOPE);
    for (let row = -Math.ceil(h / step); row <= Math.ceil(h / step); row++) {
      for (let col = -Math.ceil(w / dx); col <= Math.ceil(w / dx); col++) {
        if ((row + col) % 2 !== 0) continue;
        const x = w / 2 + col * dx;
        const y = h / 2 + row * (step / 2);
        if (x < 0 || x > w || y < 0 || y > h) continue;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 6);
        g.addColorStop(0, rgba(SPACE.grid, 0.75));
        g.addColorStop(1, rgba(SPACE.grid, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - 6, y - 6, 12, 12);
      }
    }
    ctx.globalCompositeOperation = "destination-in";
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(1, h / w);
    const fade = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
    fade.addColorStop(0, "rgba(0,0,0,1)");
    fade.addColorStop(0.45, "rgba(0,0,0,0.85)");
    fade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = fade;
    ctx.fillRect(-w, -w, w * 2, w * 2);
    ctx.restore();
  });
}

/** Adds a baked painting as an image whose position is the painting's floor point. */
export function clayImage(scene: Phaser.Scene, art: ClayArt, y = 0): Phaser.GameObjects.Image {
  return scene.add.image(0, y, art.key).setOrigin(art.originX, art.originY).setScale(1 / RES);
}
