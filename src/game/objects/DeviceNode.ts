import Phaser from "phaser";
import type { DeviceIntel } from "@/core/levels/objectives";
import type { NetworkDevice } from "@/types/topology";
import { CSS, DEPTH, DEVICE_ACCENT, FONT_MONO, FONT_SANS, LABEL_GLASS, mix, MYSTERY, NEON, PALETTE, shade, TEXT_RESOLUTION } from "../theme";
import { clayImage, crateArt, dissolveKey, modelArt, pedestalArt, smokeKeys, softDiscKey } from "./clayTextures";
import { PLINTH_TOP } from "./deviceModels";
import type { BlinkLight } from "./hardwarePainter";
import { boardToWorld } from "./iso";

/** Models are painted in their own units; this sizes them against the board. Captions are not scaled. */
const MODEL_SCALE = 1.3;
/** A floor circle under the pedestal, as an isometric ellipse. */
const FLOOR_RX = 46;
const FLOOR_RY = 26.5;
/** How far the pedestal floats above its shadow, and how much it drifts while hovering. */
const LIFT = 9;
const HOVER_PX = 2.5;
const BOB_PX = 4;
/** Neon light from the pedestal pooling on the floor under a discovered device. */
const UNDERGLOW_ALPHA = 0.42;
/** Captions stack down from here, just below the pedestal's floor shadow. */
const LABEL_Y = 42;
const PILL_GAP = 5;
/** Caption type sizes, in world pixels at camera zoom 1. */
const FONT_PX = { name: 20, ip: 17, mac: 15, services: 15, you: 17 } as const;
const DETAIL_WRAP_PX = 240;
/** How long the detail pills (IP, MAC, services) take to fan out under the name, and to fold back. */
const DETAIL_IN_MS = 200;
const DETAIL_OUT_MS = 160;
/** After a discovery or new open ports, the details stay out this long before folding away. */
const FRESH_MS = 2600;
/** Expanded captions draw above every other device's captions. */
const DETAIL_DEPTH_LIFT = 0.5;
/** The walkthrough arrow: its height above its tip, and how far it bobs up. */
const POINTER_H = 14;
const POINTER_BOB = 6;
/** Rings of smoke burying an unverified device, from the floor up past the crate. `spread` scales the floor ellipse. */
const SMOKE_LAYERS = [
  { count: 10, spread: 1, y: 4, size: 66, alpha: 0.72 },
  { count: 9, spread: 0.82, y: -14, size: 64, alpha: 0.7 },
  { count: 8, spread: 0.68, y: -31, size: 62, alpha: 0.64 },
  { count: 6, spread: 0.52, y: -47, size: 56, alpha: 0.56 },
  { count: 4, spread: 0.3, y: -61, size: 50, alpha: 0.46 },
] as const;
/**
 * Wisps escaping the top of the cloud: each one leaves the smoke, climbs `rise` units while it
 * swells and thins, and starts over `cycles` times per churn turn.
 */
const SMOKE_WISPS = { count: 6, spread: 0.55, y: -38, size: 44, alpha: 0.42, rise: 52, cycles: 4 } as const;
/** Middle of the smoke column; peeking scales around it and the dissolve opens from it. */
const SMOKE_CENTER_Y = -30;
/** One full turn of the churning smoke. Every motion in it repeats a whole number of times per turn. */
const CHURN_MS = 28_000;
const DISSOLVE_MS = 900;
const FOG_GLOW_ALPHA = 0.3;
/** While the pointer is over a cloaked device the smoke thins and parts, so the player can peek. */
const FOG_PEEK = { alpha: 0.5, scale: 1.12 } as const;
const FOG_REST = { alpha: 1, scale: 1 } as const;
/** Frosted glass callout the "?" floats in; its tail points down at the hidden device. */
const CALLOUT = { w: 38, h: 34, r: 10, tail: 8, tailW: 6 } as const;
/** One full loop of the activity lights. Each light blinks a whole number of times per loop. */
const BLINK_MS = 6000;
const BLINK_RATES = [3, 4, 5, 7, 9, 11] as const;
const BLINK_SIZE = 4.5;
const BLINK_ALPHA = 0.85;

interface BlinkingLight {
  img: Phaser.GameObjects.Image;
  rate: number;
  /** Where in its blink it starts, and how much of each blink it stays lit, both as shares of a blink. */
  phase: number;
  duty: number;
}

interface SmokePuff {
  img: Phaser.GameObjects.Image;
  /** Where on its ring it starts, and which way the ring turns. */
  angle: number;
  dir: 1 | -1;
  spread: number;
  y: number;
  alpha: number;
  scaleX: number;
  scaleY: number;
  /** Its own starting rotation, in degrees. */
  spin: number;
  phase: number;
  /** How far a wisp climbs and how often per churn turn; 0 for puffs that stay in their ring. */
  rise: number;
  cycles: number;
}

