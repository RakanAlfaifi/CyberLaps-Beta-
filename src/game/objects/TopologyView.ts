import Phaser from "phaser";
import type { DeviceIntel } from "@/core/levels/objectives";
import type { Topology } from "@/types/topology";
import { DEPTH, DIORAMA, FONT_MONO, TEXT_RESOLUTION } from "../theme";
import { DeviceNode, type NodeLabels } from "./DeviceNode";
import { boardToWorld, isoGrid, slab, softShadow } from "./iso";

/** Space a device and its model and labels (name, IP, MAC, services) take up, used for framing. */
const DEVICE_EXTENT = { x: 84, top: 122, bottom: 112 };
const BOARD_PAD = 22;
const BOARD_RADIUS = 30;
/** Thickness of the diorama base, seen on its front edge. */
const BOARD_DEPTH = 26;
const ZONE_RADIUS = 20;
const ZONE_DEPTH = 9;
const TILE_SPACING = 24;
const DUST_COUNT = 16;

/** Draws the diorama (base board, subnet plates, cables, devices) for one level and keeps device nodes addressable by id. */
export class TopologyView {
  private readonly nodes = new Map<string, DeviceNode>();
  private readonly board: Phaser.Geom.Rectangle;
  private highlighted: DeviceNode | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly topology: Topology,
    labels: NodeLabels,
  ) {
    this.board = this.boardRect();
    this.drawBoard();
    this.drawZones();
    this.drawLinks();
    for (const device of topology.devices) {
      this.nodes.set(device.id, new DeviceNode(scene, device, labels));
    }
    this.spawnDust();
  }

  node(id: string): DeviceNode | undefined {
    return this.nodes.get(id);
  }

  highlight(id: string | null): void {
    const next = id ? (this.nodes.get(id) ?? null) : null;
    if (next === this.highlighted) return;
    this.highlighted?.setHighlighted(false);
    next?.setHighlighted(true);
    this.highlighted = next;
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

  /** World-space box around everything drawn, including the base board's front edge and shadow. */
  bounds(): Phaser.Geom.Rectangle {
    const b = this.board;
    return new Phaser.Geom.Rectangle(b.x - 8, b.y - 8, b.width + 16, b.height + BOARD_DEPTH + 20);
  }

  /** Subnets and devices in stage coordinates, padded into the base board. */
  private boardRect(): Phaser.Geom.Rectangle {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const z of this.topology.subnets) {
      const a = boardToWorld(z.x, z.y);
      const b = boardToWorld(z.x + z.w, z.y + z.h);
      minX = Math.min(minX, a.x);
      minY = Math.min(minY, a.y);
      maxX = Math.max(maxX, b.x);
      maxY = Math.max(maxY, b.y + ZONE_DEPTH);
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

  /** The diorama base: a thick dark board with a soft shadow, a lit pool on top and a glowing strip along its front. */
  private drawBoard(): void {
    const g = this.scene.add.graphics().setDepth(DEPTH.board);
    const r = this.board;
    softShadow(g, r.centerX, r.bottom + BOARD_DEPTH, r.width * 0.55, 38, 0.5, 6);
    slab(g, r.x, r.y, r.width, r.height, BOARD_DEPTH, BOARD_RADIUS, DIORAMA.board);

    const stripY = r.bottom + BOARD_DEPTH * 0.62;
    g.lineStyle(6, DIORAMA.edgeGlow, 0.12);
    g.lineBetween(r.x + BOARD_RADIUS, stripY, r.right - BOARD_RADIUS, stripY);
    g.lineStyle(2, DIORAMA.edgeGlow, 0.55);
    g.lineBetween(r.x + BOARD_RADIUS, stripY, r.right - BOARD_RADIUS, stripY);

    // Ambient key light falling from the upper left.
    for (let i = 0; i < 4; i++) {
      g.fillStyle(0xffffff, 0.012);
      g.fillEllipse(r.x + r.width * 0.36, r.y + r.height * 0.32, r.width * (0.5 + i * 0.16), r.height * (0.45 + i * 0.16));
    }
  }

  /** Each subnet is a raised clay plate with isometric floor tiles and a name tag. */
  private drawZones(): void {
    const g = this.scene.add.graphics().setDepth(DEPTH.zones);
    this.topology.subnets.forEach((zone, i) => {
      const style = DIORAMA.zones[i % DIORAMA.zones.length];
      const a = boardToWorld(zone.x, zone.y);
      const w = zone.w;
      const h = boardToWorld(0, zone.h).y;

      g.fillStyle(0x000000, 0.3);
      g.fillRoundedRect(a.x + 3, a.y + ZONE_DEPTH + 5, w, h, ZONE_RADIUS);
      slab(g, a.x, a.y, w, h, ZONE_DEPTH, ZONE_RADIUS, style);

      g.lineStyle(1, 0xffffff, 0.05);
      isoGrid(g, new Phaser.Geom.Rectangle(a.x + 9, a.y + 9, w - 18, h - 18), TILE_SPACING);
      g.fillStyle(0xffffff, 0.025);
      g.fillEllipse(a.x + w * 0.4, a.y + h * 0.38, w * 0.75, h * 0.6);

      const label = this.scene.add
        .text(a.x + 24, a.y + 18, zone.label.toUpperCase(), {
          fontFamily: FONT_MONO,
          fontSize: "11px",
          fontStyle: "600",
          color: style.ink,
          resolution: TEXT_RESOLUTION,
        })
        .setOrigin(0, 0.5)
        .setDepth(DEPTH.zones);
      const tagW = label.width + 20;
      g.fillStyle(0x000000, 0.35);
      g.fillRoundedRect(a.x + 14, a.y + 10, tagW, 21, 10.5);
      g.fillStyle(style.tag, 0.75);
      g.fillRoundedRect(a.x + 14, a.y + 7, tagW, 21, 10.5);
      g.lineStyle(1.5, style.rim, 1);
      g.strokeRoundedRect(a.x + 14, a.y + 7, tagW, 21, 10.5);
    });
  }

  /** Chunky clay cables lying on the floor: a shadow, a body, a thin highlight, and a connector bead. */
  private drawLinks(): void {
    const g = this.scene.add.graphics().setDepth(DEPTH.links);
    const byId = new Map(this.topology.devices.map((d) => [d.id, boardToWorld(d.x, d.y)]));
    for (const link of this.topology.links) {
      const a = byId.get(link.from);
      const b = byId.get(link.to);
      if (!a || !b) continue;
      g.lineStyle(9, 0x000000, 0.3);
      g.lineBetween(a.x + 2, a.y + 4, b.x + 2, b.y + 4);
      g.lineStyle(6, DIORAMA.cable.body, 1);
      g.lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(1.8, DIORAMA.cable.highlight, 0.9);
      g.lineBetween(a.x, a.y - 1.5, b.x, b.y - 1.5);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      g.fillStyle(0x000000, 0.3);
      g.fillEllipse(mx + 2, my + 4, 14, 8);
      g.fillStyle(DIORAMA.cable.body, 1);
      g.fillCircle(mx, my, 5.5);
      g.fillStyle(DIORAMA.cable.highlight, 1);
      g.fillCircle(mx - 1, my - 1.5, 2.5);
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
