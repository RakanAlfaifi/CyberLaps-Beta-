import { mix, shade } from "../theme";
import { convexHull, facePoint, facePoints, footprint, iso, type BoxSpec, type Face, type Point } from "./iso";

/**
 * Canvas 2D painting of soft clay solids, used to bake the device models into textures.
 * Unlike Phaser Graphics, the 2D canvas has gradients and blur, which is what makes the
 * rounded bevels, glossy tops and ambient occlusion read as real molded plastic.
 */
export type Ctx = CanvasRenderingContext2D;

const COS = Math.cos(Math.PI / 6);
const BEVEL_STEPS = 6;

/** Floor-plane direction of the key light: from the upper left, so front (+v) faces are lit. */
const LIGHT = unit(-0.55, 1);
/** Halfway between the light and the viewer (who looks along -(1, 1, 1)); drives the specular streak. */
const HALF = unit(LIGHT.u + Math.SQRT1_2, LIGHT.v + Math.SQRT1_2);

function unit(u: number, v: number): { u: number; v: number } {
  const len = Math.hypot(u, v) || 1;
  return { u: u / len, v: v / len };
}

export function rgba(color: number, alpha = 1): string {
  return `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${alpha})`;
}

function tracePath(ctx: Ctx, points: readonly Point[]): void {
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
}

/** Fills a polygon and strokes it in the same paint, so neighbouring facets meet without hairline seams. */
function facet(ctx: Ctx, points: readonly Point[], style: string | CanvasGradient, seal = 0.3): void {
  tracePath(ctx, points);
  ctx.fillStyle = style;
  ctx.fill();
  if (seal > 0) {
    ctx.strokeStyle = style;
    ctx.lineWidth = seal;
    ctx.stroke();
  }
}

export function fillPoly(ctx: Ctx, points: readonly Point[], style: string | CanvasGradient): void {
  facet(ctx, points, style, 0);
}

/** Canvas shadow sizes are in device pixels; this converts model units using the current transform. */
function devicePx(ctx: Ctx, units: number): number {
  return units * Math.abs(ctx.getTransform().a);
}

/**
 * Fills only the blurred shadow of a polygon: the shape itself is drawn far off the
 * canvas and its shadow is offset back into place. Works in every browser, unlike `ctx.filter`.
 */
function blurredFill(ctx: Ctx, points: readonly Point[], color: string, blur: number): void {
  const away = 4000;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = devicePx(ctx, blur);
  ctx.shadowOffsetX = devicePx(ctx, away);
  ctx.fillStyle = "#000";
  tracePath(
    ctx,
    points.map((p) => ({ x: p.x - away, y: p.y })),
  );
  ctx.fill();
  ctx.restore();
}

interface Material {
  top: number;
  topHi: number;
  lit: number;
  dark: number;
  rim: number;
}

function material(color: number): Material {
  return {
    top: shade(color, 0.1),
    topHi: shade(color, 0.3),
    lit: shade(color, 0.03),
    dark: shade(color, -0.46),
    rim: shade(color, 0.52),
  };
}

/** Clay lighting for a surface with floor normal (nu, nv), tilted `elev` radians up from vertical. */
function lightAt(m: Material, nu: number, nv: number, elev: number): number {
  const facing = nu * LIGHT.u + nv * LIGHT.v;
  const wall = mix(m.dark, m.lit, facing * 0.5 + 0.5);
  let c = mix(wall, m.top, Math.sin(elev));
  c = mix(c, m.rim, Math.max(0, facing) * Math.sin(2 * elev) * 0.7);
  const spec = Math.pow(Math.max(0, nu * HALF.u + nv * HALF.v), 18) * Math.cos(elev);
  return mix(c, 0xffffff, spec * 0.28);
}

/**
 * A soft-cornered clay solid: lit rounded walls darkening toward the floor, a chunky
 * rounded bevel that catches the light, a gradient top and a glossy spot.
 * Returns the screen y of its highest point.
 */