/** The callout's rounded box with its tail, clockwise from the top-left corner, centered on the "?". */
function calloutOutline(): { x: number; y: number }[] {
  const { w, h, r, tail, tailW } = CALLOUT;
  const points: { x: number; y: number }[] = [];
  const corner = (cx: number, cy: number, start: number) => {
    for (let s = 0; s <= 6; s++) {
      const a = start + (s / 6) * (Math.PI / 2);
      points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
  };
  corner(-w / 2 + r, -h / 2 + r, Math.PI);
  corner(w / 2 - r, -h / 2 + r, Math.PI * 1.5);
  corner(w / 2 - r, h / 2 - r, 0);
  points.push({ x: tailW, y: h / 2 }, { x: 0, y: h / 2 + tail }, { x: -tailW, y: h / 2 });
  corner(-w / 2 + r, h / 2 - r, Math.PI / 2);
  return points;
}

/** Words the stage draws on nodes, in the current language. */
export interface NodeLabels {
  unverified: string;
  you: string;
}

type Caption = Phaser.GameObjects.Container;

interface PillStyle {
  font: string;
  size: number;
  weight: string;
  color: string;
  /** Status dot before the text; null for none. */
  dot: number | null;
  border: number;
  fill?: number;
  fillAlpha?: number;
  wrap?: number;
}

/**
 * A caption on dark frosted glass: a rounded pill with a soft drop shadow, a top sheen and a
 * crisp rim, optionally led by a glowing status dot. It is centered on its container.
 */
class Pill {
  readonly box: Phaser.GameObjects.Container;
  readonly text: Phaser.GameObjects.Text;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly padX: number;
  private readonly padY: number;
  private readonly dotSpace: number;
  private w = 0;
  private h = 0;
  /** Where it sits in the fully expanded caption stack. */
  restY = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly style: PillStyle,
  ) {
    this.padX = Math.round(style.size * 0.7);
    this.padY = Math.round(style.size * 0.28);
    this.dotSpace = style.dot === null ? 0 : Math.round(style.size * 0.75);
    this.bg = scene.add.graphics();
    this.text = scene.add
      .text(this.dotSpace / 2, 0, "", {
        fontFamily: style.font,
        fontSize: `${style.size}px`,
        fontStyle: style.weight,
        color: style.color,
        align: "center",
        resolution: TEXT_RESOLUTION,
        wordWrap: style.wrap ? { width: style.wrap } : undefined,
      })
      .setOrigin(0.5, 0.5);
    this.box = scene.add.container(0, 0, [this.bg, this.text]);
  }

  /** Whether it has anything to say; an empty pill is never drawn. */
  get filled(): boolean {
    return this.w > 0;
  }

  get width(): number {
    return this.w;
  }

  get height(): number {
    return this.h;
  }

  set(value: string, dot = this.style.dot, border = this.style.border): void {
    this.box.setVisible(value.length > 0);
    this.w = 0;
    this.h = 0;
    if (!value) return;
    this.text.setText(value);
    const w = Math.ceil(this.text.width) + this.padX * 2 + this.dotSpace;
    const h = Math.ceil(this.text.height) + this.padY * 2;
    this.w = w;
    this.h = h;
    const r = Math.min(h / 2, this.style.size * 0.8);
    const x = -w / 2;
    const y = -h / 2;
    const g = this.bg.clear();
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(x, y + 3, w, h, r);
    g.fillStyle(this.style.fill ?? LABEL_GLASS.fill, this.style.fillAlpha ?? LABEL_GLASS.alpha);
    g.fillRoundedRect(x, y, w, h, r);
    g.fillStyle(0xffffff, LABEL_GLASS.sheen);
    g.fillRoundedRect(x + 2, y + 1.5, w - 4, h * 0.42, { tl: r - 1.5, tr: r - 1.5, bl: 2, br: 2 });
    g.lineStyle(1.5, border, LABEL_GLASS.edgeAlpha);
    g.strokeRoundedRect(x, y, w, h, r);
    if (dot === null) return;
    const dx = x + this.padX + this.dotSpace * 0.25;
    const dr = this.style.size * 0.2;
    g.fillStyle(dot, 0.3);
    g.fillCircle(dx, 0, dr * 2);
    g.fillStyle(dot, 1);
    g.fillCircle(dx, 0, dr);
  }
}

/**
 * One device on the stage: a detailed hardware render on a neon glass pedestal that floats
 * above a soft shadow. It starts as a sealed crate buried in thick churning smoke, with a
 * floating "?" and no name or address, and only shows its model, name, IP, MAC and services
 * once a discovery query got a valid reply. Probes stir the smoke, hovering thins it, and
 * discovery dissolves it outward from the middle. A known device shows just its name; its IP,
 * MAC and services fan out while it is hovered, selected, highlighted or under inspection.
 */
export class DeviceNode extends Phaser.GameObjects.Container {
  /** Emitted with the node when the player clicks the device or its caption. */
  static readonly SELECT = "device-select";
  readonly device: NetworkDevice;
  private readonly accent: number;
  private readonly ring: Phaser.GameObjects.Ellipse;
  private readonly floorShadow: Phaser.GameObjects.Container;
  /** Neon light bouncing onto the floor under a discovered device. */
  private readonly underglow: Phaser.GameObjects.Image;
  /** Lifts the figure off the floor and drifts it gently. */
  private readonly hover: Phaser.GameObjects.Container;
  /** Pedestal and model; squashes when a packet lands. */
  private readonly figure: Phaser.GameObjects.Container;
  private readonly plinthLit: Phaser.GameObjects.Image;
  private readonly mystery: Phaser.GameObjects.Container;
  private readonly crateGlow: Phaser.GameObjects.Image;
  private readonly crateTop: number;
  private readonly model: Phaser.GameObjects.Container;
  private readonly modelGlow: Phaser.GameObjects.Image;
  /** Glows over the model's painted activity LEDs; they blink while the device is known. */
  private readonly blinkLights: BlinkingLight[] = [];
  private blinkLoop: Phaser.Tweens.Tween | null = null;
  private readonly badge: Phaser.GameObjects.Container;
  /**
   * Fog of war over an unverified device. It lives on the root of the display list, just above
   * the device, because only root containers can be masked and the dissolve is a mask.
   */
  private readonly fog: Phaser.GameObjects.Container;
  /** Inside the fog; peeking thins and swells it around the middle of the column. */
  private readonly fogInner: Phaser.GameObjects.Container;
  private readonly fogGlow: Phaser.GameObjects.Image;
  private readonly smokeCore: Phaser.GameObjects.Image;
  private readonly coreScale: { x: number; y: number };
  private readonly smokePuffs: SmokePuff[] = [];
  /** `push` swells the smoke outward while a probe stirs it; `t` is where the churn is in its turn. */
  private readonly smoke = { push: 0, t: 0 };
  private dissolveHole: Phaser.GameObjects.Image | null = null;
  private dissolveMask: Phaser.Display.Masks.BitmapMask | null = null;
  private peeking = false;
  /** The floating "?" sits above the smoke, so it hovers on its own layer in step with the figure. */
  private readonly markLayer: Phaser.GameObjects.Container;
  private readonly markHover: Phaser.GameObjects.Container;
  private readonly mark: Phaser.GameObjects.Container;
  private readonly markY: number;
  /** Text and markers drawn above every device, so a nearer model never hides a farther one's name. */
  private readonly caption: Phaser.GameObjects.Container;
  /** The name and detail pills with their hit area; slides as one so open details stay on screen. */
  private readonly stack: Phaser.GameObjects.Container;
  /** World area the open caption stack has to stay inside; null until the scene frames the stage. */
  private captionBounds: Phaser.Geom.Rectangle | null = null;
  /** How far above its floor point the figure, "?" callout, "YOU" tag or walkthrough arrow can reach, in world units. */
  readonly headroom: number;
  /** Half the width of the pedestal, in world units. */
  readonly halfWidth = FLOOR_RX * MODEL_SCALE;
  private readonly namePill: Pill;
  private readonly ipPill: Pill;
  private readonly macPill: Pill;
  private readonly servicesPill: Pill;
  private readonly pointer: Phaser.GameObjects.Graphics;
  private readonly youTag: Pill | null;
  private readonly youTagBottom: number;
  private readonly modelTop: number;
  private labels: NodeLabels;
  private intel: DeviceIntel = { verified: false, macKnown: false, ports: [] };
  /** True while the discovery animation owns the model's visibility. */
  private revealing = false;
  /** Pointer over the device itself, or over its caption stack. */
  private readonly hovered = { device: false, caption: false };
  private highlighted = false;
  private selected = false;
  private inspected = false;
  /** Milliseconds left of the post-discovery peek at the details. */
  private freshMs = 0;
  /** How far the detail pills are fanned out, 0 (folded under the name) to 1; driven by `tick`. */
  private detailT = 0;
  private captionLifted = false;
  private readonly captionDepth: number;
  private readonly hoverZone: Phaser.GameObjects.Zone;
  private readonly captionZone: Phaser.GameObjects.Zone;
  private readonly selectRing: Phaser.GameObjects.Ellipse;
  private hoverLoops: Phaser.Tweens.Tween[] = [];
  private loops: Phaser.Tweens.Tween[] = [];
  private highlightLoops: Phaser.Tweens.Tween[] = [];

