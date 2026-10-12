import Phaser from "phaser";
import type { DeviceIntel } from "@/core/levels/objectives";
import type { Topology } from "@/types/topology";
import { DEPTH, DIORAMA, FONT_MONO, LABEL_GLASS, NEON, TEXT_RESOLUTION, type ZonePlate } from "../theme";
import { gridFloorKey, softDiscKey } from "./clayTextures";
import { DeviceNode, type NodeLabels } from "./DeviceNode";
import { boardToWorld, isoGrid, slab, softShadow, type Point } from "./iso";

/** Space a device and its model and labels (name, IP, MAC, services) take up, used for framing. */
const DEVICE_EXTENT = { x: 100, top: 138, bottom: 168 };
const BOARD_PAD = 22;
const BOARD_RADIUS = 30;
/** Thickness of the diorama base, seen on its front edge. */
const BOARD_DEPTH = 26;
const ZONE_RADIUS = 20;
const ZONE_DEPTH = 9;
/** A subnet's name tag: inset from the plate's top-left corner, its height, and the text's indent. */
const TAG = { x: 14, y: 8, h: 30, textX: 30 } as const;
/** Clear space kept between a subnet's name tag and anything a device below it draws. */
const TAG_CLEARANCE = 12;
const TILE_SPACING = 24;
const DUST_COUNT = 16;
/** World units per grid-floor texture pixel. */
const GRID_SCALE = 1.25;
/** How far a cable bows away from the straight line, as a share of its length, capped. */
const CABLE_SAG = 0.14;
const CABLE_SAG_MAX = 46;
/** Where a cable comes out from under a pedestal, in world units from the device's center. */
const BOOT_REACH = 58;
/** Ambient data pulses: travel speed in world units per second, and trail length. */
const PULSE_SPEED = 150;
const PULSE_TAIL = 4;
const PULSE_GAP = 7;

/** A point along a cable at progress `t`, from 0 at one device to 1 at the other. */
export type CablePath = (t: number) => Point;

/** A subnet plate as drawn, in world units. Its top can sit above the authored edge to give the name tag room. */
interface Plate {
  x: number;
  y: number;
  w: number;
  h: number;
  style: ZonePlate;
  label: Phaser.GameObjects.Text;
  tagW: number;
}

/** Draws the diorama (grid floor, base deck, subnet plates, cables, devices) for one level and keeps device nodes addressable by id. */
export class TopologyView {
  private readonly nodes = new Map<string, DeviceNode>();
  /** One curve per link, keyed "from>to" in the direction the level lists it. */
  private readonly cables = new Map<string, Phaser.Curves.QuadraticBezier>();
  private readonly board: Phaser.Geom.Rectangle;
  private readonly plates: Plate[];
  /** Per device: where its open details may go, refreshed whenever the camera reframes. */
  private readonly captionAreas = new Map<DeviceNode, Phaser.Geom.Rectangle>();
  private highlighted: DeviceNode | null = null;
  private selected: DeviceNode | null = null;
  private inspected: DeviceNode[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly topology: Topology,
    labels: NodeLabels,
  ) {
    // Devices come first: the subnet plates are sized around how tall they stand. Draw order is set by depth.
    for (const device of topology.devices) {
      const node = new DeviceNode(scene, device, labels);
      node.on(DeviceNode.SELECT, () => this.select(node === this.selected || !node.verified ? null : device.id));
      this.nodes.set(device.id, node);
    }
    this.plates = this.layoutPlates();
    this.board = this.boardRect();
    this.buildCables();
    this.drawBoard();
    this.drawZones();
    this.addLighting();
    this.drawLinks();
    this.spawnPulses();
    this.spawnDust();
  }

  node(id: string): DeviceNode | undefined {
    return this.nodes.get(id);
  }

  /** The cable between two linked devices, oriented from `fromId` to `toId`; null if they are not linked. */
  cable(fromId: string, toId: string): CablePath | null {
    const forward = this.cables.get(`${fromId}>${toId}`);
    if (forward) return (t) => forward.getPoint(t);
    const back = this.cables.get(`${toId}>${fromId}`);
    if (back) return (t) => back.getPoint(1 - t);
    return null;
  }

  highlight(id: string | null): void {
    const next = id ? (this.nodes.get(id) ?? null) : null;
    if (next === this.highlighted) return;
    this.highlighted?.setHighlighted(false);
    next?.setHighlighted(true);
    this.highlighted = next;
  }