export function clayBox(ctx: Ctx, spec: BoxSpec, color: number): number {
  const { u = 0, v = 0, z = 0, w, d, h, r = 4, gloss = true } = spec;
  const m = material(color);
  const rr = Math.max(0.01, Math.min(r, w / 2, d / 2));
  const br = Math.max(0.01, Math.min(spec.bevel ?? 2.4, h * 0.8, w / 3, d / 3));
  const shoulder = z + h - br;

  const rings = Array.from({ length: BEVEL_STEPS + 1 }, (_, k) => {
    const a = (k / BEVEL_STEPS) * (Math.PI / 2);
    const inset = br * (1 - Math.cos(a));
    const height = shoulder + br * Math.sin(a);
    return footprint(u, v, w - inset * 2, d - inset * 2, Math.max(0.01, rr - inset)).map((p) => iso(p.u, p.v, height));
  });
  const rim = footprint(u, v, w, d, rr);
  const base = rim.map((p) => iso(p.u, p.v, z));
  const count = rim.length;

  facet(ctx, convexHull([...base, ...rings.flat()]), rgba(mix(m.dark, m.lit, 0.45)), 0);

  if (shoulder - z > 0.05) {
    const wallTop = rings[0];
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      const n = unit(rim[i].nu + rim[j].nu, rim[i].nv + rim[j].nv);
      if (n.u + n.v <= 0) continue;
      const c = lightAt(m, n.u, n.v, 0);
      const y0 = (wallTop[i].y + wallTop[j].y) / 2;
      const y1 = (base[i].y + base[j].y) / 2;
      const grad = ctx.createLinearGradient(0, y0, 0, y1);
      grad.addColorStop(0, rgba(shade(c, 0.07)));
      grad.addColorStop(0.5, rgba(c));
      grad.addColorStop(1, rgba(shade(c, -0.32)));
      facet(ctx, [base[i], base[j], wallTop[j], wallTop[i]], grad);
    }
  }

  for (let k = 0; k < BEVEL_STEPS; k++) {
    const elev = ((k + 0.5) / BEVEL_STEPS) * (Math.PI / 2);
    const lo = rings[k];
    const hi = rings[k + 1];
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      const n = unit(rim[i].nu + rim[j].nu, rim[i].nv + rim[j].nv);
      if ((n.u + n.v) * Math.cos(elev) + Math.sin(elev) <= 0) continue;
      facet(ctx, [lo[i], lo[j], hi[j], hi[i]], rgba(lightAt(m, n.u, n.v, elev)));
    }
  }

  const top = rings[BEVEL_STEPS];
  const xs = top.map((p) => p.x);
  const ys = top.map((p) => p.y);
  const grad = ctx.createLinearGradient(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
  grad.addColorStop(0, rgba(m.topHi));
  grad.addColorStop(0.55, rgba(m.top));
  grad.addColorStop(1, rgba(shade(m.top, -0.07)));
  facet(ctx, top, grad);

  if (gloss) {
    ctx.save();
    tracePath(ctx, top);
    ctx.clip();
    const at = iso(u - w * 0.16, v - d * 0.04, z + h);
    const radius = Math.min(w, d) * 0.5;
    ctx.translate(at.x, at.y);
    ctx.scale(1, 0.58);
    const spot = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    spot.addColorStop(0, "rgba(255,255,255,0.34)");
    spot.addColorStop(0.45, "rgba(255,255,255,0.12)");
    spot.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = spot;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    ctx.restore();
  }

  return Math.min(...rings.flatMap((ring) => ring.map((p) => p.y)));
}

/** Ambient occlusion where a box rests on a surface: a soft, slightly offset dark footprint. */
export function contactShadow(ctx: Ctx, box: BoxSpec, strength = 0.45, blur = 2): void {
  const { u = 0, v = 0, z = 0, w, d, r = 4 } = box;
  const points = footprint(u + 0.9, v + 0.5, w + 1.2, d + 1.2, r + 0.6).map((p) => iso(p.u, p.v, z));
  blurredFill(ctx, points, `rgba(0,0,0,${strength})`, blur);
}

