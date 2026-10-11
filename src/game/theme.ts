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
  board: 0,
  zones: 1,
  links: 2,
  trails: 3,
  devices: 5,
  captions: 8,
  ambient: 9,
  packets: 10,
  labels: 12,
} as const;

/**
 * Device accents: the clay color of each 3D model. Deliberately avoid
 * green, red and amber so a device never looks like a packet result.
 */
export const DEVICE_ACCENT: Record<DeviceKind, number> = {
  router: 0x8b5cf6,
  pc: 0x3b82f6,
  server: 0x06b6d4,
  iot: 0xec4899,
  switch: 0x6366f1,
  firewall: 0xf97316,
};

/** Soft off-white clay for plinths and keycaps; tinted toward each device's accent. */
export const CLAY_LIGHT = 0xdfe6f1;

/** Colors for a device nobody has verified yet: a dark crate with a floating "?". */
export const MYSTERY = {
  cube: 0x3a4760,
  plinth: 0x2a3448,
  plinthTrim: 0x1a2232,
  glow: 0x94a3b8,
  mark: "#E2E8F0",
  markShadow: "#64748B",
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

/** The diorama: a thick dark base board, subnet plates on top, clay cables between devices. */
export const DIORAMA = {
  board: { top: 0x121a2c, rim: 0x22304b, front: 0x0e1526, frontDark: 0x080c17 } satisfies SlabColors,
  edgeGlow: PALETTE.blueGlow,
  zones: [
    { top: 0x1a2744, rim: 0x2d4170, front: 0x15213b, frontDark: 0x0f182d, ink: "#93C5FD", tag: 0x1e3a8a },
    { top: 0x211e42, rim: 0x3a3170, front: 0x1b1837, frontDark: 0x13112a, ink: "#C4B5FD", tag: 0x4c1d95 },
    { top: 0x142f3a, rim: 0x1f4d5d, front: 0x11262f, frontDark: 0x0b1b22, ink: "#67E8F9", tag: 0x155e75 },
  ] satisfies readonly ZoneStyle[],
  cable: { body: 0x2e3e5c, highlight: 0x56709b },
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
