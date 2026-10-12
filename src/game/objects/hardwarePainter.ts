import { shade } from "../theme";
import { fillPoly, led, rgba, type Ctx } from "./clayPainter";
import { facePoint, facePoints, footprint, iso, type BoxSpec, type Face, type Point } from "./iso";

/**
 * Canvas 2D painting of real-looking hardware: brushed sheet metal with crisp chamfered
 * edges, tinted glass with reflections, port cutouts, vents and emissive lights. Used to
 * bake the device renders into textures, alongside the soft shapes in clayPainter.
 */

const COS = Math.cos(Math.PI / 6);
/** Screen direction of the +u axis on the floor; the front face's horizontal edges run along it. */
const U_DIR = { x: COS, y: 0.5 };
/** Spacing of brushed-metal streaks, in model units. */
const STREAK = 0.38;

/** A status light that blinks on the live stage, at its painted spot in model units from the floor point. */
export interface BlinkLight {
  x: number;
  y: number;
  color: number;
}

/** Paints a status light and records it so the stage can blink it. */
export function blinker(ctx: Ctx, lights: BlinkLight[], at: Point, color: number, radius: number): void {
  led(ctx, at, color, radius);
  lights.push({ x: at.x, y: at.y, color });
}

/** Deterministic noise, so a baked texture comes out identical on every load. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function trace(ctx: Ctx, points: readonly Point[]): void {
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
}

function clipped(ctx: Ctx, points: readonly Point[], draw: () => void): void {
  ctx.save();
  trace(ctx, points);
  ctx.clip();
  draw();
  ctx.restore();
}

export function line(ctx: Ctx, a: Point, b: Point, style: string, width: number): void {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** The three faces of a box the camera sees, each listed bottom-left, bottom-right, top-right, top-left. */
export function boxFaces(box: BoxSpec): { top: Point[]; front: Point[]; side: Point[] } {
  const { u = 0, v = 0, z = 0, w, d, h } = box;
  const u0 = u - w / 2;
  const u1 = u + w / 2;
  const v0 = v - d / 2;
  const v1 = v + d / 2;
  const z1 = z + h;
  return {
    top: [iso(u0, v1, z1), iso(u1, v1, z1), iso(u1, v0, z1), iso(u0, v0, z1)],
    front: [iso(u0, v1, z), iso(u1, v1, z), iso(u1, v1, z1), iso(u0, v1, z1)],
    side: [iso(u1, v1, z), iso(u1, v0, z), iso(u1, v0, z1), iso(u1, v1, z1)],
  };
}

