import type { DeviceKind } from "@/types/topology";
import { METAL, mix, MYSTERY, NEON, shade } from "../theme";
import { clayBox, contactShadow, faceText, fillPoly, floorRing, groove, led, rgba, signalArcs, sphere, type Ctx } from "./clayPainter";
import {
  bloom,
  blinker,
  cutout,
  emissive,
  faceGlowText,
  facePlate,
  faceRoundRect,
  frontArc,
  glassPane,
  line,
  metalBox,
  rimRing,
  rj45,
  roundSlab,
  screw,
  seeded,
  sfpCage,
  taperedBack,
  vents,
  type BlinkLight,
} from "./hardwarePainter";
import { facePoint, facePoints, iso, type BoxSpec, type Point } from "./iso";

/** Height of the glass pedestal every device stands on; models start at this z. */
export const PLINTH_TOP = 11;

const LED_WHITE = 0xf1f5f9;
const LED_OFF = 0x1e293b;

/**
 * Paints a model standing on the pedestal and returns the screen y of its highest point.
 * Activity lights that should blink on the live stage are added to `lights`.
 */
type ModelPainter = (ctx: Ctx, accent: number, lights: BlinkLight[]) => number;

/** Dark lines across the top of a box, like stamped vent slots. */
function topSlots(ctx: Ctx, box: BoxSpec, u0: number, u1: number, vs: readonly number[]): void {
  const { u = 0, v = 0, z = 0, h } = box;
  for (const vv of vs) {
    line(ctx, iso(u + u0, v + vv + 0.25, z + h), iso(u + u1, v + vv + 0.25, z + h), "rgba(255,255,255,0.16)", 0.35);
    line(ctx, iso(u + u0, v + vv, z + h), iso(u + u1, v + vv, z + h), "rgba(2,4,10,0.75)", 0.45);
  }
}