  constructor(scene: Phaser.Scene, device: NetworkDevice, labels: NodeLabels) {
    const at = boardToWorld(device.x, device.y);
    super(scene, at.x, at.y);
    this.device = device;
    this.accent = DEVICE_ACCENT[device.kind];
    this.labels = labels;
    const depth = DEPTH.devices + at.y / 100_000;

    // Light comes from the upper left, so the shadow falls a little down and to the right.
    const shadow = softDiscKey(scene, "shadow");
    const ambient = scene.add.image(8, 6, shadow).setDisplaySize(FLOOR_RX * 2.7, FLOOR_RY * 2.7).setAlpha(0.7);
    const contact = scene.add.image(5, 3, shadow).setDisplaySize(FLOOR_RX * 1.7, FLOOR_RY * 1.7).setAlpha(0.85);
    this.underglow = scene.add
      .image(0, 0, softDiscKey(scene, "glow"))
      .setDisplaySize(FLOOR_RX * 2.5, FLOOR_RY * 2.5)
      .setTint(mix(NEON.blue, this.accent, 0.25))
      .setBlendMode(Phaser.BlendModes.ADD);
    this.floorShadow = scene.add.container(0, 0, [ambient, contact, this.underglow]);
    this.ring = scene.add.ellipse(0, 0, FLOOR_RX * 2, FLOOR_RY * 2).setStrokeStyle(3, PALETTE.blueGlow, 1).setVisible(false);

    const plinthDark = clayImage(scene, pedestalArt(scene, false));
    this.plinthLit = clayImage(scene, pedestalArt(scene, true));

    // Crate and model hang from the pedestal's top, so they squash and grow from where they stand.
    const crate = crateArt(scene);
    this.crateTop = crate.top;
    this.crateGlow = clayImage(scene, crate, PLINTH_TOP).setTintFill(0xffffff).setAlpha(0);
    this.mystery = scene.add.container(0, -PLINTH_TOP, [clayImage(scene, crate, PLINTH_TOP), this.crateGlow]);

    const art = modelArt(scene, device.kind, this.accent);
    this.modelTop = art.top;
    this.modelGlow = clayImage(scene, art, PLINTH_TOP).setTintFill(0xffffff).setAlpha(0);
    this.badge = this.makeBadge(scene, art.top + 6 + PLINTH_TOP);
    this.model = scene.add.container(0, -PLINTH_TOP, [
      clayImage(scene, art, PLINTH_TOP),
      ...this.makeBlinkLights(scene, art.lights),
      this.modelGlow,
      this.badge,
    ]);

    this.figure = scene.add.container(0, 0, [plinthDark, this.plinthLit, this.mystery, this.model]);
    this.hover = scene.add.container(0, -LIFT, [this.figure]);
    this.fogGlow = scene.add
      .image(0, SMOKE_CENTER_Y + 10, softDiscKey(scene, "glow"))
      .setDisplaySize(FLOOR_RX * 2.8, FLOOR_RY * 3.6)
      .setTint(MYSTERY.fogGlow)
      .setAlpha(FOG_GLOW_ALPHA)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.selectRing = scene.add
      .ellipse(0, 0, FLOOR_RX * 2.2, FLOOR_RY * 2.2)
      .setStrokeStyle(2, NEON.cyan, 0.9)
      .setFillStyle(NEON.cyan, 0.08)
      .setVisible(false);
    this.hoverZone = this.makeHoverZone(scene);
    this.add([this.floorShadow, this.selectRing, this.ring, this.hover, this.fogGlow, this.hoverZone]);

    this.smokeCore = scene.add
      .image(0, 0, smokeKeys(scene)[0])
      .setDisplaySize(FLOOR_RX * 2.3, FLOOR_RY * 4.4)
      .setTint(MYSTERY.smokeCore)
      .setAlpha(0.9);
    this.coreScale = { x: this.smokeCore.scaleX, y: this.smokeCore.scaleY };
    this.fogInner = scene.add.container(0, SMOKE_CENTER_Y, [this.smokeCore, ...this.makeSmoke(scene)]);
    this.fog = scene.add.container(at.x, at.y, [this.fogInner]).setScale(MODEL_SCALE).setDepth(depth + 0.000001);

    this.markY = crate.top - 34;
    this.mark = this.makeMark(scene, this.markY);
    this.markHover = scene.add.container(0, -LIFT, [this.mark]);
    this.markLayer = scene.add.container(at.x, at.y, [this.markHover]).setScale(MODEL_SCALE).setDepth(depth + 0.000002);

    this.namePill = new Pill(scene, {
      font: FONT_SANS,
      size: FONT_PX.name,
      weight: "700",
      color: CSS.ink,
      dot: null,
      border: LABEL_GLASS.edge,
    });
    this.ipPill = new Pill(scene, {
      font: FONT_MONO,
      size: FONT_PX.ip,
      weight: "600",
      color: "#F8FAFC",
      dot: this.accent,
      border: shade(this.accent, 0.2),
    });
    this.macPill = new Pill(scene, {
      font: FONT_MONO,
      size: FONT_PX.mac,
      weight: "500",
      color: "#CBD5E1",
      dot: PALETTE.inkMuted,
      border: LABEL_GLASS.edge,
    });
    this.servicesPill = new Pill(scene, {
      font: FONT_MONO,
      size: FONT_PX.services,
      weight: "600",
      color: CSS.emeraldGlow,
      dot: PALETTE.emeraldGlow,
      border: PALETTE.emerald,
      wrap: DETAIL_WRAP_PX,
    });
    this.youTagBottom = (this.modelTop - LIFT) * MODEL_SCALE - 8;
    this.youTag = device.isPlayer ? this.makeYouTag(scene) : null;
    this.pointer = this.makePointer(scene);

    this.captionZone = this.makeCaptionZone(scene);

    // Detail pills go behind the name, so while folded they tuck away underneath it.
    this.captionDepth = DEPTH.captions + at.y / 100_000;
    this.stack = scene.add.container(0, 0, [...this.detailPills().map((p) => p.box), this.namePill.box, this.captionZone]);
    this.caption = scene.add.container(at.x, at.y, [this.stack, this.pointer]).setDepth(this.captionDepth);
    if (this.youTag) this.caption.add(this.youTag.box);

    this.setSize(FLOOR_RX * 2, FLOOR_RY - this.modelTop + LIFT);
    this.setScale(MODEL_SCALE);
    this.setDepth(depth);
    scene.add.existing(this);
    this.renderCaptions();
    this.headroom = this.measureHeadroom();
    this.applyForm();
    this.startHover();
  }

  get verified(): boolean {
    return this.intel.verified;
  }