  /** Pins one device's details open (null clears it). Clicking the selected device again releases it. */
  select(id: string | null): void {
    const next = id ? (this.nodes.get(id) ?? null) : null;
    if (next === this.selected) return;
    this.selected?.setSelected(false);
    next?.setSelected(true);
    this.selected = next;
  }

  /** Holds open the details of the devices at either end of the packet in the inspector. */
  setInspected(ids: readonly string[]): void {
    for (const node of this.inspected) node.setInspected(false);
    this.inspected = ids.flatMap((id) => this.nodes.get(id) ?? []);
    for (const node of this.inspected) node.setInspected(true);
  }

  /** Steps per-frame caption motion that has to keep running while the stage's tweens are frozen. */
  update(delta: number): void {
    for (const node of this.nodes.values()) node.tick(delta);
  }

  /** Reveals or hides each device's details from what the player has verified in this level. */
  syncIntel(intel: ReadonlyMap<string, DeviceIntel>, animate: boolean): void {
    for (const [id, node] of this.nodes) {
      const known = intel.get(id);
      if (known) node.setIntel(known, animate);
    }
  }

  setLabels(labels: NodeLabels): void {
    for (const node of this.nodes.values()) node.setLabels(labels);
  }

  /** World-space box the camera frames: the deck's top and its front edge. Its soft floor shadow may bleed off-screen. */
  bounds(): Phaser.Geom.Rectangle {
    const b = this.board;
    return new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height + BOARD_DEPTH);
  }

  /**
   * The world area the camera currently leaves visible around the overlays. Each device keeps
   * its open details inside it, and below the name tag of the subnet it stands in.
   */
  setViewport(visible: Phaser.Geom.Rectangle): void {
    for (const node of this.nodes.values()) {
      const ceiling = Math.max(visible.top, this.headerBottom(node));
      let area = this.captionAreas.get(node);
      if (!area) {
        area = new Phaser.Geom.Rectangle();
        this.captionAreas.set(node, area);
      }
      area.setTo(visible.x, ceiling, visible.width, Math.max(0, visible.bottom - ceiling));
      node.setCaptionBounds(area);
    }
  }

  /** Lowest edge, plus clearance, of any subnet name tag above this device; -Infinity when none is. */
  private headerBottom(node: DeviceNode): number {
    let bottom = -Infinity;
    for (const p of this.plates) {
      const tagBottom = p.y + TAG.y + TAG.h + TAG_CLEARANCE;
      if (node.x < p.x || node.x > p.x + p.w || node.y < tagBottom) continue;
      bottom = Math.max(bottom, tagBottom);
    }
    return bottom;
  }

  /**
   * Subnet plates in world units, each with its name tag measured. A device standing under a
   * tag pushes that plate's top up until the tag clears its model, "?" callout, "YOU" tag and
   * walkthrough arrow. Plates in a row share a top edge, so they all rise together.
   */
  private layoutPlates(): Plate[] {
    const plates = this.topology.subnets.map((zone, i): Plate & { authoredTop: number } => {
      const style = DIORAMA.zones[i % DIORAMA.zones.length];
      const a = boardToWorld(zone.x, zone.y);
      const bottom = boardToWorld(0, zone.y + zone.h).y;
      // Measured now, added to the scene in drawZones so it draws over its tag.
      const label = this.scene.make
        .text(
          {
            text: zone.label.toUpperCase(),
            style: { fontFamily: FONT_MONO, fontSize: "17px", fontStyle: "700", color: style.ink, resolution: TEXT_RESOLUTION },
          },
          false,
        )
        .setOrigin(0, 0.5)
        .setDepth(DEPTH.zoneTags);
      const tagW = label.width + 32;
      const tagLeft = a.x + TAG.x - TAG_CLEARANCE;
      const tagRight = a.x + TAG.x + tagW + TAG_CLEARANCE;
      let top = a.y;
      for (const node of this.nodes.values()) {
        if (node.y <= a.y || node.y >= bottom) continue;
        if (node.x + node.halfWidth < tagLeft || node.x - node.halfWidth > tagRight) continue;
        top = Math.min(top, node.y - node.headroom - TAG_CLEARANCE - TAG.h - TAG.y);
      }
      return { x: a.x, y: top, w: zone.w, h: bottom - top, style, label, tagW, authoredTop: a.y };
    });
    return plates.map(({ authoredTop, ...p }) => {
      const top = Math.min(...plates.filter((q) => q.authoredTop === authoredTop).map((q) => q.y));
      return { ...p, y: top, h: p.y + p.h - top };
    });
  }

  /** Subnets and devices in stage coordinates, padded into the base board. */
  private boardRect(): Phaser.Geom.Rectangle {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of this.plates) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + p.w);
      maxY = Math.max(maxY, p.y + p.h + ZONE_DEPTH);
    }
    for (const d of this.topology.devices) {
      const p = boardToWorld(d.x, d.y);
      minX = Math.min(minX, p.x - DEVICE_EXTENT.x);
      minY = Math.min(minY, p.y - DEVICE_EXTENT.top);
      maxX = Math.max(maxX, p.x + DEVICE_EXTENT.x);
      maxY = Math.max(maxY, p.y + DEVICE_EXTENT.bottom);
    }
    return new Phaser.Geom.Rectangle(minX - BOARD_PAD, minY - BOARD_PAD, maxX - minX + BOARD_PAD * 2, maxY - minY + BOARD_PAD * 2);
  }

  /** Cables lie slack on the floor, so each one bows toward the viewer between its two devices. */
  private buildCables(): void {
    const at = new Map(this.topology.devices.map((d) => [d.id, boardToWorld(d.x, d.y)]));
    for (const link of this.topology.links) {
      const a = at.get(link.from);
      const b = at.get(link.to);
      if (!a || !b) continue;
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      let nx = -(b.y - a.y) / len;
      let ny = (b.x - a.x) / len;
      if (ny < 0 || (ny === 0 && nx < 0)) {
        nx = -nx;
        ny = -ny;
      }
      const sag = Math.min(CABLE_SAG_MAX, len * CABLE_SAG);
      const bend = new Phaser.Math.Vector2((a.x + b.x) / 2 + nx * sag, (a.y + b.y) / 2 + ny * sag);
      const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(a.x, a.y), bend, new Phaser.Math.Vector2(b.x, b.y));
      this.cables.set(`${link.from}>${link.to}`, curve);
    }
  }

  /**
   * The isometric grid floor fading out into space, a soft glow under the deck, and the deck
   * itself: thick dark glass with a neon trim, faint floor tiles and a glowing strip along its front.
   */
  private drawBoard(): void {
    const r = this.board;
    this.scene.add.image(r.centerX, r.centerY + BOARD_DEPTH, gridFloorKey(this.scene)).setScale(GRID_SCALE).setDepth(DEPTH.grid);
    this.scene.add
      .image(r.centerX, r.bottom, softDiscKey(this.scene, "glow"))
      .setDisplaySize(r.width * 1.5, r.height * 0.8)
      .setTint(NEON.blue)
      .setAlpha(0.09)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.grid + 1);

    const g = this.scene.add.graphics().setDepth(DEPTH.board);
    softShadow(g, r.centerX, r.bottom + BOARD_DEPTH, r.width * 0.58, 44, 0.65, 6);
    slab(g, r.x, r.y, r.width, r.height, BOARD_DEPTH, BOARD_RADIUS, DIORAMA.board);

    g.lineStyle(1, NEON.blue, 0.05);
    isoGrid(g, new Phaser.Geom.Rectangle(r.x + 22, r.y + 22, r.width - 44, r.height - 44), TILE_SPACING * 2);

    g.lineStyle(7, DIORAMA.edgeGlow, 0.07);
    g.strokeRoundedRect(r.x, r.y, r.width, r.height, BOARD_RADIUS);
    g.lineStyle(1.5, DIORAMA.edgeGlow, 0.5);
    g.strokeRoundedRect(r.x + 0.75, r.y + 0.75, r.width - 1.5, r.height - 1.5, BOARD_RADIUS);

    const stripY = r.bottom + BOARD_DEPTH * 0.62;
    g.lineStyle(8, DIORAMA.edgeGlow, 0.12);
    g.lineBetween(r.x + BOARD_RADIUS, stripY, r.right - BOARD_RADIUS, stripY);
    g.lineStyle(2, DIORAMA.edgeGlow, 0.75);
    g.lineBetween(r.x + BOARD_RADIUS, stripY, r.right - BOARD_RADIUS, stripY);
  }

  /**
   * Each subnet is a raised dark plate trimmed in neon, with isometric floor tiles. Its name tag
   * sits on a layer above the devices, so no model or caption ever covers a network's name.
   */
  private drawZones(): void {
    const g = this.scene.add.graphics().setDepth(DEPTH.zones);
    const tags = this.scene.add.graphics().setDepth(DEPTH.zoneTags);
    for (const { x, y, w, h, style, label, tagW } of this.plates) {
      g.fillStyle(0x000000, 0.4);
      g.fillRoundedRect(x + 3, y + ZONE_DEPTH + 6, w, h, ZONE_RADIUS);
      slab(g, x, y, w, h, ZONE_DEPTH, ZONE_RADIUS, style);

      g.lineStyle(1, style.neon, 0.08);
      isoGrid(g, new Phaser.Geom.Rectangle(x + 9, y + 9, w - 18, h - 18), TILE_SPACING);
      g.fillStyle(0xffffff, 0.02);
      g.fillEllipse(x + w * 0.4, y + h * 0.38, w * 0.75, h * 0.6);
      g.lineStyle(6, style.neon, 0.07);
      g.strokeRoundedRect(x, y, w, h, ZONE_RADIUS);
      g.lineStyle(1.4, style.neon, 0.6);
      g.strokeRoundedRect(x + 0.7, y + 0.7, w - 1.4, h - 1.4, ZONE_RADIUS);

      const tx = x + TAG.x;
      const ty = y + TAG.y;
      const r = TAG.h / 2;
      tags.fillStyle(0x000000, 0.4);
      tags.fillRoundedRect(tx, ty + 3, tagW, TAG.h, r);
      tags.fillStyle(LABEL_GLASS.fill, LABEL_GLASS.alpha);
      tags.fillRoundedRect(tx, ty, tagW, TAG.h, r);
      tags.fillStyle(style.tag, 0.35);
      tags.fillRoundedRect(tx, ty, tagW, TAG.h, r);
      tags.lineStyle(1.5, style.neon, 0.85);
      tags.strokeRoundedRect(tx, ty, tagW, TAG.h, r);
      this.scene.add.existing(label.setPosition(x + TAG.textX, ty + r));
    }
  }

  /** Pools of colored light on the deck: cool blue from the upper left, violet from the right. */
  private addLighting(): void {
    const r = this.board;
    const key = softDiscKey(this.scene, "glow");
    const pools: readonly [number, number, number, number, number, number][] = [
      [0.3, 0.32, 0.8, 0.85, DIORAMA.lights[0], 0.14],
      [0.8, 0.6, 0.62, 0.72, DIORAMA.lights[1], 0.1],
    ];
    for (const [x, y, w, h, color, alpha] of pools) {
      this.scene.add
        .image(r.x + r.width * x, r.y + r.height * y, key)
        .setDisplaySize(r.width * w, r.height * h)
        .setTint(color)
        .setAlpha(alpha)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(DEPTH.light);
    }
  }

  /**
   * Thick Ethernet cables: a soft floor shadow, a dark jacket, a rounded body with a sheen and
   * a specular streak along its top, a neon light strip inside, and strain-relief boots where
   * each end disappears under a pedestal.
   */
  private drawLinks(): void {
    const g = this.scene.add.graphics().setDepth(DEPTH.links);
    const glow = this.scene.add.graphics().setDepth(DEPTH.links).setBlendMode(Phaser.BlendModes.ADD);
    const c = DIORAMA.cable;
    for (const curve of this.cables.values()) {
      const length = curve.getLength();
      const points = curve.getPoints(Math.max(16, Math.ceil(length / 10)));
      const shifted = (dx: number, dy: number) => points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      g.lineStyle(16, 0x000000, 0.14);
      g.strokePoints(shifted(3, 7));
      g.lineStyle(10, 0x000000, 0.3);
      g.strokePoints(shifted(2, 4.5));
      g.lineStyle(9, c.jacket, 1);
      g.strokePoints(points);
      g.lineStyle(6.6, c.body, 1);
      g.strokePoints(shifted(0, -0.4));
      g.lineStyle(2.6, c.sheen, 0.85);
      g.strokePoints(shifted(0, -1.8));
      g.lineStyle(0.9, c.spec, 0.55);
      g.strokePoints(shifted(-0.3, -2.5));
      glow.lineStyle(7, NEON.cyan, 0.06);
      glow.strokePoints(points);
      glow.lineStyle(1.1, NEON.cyan, 0.4);
      glow.strokePoints(shifted(0, 1));

      const reach = Math.min(0.42, BOOT_REACH / Math.max(1, length));
      for (const t of [reach, 1 - reach]) this.drawBoot(g, curve, t, t < 0.5 ? -1 : 1);
    }
  }

  /** A molded RJ45 boot on the cable at `t`, its neon collar on the side facing the device (`toward` -1 = start). */
  private drawBoot(g: Phaser.GameObjects.Graphics, curve: Phaser.Curves.QuadraticBezier, t: number, toward: -1 | 1): void {
    const c = DIORAMA.cable;
    const p = curve.getPoint(t);
    const tangent = curve.getTangent(t);
    let angle = Math.atan2(tangent.y, tangent.x);
    let collar = toward;
    // Keep the boot's lit top side up whichever way the cable runs.
    if (Math.abs(angle) > Math.PI / 2) {
      angle += Math.PI;
      collar = -collar as -1 | 1;
    }
    g.save();
    g.translateCanvas(p.x, p.y);
    g.rotateCanvas(angle);
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-7, -1.5, 15, 10, 3.5);
    g.fillStyle(c.jacket, 1);
    g.fillRoundedRect(-7.5, -5.5, 15, 11, 3.5);
    g.fillStyle(c.boot, 1);
    g.fillRoundedRect(-7, -5, 14, 9.5, 3);
    g.fillStyle(c.sheen, 0.75);
    g.fillRoundedRect(-6, -4.4, 12, 2.6, 1.3);
    g.fillStyle(NEON.cyan, 0.9);
    g.fillRect(collar * 5 - 0.8, -4.6, 1.6, 8.8);
    g.restore();
  }

  /** Small bright pulses with fading tails that keep running along every cable in both directions. */
  private spawnPulses(): void {
    const key = softDiscKey(this.scene, "glow");
    let n = 0;
    for (const curve of this.cables.values()) {
      const length = curve.getLength();
      const travel = (length / PULSE_SPEED) * 1000;
      for (const dir of [1, -1] as const) {
        const add = (w: number, h: number, color: number) =>
          this.scene.add
            .image(0, 0, key)
            .setDisplaySize(w, h)
            .setTint(color)
            .setAlpha(0)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(DEPTH.trails);
        const head = add(20, 12, NEON.cyan);
        const core = add(6, 4.5, 0xffffff);
        const tail = Array.from({ length: PULSE_TAIL }, (_, k) => add(12 - k * 2, 7 - k, NEON.blue));
        const step = PULSE_GAP / Math.max(1, length);
        const place = (t: number) => {
          // Both ends of a cable hide under pedestals, so pulses fade in and out there.
          const fade = Phaser.Math.Clamp(Math.min(t, 1 - t) / 0.14, 0, 1);
          const p = curve.getPoint(t);
          head.setPosition(p.x, p.y - 1).setAlpha(fade * 0.85);
          core.setPosition(p.x, p.y - 1).setAlpha(fade);
          tail.forEach((img, k) => {
            const tt = Phaser.Math.Clamp(t - dir * (k + 1) * step, 0, 1);
            const q = curve.getPoint(tt);
            img.setPosition(q.x, q.y - 1).setAlpha(fade * (0.5 - k * 0.1));
          });
        };
        this.scene.tweens.addCounter({
          from: 0,
          to: 1,
          duration: travel,
          delay: ((n * 530) % 2600) + (dir < 0 ? travel * 0.5 : 0),
          repeat: -1,
          repeatDelay: 900 + ((n * 377) % 2200),
          onUpdate: (tween) => place(dir > 0 ? (tween.getValue() ?? 0) : 1 - (tween.getValue() ?? 0)),
        });
        n += 1;
      }
    }
  }

  /** Slow motes drifting up through the light, so the little world feels alive. */
  private spawnDust(): void {
    const r = this.board;
    for (let i = 0; i < DUST_COUNT; i++) {
      const mote = this.scene.add
        .circle(0, 0, Phaser.Math.FloatBetween(1, 2.2), DIORAMA.dust[i % DIORAMA.dust.length], 1)
        .setDepth(DEPTH.ambient)
        .setBlendMode(Phaser.BlendModes.ADD);
      const drift = () => {
        const x = Phaser.Math.FloatBetween(r.x + 20, r.right - 20);
        const y = Phaser.Math.FloatBetween(r.y + r.height * 0.3, r.bottom);
        mote.setPosition(x, y).setAlpha(0);
        this.scene.tweens.chain({
          targets: mote,
          tweens: [
            { alpha: Phaser.Math.FloatBetween(0.25, 0.55), duration: 1400, ease: "Sine.easeOut" },
            { alpha: 0, duration: 2200, ease: "Sine.easeIn" },
          ],
        });
        this.scene.tweens.add({
          targets: mote,
          x: x + Phaser.Math.FloatBetween(-30, 30),
          y: y - Phaser.Math.FloatBetween(60, 140),
          duration: 3600,
          ease: "Sine.easeInOut",
          onComplete: drift,
        });
      };
      this.scene.time.delayedCall(i * 380, drift);
    }
  }
}