/** A gradient running from a quad's top edge (0) down to its bottom edge (1), following the face's slant. */
function downGradient(ctx: Ctx, quad: readonly Point[]): CanvasGradient {
  const [bl, br, , tl] = quad;
  const ex = br.x - bl.x;
  const ey = br.y - bl.y;
  const len = Math.hypot(ex, ey) || 1;
  // Perpendicular to the bottom edge, pointing down the face.
  let nx = -ey / len;
  let ny = ex / len;
  if (ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const depth = (bl.x - tl.x) * nx + (bl.y - tl.y) * ny;
  return ctx.createLinearGradient(tl.x, tl.y, tl.x + nx * depth, tl.y + ny * depth);
}

/** Fine streaks along `dir` across a clipped face; a brushed finish catching the light unevenly. */
function brush(ctx: Ctx, quad: readonly Point[], dir: Point, rand: () => number, strength: number): void {
  const len = Math.hypot(dir.x, dir.y) || 1;
  const ex = dir.x / len;
  const ey = dir.y / len;
  const nx = -ey;
  const ny = ex;
  const xs = quad.map((p) => p.x);
  const ys = quad.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const reach = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  clipped(ctx, quad, () => {
    ctx.lineWidth = STREAK * 0.6;
    for (let o = -reach / 2; o <= reach / 2; o += STREAK) {
      const bright = rand() > 0.5;
      ctx.strokeStyle = bright ? `rgba(255,255,255,${0.02 + rand() * 0.05 * strength})` : `rgba(0,0,0,${0.03 + rand() * 0.06 * strength})`;
      const px = cx + nx * o;
      const py = cy + ny * o;
      // Streaks break up along their length, like real brushing.
      const from = -reach + rand() * reach * 0.5;
      const to = reach - rand() * reach * 0.5;
      ctx.beginPath();
      ctx.moveTo(px + ex * from, py + ey * from);
      ctx.lineTo(px + ex * to, py + ey * to);
      ctx.stroke();
    }
  });
}

export interface MetalOptions {
  /** Fine streaks of a brushed finish. */
  brushed?: boolean;
  /** Seeds the streak pattern so twin parts do not look stamped. */
  seed?: number;
  /** Strength of the bright chamfer along the lit edges, 0..1. */
  edge?: number;
  /** Strength of the vertical reflection band across the front, 0..1. */
  sheen?: number;
}

/**
 * A crisp sheet-metal box: a cool top catching the key light, a lit front with a soft falloff
 * and a reflection band, a shaded side, brushed streaks and bright chamfered edges.
 * Returns the screen y of its highest point.
 */
export function metalBox(ctx: Ctx, box: BoxSpec, color: number, opts: MetalOptions = {}): number {
  const { brushed = true, seed = 1, edge = 1, sheen = 1 } = opts;
  const rand = seeded(seed * 7919 + Math.round(box.w * 13 + box.h * 31));
  const f = boxFaces(box);

  const front = downGradient(ctx, f.front);
  front.addColorStop(0, rgba(shade(color, 0.14)));
  front.addColorStop(0.45, rgba(color));
  front.addColorStop(1, rgba(shade(color, -0.3)));
  fillPoly(ctx, f.front, front);

  const sideColor = shade(color, -0.42);
  const side = downGradient(ctx, f.side);
  side.addColorStop(0, rgba(shade(sideColor, 0.1)));
  side.addColorStop(1, rgba(shade(sideColor, -0.35)));
  fillPoly(ctx, f.side, side);

  const topColor = shade(color, 0.22);
  const top = ctx.createLinearGradient(f.top[3].x, f.top[3].y, f.top[1].x, f.top[1].y);
  top.addColorStop(0, rgba(shade(topColor, 0.12)));
  top.addColorStop(0.6, rgba(topColor));
  top.addColorStop(1, rgba(shade(topColor, -0.1)));
  fillPoly(ctx, f.top, top);

  if (brushed) {
    brush(ctx, f.front, U_DIR, rand, 1);
    brush(ctx, f.side, { x: -COS, y: 0.5 }, rand, 0.7);
    brush(ctx, f.top, U_DIR, rand, 0.8);
  }

  if (sheen > 0) {
    const xs = f.front.map((p) => p.x);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    clipped(ctx, f.front, () => {
      const band = ctx.createLinearGradient(x0, 0, x1, 0);
      band.addColorStop(0, "rgba(255,255,255,0)");
      band.addColorStop(0.22, `rgba(255,255,255,${0.11 * sheen})`);
      band.addColorStop(0.34, "rgba(255,255,255,0)");
      band.addColorStop(0.62, `rgba(255,255,255,${0.05 * sheen})`);
      band.addColorStop(0.7, "rgba(255,255,255,0)");
      ctx.fillStyle = band;
      ctx.fillRect(x0, Math.min(...f.front.map((p) => p.y)), x1 - x0, 400);
    });
  }

  ctx.lineCap = "round";
  if (edge > 0) {
    line(ctx, f.top[0], f.top[1], `rgba(255,255,255,${0.62 * edge})`, 0.55);
    line(ctx, f.top[1], f.top[2], `rgba(255,255,255,${0.3 * edge})`, 0.45);
    line(ctx, f.top[0], f.top[3], `rgba(255,255,255,${0.22 * edge})`, 0.4);
    line(ctx, f.front[1], f.front[2], `rgba(255,255,255,${0.32 * edge})`, 0.4);
  }
  trace(ctx, [f.top[3], f.top[2], f.side[1], f.side[0], f.front[0], f.top[0]]);
  ctx.strokeStyle = "rgba(2,4,10,0.6)";
  ctx.lineWidth = 0.45;
  ctx.stroke();
  return f.top[3].y;
}

/**
 * A frustum seen from the front-top: a big near rectangle at `v0` tapering back to a small one at `v1`.
 * Only its top and +u sides are visible (the near end is covered by whatever stands in front).
 */
export function taperedBack(
  ctx: Ctx,
  near: { v: number; w: number; z0: number; z1: number },
  far: { v: number; w: number; z0: number; z1: number },
  color: number,
): number {
  const topQuad = [iso(-near.w / 2, near.v, near.z1), iso(near.w / 2, near.v, near.z1), iso(far.w / 2, far.v, far.z1), iso(-far.w / 2, far.v, far.z1)];
  const sideQuad = [iso(near.w / 2, near.v, near.z0), iso(far.w / 2, far.v, far.z0), iso(far.w / 2, far.v, far.z1), iso(near.w / 2, near.v, near.z1)];
  const side = downGradient(ctx, sideQuad);
  side.addColorStop(0, rgba(shade(color, -0.3)));
  side.addColorStop(1, rgba(shade(color, -0.6)));
  fillPoly(ctx, sideQuad, side);
  const top = ctx.createLinearGradient(topQuad[3].x, topQuad[3].y, topQuad[1].x, topQuad[1].y);
  top.addColorStop(0, rgba(shade(color, 0.2)));
  top.addColorStop(1, rgba(shade(color, -0.05)));
  fillPoly(ctx, topQuad, top);
  ctx.lineCap = "round";
  line(ctx, topQuad[1], topQuad[2], "rgba(255,255,255,0.28)", 0.45);
  trace(ctx, [topQuad[3], topQuad[2], sideQuad[1], sideQuad[0], topQuad[0]]);
  ctx.strokeStyle = "rgba(2,4,10,0.5)";
  ctx.lineWidth = 0.45;
  ctx.stroke();
  return Math.min(topQuad[2].y, topQuad[3].y);
}

/** A rectangular hole cut into a face: near-black inside, a shadowed top lip and a lit bottom lip. */
export function cutout(ctx: Ctx, box: BoxSpec, face: Face, a0: number, a1: number, z0: number, z1: number, fill = 0x03060b): void {
  fillPoly(ctx, facePoints(box, face, a0 - 0.18, a1 + 0.18, z0 - 0.22, z1 + 0.12), "rgba(255,255,255,0.22)");
  const hole = facePoints(box, face, a0, a1, z0, z1);
  const grad = downGradient(ctx, hole);
  grad.addColorStop(0, rgba(0x000000));
  grad.addColorStop(1, rgba(fill));
  fillPoly(ctx, hole, grad);
}

/** A flat plate fastened to a face: lit along its top edge, shadowed along its bottom. */
export function facePlate(ctx: Ctx, box: BoxSpec, face: Face, a0: number, a1: number, z0: number, z1: number, color: number): void {
  const quad = facePoints(box, face, a0, a1, z0, z1);
  fillPoly(ctx, facePoints(box, face, a0, a1, z0 - 0.3, z0), "rgba(0,0,0,0.45)");
  const grad = downGradient(ctx, quad);
  grad.addColorStop(0, rgba(shade(color, 0.18)));
  grad.addColorStop(1, rgba(shade(color, -0.22)));
  fillPoly(ctx, quad, grad);
  fillPoly(ctx, facePoints(box, face, a0, a1, z1 - 0.22, z1), "rgba(255,255,255,0.28)");
}

/** A rounded rectangle lying on a face, as screen points. */
export function faceRoundRect(box: BoxSpec, face: Face, a0: number, a1: number, z0: number, z1: number, r: number, steps = 5): Point[] {
  const corners: readonly [number, number, number][] = [
    [a1 - r, z0 + r, -Math.PI / 2],
    [a1 - r, z1 - r, 0],
    [a0 + r, z1 - r, Math.PI / 2],
    [a0 + r, z0 + r, Math.PI],
  ];
  return corners.flatMap(([ca, cz, start]) =>
    Array.from({ length: steps + 1 }, (_, s) => {
      const t = start + (s / steps) * (Math.PI / 2);
      return facePoint(box, face, ca + Math.cos(t) * r, cz + Math.sin(t) * r);
    }),
  );
}

/** Small horizontal slots in a grid, for air intakes. */
export function vents(ctx: Ctx, box: BoxSpec, face: Face, a0: number, a1: number, z0: number, z1: number, cols: number, rows: number): void {
  const cw = (a1 - a0) / cols;
  const rh = (z1 - z0) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = a0 + c * cw;
      const z = z0 + r * rh;
      cutout(ctx, box, face, a + cw * 0.12, a + cw * 0.88, z + rh * 0.3, z + rh * 0.7);
    }
  }
}