  /** The walkthrough is pointing at this device: a pulsing ring, a bobbing arrow, and its details held open. */
  setHighlighted(on: boolean): void {
    this.highlighted = on;
    for (const t of this.highlightLoops) t.remove();
    this.highlightLoops = [];
    this.ring.setVisible(on).setScale(1).setAlpha(1);
    this.pointer.setVisible(on).setY(this.pointerY());
    if (!on) return;
    this.highlightLoops = [
      this.scene.tweens.add({
        targets: this.ring,
        scale: 1.14,
        alpha: 0.35,
        duration: 700,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      }),
      this.scene.tweens.add({
        targets: this.pointer,
        y: this.pointerY() - POINTER_BOB,
        duration: 520,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      }),
    ];
  }

  /** Applies what the player has proven. With `animate`, a fresh verification plays the discovery sequence. */
  setIntel(intel: DeviceIntel, animate: boolean): void {
    const revealed = intel.verified && !this.intel.verified;
    const newPorts = intel.ports.length > this.intel.ports.length;
    this.intel = intel;
    this.renderCaptions();
    if (revealed && animate && !this.device.isPlayer) {
      this.playReveal();
    } else if (!this.revealing) {
      this.applyForm();
      if (animate && newPorts) this.freshMs = FRESH_MS;
    }
  }

  /** The player clicked this device: a steady ring under it and its details held open until deselected. */
  setSelected(on: boolean): void {
    this.selected = on;
    this.selectRing.setVisible(on);
  }

  /** A packet to or from this device is open in the inspector, so its details stay open. */
  setInspected(on: boolean): void {
    this.inspected = on;
  }

  /** The world area open details must stay inside: the part of the stage the overlays leave visible, below the subnet header. */
  setCaptionBounds(area: Phaser.Geom.Rectangle): void {
    this.captionBounds = area;
    if (this.detailT > 0) this.layoutDetails();
  }

  /**
   * Per-frame step of the detail pills, on the scene's update loop rather than the tween manager:
   * the stage freezes tweens while the packet inspector is open, and that is exactly when an
   * inspected device has to show its details. Does nothing once the pills have settled.
   */
  tick(delta: number): void {
    if (this.freshMs > 0) this.freshMs = Math.max(0, this.freshMs - delta);
    const target = this.detailsWanted() ? 1 : 0;
    if (this.detailT === target) return;
    const step = delta / (target > this.detailT ? DETAIL_IN_MS : DETAIL_OUT_MS);
    this.detailT = target > this.detailT ? Math.min(1, this.detailT + step) : Math.max(0, this.detailT - step);
    this.layoutDetails();
  }

  setLabels(labels: NodeLabels): void {
    this.labels = labels;
    this.renderCaptions();
  }

  /** A packet landed here: the floor glows in the result color and the model gives a little squash. */
  flash(color: number): void {
    const glow = this.scene.add.ellipse(0, 0, FLOOR_RX * 2, FLOOR_RY * 2, color, 0.32);
    const ripple = this.scene.add.ellipse(0, 0, FLOOR_RX * 2, FLOOR_RY * 2).setStrokeStyle(3, color, 0.95);
    this.addAt([glow, ripple], 1);
    this.fadeAway(glow, { alpha: 0 }, 650);
    this.fadeAway(ripple, { scale: 1.9, alpha: 0 }, 560, "Quad.easeOut");

    if (this.revealing) return;
    if (this.fog.visible) this.stirFog();
    this.scene.tweens.killTweensOf(this.figure);
    this.figure.setScale(1);
    this.scene.tweens.add({
      targets: this.figure,
      scaleX: 1.08,
      scaleY: 0.9,
      duration: 90,
      ease: "Quad.easeOut",
      yoyo: true,
    });
  }

  override destroy(fromScene?: boolean): void {
    this.stopLoops();
    this.blinkLoop?.remove();
    this.blinkLoop = null;
    for (const t of [...this.hoverLoops, ...this.highlightLoops]) t.remove();
    this.scene?.tweens.killTweensOf(this.animated());
    this.caption.destroy(fromScene);
    this.fog.clearMask();
    this.fog.destroy(fromScene);
    this.markLayer.destroy(fromScene);
    this.dissolveMask?.destroy();
    this.dissolveHole?.destroy();
    super.destroy(fromScene);
  }

  private animated(): object[] {
    return [
      this.figure,
      this.mystery,
      this.mark,
      this.crateGlow,
      this.model,
      this.modelGlow,
      this.badge,
      this.plinthLit,
      this.underglow,
      this.fogInner,
      this.fogGlow,
      this.smokeCore,
      this.smoke,
      ...(this.dissolveHole ? [this.dissolveHole] : []),
      ...this.smokePuffs.map((p) => p.img),
    ];
  }

  /** Final look for the current intel, with no animation in progress. */
  private applyForm(): void {
    const known = this.intel.verified;
    this.mystery.setVisible(!known).setAlpha(1).setScale(1).setAngle(0).setY(-PLINTH_TOP);
    this.crateGlow.setAlpha(0);
    this.mark.setVisible(!known).setAlpha(1).setScale(1).setY(this.markY);
    this.model.setVisible(known).setAlpha(1).setScale(1).setY(-PLINTH_TOP);
    this.modelGlow.setAlpha(0);
    this.plinthLit.setAlpha(known ? 1 : 0);
    this.underglow.setAlpha(known ? UNDERGLOW_ALPHA : 0);
    this.badge.setVisible(known && !this.device.isPlayer).setScale(1);
    this.namePill.box.setAlpha(1).setScale(1);
    this.hoverZone.input!.cursor = known ? "pointer" : "";
    this.captionZone.input!.cursor = known ? "pointer" : "";
    this.layoutDetails();
    this.resetFog(!known);
    this.setIdle(!known);
    this.setBlinking(known);
  }

  /** Puts the smoke back as a settled, full cloud (or clears it away) with no tween or mask on it. */
  private resetFog(visible: boolean): void {
    const tweens = this.scene.tweens;
    tweens.killTweensOf([this.fogInner, this.smokeCore, this.smoke, ...this.smokePuffs.map((p) => p.img)]);
    this.fog.clearMask();
    const rest = this.fogRest();
    this.fog.setVisible(visible);
    this.fogInner.setAlpha(rest.alpha).setScale(rest.scale);
    this.fogGlow.setVisible(visible).setAlpha(FOG_GLOW_ALPHA);
    this.smokeCore.setAlpha(0.9).setScale(this.coreScale.x, this.coreScale.y);
    this.smoke.push = 0;
    this.layoutSmoke(this.smoke.t);
  }