/** The glowing tube face of a CRT: a curved blue picture with terminal text, scanlines, vignette and a glass glare. */
function crtScreen(ctx: Ctx, box: BoxSpec, a0: number, a1: number, z0: number, z1: number, glow: number): void {
  const outline = faceRoundRect(box, "front", a0, a1, z0, z1, 1.8);
  const mid = facePoint(box, "front", (a0 + a1) / 2, (z0 + z1) / 2);
  const span = a1 - a0;
  ctx.save();
  ctx.beginPath();
  outline.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  const picture = ctx.createRadialGradient(mid.x - 1, mid.y - 1.5, 0, mid.x, mid.y, span * 0.75);
  picture.addColorStop(0, rgba(mix(glow, 0xffffff, 0.2)));
  picture.addColorStop(0.45, rgba(glow));
  picture.addColorStop(1, rgba(mix(glow, 0x020617, 0.75)));
  ctx.fillStyle = picture;
  ctx.fill();
  ctx.clip();

  const rows: readonly [number, number][] = [
    [0.1, 0.55],
    [0.1, 0.8],
    [0.1, 0.38],
    [0.1, 0.66],
    [0.1, 0.48],
  ];
  ctx.shadowColor = "rgba(255,255,255,0.9)";
  ctx.shadowBlur = 1.2 * Math.abs(ctx.getTransform().a);
  rows.forEach(([from, to], i) => {
    const zz = z1 - 2.4 - i * 2.4;
    if (zz - 0.5 < z0 + 1) return;
    fillPoly(ctx, facePoints(box, "front", a0 + span * from, a0 + span * to, zz - 0.45, zz + 0.45), "rgba(239,246,255,0.85)");
  });
  const cursor = z1 - 2.4 - rows.length * 2.4;
  if (cursor - 0.6 > z0 + 0.6) fillPoly(ctx, facePoints(box, "front", a0 + span * 0.1, a0 + span * 0.16, cursor - 0.6, cursor + 0.6), "#ffffff");
  ctx.shadowBlur = 0;

  for (let zz = z0 + 0.4; zz < z1; zz += 0.9) {
    fillPoly(ctx, facePoints(box, "front", a0, a1, zz, zz + 0.3), "rgba(2,6,23,0.18)");
  }
  const edge = ctx.createRadialGradient(mid.x, mid.y, span * 0.25, mid.x, mid.y, span * 0.72);
  edge.addColorStop(0, "rgba(0,0,0,0)");
  edge.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = edge;
  ctx.fillRect(mid.x - span, mid.y - span, span * 2, span * 2);

  // The bulging glass catches the room light in a soft curved glare.
  const glare = facePoint(box, "front", a0 + span * 0.28, z1 - (z1 - z0) * 0.22);
  ctx.translate(glare.x, glare.y);
  ctx.rotate(0.5);
  ctx.scale(1, 0.45);
  const shine = ctx.createRadialGradient(0, 0, 0, 0, 0, span * 0.42);
  shine.addColorStop(0, "rgba(255,255,255,0.32)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.fillRect(-span, -span, span * 2, span * 2);
  ctx.restore();

  ctx.beginPath();
  outline.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.strokeStyle = "rgba(2,4,10,0.85)";
  ctx.lineWidth = 0.6;
  ctx.stroke();
}

/** Keycaps across the top of a keyboard deck, with a long space bar in the front row. */
function keycaps(ctx: Ctx, board: BoxSpec, color: number): void {
  const { u = 0, v = 0, z = 0, w, d, h } = board;
  const zz = z + h;
  const cols = 12;
  const rows = 4;
  const pitchU = (w - 2) / cols;
  const pitchV = (d - 1.6) / rows;
  const cap = (u0: number, u1: number, v0: number, v1: number) => {
    const quad = [iso(u0, v1, zz), iso(u1, v1, zz), iso(u1, v0, zz), iso(u0, v0, zz)];
    fillPoly(
      ctx,
      quad.map((p) => ({ x: p.x, y: p.y + 0.35 })),
      "rgba(0,0,0,0.6)",
    );
    fillPoly(ctx, quad, rgba(color));
    line(ctx, quad[0], quad[1], "rgba(255,255,255,0.35)", 0.2);
  };
  for (let r = 0; r < rows; r++) {
    const v0 = v - d / 2 + 0.8 + r * pitchV;
    if (r === rows - 1) {
      cap(u - pitchU * 3, u + pitchU * 3, v0 + 0.2, v0 + pitchV - 0.2);
      continue;
    }
    for (let c = 0; c < cols; c++) {
      const u0 = u - w / 2 + 1 + c * pitchU;
      cap(u0 + 0.2, u0 + pitchU - 0.2, v0 + 0.2, v0 + pitchV - 0.2);
    }
  }
}

/** A dark rubber antenna with a chrome hinge and a status light at its tip. Returns the tip's screen point. */
function antenna(ctx: Ctx, u: number, v: number, z: number, length: number, tipColor: number): Point {
  metalBox(ctx, { u, v, z, w: 3.2, d: 3.2, h: 1.8 }, METAL.chrome, { brushed: false });
  const base = iso(u, v, z + 3);
  sphere(ctx, base, 1.25, METAL.pewter);
  const tip = iso(u, v, z + 3 + length);
  const rod = [
    { x: base.x - 0.95, y: base.y },
    { x: base.x + 0.95, y: base.y },
    { x: tip.x + 0.6, y: tip.y },
    { x: tip.x - 0.6, y: tip.y },
  ];
  const grad = ctx.createLinearGradient(base.x - 1, 0, base.x + 1, 0);
  grad.addColorStop(0, rgba(0x4b5563));
  grad.addColorStop(0.35, rgba(0x1f2937));
  grad.addColorStop(1, rgba(0x05070b));
  fillPoly(ctx, rod, grad);
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 0.6, Math.PI, 0);
  ctx.fillStyle = rgba(0x1f2937);
  ctx.fill();
  for (const t of [0.25, 0.32]) {
    const y = base.y + (tip.y - base.y) * t;
    line(ctx, { x: base.x - 0.9, y }, { x: base.x + 0.9, y }, "rgba(148,163,184,0.5)", 0.25);
  }
  line(ctx, { x: base.x - 0.55, y: base.y - 1 }, { x: tip.x - 0.3, y: tip.y + 1 }, "rgba(255,255,255,0.22)", 0.3);
  led(ctx, { x: tip.x, y: tip.y - 0.4 }, tipColor, 0.55);
  return tip;
}

