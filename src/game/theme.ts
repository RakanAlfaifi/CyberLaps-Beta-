import type { DeviceKind, PacketOutcome } from "@/types/topology";

/** Mirrors the Tailwind tokens in tailwind.config.ts. Keep the color meanings identical. */
export const PALETTE = {
  void: 0x0b0f19,
  surface: 0x111827,
  surfaceRaised: 0x161e2e,
  line: 0x1f2a3d,
  lineStrong: 0x2c3b55,
  ink: 0xe5e7eb,
  inkMuted: 0x9ca3af,
  inkFaint: 0x6b7280,
  emerald: 0x10b981,
  emeraldGlow: 0x34d399,
  blue: 0x3b82f6,
  blueGlow: 0x60a5fa,
  amber: 0xf59e0b,
  amberGlow: 0xfbbf24,
  red: 0xef4444,
  redGlow: 0xf87171,
} as const;

export const CSS = {
  ink: "#E5E7EB",
  inkMuted: "#9CA3AF",
  inkFaint: "#6B7280",
  blueGlow: "#60A5FA",
  emeraldGlow: "#34D399",
  amberGlow: "#FBBF24",
  redGlow: "#F87171",
} as const;

export const FONT_SANS = '"Inter Variable", Inter, "Cairo Variable", system-ui, sans-serif';
export const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';

/** Draw order on the stage, back to front. Devices add a sliver of their y so nearer ones overlap farther ones. */
export const DEPTH = {
  backdrop: -10,
  grid: -5,
  board: 0,
  zones: 1,
  light: 1.5,
  links: 2,
  trails: 3,
  vignette: 4.5,
  devices: 5,
  captions: 8,
  /** Subnet name tags: above every model and even an expanded caption, so a network's name is never hidden. */
  zoneTags: 8.8,
  ambient: 9,
  packets: 10,
  labels: 12,
} as const;

/**
 * Device accents: the trim, status lights and screen glow of each 3D model. Deliberately
 * avoid green, red and amber so a device never looks like a packet result.
 */
export const DEVICE_ACCENT: Record<DeviceKind, number> = {
  router: 0x8b5cf6,
  pc: 0x3b82f6,
  server: 0x06b6d4,
  iot: 0xec4899,
  switch: 0x6366f1,
  firewall: 0xf97316,
};

/** Brushed-metal stock the hardware is built from, light to dark. */
export const METAL = {
  chrome: 0xc9d3e0,
  steel: 0x8d99ab,
  pewter: 0x5d6879,
  gunmetal: 0x3a4454,
  graphite: 0x252d3a,
  black: 0x10151d,
} as const;

/** Neon light: pedestal trim, cable cores and the data pulses running along them. */
export const NEON = {
  blue: 0x38bdf8,
  cyan: 0x22d3ee,
  /** Pedestal trim of a device nobody has verified yet: the light is off. */
  off: 0x4a5a78,
} as const;

/** Colors for a device nobody has verified yet: a dark crate with a floating "?", buried in smoke. */
export const MYSTERY = {
  cube: 0x3a4760,
  glow: 0x94a3b8,
  /** Smoke from the floor (dense, dark) up to the crest (thin, light). */
  smoke: [0x2a3550, 0x3c4a68, 0x55647f, 0x707f9c, 0x8a98b4],
  smokeCore: 0x1b2438,
  fogGlow: 0x4f6fae,
  /** Frosted glass callout the "?" floats in, and its bright rim. */
  glass: 0x1e293b,
  glassEdge: 0xcbd5e1,
  mark: "#E2E8F0",
  markShadow: "#64748B",
} as const;

/** Dark frosted glass behind every stage label: rgba(15, 23, 42, 0.85) with a crisp slate rim. */
export const LABEL_GLASS = {
  fill: 0x0f172a,
  alpha: 0.85,
  edge: 0x475569,
  edgeAlpha: 0.9,
  sheen: 0.07,
} as const;

/** Deep-space room the diorama floats in. */
export const SPACE = {
  core: 0x0d1a33,
  edge: 0x02040a,
  nebula: [0x1d4ed8, 0x6d28d9, 0x0891b2],
  grid: NEON.blue,
} as const;

export interface SlabColors {
  top: number;
  rim: number;
  front: number;
  frontDark: number;
}

export interface ZoneStyle extends SlabColors {
  /** Subnet name tag. */
  ink: string;
  tag: number;
}

/** Subnet plate colors plus the neon trim around its edge. */
export interface ZonePlate extends ZoneStyle {
  neon: number;
}

/** The diorama: a thick dark glass deck, subnet plates on top, Ethernet cables between devices. */
export const DIORAMA = {
  board: { top: 0x0a1222, rim: 0x1a2944, front: 0x0a1120, frontDark: 0x04070f } satisfies SlabColors,
  edgeGlow: NEON.blue,
  zones: [
    { top: 0x0f1c36, rim: 0x23406f, front: 0x0d182e, frontDark: 0x081022, ink: "#93C5FD", tag: 0x1e3a8a, neon: 0x60a5fa },
    { top: 0x161433, rim: 0x3a2f72, front: 0x13112b, frontDark: 0x0c0a1e, ink: "#C4B5FD", tag: 0x4c1d95, neon: 0xa78bfa },
    { top: 0x0b2430, rim: 0x1b4f5f, front: 0x0a1e27, frontDark: 0x06141a, ink: "#67E8F9", tag: 0x155e75, neon: 0x22d3ee },
  ] satisfies readonly ZonePlate[],
  /** Ethernet jacket from its shadowed underside to the specular streak on top, and the strain-relief boots. */
  cable: { jacket: 0x070c16, body: 0x1d2b45, sheen: 0x4a6491, spec: 0xc7d6ee, boot: 0x2a3650 },
  /** Light pools on the deck, cool from the upper left and violet from the right. */
  lights: [0x1d4ed8, 0x7c3aed],
  dust: [0x93c5fd, 0xc4b5fd, 0xe2e8f0],
} as const;

/** Mixes a color toward white (amount > 0) or black (amount < 0). `amount` is -1..1. */
export function shade(color: number, amount: number): number {
  return mix(color, amount < 0 ? 0x000000 : 0xffffff, Math.abs(amount));
}

/** Linear blend from `a` (t = 0) to `b` (t = 1). */
export function mix(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  const lerp = (shift: number) => {
    const ca = (a >> shift) & 0xff;
    const cb = (b >> shift) & 0xff;
    return Math.round(ca + (cb - ca) * k) << shift;
  };
  return lerp(16) | lerp(8) | lerp(0);
}

export const DEVICE_KIND_LABEL: Record<DeviceKind, string> = {
  router: "Router",
  pc: "PC",
  server: "Server",
  iot: "IoT",
  switch: "Switch",
  firewall: "Firewall",
};

/** A packet is blue while it travels, then takes its outcome color. */
export const PACKET_IN_FLIGHT = PALETTE.blueGlow;

export const OUTCOME_COLOR: Record<PacketOutcome, number> = {
  success: PALETTE.emeraldGlow,
  rst: PALETTE.redGlow,
  timeout: PALETTE.amberGlow,
  unreachable: PALETTE.amberGlow,
};

export const OUTCOME_CSS: Record<PacketOutcome, string> = {
  success: CSS.emeraldGlow,
  rst: CSS.redGlow,
  timeout: CSS.amberGlow,
  unreachable: CSS.amberGlow,
};

/** Text is rasterized at this multiple so it stays sharp when the camera zooms in. */
export const TEXT_RESOLUTION = 3;
