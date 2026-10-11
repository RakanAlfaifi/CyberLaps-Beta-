import type Phaser from "phaser";
import type { SlabColors } from "../theme";

type Gfx = Phaser.GameObjects.Graphics;

export interface Point {
  x: number;
  y: number;
}

const COS = Math.cos(Math.PI / 6);
const SIN = 0.5;
/** Slope of the isometric floor axes on screen (tan 30°). */
export const ISO_SLOPE = SIN / COS;

/**
 * The board is seen from above at a tilt, so its depth axis is a little foreshortened.
 * Level layouts were authored top-down; this keeps their spacing while adding perspective.
 */
export const BOARD_TILT = 0.88;

/** Level (board) coordinates to stage world coordinates. */
export function boardToWorld(x: number, y: number): Point {
  return { x, y: y * BOARD_TILT };
}

/** Screen offset of a point in a model's local 3D space: `u` runs down-right, `v` down-left, `z` up. */
export function iso(u: number, v: number, z = 0): Point {
  return { x: (u - v) * COS, y: (u + v) * SIN - z };
}

/** A rounded box: footprint centered on (u, v), standing on height z. */
export interface BoxSpec {
  u?: number;
  v?: number;
  z?: number;
  /** Size along u. */
  w: number;
  /** Size along v. */
  d: number;
  /** Height. */
  h: number;
  /** Corner radius of the footprint. Half the footprint gives a cylinder. */
  r?: number;
  /** Width of the lit rim around the top face. */
  bevel?: number;
  /** Soft specular spot on the top face. */
  gloss?: boolean;
}

export interface RimPoint {
  u: number;
  v: number;
  /** Outward normal on the floor plane. */
  nu: number;
  nv: number;
}

const CORNER_STEPS = 8;

/** Rounded-rectangle footprint, sampled corner by corner with outward normals. */
export function footprint(cu: number, cv: number, w: number, d: number, r: number): RimPoint[] {
  const hw = w / 2;
  const hd = d / 2;
  const rr = Math.max(0.01, Math.min(r, hw, hd));
  const cx = hw - rr;
  const cy = hd - rr;
  const centers: readonly [number, number][] = [
    [cx, cy],
    [-cx, cy],
    [-cx, -cy],
    [cx, -cy],
  ];
  const points: RimPoint[] = [];
  centers.forEach(([ou, ov], quadrant) => {
    for (let s = 0; s <= CORNER_STEPS; s++) {
      const a = (quadrant + s / CORNER_STEPS) * (Math.PI / 2);
      const nu = Math.cos(a);
      const nv = Math.sin(a);
      points.push({ u: cu + ou + rr * nu, v: cv + ov + rr * nv, nu, nv });
    }
  });
  return points;
}

export function convexHull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/** "front" is the +v side (faces down-left, lit); "side" is the +u side (faces down-right, shaded). */
export type Face = "front" | "side";

/** A point on a box's flat side: `a` runs along the face, `z` is measured up from the box's base. */
export function facePoint(box: BoxSpec, face: Face, a: number, z: number): Point {
  const { u = 0, v = 0, z: base = 0, w, d } = box;
  return face === "front" ? iso(u + a, v + d / 2, base + z) : iso(u + w / 2, v + a, base + z);
}

/** Corners of a rectangle painted on a box's flat side, for screens, panels and seams. */
export function facePoints(box: BoxSpec, face: Face, a0: number, a1: number, z0: number, z1: number): Point[] {
  return [facePoint(box, face, a0, z0), facePoint(box, face, a1, z0), facePoint(box, face, a1, z1), facePoint(box, face, a0, z1)];
}

/** Stacked translucent ellipses read as one soft shadow. */
export function softShadow(g: Gfx, x: number, y: number, rx: number, ry: number, strength = 0.34, layers = 5): void {
  for (let i = 0; i < layers; i++) {
    const k = 1 + (i / Math.max(1, layers - 1)) * 0.5;
    g.fillStyle(0x000000, strength / layers);
    g.fillEllipse(x, y, rx * 2 * k, ry * 2 * k);
  }
}

/** A thick rounded plate seen from the front-top: lit rim, beveled top, and a front edge that darkens downward. */
export function slab(g: Gfx, x: number, y: number, w: number, h: number, depth: number, radius: number, c: SlabColors): void {
  const r = Math.min(radius, w / 2, h / 2);
  g.fillStyle(c.frontDark, 1);
  g.fillRoundedRect(x, y + depth, w, h, r);
  g.fillStyle(c.front, 1);
  g.fillRoundedRect(x, y + depth * 0.45, w, h, r);
  g.fillStyle(c.rim, 1);
  g.fillRoundedRect(x, y, w, h, r);
  g.fillStyle(c.top, 1);
  g.fillRoundedRect(x + 2, y + 2.5, w - 4, h - 4, Math.max(1, r - 2));
}

/**
 * Isometric floor tiles inside a rectangle: two families of parallel lines at
 * ±30°, anchored to the world origin so tiles line up across plates.
 */
export function isoGrid(g: Gfx, rect: Phaser.Geom.Rectangle, spacing: number): void {
  for (const m of [ISO_SLOPE, -ISO_SLOPE]) {
    const corners = [rect.left, rect.right].flatMap((x) => [rect.top, rect.bottom].map((y) => y - m * x));
    const from = Math.ceil(Math.min(...corners) / spacing) * spacing;
    const to = Math.max(...corners);
    for (let b = from; b <= to; b += spacing) {
      let xa = (rect.top - b) / m;
      let xb = (rect.bottom - b) / m;
      if (xa > xb) [xa, xb] = [xb, xa];
      const lo = Math.max(rect.left, xa);
      const hi = Math.min(rect.right, xb);
      if (hi - lo < 1) continue;
      g.lineBetween(lo, m * lo + b, hi, m * hi + b);
    }
  }
}
