import type { DeviceKind } from "@/types/topology";
import { CLAY_LIGHT, mix, MYSTERY, shade } from "../theme";
import {
  clayBox,
  contactShadow,
  faceText,
  floorRing,
  groove,
  led,
  recess,
  rgba,
  screen,
  signalArcs,
  sphere,
  topPoints,
  type Ctx,
} from "./clayPainter";
import { facePoint, iso, type BoxSpec } from "./iso";

/** Height of the two-tier plinth every device stands on; models start at this z. */
export const PLINTH_TOP = 10;

const GLASS = 0x0b1222;
const LED_WHITE = 0xf1f5f9;

/** Paints a model standing on the plinth and returns the screen y of its highest point. */
type ModelPainter = (ctx: Ctx, accent: number) => number;

const MODELS: Record<DeviceKind, ModelPainter> = {
  /** A chunky all-in-one desktop: molded body on a foot, recessed glowing screen, keyboard and mouse. */
  pc(ctx, accent) {
    const z = PLINTH_TOP;
    const foot: BoxSpec = { u: 0, v: -5, z, w: 22, d: 16, h: 2.5, r: 4, bevel: 1 };
    contactShadow(ctx, foot, 0.55, 2.4);
    clayBox(ctx, foot, shade(accent, -0.35));

    const body: BoxSpec = { u: 0, v: -5, z: z + 2.5, w: 28, d: 20, h: 30, r: 4, bevel: 3.4 };
    const top = clayBox(ctx, body, accent);
    recess(ctx, body, "front", -9.6, 9.6, 9.2, 25.2, shade(accent, -0.55), accent);
    screen(ctx, body, "front", -8.4, 8.4, 10.3, 24.1, accent);
    groove(ctx, facePoint(body, "front", 2.5, 5), facePoint(body, "front", 8.5, 5), accent, 1);
    led(ctx, facePoint(body, "front", -7.5, 5), LED_WHITE, 0.8);
    for (let i = 0; i < 5; i++) {
      groove(ctx, facePoint(body, "side", -5, 17 + i * 2), facePoint(body, "side", 5, 17 + i * 2), accent, 0.7);
    }
    for (let i = 0; i < 4; i++) {
      groove(ctx, iso(-6 + i * 2.2, -11, z + 32.5), iso(-6 + i * 2.2, -3, z + 32.5), accent, 0.7);
    }

    const keys = mix(CLAY_LIGHT, accent, 0.14);
    const board: BoxSpec = { u: -2, v: 12, z, w: 26, d: 8, h: 2.6, r: 2.4, bevel: 1.1 };
    contactShadow(ctx, board, 0.5, 1.6);
    clayBox(ctx, board, keys);
    const cap = shade(keys, 0.12);
    for (let row = 0; row < 3; row++) {
      const vv = 9.7 + row * 2.3;
      if (row === 2) {
        clayBox(ctx, { u: -2, v: vv, z: z + 2.6, w: 11, d: 1.7, h: 0.7, r: 0.6, bevel: 0.35, gloss: false }, cap);
        continue;
      }
      for (let col = 0; col < 9; col++) {
        clayBox(ctx, { u: -13 + col * 2.75, v: vv, z: z + 2.6, w: 2.1, d: 1.7, h: 0.7, r: 0.6, bevel: 0.35, gloss: false }, cap);
      }
    }
    const mouse: BoxSpec = { u: 15.5, v: 12, z, w: 5, d: 7, h: 2.8, r: 2.5, bevel: 1.4 };
    contactShadow(ctx, mouse, 0.5, 1.4);
    clayBox(ctx, mouse, keys);
    groove(ctx, iso(15.5, 8.8, z + 2.8), iso(15.5, 11.5, z + 2.8), keys, 0.5);
    return top;
  },

  /** A wide molded router: grille on top, two antennas with ball tips, status lights and ports. */
  router(ctx, accent) {
    const z = PLINTH_TOP;
    const body: BoxSpec = { u: 0, v: 3, z, w: 34, d: 24, h: 11, r: 6, bevel: 3.6 };
    contactShadow(ctx, body, 0.55, 2.6);
    clayBox(ctx, body, accent);
    for (let i = 0; i < 4; i++) {
      groove(ctx, iso(-1, 2 + i * 2.4, z + 11), iso(10, 2 + i * 2.4, z + 11), accent, 0.8);
    }
    recess(ctx, body, "front", -10.5, -1, 2.8, 6.8, shade(accent, -0.6), accent);
    [-8.6, -5.8, -3].forEach((a, i) => led(ctx, facePoint(body, "front", a, 4.9), i === 2 ? shade(accent, 0.6) : LED_WHITE, 0.85));
    for (const a of [-5.2, -1.3, 2.6]) {
      recess(ctx, body, "side", a, a + 2.6, 2.8, 6.2, GLASS, accent);
    }

    let top = Infinity;
    for (const u of [-11, 11]) {
      const mount: BoxSpec = { u, v: -5, z: z + 11, w: 6, d: 5, h: 3, r: 2, bevel: 1 };
      contactShadow(ctx, mount, 0.4, 1.2);
      clayBox(ctx, mount, shade(accent, -0.3));
      clayBox(ctx, { u, v: -5, z: z + 14, w: 3.2, d: 3.2, h: 19, r: 1.6, bevel: 1, gloss: false }, shade(accent, -0.12));
      const tip = iso(u, -5, z + 35);
      sphere(ctx, tip, 3, shade(accent, 0.35));
      top = Math.min(top, tip.y - 3);
    }
    return top;
  },

  /** A tall tower on a foot, with three hot-swap bays and vents. */
  server(ctx, accent) {
    const z = PLINTH_TOP;
    const foot: BoxSpec = { u: 0, v: 0, z, w: 26, d: 28, h: 3, r: 5, bevel: 1.2 };
    contactShadow(ctx, foot, 0.55, 2.6);
    clayBox(ctx, foot, shade(accent, -0.38));
    const body: BoxSpec = { u: 0, v: 0, z: z + 3, w: 24, d: 26, h: 40, r: 4.5, bevel: 3.6 };
    const top = clayBox(ctx, body, accent);
    for (const z0 of [5, 15, 25]) {
      recess(ctx, body, "front", -7, 7, z0, z0 + 8, shade(accent, -0.5), accent);
      const bar = facePoint(body, "front", -5.2, z0 + 4.4);
      const barEnd = facePoint(body, "front", 2, z0 + 4.4);
      ctx.lineCap = "round";
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = rgba(shade(accent, 0.2));
      ctx.beginPath();
      ctx.moveTo(bar.x, bar.y);
      ctx.lineTo(barEnd.x, barEnd.y);
      ctx.stroke();
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = rgba(shade(accent, 0.6));
      ctx.beginPath();
      ctx.moveTo(bar.x, bar.y - 0.5);
      ctx.lineTo(barEnd.x, barEnd.y - 0.5);
      ctx.stroke();
      led(ctx, facePoint(body, "front", 4, z0 + 4.4), LED_WHITE, 0.8);
      led(ctx, facePoint(body, "front", 5.9, z0 + 4.4), shade(accent, 0.6), 0.8);
    }
    for (let i = 0; i < 6; i++) {
      groove(ctx, facePoint(body, "side", -6.5, 22 + i * 2), facePoint(body, "side", 6.5, 22 + i * 2), accent, 0.75);
    }
    for (let i = 0; i < 4; i++) {
      groove(ctx, iso(-5, -6 + i * 2.6, z + 43), iso(5, -6 + i * 2.6, z + 43), accent, 0.75);
    }
    return top;
  },

  /** A long low switch with a row of ports, each with its own link light. */
  switch(ctx, accent) {
    const z = PLINTH_TOP;
    const body: BoxSpec = { u: 0, v: 2, z, w: 38, d: 20, h: 10, r: 4.5, bevel: 3 };
    contactShadow(ctx, body, 0.55, 2.6);
    const top = clayBox(ctx, body, accent);
    for (let i = 0; i < 8; i++) {
      const a = -13.6 + i * 3.5;
      recess(ctx, body, "front", a, a + 2.6, 1.8, 4.8, GLASS, accent);
      led(ctx, facePoint(body, "front", a + 1.3, 6.1), i % 3 === 1 ? shade(accent, 0.6) : LED_WHITE, 0.55);
    }
    for (let i = 0; i < 3; i++) {
      groove(ctx, facePoint(body, "side", -4, 2.5 + i * 1.8), facePoint(body, "side", 4, 2.5 + i * 1.8), accent, 0.6);
    }
    const plate = topPoints(body, -12, 6, -3, 3);
    const grad = ctx.createLinearGradient(plate[0].x, plate[0].y, plate[2].x, plate[2].y);
    grad.addColorStop(0, rgba(0xffffff, 0.22));
    grad.addColorStop(1, rgba(0xffffff, 0.06));
    ctx.fillStyle = grad;
    ctx.beginPath();
    plate.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
    return top;
  },

  /** A round smart camera: footed cylinder, light cap with a glowing ring, big glass lens and wireless waves. */
  iot(ctx, accent) {
    const z = PLINTH_TOP;
    const foot: BoxSpec = { z, w: 16, d: 16, h: 3, r: 8, bevel: 1.2 };
    contactShadow(ctx, foot, 0.55, 2.2);
    clayBox(ctx, foot, shade(accent, -0.38));
    clayBox(ctx, { z: z + 3, w: 21, d: 21, h: 15, r: 10.5, bevel: 3.2 }, accent);
    const cap: BoxSpec = { z: z + 18, w: 14, d: 14, h: 4, r: 7, bevel: 2.2 };
    contactShadow(ctx, cap, 0.35, 1.2);
    const capTop = clayBox(ctx, cap, shade(accent, 0.38));
    floorRing(ctx, 0, 0, z + 18.05, 8.4, shade(accent, 0.7), 0.7);

    const lens = iso(7.4, 7.4, z + 10.5);
    sphere(ctx, lens, 5.2, shade(accent, -0.5));
    ctx.beginPath();
    ctx.arc(lens.x, lens.y, 3.9, 0, Math.PI * 2);
    const glass = ctx.createRadialGradient(lens.x - 1, lens.y - 1.2, 0.3, lens.x, lens.y, 3.9);
    glass.addColorStop(0, rgba(0x334155));
    glass.addColorStop(0.6, rgba(GLASS));
    glass.addColorStop(1, rgba(0x020617));
    ctx.fillStyle = glass;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lens.x, lens.y, 2.3, 0, Math.PI * 2);
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = rgba(shade(accent, 0.55), 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(lens.x - 1.2, lens.y - 1.3, 0.9, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fill();
    led(ctx, iso(10.2, 2.6, z + 13.5), shade(accent, 0.65), 0.7);

    const radii = [7.5, 12] as const;
    signalArcs(ctx, { x: 0, y: capTop + 3 }, radii, shade(accent, 0.6));
    return capTop + 3 - radii[1] - 2;
  },

  /** A chunky brick wall with merlons. */
  firewall(ctx, accent) {
    const z = PLINTH_TOP;
    const wall: BoxSpec = { u: 0, v: 2, z, w: 38, d: 12, h: 24, r: 3, bevel: 2 };
    contactShadow(ctx, wall, 0.55, 2.6);
    clayBox(ctx, wall, accent);
    for (const zz of [6, 12, 18]) {
      groove(ctx, facePoint(wall, "front", -16, zz), facePoint(wall, "front", 16, zz), accent, 0.9);
      groove(ctx, facePoint(wall, "side", -3, zz), facePoint(wall, "side", 3, zz), accent, 0.9);
    }
    const joints: readonly (readonly number[])[] = [[-6, 6], [-12, 0, 12], [-6, 6], [-12, 0, 12]];
    joints.forEach((row, i) => {
      for (const a of row) groove(ctx, facePoint(wall, "front", a, i * 6 + 0.6), facePoint(wall, "front", a, i * 6 + 5.4), accent, 0.9);
    });
    let top = Infinity;
    for (const u of [-13, 0, 13]) {
      const merlon: BoxSpec = { u, v: 2, z: z + 24, w: 9, d: 12, h: 6, r: 2, bevel: 1.5 };
      contactShadow(ctx, merlon, 0.4, 1.2);
      top = Math.min(top, clayBox(ctx, merlon, shade(accent, 0.06)));
    }
    return top;
  },
};

/**
 * The two-tier base: a trim slab and a lighter top slab with a ledge between them.
 * `lights` adds three small status lights along the trim.
 */
export function paintPlinth(ctx: Ctx, trim: number, surface: number, lights: number | null): void {
  const base: BoxSpec = { w: 46, d: 46, h: 5, r: 11, bevel: 1.6 };
  clayBox(ctx, base, trim);
  if (lights !== null) {
    for (const a of [-7, -3.5, 0]) led(ctx, facePoint(base, "front", a, 2.2), lights, 0.7);
  }
  const top: BoxSpec = { z: 5, w: 40, d: 40, h: 5, r: 9, bevel: 2.4 };
  contactShadow(ctx, top, 0.4, 1.4);
  clayBox(ctx, top, surface);
}

/** Plinth colors for a verified device: an accent trim under soft off-white clay tinted toward the accent. */
export function plinthColors(accent: number): { trim: number; surface: number; lights: number } {
  return { trim: shade(accent, -0.2), surface: mix(CLAY_LIGHT, accent, 0.2), lights: shade(accent, 0.6) };
}

export function paintDeviceModel(ctx: Ctx, kind: DeviceKind, accent: number): number {
  return MODELS[kind](ctx, accent);
}

/** The placeholder for an unverified device: a dark sealed crate with stenciled "?" panels. Returns its top y. */
export function paintMysteryCrate(ctx: Ctx): number {
  const crate: BoxSpec = { z: PLINTH_TOP, w: 28, d: 28, h: 26, r: 6, bevel: 3.4 };
  contactShadow(ctx, crate, 0.55, 2.6);
  const top = clayBox(ctx, crate, MYSTERY.cube);
  for (const face of ["front", "side"] as const) {
    recess(ctx, crate, face, -6.5, 6.5, 5, 19.5, shade(MYSTERY.cube, -0.25), MYSTERY.cube);
    faceText(ctx, crate, face, 0, 12, "?", 11, rgba(MYSTERY.glow, 0.45));
  }
  const lid = topPoints(crate, -7, 7, -7, 7);
  lid.forEach((p, i) => groove(ctx, p, lid[(i + 1) % lid.length], MYSTERY.cube, 0.8));
  return top;
}