const MODELS: Record<DeviceKind, ModelPainter> = {
  /** A retro workstation: steel desktop case with drive bays, a deep-backed CRT glowing blue on a swivel, keyboard and mouse. */
  pc(ctx, accent, lights) {
    const z = PLINTH_TOP;
    const casing = 0x9ba6b7;
    const glow = mix(accent, 0x60a5fa, 0.5);

    const chassis: BoxSpec = { u: 0, v: -3, z, w: 30, d: 24, h: 7 };
    contactShadow(ctx, { ...chassis, r: 1 }, 0.6, 2.4);
    metalBox(ctx, chassis, casing, { seed: 1 });
    facePlate(ctx, chassis, "front", -12.6, -2.4, 3.6, 5.8, shade(casing, -0.12));
    cutout(ctx, chassis, "front", -11.4, -3.6, 4.4, 4.9);
    facePlate(ctx, chassis, "front", -12.6, -2.4, 1, 3.1, shade(casing, -0.12));
    cutout(ctx, chassis, "front", -11.4, -6.6, 1.8, 2.2);
    vents(ctx, chassis, "front", 1, 7, 1.4, 5.6, 4, 5);
    led(ctx, facePoint(chassis, "front", 9.6, 4.6), shade(accent, 0.55), 0.5);
    blinker(ctx, lights, facePoint(chassis, "front", 11.4, 4.6), LED_WHITE, 0.4);
    cutout(ctx, chassis, "front", 9, 12, 1.4, 2.6, 0x111827);
    vents(ctx, chassis, "side", -10, -1, 1.4, 5.6, 5, 4);

    metalBox(ctx, { u: 0, v: -5.5, z: z + 7, w: 12, d: 9, h: 1.6 }, METAL.graphite, { brushed: false });

    const tubeTop = taperedBack(
      ctx,
      { v: -6, w: 24, z0: z + 9.6, z1: z + 29.6 },
      { v: -15.5, w: 13, z0: z + 13.6, z1: z + 25.6 },
      shade(casing, -0.06),
    );
    // The tube's top slopes down 4 units from the bezel (v = -6) to the back (v = -15.5).
    const tubeZ = (vv: number) => z + 29.6 - ((-6 - vv) / 9.5) * 4;
    for (let i = 0; i < 4; i++) {
      const uu = -3.6 + i * 2.4;
      line(ctx, iso(uu, -13, tubeZ(-13)), iso(uu, -8, tubeZ(-8)), "rgba(2,4,10,0.6)", 0.45);
    }

    const bezel: BoxSpec = { u: 0, v: -3, z: z + 8.6, w: 27, d: 6, h: 22 };
    const bezelTop = metalBox(ctx, bezel, shade(casing, 0.06), { seed: 2 });
    fillPoly(ctx, faceRoundRect(bezel, "front", -11.4, 11.4, 2.8, 20.2, 2.4), rgba(0x070b14));
    crtScreen(ctx, bezel, -10.4, 10.4, 3.6, 19.4, glow);
    led(ctx, facePoint(bezel, "front", 10.2, 1.4), shade(accent, 0.55), 0.45);
    for (const a of [6.4, 8]) cutout(ctx, bezel, "front", a, a + 0.9, 1, 1.8, 0x1e293b);
    faceText(ctx, bezel, "front", -8.5, 1.4, "CL-80", 1.6, "rgba(30,41,59,0.75)");
    bloom(ctx, facePoint(bezel, "front", 0, 11.5), 24, 17, glow, 0.2);

    const board: BoxSpec = { u: -2, v: 13, z, w: 26, d: 8, h: 1.8 };
    contactShadow(ctx, { ...board, r: 1 }, 0.55, 1.6);
    metalBox(ctx, board, METAL.graphite, { seed: 3, sheen: 0.4 });
    keycaps(ctx, board, 0x3f4a5c);
    bloom(ctx, iso(-2, 10, z + 2), 14, 5, glow, 0.14);

    ctx.lineCap = "round";
    ctx.beginPath();
    const from = iso(15.5, 9.8, z + 0.5);
    const via = iso(16, 6, z + 0.5);
    const to = iso(13, 8.6, z + 0.5);
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(via.x, via.y, to.x, to.y);
    ctx.strokeStyle = rgba(0x0b1120);
    ctx.lineWidth = 0.6;
    ctx.stroke();
    const mouse: BoxSpec = { u: 15.5, v: 13, z, w: 4.4, d: 6.2, h: 2, r: 2.2, bevel: 1 };
    contactShadow(ctx, mouse, 0.5, 1.2);
    clayBox(ctx, mouse, METAL.pewter);
    line(ctx, iso(15.5, 10.2, z + 2), iso(15.5, 12.2, z + 2), "rgba(2,4,10,0.6)", 0.3);
    return Math.min(tubeTop, bezelTop);
  },

  /** An industrial 2U edge router: brushed chassis, RJ45 and SFP uplinks, a status display, vents and two rubber antennas. */
  router(ctx, accent, lights) {
    const z = PLINTH_TOP;
    const rand = seeded(41);
    const lit = shade(accent, 0.55);
    const body: BoxSpec = { u: 0, v: 2, z, w: 34, d: 26, h: 13 };
    contactShadow(ctx, { ...body, r: 1 }, 0.6, 2.6);
    let top = metalBox(ctx, body, METAL.pewter, { seed: 4 });
    groove(ctx, facePoint(body, "front", -17, 6.5), facePoint(body, "front", 17, 6.5), METAL.pewter, 0.4);
    groove(ctx, facePoint(body, "side", 13, 6.5), facePoint(body, "side", -13, 6.5), shade(METAL.pewter, -0.42), 0.4);

    for (let i = 0; i < 6; i++) {
      rj45(ctx, body, "front", -13.6 + i * 3.3, 7.8, 2.5, 2.3, rand() > 0.2 ? lit : LED_OFF, rand() > 0.5 ? NEON.cyan : null, lights);
    }
    sfpCage(ctx, body, "front", 6.2, 9.2, 8, 9.9);
    sfpCage(ctx, body, "front", 10.2, 13.2, 8, 9.9);
    led(ctx, facePoint(body, "front", 7.7, 11.2), lit, 0.32);
    blinker(ctx, lights, facePoint(body, "front", 11.7, 11.2), LED_WHITE, 0.32);

    facePlate(ctx, body, "front", -15, -5, 1.6, 5.2, METAL.graphite);
    glassPane(ctx, body, "front", -14.4, -5.6, 2.1, 4.7, mix(accent, 0x020617, 0.75), 0.95);
    faceGlowText(ctx, body, "front", -10, 3.4, "EDGE-R1", 1.5, accent);
    [-3, -1.4, 0.2, 1.8].forEach((a, i) => {
      const at = facePoint(body, "front", a, 3.4);
      if (i === 3) blinker(ctx, lights, at, NEON.cyan, 0.42);
      else led(ctx, at, i === 0 ? LED_WHITE : lit, 0.42);
    });
    rj45(ctx, body, "front", 5, 2, 2.2, 2, null, null);
    vents(ctx, body, "front", 8.6, 15.6, 1.6, 5.2, 5, 3);
    for (const a of [-16.2, 16.2]) {
      for (const zz of [3.2, 9.8]) screw(ctx, facePoint(body, "front", a, zz));
    }

    vents(ctx, body, "side", -10, 6, 2, 11, 7, 6);
    topSlots(ctx, body, -14, 14, [-11, -10, -9, -8]);

    for (const u of [-12.5, 12.5]) {
      const tip = antenna(ctx, u, -8, z + 13, 21, u < 0 ? lit : NEON.cyan);
      top = Math.min(top, tip.y - 2);
    }
    return top;
  },

  /** A tall server rack: brushed cabinet, perforated side panels, a tinted glass door over six units of lit drive bays. */
  server(ctx, accent, lights) {
    const z = PLINTH_TOP;
    const rand = seeded(11);
    const lit = shade(accent, 0.5);
    const plinth: BoxSpec = { u: 0, v: 0, z, w: 27, d: 27, h: 2.4 };
    contactShadow(ctx, { ...plinth, r: 2 }, 0.6, 2.6);
    metalBox(ctx, plinth, METAL.black, { seed: 5, sheen: 0 });

    const rack: BoxSpec = { u: 0, v: 0, z: z + 2.4, w: 25, d: 25, h: 54 };
    const top = metalBox(ctx, rack, METAL.gunmetal, { seed: 6 });
    for (const [z0, z1] of [
      [4, 25],
      [29, 50],
    ] as const) {
      facePlate(ctx, rack, "side", 10.5, -10.5, z0, z1, shade(METAL.gunmetal, -0.45));
      vents(ctx, rack, "side", 9.4, -9.4, z0 + 1, z1 - 1, 7, 13);
    }
    topSlots(ctx, rack, -9, 9, [-8, -6.5, -5, -3.5, -2, -0.5]);
    for (const [uu, vv] of [
      [-10, -10],
      [10, -10],
      [-10, 10],
      [10, 10],
    ] as const) {
      sphere(ctx, iso(uu, vv, z + 56.4), 0.6, METAL.chrome);
    }

    fillPoly(ctx, facePoints(rack, "front", -11, 11, 2.2, 51.8), rgba(0x02040a));
    for (const a of [-10.6, 10.6]) fillPoly(ctx, facePoints(rack, "front", a - 0.35, a + 0.35, 2.4, 51.6), rgba(METAL.steel, 0.7));

    for (let i = 0; i < 6; i++) {
      const z0 = 3.2 + i * 8;
      const z1 = z0 + 7.3;
      facePlate(ctx, rack, "front", -10.2, 10.2, z0, z1, i % 2 === 0 ? 0x2c3646 : 0x323d4f);
      for (let b = 0; b < 5; b++) {
        const a = -9.6 + b * 3.2;
        facePlate(ctx, rack, "front", a, a + 2.8, z0 + 0.7, z1 - 0.6, METAL.graphite);
        cutout(ctx, rack, "front", a + 0.45, a + 2.35, z0 + 1.3, z0 + 1.8);
        const busy = rand() > 0.22;
        const color = rand() > 0.75 ? LED_WHITE : rand() > 0.5 ? NEON.cyan : lit;
        if (busy) {
          emissive(ctx, [facePoint(rack, "front", a + 0.5, z1 - 1.5), facePoint(rack, "front", a + 1.7, z1 - 1.5)], color, 0.4, 1.4);
          blinker(ctx, lights, facePoint(rack, "front", a + 2.25, z1 - 1.5), color, 0.36);
        } else {
          led(ctx, facePoint(rack, "front", a + 2.25, z1 - 1.5), LED_OFF, 0.3);
        }
      }
      led(ctx, facePoint(rack, "front", 7.4 + 1, z1 - 1.6), i === 2 ? NEON.cyan : lit, 0.42);
      blinker(ctx, lights, facePoint(rack, "front", 7.4 + 2, z1 - 1.6), LED_WHITE, 0.32);
      cutout(ctx, rack, "front", 6.9 + 0.5, 6.9 + 2.6, z0 + 1.2, z0 + 3.4);
    }
    bloom(ctx, facePoint(rack, "front", 0, 27), 17, 30, lit, 0.1);

    glassPane(ctx, rack, "front", -11.8, 11.8, 1.6, 52.4, 0x0b1a30, 0.34);
    fillPoly(ctx, facePoints(rack, "front", 9.6, 10.4, 21, 33), rgba(METAL.chrome));
    fillPoly(ctx, facePoints(rack, "front", 9.6, 9.85, 21, 33), "rgba(255,255,255,0.6)");
    emissive(ctx, [facePoint(rack, "front", -12.1, 3), facePoint(rack, "front", -12.1, 51)], accent, 0.4, 2.2);
    faceGlowText(ctx, rack, "front", -4, 53.2, "CL-RACK", 1.3, accent);
    return top;
  },

  /** A 1U managed switch: steel chassis with rack ears, two rows of RJ45 ports with link lights, SFP uplinks and a console port. */
  switch(ctx, accent, lights) {
    const z = PLINTH_TOP;
    const rand = seeded(23);
    const lit = shade(accent, 0.55);
    const steel = 0x6c788a;
    const body: BoxSpec = { u: 0, v: 3, z, w: 40, d: 22, h: 8.6 };
    contactShadow(ctx, { ...body, r: 1 }, 0.6, 2.6);
    const top = metalBox(ctx, body, steel, { seed: 7 });
    vents(ctx, body, "side", -8, 8, 1.6, 7, 8, 3);
    topSlots(ctx, body, -16, 16, [-8.6, -7.6, -6.6]);
    fillPoly(ctx, [iso(-14, 1, z + 8.6), iso(2, 1, z + 8.6), iso(2, 7, z + 8.6), iso(-14, 7, z + 8.6)], "rgba(255,255,255,0.08)");

    for (let i = 0; i < 10; i++) {
      const a = -16.6 + i * 2.95;
      rj45(ctx, body, "front", a, 4.4, 2.3, 2.1, rand() > 0.25 ? lit : LED_OFF, rand() > 0.45 ? NEON.cyan : rand() > 0.5 ? LED_WHITE : null, lights);
      rj45(ctx, body, "front", a, 0.9, 2.3, 2.1, null, null);
    }
    facePlate(ctx, body, "front", 12.4, 19.2, 0.6, 8, shade(steel, -0.35));
    sfpCage(ctx, body, "front", 12.9, 15.5, 4.6, 6.3);
    sfpCage(ctx, body, "front", 16.1, 18.7, 4.6, 6.3);
    led(ctx, facePoint(body, "front", 14.2, 7.2), lit, 0.3);
    blinker(ctx, lights, facePoint(body, "front", 17.4, 7.2), NEON.cyan, 0.3);
    rj45(ctx, body, "front", 14.2, 1.2, 2, 1.9, null, null);
    led(ctx, facePoint(body, "front", 17, 2.4), LED_WHITE, 0.36);
    led(ctx, facePoint(body, "front", 18.4, 2.4), lit, 0.36);

    for (const u of [-20.9, 20.9]) {
      const ear: BoxSpec = { u, v: 14.4, z, w: 1.8, d: 1.2, h: 8.6 };
      metalBox(ctx, ear, METAL.chrome, { brushed: false, sheen: 0.4 });
      for (const zz of [2.2, 6.4]) screw(ctx, facePoint(ear, "front", 0, zz), 0.5);
    }
    return top;
  },

  /** A smart security camera: steel pole on a round foot, a white dome with an accent ring, a glass lens and wireless waves. */
  iot(ctx, accent) {
    const z = PLINTH_TOP;
    const foot: BoxSpec = { z, w: 16, d: 16, h: 2.4, r: 8, bevel: 0.8 };
    contactShadow(ctx, foot, 0.55, 2.2);
    clayBox(ctx, foot, METAL.graphite);
    clayBox(ctx, { z: z + 2.4, w: 3.6, d: 3.6, h: 12, r: 1.8, bevel: 0.6, gloss: false }, METAL.steel);
    sphere(ctx, iso(0, 0, z + 15), 2.4, METAL.pewter);
    const dome: BoxSpec = { z: z + 15, w: 20, d: 20, h: 10, r: 10, bevel: 4.6 };
    const top = clayBox(ctx, dome, 0xd5dce6);
    floorRing(ctx, 0, 0, z + 15.6, 10.05, accent, 0.9);

    const lens = iso(7.2, 7.2, z + 19.4);
    sphere(ctx, lens, 4.4, METAL.black);
    ctx.beginPath();
    ctx.arc(lens.x, lens.y, 3.3, 0, Math.PI * 2);
    const glass = ctx.createRadialGradient(lens.x - 0.9, lens.y - 1, 0.2, lens.x, lens.y, 3.3);
    glass.addColorStop(0, rgba(mix(accent, 0x334155, 0.5)));
    glass.addColorStop(0.55, rgba(0x0b1222));
    glass.addColorStop(1, rgba(0x020617));
    ctx.fillStyle = glass;
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * Math.PI * 2;
      led(ctx, { x: lens.x + Math.cos(t) * 3.85, y: lens.y + Math.sin(t) * 3.85 }, shade(accent, 0.3), 0.22);
    }
    ctx.beginPath();
    ctx.arc(lens.x - 1.1, lens.y - 1.2, 0.8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fill();

    const radii = [7.5, 12] as const;
    signalArcs(ctx, { x: 0, y: top + 2 }, radii, shade(accent, 0.6));
    return top + 2 - radii[1] - 2;
  },

  /** A hardened firewall appliance: a brushed steel wall of bricks with glowing mortar, crowned with battlements. */
  firewall(ctx, accent, lights) {
    const z = PLINTH_TOP;
    const rand = seeded(31);
    const wall: BoxSpec = { u: 0, v: 3, z, w: 38, d: 13, h: 24 };
    contactShadow(ctx, { ...wall, r: 1 }, 0.6, 2.6);
    metalBox(ctx, wall, METAL.gunmetal, { seed: 8 });
    for (let row = 0; row < 4; row++) {
      const z0 = row * 6;
      const joints = row % 2 === 0 ? [-19, -6.3, 6.3, 19] : [-19, -12.6, 0, 12.6, 19];
      for (let j = 0; j < joints.length - 1; j++) {
        facePlate(ctx, wall, "front", joints[j] + 0.4, joints[j + 1] - 0.4, z0 + 0.45, z0 + 5.55, shade(METAL.gunmetal, rand() * 0.14 - 0.04));
      }
      for (const a of joints.slice(1, -1)) {
        emissive(ctx, [facePoint(wall, "front", a, z0 + 0.6), facePoint(wall, "front", a, z0 + 5.4)], accent, 0.3, 1.4);
      }
      const sideJoints = row % 2 === 0 ? [6.5, 0, -6.5] : [6.5, 3, -3, -6.5];
      for (let j = 0; j < sideJoints.length - 1; j++) {
        facePlate(ctx, wall, "side", sideJoints[j] - 0.35, sideJoints[j + 1] + 0.35, z0 + 0.45, z0 + 5.55, shade(METAL.gunmetal, -0.42));
      }
    }
    for (const zz of [6, 12, 18]) {
      emissive(ctx, [facePoint(wall, "front", -18.6, zz), facePoint(wall, "front", 18.6, zz)], accent, 0.3, 1.6);
      emissive(ctx, [facePoint(wall, "side", 6.2, zz), facePoint(wall, "side", -6.2, zz)], shade(accent, -0.3), 0.25, 1.2);
    }
    bloom(ctx, facePoint(wall, "front", 0, 12), 22, 14, accent, 0.1);

    let top = Infinity;
    [-13.5, 0, 13.5].forEach((u, i) => {
      const merlon: BoxSpec = { u, v: 3, z: z + 24, w: 9, d: 13, h: 6 };
      top = Math.min(top, metalBox(ctx, merlon, shade(METAL.gunmetal, 0.08), { seed: 9 + i }));
    });
    blinker(ctx, lights, facePoint(wall, "front", 16.4, 22.6), accent, 0.45);
    return top;
  },
};