/**
 * An RJ45 jack centered at `a`: a steel shield, the keyed opening, gold contacts and two link lights above.
 * With `lights`, the activity light is recorded so it blinks with traffic.
 */
export function rj45(
  ctx: Ctx,
  box: BoxSpec,
  face: Face,
  a: number,
  z: number,
  w: number,
  h: number,
  link: number | null,
  activity: number | null,
  lights?: BlinkLight[],
): void {
  fillPoly(ctx, facePoints(box, face, a - w / 2 - 0.32, a + w / 2 + 0.32, z - 0.3, z + h + 0.3), rgba(0xb8c2cf));
  fillPoly(ctx, facePoints(box, face, a - w / 2 - 0.32, a + w / 2 + 0.32, z - 0.3, z - 0.05), rgba(0xe5ebf2));
  fillPoly(ctx, facePoints(box, face, a - w / 2, a + w / 2, z + h * 0.3, z + h), rgba(0x020408));
  fillPoly(ctx, facePoints(box, face, a - w * 0.24, a + w * 0.24, z, z + h * 0.32), rgba(0x020408));
  fillPoly(ctx, facePoints(box, face, a - w * 0.36, a + w * 0.36, z + h - 0.5, z + h - 0.24), rgba(0xd9b45a, 0.9));
  if (link !== null) led(ctx, facePoint(box, face, a - w / 2 + 0.35, z + h + 0.85), link, 0.32);
  if (activity === null) return;
  const at = facePoint(box, face, a + w / 2 - 0.35, z + h + 0.85);
  if (lights) blinker(ctx, lights, at, activity, 0.32);
  else led(ctx, at, activity, 0.32);
}