  private renderCaptions(): void {
    const { verified, macKnown, ports } = this.intel;
    const d = this.device;
    if (this.youTag) {
      this.youTag.set(this.labels.you);
      this.youTag.box.setY(this.youTagBottom - this.youTag.height / 2);
    }

    // An unknown device shows no name, no address, nothing a scan has not proven.
    this.namePill.text.setColor(verified ? CSS.ink : CSS.inkMuted).setFontStyle(verified ? "700" : "italic 600");
    this.namePill.set(verified ? d.name : this.labels.unverified, null, verified ? LABEL_GLASS.edge : MYSTERY.cube);
    this.ipPill.set(verified ? d.ip : "");
    this.macPill.set(verified && macKnown ? d.mac : "");

    const services = verified ? ports.map((p) => `${p.number}/${p.state === "open" ? (p.service ?? "open") : p.state}`) : [];
    const allOpen = ports.every((p) => p.state === "open");
    this.servicesPill.text.setColor(allOpen ? CSS.emeraldGlow : CSS.amberGlow);
    this.servicesPill.set(
      services.join("  "),
      allOpen ? PALETTE.emeraldGlow : PALETTE.amberGlow,
      allOpen ? PALETTE.emerald : PALETTE.amber,
    );

    // The name always shows; the details have their places below it for when they fan out.
    this.namePill.restY = LABEL_Y + this.namePill.height / 2;
    this.namePill.box.setY(this.namePill.restY);
    let y = LABEL_Y + this.namePill.height + PILL_GAP;
    for (const pill of this.detailPills()) {
      if (!pill.filled) continue;
      pill.restY = y + pill.height / 2;
      y += pill.height + PILL_GAP;
    }
    this.layoutDetails();
  }

  private detailPills(): Pill[] {
    return [this.ipPill, this.macPill, this.servicesPill];
  }

  /** Details stay out while the device is hovered, selected, highlighted, inspected, or freshly discovered. */
  private detailsWanted(): boolean {
    if (!this.intel.verified || this.revealing) return false;
    return this.hovered.device || this.hovered.caption || this.selected || this.highlighted || this.inspected || this.freshMs > 0;
  }

  /**
   * Places the detail pills for the current fan-out: folded, they sit hidden behind the name;
   * opening, they slide down to their places in the stack while fading and growing in.
   * Open captions are lifted above every neighbor's, and the caption's hit area follows them.
   */
  private layoutDetails(): void {
    const t = this.detailT;
    const ease = 1 - (1 - t) ** 3;
    const from = this.namePill.restY;
    for (const pill of this.detailPills()) {
      pill.box
        .setVisible(pill.filled && t > 0)
        .setAlpha(t)
        .setY(from + (pill.restY - from) * ease)
        .setScale(0.9 + 0.1 * ease);
    }

    const lifted = t > 0;
    if (lifted !== this.captionLifted) {
      this.captionLifted = lifted;
      this.caption.setDepth(this.captionDepth + (lifted ? DETAIL_DEPTH_LIFT : 0));
    }

    const open = t > 0 || this.detailsWanted();
    const shown = [this.namePill, ...(open ? this.detailPills() : [])].filter((p) => p.filled);
    const last = shown[shown.length - 1] ?? this.namePill;
    const width = Math.max(1, ...shown.map((p) => p.width));
    const bottom = last.restY + last.height / 2;
    if (this.captionZone.width !== width || this.captionZone.y + this.captionZone.height / 2 !== bottom) {
      this.captionZone.setPosition(0, (LABEL_Y + bottom) / 2).setSize(width, Math.max(1, bottom - LABEL_Y));
    }
    this.fitStack(ease);
  }

  /**
   * Slides the caption stack so its fully open extent stays inside the caption bounds: up over
   * the model when the details would run off the bottom (never past the top, which sits below
   * the subnet header), and sideways at the left and right edges. The slide follows the
   * fan-out, so a folded name always rests in its place under the device.
   */
  private fitStack(ease: number): void {
    const area = this.captionBounds;
    if (!area || ease <= 0) {
      this.stack.setPosition(0, 0);
      return;
    }
    const filled = [this.namePill, ...this.detailPills()].filter((p) => p.filled);
    const last = filled[filled.length - 1] ?? this.namePill;
    const top = this.y + LABEL_Y;
    const bottom = this.y + last.restY + last.height / 2;
    const half = Math.max(1, ...filled.map((p) => p.width)) / 2;
    const dy = -Math.min(Math.max(0, bottom - area.bottom), Math.max(0, top - area.top));
    const dx = Phaser.Math.Clamp(0, area.left - (this.x - half), area.right - (this.x + half));
    this.stack.setPosition(dx * ease, dy * ease);
  }

  /**
   * Discovery: the smoke dissolves outward from the middle while the crate squashes, stretches
   * and shivers as it heats up to white, then implodes into the pedestal in a flash of light and
   * chips. The real device pops up out of the pedestal, white-hot, overshoots, and settles as it cools.
   */
  private playReveal(): void {
    this.revealing = true;
    this.setIdle(false);
    this.setBlinking(false);
    const tweens = this.scene.tweens;
    tweens.killTweensOf(this.animated());
    this.figure.setScale(1);
    this.mystery.setVisible(true).setAlpha(1).setScale(1).setAngle(0).setY(-PLINTH_TOP);
    this.crateGlow.setAlpha(0);
    this.mark.setVisible(true).setAlpha(1).setScale(1).setY(this.markY);
    this.model.setVisible(false);
    this.badge.setVisible(false);
    this.namePill.box.setAlpha(0);
    this.detailT = 0;
    this.layoutDetails();
    this.dissolveFog();

    tweens.add({ targets: this.mark, y: this.markY - 14, scale: 1.35, alpha: 0, duration: 260, ease: "Back.easeIn" });
    tweens.add({ targets: this.crateGlow, alpha: 0.9, duration: 520, ease: "Quad.easeIn" });
    tweens.chain({
      targets: this.mystery,
      tweens: [
        { scaleX: 1.14, scaleY: 0.82, duration: 150, ease: "Quad.easeOut" },
        { scaleX: 0.92, scaleY: 1.12, y: -PLINTH_TOP - 7, duration: 130, ease: "Quad.easeOut" },
        { angle: -5, duration: 45, ease: "Sine.easeInOut" },
        { angle: 5, duration: 70, ease: "Sine.easeInOut", yoyo: true, repeat: 1 },
        { angle: 0, duration: 45 },
        {
          scaleX: 1.4,
          scaleY: 0.12,
          y: -PLINTH_TOP,
          alpha: 0,
          duration: 150,
          ease: "Back.easeIn",
          onComplete: () => this.burst(),
        },
      ],
    });
  }

  /** The crate is gone: light beam, chips and a shockwave, then the model pops up. */
  private burst(): void {
    const scene = this.scene;
    const light = shade(this.accent, 0.45);
    this.mystery.setVisible(false);
    const surface = -PLINTH_TOP;

    const beam = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 0; i < 5; i++) {
      const w = 54 - i * 10;
      beam.fillStyle(light, 0.07 + i * 0.03);
      beam.fillRect(-w / 2, surface - 150, w, 150);
      beam.fillEllipse(0, surface, w * 1.22, w * 0.7);
    }
    this.hover.add(beam);
    this.fadeAway(beam, { scaleX: 0, alpha: 0 }, 620, "Cubic.easeIn");

