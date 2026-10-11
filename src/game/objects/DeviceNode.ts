import Phaser from "phaser";
import type { DeviceIntel } from "@/core/levels/objectives";
import type { NetworkDevice } from "@/types/topology";
import { CSS, DEPTH, DEVICE_ACCENT, FONT_MONO, FONT_SANS, MYSTERY, PALETTE, shade, TEXT_RESOLUTION } from "../theme";
import { clayImage, crateArt, modelArt, plinthArt, softDiscKey } from "./clayTextures";
import { PLINTH_TOP } from "./deviceModels";
import { boardToWorld } from "./iso";

/** Models are painted in their own units; this sizes them against the board. Captions are not scaled. */
const MODEL_SCALE = 1.3;
/** A floor circle under the plinth, as an isometric ellipse. */
const FLOOR_RX = 46;
const FLOOR_RY = 26.5;
/** How far the plinth floats above its shadow, and how much it drifts while hovering. */
const LIFT = 9;
const HOVER_PX = 2.5;
const BOB_PX = 4;
const UNDERGLOW_ALPHA = 0.22;
const LABEL_Y = 40;
const CHIP_H = 15;
const CHIP_GAP = 3;
const DETAIL_WRAP_PX = 150;
const TEXT_SHADOW = { offsetX: 0, offsetY: 1, color: "#020617", blur: 3, fill: true } as const;

/** Words the stage draws on nodes, in the current language. */
export interface NodeLabels {
  unverified: string;
  you: string;
}

type Caption = Phaser.GameObjects.Text | Phaser.GameObjects.Container;

/** A rounded badge with a colored dot, for one address (IP or MAC). */
class Chip {
  readonly box: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    fontSize: string,
    color: string,
    private readonly dot: number,
    private readonly border: number,
  ) {
    this.bg = scene.add.graphics();
    this.text = scene.add
      .text(4, 0, "", { fontFamily: FONT_MONO, fontSize, fontStyle: "600", color, resolution: TEXT_RESOLUTION })
      .setOrigin(0.5, 0.5);
    this.box = scene.add.container(0, 0, [this.bg, this.text]);
  }

  get visible(): boolean {
    return this.box.visible;
  }

  set(value: string): void {
    this.box.setVisible(value.length > 0);
    if (!value) return;
    this.text.setText(value);
    const w = Math.ceil(this.text.width) + 22;
    const h = CHIP_H;
    const x = -w / 2;
    const y = -h / 2;
    const g = this.bg.clear();
    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(x, y + 2, w, h, h / 2);
    g.fillStyle(0x0b1222, 0.94);
    g.fillRoundedRect(x, y, w, h, h / 2);
    g.fillStyle(0xffffff, 0.06);
    g.fillRoundedRect(x + 1.5, y + 1, w - 3, h / 2 - 1, { tl: h / 2 - 1, tr: h / 2 - 1, bl: 0, br: 0 });
    g.lineStyle(1, this.border, 0.85);
    g.strokeRoundedRect(x, y, w, h, h / 2);
    g.fillStyle(this.dot, 0.3);
    g.fillCircle(x + 8, 0, 4);
    g.fillStyle(this.dot, 1);
    g.fillCircle(x + 8, 0, 2.2);
  }
}

/**
 * One device on the stage: a little clay diorama model on a plinth that floats above
 * a soft shadow. It starts as a dark crate with a floating "?" and no name or address,
 * and only shows its model, name, IP, MAC and services once a discovery query got a valid reply.
 */