/** A glossy clay ball, lit from the upper left. */
export function sphere(ctx: Ctx, at: Point, radius: number, color: number): void {
  const grad = ctx.createRadialGradient(at.x - radius * 0.35, at.y - radius * 0.4, radius * 0.1, at.x, at.y, radius);
  grad.addColorStop(0, rgba(shade(color, 0.6)));
  grad.addColorStop(0.45, rgba(color));
  grad.addColorStop(1, rgba(shade(color, -0.42)));
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(at.x - radius * 0.38, at.y - radius * 0.42, radius * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fill();
}

/** A status light: a soft halo and a hot core. */
export function led(ctx: Ctx, at: Point, color: number, radius = 1.2): void {
  const halo = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, radius * 3.2);
  halo.addColorStop(0, rgba(color, 0.6));
  halo.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(at.x - radius * 3.2, at.y - radius * 3.2, radius * 6.4, radius * 6.4);
  const core = ctx.createRadialGradient(at.x - radius * 0.25, at.y - radius * 0.25, 0, at.x, at.y, radius);
  core.addColorStop(0, "#ffffff");
  core.addColorStop(0.5, rgba(shade(color, 0.5)));
  core.addColorStop(1, rgba(color));
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

/** A pressed-in line: a dark groove with a light lip under it. */
export function groove(ctx: Ctx, a: Point, b: Point, body: number, width = 0.9): void {
  ctx.lineCap = "round";
  ctx.lineWidth = width;
  ctx.strokeStyle = rgba(shade(body, 0.32), 0.85);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y + width * 0.55);
  ctx.lineTo(b.x, b.y + width * 0.55);
  ctx.stroke();
  ctx.strokeStyle = rgba(shade(body, -0.58));
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

/** Points of a rectangle lying on a box's top face. */
export function topPoints(box: BoxSpec, u0: number, u1: number, v0: number, v1: number): Point[] {
  const { u = 0, v = 0, z = 0, h } = box;
  const zz = z + h;
  return [iso(u + u0, v + v0, zz), iso(u + u1, v + v0, zz), iso(u + u1, v + v1, zz), iso(u + u0, v + v1, zz)];
}

/**
 * A recessed panel on a flat side: a shadowed rim that is deeper at the top,
 * the inner fill, and a light lip along the bottom edge.
 */
export function recess(
  ctx: Ctx,
  box: BoxSpec,
  face: Face,
  a0: number,
  a1: number,
  z0: number,
  z1: number,
  fill: number,
  body: number,
): void {
  fillPoly(ctx, facePoints(box, face, a0, a1, z0, z1), rgba(shade(body, -0.6)));
  const inner = facePoints(box, face, a0 + 0.45, a1 - 0.45, z0 + 0.35, z1 - 0.9);
  const grad = ctx.createLinearGradient(0, inner[3].y, 0, inner[0].y);
  grad.addColorStop(0, rgba(shade(fill, -0.25)));
  grad.addColorStop(1, rgba(fill));
  fillPoly(ctx, inner, grad);
  fillPoly(ctx, facePoints(box, face, a0, a1, z0 - 0.15, z0 + 0.4), rgba(shade(body, 0.4), 0.8));
}

/**
 * A glowing screen on a flat side: dark glass with a colored inner glow, terminal
 * lines, faint scanlines and a diagonal reflection.
 */
export function screen(ctx: Ctx, box: BoxSpec, face: Face, a0: number, a1: number, z0: number, z1: number, accent: number): void {
  const quad = facePoints(box, face, a0, a1, z0, z1);
  const glow = shade(accent, 0.55);
  const grad = ctx.createLinearGradient(0, quad[3].y, 0, quad[0].y);
  grad.addColorStop(0, rgba(mix(0x0b1222, accent, 0.32)));
  grad.addColorStop(1, rgba(0x050913));
  ctx.save();
  tracePath(ctx, quad);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.clip();

  const mid = facePoint(box, face, (a0 + a1) / 2, (z0 + z1) / 2);
  const inner = ctx.createRadialGradient(mid.x, mid.y, 0, mid.x, mid.y, (a1 - a0) * 0.75);
  inner.addColorStop(0, rgba(accent, 0.32));
  inner.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = inner;
  ctx.fillRect(mid.x - 40, mid.y - 40, 80, 80);

  const span = a1 - a0;
  const rows: readonly [number, number][] = [
    [0.12, 0.62],
    [0.12, 0.42],
    [0.12, 0.78],
    [0.12, 0.3],
  ];
  ctx.shadowColor = rgba(glow, 0.9);
  ctx.shadowBlur = devicePx(ctx, 1.4);
  rows.forEach(([from, to], i) => {
    const zz = z1 - 2.6 - i * 2.7;
    if (zz - 0.6 < z0 + 1) return;
    fillPoly(ctx, facePoints(box, face, a0 + span * from, a0 + span * to, zz - 0.6, zz + 0.6), rgba(glow, i === 3 ? 1 : 0.85));
  });
  const cursorZ = z1 - 2.6 - 3 * 2.7;
  if (cursorZ - 0.6 > z0 + 1) {
    fillPoly(ctx, facePoints(box, face, a0 + span * 0.34, a0 + span * 0.42, cursorZ - 0.8, cursorZ + 0.8), rgba(0xffffff, 0.95));
  }
  ctx.shadowBlur = 0;

  for (let zz = z0 + 0.6; zz < z1; zz += 1.1) {
    fillPoly(ctx, facePoints(box, face, a0, a1, zz, zz + 0.25), "rgba(0,0,0,0.16)");
  }
  fillPoly(
    ctx,
    [facePoint(box, face, a0 + span * 0.5, z1), facePoint(box, face, a1, z1), facePoint(box, face, a1, z1 - (z1 - z0) * 0.55)],
    "rgba(255,255,255,0.09)",
  );
  ctx.restore();

  tracePath(ctx, quad);
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = rgba(0x000000, 0.55);
  ctx.stroke();
}

/** Text printed flat on a box's side, as if stenciled onto it. */
export function faceText(ctx: Ctx, box: BoxSpec, face: Face, a: number, z: number, text: string, size: number, color: string): void {
  const o = facePoint(box, face, a, z);
  ctx.save();
  // The side face runs toward screen-left as `a` grows; read along -a so the text is not mirrored.
  ctx.transform(COS, face === "front" ? 0.5 : -0.5, 0, 1, o.x, o.y);
  ctx.font = `800 ${size}px "Inter Variable", Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillText(text, 0, 0.6);
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Strokes the outline of a circle lying flat at height z, with a glow. */
export function floorRing(ctx: Ctx, u: number, v: number, z: number, radius: number, color: number, width = 1): void {
  const points = footprint(u, v, radius * 2, radius * 2, radius).map((p) => iso(p.u, p.v, z));
  ctx.save();
  ctx.shadowColor = rgba(color, 0.9);
  ctx.shadowBlur = devicePx(ctx, 2);
  tracePath(ctx, points);
  ctx.lineWidth = width;
  ctx.strokeStyle = rgba(color);
  ctx.stroke();
  ctx.restore();
}

/** Upward arcs of a wireless signal, glowing. */
export function signalArcs(ctx: Ctx, at: Point, radii: readonly number[], color: number): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.shadowColor = rgba(color, 0.9);
  ctx.shadowBlur = devicePx(ctx, 2.2);
  ctx.strokeStyle = rgba(color);
  ctx.lineWidth = 1.9;
  for (const radius of radii) {
    ctx.beginPath();
    ctx.arc(at.x, at.y, radius, Math.PI * 1.25, Math.PI * 1.75);
    ctx.stroke();
  }
  ctx.restore();
}