/** An SFP cage: a wide steel-framed slot. */
export function sfpCage(ctx: Ctx, box: BoxSpec, face: Face, a0: number, a1: number, z0: number, z1: number): void {
  fillPoly(ctx, facePoints(box, face, a0 - 0.3, a1 + 0.3, z0 - 0.3, z1 + 0.3), rgba(0xd3dbe5));
  cutout(ctx, box, face, a0, a1, z0, z1);
  fillPoly(ctx, facePoints(box, face, a0 + 0.3, a1 - 0.3, z0 + 0.25, z0 + 0.45), "rgba(255,255,255,0.18)");
}

/** A screw head on a face. */
export function screw(ctx: Ctx, at: Point, radius = 0.45): void {
  const g = ctx.createRadialGradient(at.x - radius * 0.3, at.y - radius * 0.3, 0, at.x, at.y, radius);
  g.addColorStop(0, "#f1f5f9");
  g.addColorStop(1, "#64748b");
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  line(ctx, { x: at.x - radius * 0.6, y: at.y }, { x: at.x + radius * 0.6, y: at.y }, "rgba(15,23,42,0.7)", radius * 0.35);
}

/**
 * Tinted glass across a face: see-through, with two diagonal reflection streaks,
 * a bright glare along its top and a thin chrome frame.
 */
export function glassPane(ctx: Ctx, box: BoxSpec, face: Face, a0: number, a1: number, z0: number, z1: number, tint: number, opacity: number): void {
  const pane = facePoints(box, face, a0, a1, z0, z1);
  const body = downGradient(ctx, pane);
  body.addColorStop(0, rgba(shade(tint, 0.25), opacity * 0.7));
  body.addColorStop(1, rgba(tint, opacity));
  fillPoly(ctx, pane, body);

  const span = a1 - a0;
  const tall = z1 - z0;
  clipped(ctx, pane, () => {
    const streak = (from: number, width: number, alpha: number) => {
      const quad = [
        facePoint(box, face, a0 + span * from, z1),
        facePoint(box, face, a0 + span * (from + width), z1),
        facePoint(box, face, a0 + span * (from + width) - tall * 0.55, z0),
        facePoint(box, face, a0 + span * from - tall * 0.55, z0),
      ];
      const g = ctx.createLinearGradient(quad[0].x, quad[0].y, quad[3].x, quad[3].y);
      g.addColorStop(0, `rgba(255,255,255,${alpha})`);
      g.addColorStop(1, `rgba(255,255,255,${alpha * 0.2})`);
      fillPoly(ctx, quad, g);
    };
    streak(0.42, 0.2, 0.13);
    streak(0.7, 0.07, 0.09);
    streak(1.02, 0.12, 0.07);
  });
  fillPoly(ctx, facePoints(box, face, a0, a1, z1 - 0.55, z1), "rgba(255,255,255,0.2)");
  trace(ctx, pane);
  ctx.strokeStyle = "rgba(203,213,225,0.55)";
  ctx.lineWidth = 0.4;
  ctx.stroke();
}