export class DeviceNode extends Phaser.GameObjects.Container {
  readonly device: NetworkDevice;
  private readonly accent: number;
  private readonly ring: Phaser.GameObjects.Ellipse;
  private readonly floorShadow: Phaser.GameObjects.Container;
  /** Accent light bouncing onto the floor under a discovered device. */
  private readonly underglow: Phaser.GameObjects.Image;
  /** Lifts the figure off the floor and drifts it gently. */
  private readonly hover: Phaser.GameObjects.Container;
  /** Plinth and model; squashes when a packet lands. */
  private readonly figure: Phaser.GameObjects.Container;
  private readonly plinthLit: Phaser.GameObjects.Image;
  private readonly mystery: Phaser.GameObjects.Container;
  private readonly crateGlow: Phaser.GameObjects.Image;
  private readonly mark: Phaser.GameObjects.Container;
  private readonly markY: number;
  private readonly crateTop: number;
  private readonly model: Phaser.GameObjects.Container;
  private readonly modelGlow: Phaser.GameObjects.Image;
  private readonly badge: Phaser.GameObjects.Container;
  /** Text and markers drawn above every device, so a nearer model never hides a farther one's name. */
  private readonly caption: Phaser.GameObjects.Container;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly ipChip: Chip;
  private readonly macChip: Chip;
  private readonly servicesText: Phaser.GameObjects.Text;
  private readonly pointer: Phaser.GameObjects.Graphics;
  private readonly youTag: Phaser.GameObjects.Text | null;
  private readonly modelTop: number;
  private labels: NodeLabels;
  private intel: DeviceIntel = { verified: false, macKnown: false, ports: [] };
  /** True while the discovery animation owns the model's visibility. */
  private revealing = false;
  private hoverLoops: Phaser.Tweens.Tween[] = [];
  private loops: Phaser.Tweens.Tween[] = [];
  private highlightLoops: Phaser.Tweens.Tween[] = [];

  constructor(scene: Phaser.Scene, device: NetworkDevice, labels: NodeLabels) {
    const at = boardToWorld(device.x, device.y);
    super(scene, at.x, at.y);
    this.device = device;
    this.accent = DEVICE_ACCENT[device.kind];
    this.labels = labels;

    // Light comes from the upper left, so the shadow falls a little down and to the right.
    const shadow = softDiscKey(scene, "shadow");
    const ambient = scene.add.image(7, 5, shadow).setDisplaySize(FLOOR_RX * 2.4, FLOOR_RY * 2.4).setAlpha(0.6);
    const contact = scene.add.image(5, 3, shadow).setDisplaySize(FLOOR_RX * 1.6, FLOOR_RY * 1.6).setAlpha(0.75);
    this.underglow = scene.add
      .image(0, 0, softDiscKey(scene, "glow"))
      .setDisplaySize(FLOOR_RX * 2.2, FLOOR_RY * 2.2)
      .setTint(this.accent)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.floorShadow = scene.add.container(0, 0, [ambient, contact, this.underglow]);
    this.ring = scene.add.ellipse(0, 0, FLOOR_RX * 2, FLOOR_RY * 2).setStrokeStyle(3, PALETTE.blueGlow, 1).setVisible(false);

    const plinthDark = clayImage(scene, plinthArt(scene, null));
    this.plinthLit = clayImage(scene, plinthArt(scene, this.accent));

    // Crate and model hang from the plinth's top, so they squash and grow from where they stand.
    const crate = crateArt(scene);
    this.crateTop = crate.top;
    this.crateGlow = clayImage(scene, crate, PLINTH_TOP).setTintFill(0xffffff).setAlpha(0);
    this.markY = crate.top - 20 + PLINTH_TOP;
    this.mark = this.makeMark(scene, this.markY);
    this.mystery = scene.add.container(0, -PLINTH_TOP, [clayImage(scene, crate, PLINTH_TOP), this.crateGlow, this.mark]);

    const art = modelArt(scene, device.kind, this.accent);
    this.modelTop = art.top;
    this.modelGlow = clayImage(scene, art, PLINTH_TOP).setTintFill(0xffffff).setAlpha(0);
    this.badge = this.makeBadge(scene, art.top + 6 + PLINTH_TOP);
    this.model = scene.add.container(0, -PLINTH_TOP, [clayImage(scene, art, PLINTH_TOP), this.modelGlow, this.badge]);

    this.figure = scene.add.container(0, 0, [plinthDark, this.plinthLit, this.mystery, this.model]);
    this.hover = scene.add.container(0, -LIFT, [this.figure]);
    this.add([this.floorShadow, this.ring, this.hover]);

    this.nameText = scene.add
      .text(0, LABEL_Y, "", {
        fontFamily: FONT_SANS,
        fontSize: "12px",
        fontStyle: "700",
        color: CSS.ink,
        align: "center",
        resolution: TEXT_RESOLUTION,
        shadow: TEXT_SHADOW,
      })
      .setOrigin(0.5, 0);
    this.ipChip = new Chip(scene, "10px", CSS.ink, this.accent, shade(this.accent, 0.25));
    this.macChip = new Chip(scene, "9px", CSS.inkMuted, PALETTE.inkFaint, PALETTE.lineStrong);
    this.servicesText = scene.add
      .text(0, 0, "", {
        fontFamily: FONT_MONO,
        fontSize: "9px",
        color: CSS.emeraldGlow,
        align: "center",
        resolution: TEXT_RESOLUTION,
        shadow: TEXT_SHADOW,
      })
      .setOrigin(0.5, 0)
      .setWordWrapWidth(DETAIL_WRAP_PX);
    this.youTag = device.isPlayer ? this.makeYouTag(scene, (this.modelTop - LIFT) * MODEL_SCALE - 8) : null;
    this.pointer = this.makePointer(scene);

    this.caption = scene.add
      .container(at.x, at.y, [this.nameText, this.ipChip.box, this.macChip.box, this.servicesText, this.pointer])
      .setDepth(DEPTH.captions);
    if (this.youTag) this.caption.add(this.youTag);

    this.setSize(FLOOR_RX * 2, FLOOR_RY - this.modelTop + LIFT);
    this.setScale(MODEL_SCALE);
    this.setDepth(DEPTH.devices + at.y / 100_000);
    scene.add.existing(this);
    this.renderCaptions();
    this.applyForm();
    this.startHover();
  }