    const shock = scene.add.ellipse(0, 0, FLOOR_RX * 2, FLOOR_RY * 2).setStrokeStyle(3, light, 1).setScale(0.4);
    this.addAt(shock, 1);
    this.fadeAway(shock, { scale: 1.9, alpha: 0 }, 640, "Quad.easeOut");

    const colors = [this.accent, light, 0xffffff, NEON.cyan];
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.2, 0.2);
      const reach = Phaser.Math.Between(28, 62);
      const chip = scene.add.circle(0, surface - 14, Phaser.Math.FloatBetween(1.8, 3.8), colors[i % colors.length], 1);
      this.hover.add(chip);
      scene.tweens.add({ targets: chip, x: Math.cos(angle) * reach * 1.2, duration: 560, ease: "Sine.easeOut" });
      scene.tweens.chain({
        targets: chip,
        tweens: [
          { y: surface - 36 - Phaser.Math.Between(0, 26), duration: 230, ease: "Quad.easeOut" },
          { y: LIFT + Math.sin(angle) * reach * 0.45, duration: 330, ease: "Quad.easeIn" },
          { alpha: 0, scale: 0.2, duration: 240, delay: 140 },
        ],
        onComplete: () => chip.destroy(),
      });
    }

    scene.tweens.add({ targets: this.plinthLit, alpha: 1, duration: 320, ease: "Sine.easeOut" });
    scene.tweens.add({ targets: this.underglow, alpha: UNDERGLOW_ALPHA, duration: 700, ease: "Sine.easeOut" });
    this.model.setVisible(true).setAlpha(1).setScale(0.15).setY(-PLINTH_TOP);
    this.modelGlow.setAlpha(1);
    scene.tweens.add({ targets: this.modelGlow, alpha: 0, delay: 140, duration: 560, ease: "Quad.easeIn" });
    scene.tweens.chain({
      targets: this.model,
      tweens: [
        { scale: 1.18, duration: 280, ease: "Cubic.easeOut" },
        {
          scaleX: 1.08,
          scaleY: 0.88,
          duration: 90,
          ease: "Quad.easeOut",
          onStart: () => this.flash(PALETTE.emeraldGlow),
        },
        { scaleX: 1, scaleY: 1, duration: 620, ease: "Elastic.easeOut", easeParams: [1.15, 0.45] },
      ],
      onComplete: () => this.finishReveal(),
    });
  }

  private finishReveal(): void {
    this.revealing = false;
    this.applyForm();
    if (this.highlighted) this.setHighlighted(true);
    this.badge.setScale(0);
    this.scene.tweens.add({ targets: this.badge, scale: 1, duration: 300, ease: "Back.easeOut" });
    this.popIn(this.namePill.box);
    // Give the player a look at what the scan just proved before the details fold away.
    this.freshMs = FRESH_MS;
  }

  /** Fades a caption in with a small rise and a little overshoot. */
  private popIn(item: Caption): void {
    const y = item.y;
    item.setAlpha(0).setY(y + 8).setScale(0.85);
    this.scene.tweens.add({ targets: item, alpha: 1, y, scale: 1, duration: 320, ease: "Back.easeOut" });
  }

  /** Every device floats above its shadow; the shadow tightens and darkens as the figure drifts down. */
  private startHover(): void {
    const offset = ((this.device.x * 3 + this.device.y) % 11) * 70;
    const duration = 2300 + offset;
    this.hoverLoops = [
      this.scene.tweens.add({
        targets: [this.hover, this.markHover],
        y: -LIFT - HOVER_PX,
        duration,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      }),
      this.scene.tweens.add({
        targets: this.floorShadow,
        scale: 0.92,
        alpha: 0.8,
        duration,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      }),
    ];
  }

  /** Unknown crates bob on their pedestal, their "?" pulses, and the smoke over them keeps churning. */
  private setIdle(on: boolean): void {
    if (on === this.loops.length > 0) return;
    this.stopLoops();
    if (!on) return;
    const offset = ((this.device.x + this.device.y) % 7) * 90;
    const from = this.smoke.t;
    this.loops = [
      this.scene.tweens.add({
        targets: this.mystery,
        y: -PLINTH_TOP - BOB_PX,
        duration: 1500 + offset,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      }),
      this.scene.tweens.add({
        targets: this.mark,
        y: this.markY - 3,
        scale: 1.08,
        duration: 1100 + offset,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      }),
      this.scene.tweens.add({
        targets: this.fogGlow,
        alpha: FOG_GLOW_ALPHA * 0.5,
        duration: 1900 + offset,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      }),
      this.scene.tweens.addCounter({
        from,
        to: from + 1,
        duration: CHURN_MS,
        repeat: -1,
        onUpdate: (tween) => this.layoutSmoke(tween.getValue() ?? from),
      }),
    ];
  }

  /** A known device's activity lights blink out of step with each other, like real traffic. */
  private setBlinking(on: boolean): void {
    if (on === (this.blinkLoop !== null)) return;
    this.blinkLoop?.remove();
    this.blinkLoop = null;
    for (const light of this.blinkLights) light.img.setAlpha(0);
    if (!on || this.blinkLights.length === 0) return;
    this.blinkLoop = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: BLINK_MS,
      repeat: -1,
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        for (const light of this.blinkLights) {
          light.img.setAlpha((t * light.rate + light.phase) % 1 < light.duty ? BLINK_ALPHA : 0);
        }
      },
    });
  }

  /** Stops the idle motion where it is, so a following animation starts from what is on screen. */
  private stopLoops(): void {
    for (const t of this.loops) t.remove();
    this.loops = [];
    this.mystery.setY(-PLINTH_TOP);
    this.mark.setY(this.markY).setScale(1);
    this.fogGlow.setAlpha(FOG_GLOW_ALPHA);
  }

  /**
   * Places every puff for churn position `t` (one unit per turn): each ring of smoke slowly
   * orbits the device, the puffs tumble, breathe and bob, and `push` swells the cloud outward.
   */
  private layoutSmoke(t: number): void {
    this.smoke.t = t;
    const push = this.smoke.push;
    const tau = Math.PI * 2;
    for (const p of this.smokePuffs) {
      const theta = p.angle + p.dir * tau * t;
      // A wisp's climb: 0 as it leaves the cloud, 1 as it fades out above it.
      const climb = p.rise > 0 ? (t * p.cycles + p.phase / tau) % 1 : 0;
      const reach = p.spread * (1 + 0.07 * Math.sin(tau * 3 * t + p.phase) + push * 0.55) * (1 - climb * 0.35);
      const x = Math.cos(theta) * FLOOR_RX * reach;
      const y =
        p.y - SMOKE_CENTER_Y + Math.sin(theta) * FLOOR_RY * reach + Math.sin(tau * 2 * t + p.phase) * 2.2 - push * 8 - climb * p.rise;
      const swell = (1 + 0.08 * Math.sin(tau * 4 * t + p.phase) + push * 0.3) * (1 + climb * 0.7);
      const fade = p.rise > 0 ? Math.sin(Math.PI * climb) : 1;
      p.img
        .setPosition(x, y)
        .setAngle(p.spin + p.dir * 360 * t)
        .setScale(p.scaleX * swell, p.scaleY * swell)
        .setAlpha(p.alpha * fade * (0.82 + 0.18 * Math.sin(tau * 5 * t + p.phase * 1.3)) * (1 - push * 0.45));
    }
  }

  private fogRest(): { alpha: number; scale: number } {
    return this.peeking ? FOG_PEEK : FOG_REST;
  }

  /** Hovering a cloaked device thins its smoke; leaving lets it settle back. */
  private peekFog(on: boolean): void {
    this.peeking = on;
    if (!this.fog.visible || this.revealing) return;
    const rest = this.fogRest();
    this.scene.tweens.killTweensOf(this.fogInner);
    this.scene.tweens.add({ targets: this.fogInner, ...rest, duration: on ? 260 : 420, ease: "Sine.easeOut" });
  }

  /** A probe landed on a cloaked device: the churning smoke billows outward and rolls back. */
  private stirFog(): void {
    this.scene.tweens.killTweensOf(this.smoke);
    this.scene.tweens.chain({
      targets: this.smoke,
      tweens: [
        { push: 1, duration: 160, ease: "Quad.easeOut" },
        { push: 0, duration: 760, ease: "Sine.easeInOut" },
      ],
    });
  }

  /**
   * Discovery: a soft round hole opens in the middle of the smoke and races outward while
   * every puff is blown away from the center, inner ones first, and a scan ring sweeps out.
   */
  private dissolveFog(): void {
    const tweens = this.scene.tweens;
    this.fog.setVisible(true);
    this.openHole();

    tweens.add({ targets: this.fogGlow, alpha: 0, duration: 360, ease: "Sine.easeOut" });
    tweens.add({
      targets: this.smokeCore,
      scaleX: this.smokeCore.scaleX * 2.2,
      scaleY: this.smokeCore.scaleY * 2.2,
      alpha: 0,
      duration: DISSOLVE_MS * 0.6,
      ease: "Quad.easeOut",
    });
    for (const p of this.smokePuffs) {
      const img = p.img;
      // Iso floor distances are squashed vertically; undo that so "inner first" means a round front.
      const dx = img.x;
      const dy = img.y * 1.6;
      const dist = Math.hypot(dx, dy) || 1;
      tweens.add({
        targets: img,
        x: img.x + (dx / dist) * 58,
        y: img.y + (dy / dist) * 30 - 14,
        scaleX: img.scaleX * 1.9,
        scaleY: img.scaleY * 1.9,
        angle: img.angle + p.dir * 70,
        alpha: 0,
        delay: Math.min(1, dist / 80) * DISSOLVE_MS * 0.35,
        duration: DISSOLVE_MS * 0.7,
        ease: "Cubic.easeOut",
      });
    }
    tweens.add({
      targets: this.fogInner,
      alpha: 0,
      delay: DISSOLVE_MS * 0.55,
      duration: DISSOLVE_MS * 0.45,
      ease: "Sine.easeIn",
      onComplete: () => {
        this.fog.setVisible(false).clearMask();
        this.fogGlow.setVisible(false);
      },
    });

    const scan = this.scene.add.ellipse(0, SMOKE_CENTER_Y, FLOOR_RX * 1.2, FLOOR_RY * 1.2).setStrokeStyle(2.5, NEON.cyan, 1).setScale(0.2);
    const sheen = this.scene.add
      .image(0, SMOKE_CENTER_Y, softDiscKey(this.scene, "glow"))
      .setDisplaySize(FLOOR_RX * 1.6, FLOOR_RY * 1.6)
      .setTint(NEON.cyan)
      .setAlpha(0.55)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.markLayer.add([sheen, scan]);
    this.fadeAway(scan, { scale: 2.6, alpha: 0 }, DISSOLVE_MS, "Cubic.easeOut");
    this.fadeAway(sheen, { scaleX: sheen.scaleX * 2.4, scaleY: sheen.scaleY * 2.4, alpha: 0 }, DISSOLVE_MS * 0.7, "Quad.easeOut");
  }

  /** Masks the fog with a feathered disc that grows from nothing, cutting a widening hole through it. WebGL only. */
  private openHole(): void {
    if (this.scene.renderer.type !== Phaser.WEBGL) return;
    if (!this.dissolveHole || !this.dissolveMask) {
      this.dissolveHole = this.scene.make.image(
        { x: this.fog.x, y: this.fog.y + SMOKE_CENTER_Y * MODEL_SCALE, key: dissolveKey(this.scene) },
        false,
      );
      this.dissolveMask = this.dissolveHole.createBitmapMask();
      this.dissolveMask.invertAlpha = true;
    }
    this.dissolveHole.setScale(0.02, 0.016);
    this.fog.setMask(this.dissolveMask);
    this.scene.tweens.add({ targets: this.dissolveHole, scaleX: 1.7, scaleY: 1.3, duration: DISSOLVE_MS, ease: "Sine.easeInOut" });
  }

  /** Above the model, its "YOU" tag, or the floating "?" of an unknown crate. */
  private pointerY(verified = this.intel.verified): number {
    if (!verified) return (this.markY - CALLOUT.h / 2 - 6 - LIFT) * MODEL_SCALE - 8;
    if (this.youTag) return this.youTagBottom - this.youTag.height - 8;
    return (this.modelTop - LIFT) * MODEL_SCALE - 12;
  }

  /** The highest point anything drawn over this device reaches, in either state and at the top of every bob. */
  private measureHeadroom(): number {
    const figure = (Math.min(this.modelTop, this.markY - CALLOUT.h / 2) - LIFT - HOVER_PX) * MODEL_SCALE;
    const arrow = Math.min(this.pointerY(true), this.pointerY(false)) - POINTER_BOB - POINTER_H;
    const tag = this.youTag ? this.youTagBottom - this.youTag.height : 0;
    return -Math.min(figure, arrow, tag);
  }

  /** Adds a short-lived effect tween that destroys its target when done. */
  private fadeAway(target: Phaser.GameObjects.GameObject, props: Record<string, number>, duration: number, ease = "Linear"): void {
    this.scene.tweens.add({ targets: target, ...props, duration, ease, onComplete: () => target.destroy() });
  }

  /**
   * Rings of billowing smoke from the floor to above the crate, darker and denser low down,
   * each puff remembering where it rests. A dark core behind them hides the crate's outline.
   */
  private makeSmoke(scene: Phaser.Scene): Phaser.GameObjects.Image[] {
    const keys = smokeKeys(scene);
    const seed = (this.device.x * 31 + this.device.y * 17) % 997;
    const wisps = { ...SMOKE_WISPS, tint: MYSTERY.smoke[3] };
    const layers = [...SMOKE_LAYERS.map((layer, li) => ({ ...layer, rise: 0, cycles: 0, tint: MYSTERY.smoke[li % MYSTERY.smoke.length] })), wisps];
    let n = 0;
    return layers.flatMap((layer, li) =>
      Array.from({ length: layer.count }, (_, i) => {
        n += 1;
        const angle = ((i + (seed % 13) / 13 + li * 0.5) / layer.count) * Math.PI * 2;
        const img = scene.add
          .image(0, 0, keys[(n + seed) % keys.length])
          .setDisplaySize(layer.size, layer.size * 0.8)
          .setTint(layer.tint);
        this.smokePuffs.push({
          img,
          angle,
          dir: li % 2 === 0 ? 1 : -1,
          spread: layer.spread,
          y: layer.y,
          alpha: layer.alpha,
          scaleX: img.scaleX,
          scaleY: img.scaleY,
          spin: ((n * 137 + seed) % 360) - 180,
          // Wisps share a layer, so spread their climbs evenly instead of leaving it to the hash.
          phase: layer.rise > 0 ? (i / layer.count) * Math.PI * 2 : (n * 2.39996 + seed) % (Math.PI * 2),
          rise: layer.rise,
          cycles: layer.cycles,
        });
        return img;
      }),
    );
  }

  /** An additive glow over each painted activity LED, with its own blink rate and timing. */
  private makeBlinkLights(scene: Phaser.Scene, lights: readonly BlinkLight[]): Phaser.GameObjects.Image[] {
    const key = softDiscKey(scene, "glow");
    const seed = (this.device.x * 13 + this.device.y * 29) % 101;
    return lights.map((light, i) => {
      const img = scene.add
        .image(light.x, PLINTH_TOP + light.y, key)
        .setDisplaySize(BLINK_SIZE, BLINK_SIZE)
        .setTint(shade(light.color, 0.35))
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0);
      this.blinkLights.push({
        img,
        rate: BLINK_RATES[(i * 5 + seed) % BLINK_RATES.length],
        phase: ((i + 1) * 0.618034 + seed / 101) % 1,
        duty: 0.3 + (((i * 7 + seed) % 10) / 10) * 0.35,
      });
      return img;
    });
  }

  /** An invisible hit area over the pedestal and crate that lets the pointer part the smoke. */
  private makeHoverZone(scene: Phaser.Scene): Phaser.GameObjects.Zone {
    const top = Math.min(this.crateTop, this.modelTop) - LIFT - 10;
    const bottom = FLOOR_RY + 6;
    const zone = scene.add.zone(0, (top + bottom) / 2, FLOOR_RX * 2, bottom - top).setInteractive();
    zone.on(Phaser.Input.Events.POINTER_OVER, () => {
      this.hovered.device = true;
      this.peekFog(true);
    });
    zone.on(Phaser.Input.Events.POINTER_OUT, () => {
      this.hovered.device = false;
      this.peekFog(false);
    });
    zone.on(Phaser.Input.Events.POINTER_DOWN, () => this.emit(DeviceNode.SELECT, this));
    return zone;
  }

  /** Hit area over the caption stack, so moving from the device onto its open details keeps them open. */
  private makeCaptionZone(scene: Phaser.Scene): Phaser.GameObjects.Zone {
    const zone = scene.add.zone(0, LABEL_Y, 1, 1).setInteractive();
    zone.on(Phaser.Input.Events.POINTER_OVER, () => (this.hovered.caption = true));
    zone.on(Phaser.Input.Events.POINTER_OUT, () => (this.hovered.caption = false));
    zone.on(Phaser.Input.Events.POINTER_DOWN, () => this.emit(DeviceNode.SELECT, this));
    return zone;
  }

  /**
   * A chunky "?" with an extruded underside, in a frosted glass callout whose tail points down
   * at the hidden device, with a soft halo behind it, floating out of the smoke.
   */
  private makeMark(scene: Phaser.Scene, y: number): Phaser.GameObjects.Container {
    const halo = scene.add.circle(0, 0, 28, NEON.blue, 0.14).setBlendMode(Phaser.BlendModes.ADD);
    const outline = calloutOutline();
    const { w, h, r } = CALLOUT;
    const glass = scene.add.graphics();
    glass.fillStyle(0x000000, 0.4);
    glass.fillPoints(
      outline.map((p) => ({ x: p.x + 1, y: p.y + 3 })),
      true,
    );
    glass.fillStyle(MYSTERY.glass, 0.82);
    glass.fillPoints(outline, true);
    glass.fillStyle(0xffffff, 0.09);
    glass.fillRoundedRect(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, h * 0.42, { tl: r - 1.5, tr: r - 1.5, bl: 2, br: 2 });
    glass.lineStyle(1.2, MYSTERY.glassEdge, 0.65);
    glass.strokePoints(outline, true);
    const text = scene.add
      .text(0, -0.5, "?", {
        fontFamily: FONT_SANS,
        fontSize: "26px",
        fontStyle: "800",
        color: MYSTERY.mark,
        stroke: "#1E293B",
        strokeThickness: 3,
        resolution: TEXT_RESOLUTION,
        shadow: { offsetX: 0, offsetY: 3, color: MYSTERY.markShadow, blur: 0, stroke: true, fill: true },
      })
      .setOrigin(0.5, 0.5);
    return scene.add.container(0, y, [halo, glass, text]);
  }

  private makeBadge(scene: Phaser.Scene, y: number): Phaser.GameObjects.Container {
    const shadow = scene.add.circle(1, 2, 8.5, 0x000000, 0.35);
    const dot = scene.add.circle(0, 0, 8.5, PALETTE.emerald, 1).setStrokeStyle(2.5, 0xffffff, 1);
    const shine = scene.add.circle(-2.5, -3, 3, 0xffffff, 0.3);
    const tick = scene.add.graphics();
    tick.lineStyle(2.5, 0xffffff, 1);
    tick.beginPath();
    tick.moveTo(-4, 0);
    tick.lineTo(-1, 3);
    tick.lineTo(4, -3);
    tick.strokePath();
    return scene.add.container(22, y, [shadow, dot, shine, tick]);
  }

  private makeYouTag(scene: Phaser.Scene): Pill {
    return new Pill(scene, {
      font: FONT_SANS,
      size: FONT_PX.you,
      weight: "800",
      color: "#FFFFFF",
      dot: null,
      border: PALETTE.blueGlow,
      fill: 0x2563eb,
      fillAlpha: 0.95,
    });
  }

  /** A chunky down arrow that bobs above a highlighted device. */
  private makePointer(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics().setVisible(false);
    g.fillStyle(shade(PALETTE.blue, -0.45), 1);
    g.fillTriangle(-9, -11, 9, -11, 0, 2);
    g.fillStyle(PALETTE.blueGlow, 1);
    g.fillTriangle(-9, -14, 9, -14, 0, -1);
    g.fillStyle(0xffffff, 0.45);
    g.fillTriangle(-6, -12.5, -1, -12.5, -2.5, -8);
    return g;
  }
}