/** A glowing line, as from an LED light pipe or neon tube. */
export function emissive(ctx: Ctx, points: readonly Point[], color: number, width: number, blur: number, closed = false): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = rgba(color, 0.95);
  ctx.shadowBlur = blur * Math.abs(ctx.getTransform().a);
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  if (closed) ctx.closePath();
  ctx.strokeStyle = rgba(color);
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.strokeStyle = rgba(shade(color, 0.7), 0.9);
  ctx.lineWidth = width * 0.4;
  ctx.stroke();
  ctx.restore();
}

/** Additive light spilling around a bright source, squashed into an ellipse. */
export function bloom(ctx: Ctx, at: Point, rx: number, ry: number, color: number, alpha: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(at.x, at.y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.4, rgba(color, alpha * 0.4));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/** Walls and top of a rounded slab, with a style per wall facet from its outward floor normal. */
export function roundSlab(
  ctx: Ctx,
  size: number,
  radius: number,
  z0: number,
  z1: number,
  wall: (quad: Point[], nu: number, nv: number) => string | CanvasGradient,
  top: (outline: Point[]) => string | CanvasGradient,
): { top: Point[]; base: Point[]; front: Point[][] } {
  const rim = footprint(0, 0, size, size, radius);
  const base = rim.map((p) => iso(p.u, p.v, z0));
  const upper = rim.map((p) => iso(p.u, p.v, z1));
  const front: Point[][] = [];
  for (let i = 0; i < rim.length; i++) {
    const j = (i + 1) % rim.length;
    const nu = rim[i].nu + rim[j].nu;
    const nv = rim[i].nv + rim[j].nv;
    if (nu + nv <= 0) continue;
    const quad = [base[i], base[j], upper[j], upper[i]];
    const style = wall(quad, nu / Math.hypot(nu, nv), nv / Math.hypot(nu, nv));
    trace(ctx, quad);
    ctx.fillStyle = style;
    ctx.fill();
    ctx.strokeStyle = style;
    ctx.lineWidth = 0.25;
    ctx.stroke();
    front.push(quad);
  }
  fillPoly(ctx, upper, top(upper));
  return { top: upper, base, front };
}

/** The visible (front) half of a rounded rim at height z, from its left extreme around to its right. */
export function frontArc(size: number, radius: number, z: number): Point[] {
  const rim = footprint(0, 0, size, size, radius);
  return rim.filter((p) => p.nu + p.nv > -0.05).map((p) => iso(p.u, p.v, z)).sort((a, b) => a.x - b.x);
}

/** A ring of a rounded outline at height z. */
export function rimRing(size: number, radius: number, z: number): Point[] {
  return footprint(0, 0, size, size, radius).map((p) => iso(p.u, p.v, z));
}

/** Text glowing on a face (a status display), drawn along the face's slant. */
export function faceGlowText(ctx: Ctx, box: BoxSpec, face: Face, a: number, z: number, text: string, size: number, color: number): void {
  const o = facePoint(box, face, a, z);
  ctx.save();
  ctx.transform(COS, face === "front" ? 0.5 : -0.5, 0, 1, o.x, o.y);
  ctx.font = `700 ${size}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = rgba(color, 0.9);
  ctx.shadowBlur = size * 0.8 * Math.abs(ctx.getTransform().a) / COS;
  ctx.fillStyle = rgba(shade(color, 0.5));
  ctx.fillText(text, 0, 0);
  ctx.restore();
}