export function paintDeviceModel(ctx: Ctx, kind: DeviceKind, accent: number, lights: BlinkLight[]): number {
  return MODELS[kind](ctx, accent, lights);
}

/**
 * The glass pedestal: a dark metal foot, a translucent glass body with a neon band
 * inside it, and a dark glass cap ringed in neon with a glowing emitter at its center.
 * With `lit` false the neon is switched off, for a device nobody has verified yet.
 */
export function paintPedestal(ctx: Ctx, lit: boolean): void {
  const neon = lit ? NEON.blue : NEON.off;
  const power = lit ? 1 : 0.4;
  const vertical = (quad: readonly Point[], from: string, to: string) => {
    const ys = quad.map((p) => p.y);
    const g = ctx.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
    g.addColorStop(0, from);
    g.addColorStop(1, to);
    return g;
  };

  roundSlab(
    ctx,
    46,
    10,
    0,
    3,
    (quad, nu) => vertical(quad, rgba(shade(0x1f2a40, nu * 0.15)), rgba(0x05080f)),
    () => rgba(0x0b1220),
  );
  emissive(ctx, frontArc(46, 10, 0.4), neon, 0.35, 1.6 * power);

  roundSlab(
    ctx,
    41,
    8,
    3,
    9,
    (quad, nu, nv) => {
      const facing = Math.max(0, nv * 0.8 - nu * 0.3);
      return vertical(quad, rgba(neon, (0.12 + facing * 0.16) * power + 0.06), rgba(0x060d1d, 0.92));
    },
    () => rgba(0x0a1428),
  );
  ctx.save();
  ctx.globalAlpha = lit ? 1 : 0.6;
  emissive(ctx, frontArc(41, 8, 6), neon, 0.5, 2.4 * power);
  ctx.restore();
  for (const [u, v] of [
    [-12, 20.5],
    [20.5, -6],
    [20.5, 12],
  ] as const) {
    line(ctx, iso(u, v, 3.4), iso(u, v, 8.6), "rgba(255,255,255,0.12)", 0.4);
  }

  const cap = roundSlab(
    ctx,
    44,
    10,
    9,
    11,
    (quad, nu) => vertical(quad, rgba(shade(0x24324d, nu * 0.1)), rgba(0x0b1220)),
    (outline) => {
      const ys = outline.map((p) => p.y);
      const g = ctx.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
      g.addColorStop(0, rgba(0x15223b));
      g.addColorStop(1, rgba(0x070d1a));
      return g;
    },
  );
  ctx.save();
  ctx.beginPath();
  cap.top.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = rgba(neon, 0.05 + 0.07 * power);
  ctx.lineWidth = 0.3;
  for (let k = -20; k <= 20; k += 4) {
    ctx.beginPath();
    const a = iso(-22, k, 11);
    const b = iso(22, k, 11);
    const c = iso(k, -22, 11);
    const d = iso(k, 22, 11);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
  }
  bloom(ctx, iso(0, 0, 11), 18, 10.4, neon, 0.28 * power);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.55;
  emissive(ctx, rimRing(32, 16, 11), neon, 0.3, 1.4 * power, true);
  ctx.restore();
  emissive(ctx, rimRing(44, 10, 11), neon, 0.65, 2.8 * power, true);
  emissive(ctx, frontArc(44, 10, 9.1), neon, 0.3, 1.2 * power);
}

/** The placeholder for an unverified device: a sealed steel crate with stenciled "?" panels. Returns its top y. */
export function paintMysteryCrate(ctx: Ctx): number {
  const crate: BoxSpec = { z: PLINTH_TOP, w: 28, d: 28, h: 26 };
  contactShadow(ctx, { ...crate, r: 1 }, 0.6, 2.6);
  const top = metalBox(ctx, crate, MYSTERY.cube, { seed: 12, sheen: 0.5 });
  for (const face of ["front", "side"] as const) {
    const [a0, a1] = face === "front" ? [-10.5, 10.5] : [10.5, -10.5];
    facePlate(ctx, crate, face, a0, a1, 3, 23, shade(MYSTERY.cube, face === "front" ? -0.2 : -0.5));
    faceText(ctx, crate, face, 0, 13, "?", 12, rgba(MYSTERY.glow, 0.5));
    for (const a of [-12.8, 12.8]) {
      for (const zz of [2, 24]) screw(ctx, facePoint(crate, face, a, zz), 0.55);
    }
  }
  return top;
}