  get verified(): boolean {
    return this.intel.verified;
  }

  setHighlighted(on: boolean): void {
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
        y: this.pointerY() - 6,
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
      if (animate && newPorts) this.popIn([this.servicesText], 0);
    }
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
    for (const t of [...this.hoverLoops, ...this.highlightLoops]) t.remove();
    this.scene?.tweens.killTweensOf(this.animated());
    this.caption.destroy(fromScene);
    super.destroy(fromScene);
  }

  private animated(): Phaser.GameObjects.GameObject[] {
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
    ];
  }

  /** Final look for the current intel, with no animation in progress. */
  private applyForm(): void {
    const known = this.intel.verified;
    this.mystery.setVisible(!known).setAlpha(1).setScale(1).setAngle(0).setY(-PLINTH_TOP);
    this.crateGlow.setAlpha(0);
    this.mark.setAlpha(1).setScale(1).setY(this.markY);
    this.model.setVisible(known).setAlpha(1).setScale(1).setY(-PLINTH_TOP);
    this.modelGlow.setAlpha(0);
    this.plinthLit.setAlpha(known ? 1 : 0);
    this.underglow.setAlpha(known ? UNDERGLOW_ALPHA : 0);
    this.badge.setVisible(known && !this.device.isPlayer).setScale(1);
    for (const item of this.captionItems()) item.setAlpha(1).setScale(1);
    this.setIdle(!known);
  }

  private renderCaptions(): void {
    const { verified, macKnown, ports } = this.intel;
    const d = this.device;
    this.youTag?.setText(this.labels.you);

    // An unknown device shows no name, no address, nothing a scan has not proven.
    this.nameText.setText(verified ? d.name : this.labels.unverified).setColor(verified ? CSS.ink : CSS.inkFaint);
    this.nameText.setFontStyle(verified ? "700" : "italic");

    let y = LABEL_Y + 18;
    this.ipChip.set(verified ? d.ip : "");
    this.ipChip.box.setY(y + CHIP_H / 2);
    if (this.ipChip.visible) y += CHIP_H + CHIP_GAP;
    this.macChip.set(verified && macKnown ? d.mac : "");
    this.macChip.box.setY(y + CHIP_H / 2);
    if (this.macChip.visible) y += CHIP_H + CHIP_GAP;

    const services = verified ? ports.map((p) => `${p.number}/${p.state === "open" ? (p.service ?? "open") : p.state}`) : [];
    const allOpen = ports.every((p) => p.state === "open");
    this.servicesText
      .setText(services.join("  "))
      .setColor(allOpen ? CSS.emeraldGlow : CSS.amberGlow)
      .setVisible(services.length > 0)
      .setY(y + 1);
  }

  /**
   * Discovery: the crate squashes, stretches and shivers while it heats up to white,
   * then implodes into the plinth in a flash of light and clay chips. The real device
   * pops up out of the plinth, white-hot, overshoots, and settles as it cools to its colors.
   */
  private playReveal(): void {
    this.revealing = true;
    this.setIdle(false);
    const tweens = this.scene.tweens;
    tweens.killTweensOf(this.animated());
    this.figure.setScale(1);
    this.mystery.setVisible(true).setAlpha(1).setScale(1).setAngle(0).setY(-PLINTH_TOP);
    this.crateGlow.setAlpha(0);
    this.mark.setAlpha(1).setScale(1).setY(this.markY);
    this.model.setVisible(false);
    this.badge.setVisible(false);
    for (const item of this.captionItems()) item.setAlpha(0);

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

    const colors = [this.accent, light, 0xffffff, MYSTERY.cube];
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
    if (this.pointer.visible) this.setHighlighted(true);
    this.badge.setScale(0);
    this.scene.tweens.add({ targets: this.badge, scale: 1, duration: 300, ease: "Back.easeOut" });
    this.popIn(this.captionItems(), 70);
  }

  /** Fades captions in with a small rise and a little overshoot, one after another. */
  private popIn(items: Caption[], stagger: number): void {
    items.forEach((item, i) => {
      const y = item.y;
      item.setAlpha(0).setY(y + 8).setScale(0.85);
      this.scene.tweens.add({
        targets: item,
        alpha: 1,
        y,
        scale: 1,
        duration: 320,
        delay: i * stagger,
        ease: "Back.easeOut",
      });
    });
  }

  /** Every device floats above its shadow; the shadow tightens and darkens as the figure drifts down. */
  private startHover(): void {
    const offset = ((this.device.x * 3 + this.device.y) % 11) * 70;
    const duration = 2300 + offset;
    this.hoverLoops = [
      this.scene.tweens.add({
        targets: this.hover,
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

  /** Unknown crates bob on their plinth and their "?" pulses, as if waiting to be discovered. */
  private setIdle(on: boolean): void {
    if (on === this.loops.length > 0) return;
    this.stopLoops();
    if (!on) return;
    const offset = ((this.device.x + this.device.y) % 7) * 90;
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
    ];
  }

  private stopLoops(): void {
    for (const t of this.loops) t.remove();
    this.loops = [];
    this.mystery.setY(-PLINTH_TOP);
    this.mark.setY(this.markY).setScale(1);
  }

  private captionItems(): Caption[] {
    return [this.nameText, this.ipChip.box, this.macChip.box, this.servicesText];
  }

  /** Above the model, its "YOU" tag, or the floating "?" of an unknown crate. */
  private pointerY(): number {
    if (!this.intel.verified) return (this.crateTop - 34 - LIFT) * MODEL_SCALE - 8;
    return (this.modelTop - LIFT) * MODEL_SCALE - (this.youTag ? 34 : 12);
  }

  /** Adds a short-lived effect tween that destroys its target when done. */
  private fadeAway(target: Phaser.GameObjects.GameObject, props: Record<string, number>, duration: number, ease = "Linear"): void {
    this.scene.tweens.add({ targets: target, ...props, duration, ease, onComplete: () => target.destroy() });
  }

  /** A chunky "?" with an extruded underside and a soft halo. */
  private makeMark(scene: Phaser.Scene, y: number): Phaser.GameObjects.Container {
    const halo = scene.add.circle(0, 0, 15, MYSTERY.glow, 0.18).setBlendMode(Phaser.BlendModes.ADD);
    const text = scene.add
      .text(0, 0, "?", {
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
    return scene.add.container(0, y, [halo, text]);
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

  private makeYouTag(scene: Phaser.Scene, y: number): Phaser.GameObjects.Text {
    return scene.add
      .text(0, y, this.labels.you, {
        fontFamily: FONT_SANS,
        fontSize: "10px",
        fontStyle: "800",
        color: "#FFFFFF",
        backgroundColor: "#2563EB",
        padding: { x: 7, y: 3 },
        resolution: TEXT_RESOLUTION,
      })
      .setOrigin(0.5, 1);
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
