import Phaser from "phaser";
import { playSfx } from "@/core/audio";
import { routeHops } from "@/core/network/routing";
import type { SfxName } from "@/types/audio";
import type { PacketFlow } from "@/types/packet";
import type { PacketOutcome, Topology } from "@/types/topology";
import type { DeviceNode } from "../objects/DeviceNode";
import type { TopologyView } from "../objects/TopologyView";
import { DEPTH, FONT_MONO, OUTCOME_COLOR, OUTCOME_CSS, PACKET_IN_FLIGHT, PALETTE, TEXT_RESOLUTION } from "../theme";

/** World units per second. */
const SPEED = 320;
const SEGMENT_MS = { min: 260, max: 1300 };
/** A scan can fire many packets at once; only one sound per window. */
const SFX_GAP_MS = 140;
/** How many flows' endpoints are kept for the packet inspector, oldest dropped first. */
const MAX_REMEMBERED_FLOWS = 500;

type Point = { x: number; y: number };

interface OutcomeStyle {
  tag: (flow: PacketFlow) => string;
  sfx: SfxName;
  /** Success and RST send a reply back to the sender. */
  returns: boolean;
}

const OUTCOMES: Record<PacketOutcome, OutcomeStyle> = {
  success: { tag: (f) => (f.protocol === "tcp" ? "SYN-ACK · open" : "reply"), sfx: "success", returns: true },
  rst: { tag: () => "RST · closed", sfx: "rst", returns: true },
  timeout: { tag: () => "no reply", sfx: "reject", returns: false },
  unreachable: { tag: (f) => `${f.dstIp ?? "address"} not found`, sfx: "reject", returns: false },
};

function protocolLabel(flow: PacketFlow): string {
  const proto = flow.protocol.toUpperCase();
  return flow.dstPort !== undefined ? `${proto} :${flow.dstPort}` : proto;
}

/** A direct line between two devices, for hops with no cable drawn between them. */
function straight(a: Point, b: Point): (t: number) => Point {
  return (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
}

function segmentMs(a: Point, b: Point): number {
  const ms = (Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) / SPEED) * 1000;
  return Phaser.Math.Clamp(ms, SEGMENT_MS.min, SEGMENT_MS.max);
}

/** Packets are small and moving; the click target is a lot bigger than the dot. */
const HIT_RADIUS = 18;
/** Packets hover this high above the cable they travel along. */
const LIFT = 11;
/** Result tags float above the 3D models and the "?" over unknown crates. */
const TAG_Y = 124;
/** Segments in the glowing trail drawn along a curved cable. */
const TRAIL_STEPS = 24;

export interface PacketFlowHooks {
  /** The packet's story is over: its reply got home, it was dropped, or it gave up waiting. */
  settled: (flow: PacketFlow) => void;
  inspect: (flowId: string) => void;
}

/**
 * Visual for one packet in flight: a glossy orb hovering over the cable with its shadow
 * on the floor, a soft glow and a protocol label. Click to inspect.
 */
class PacketSprite extends Phaser.GameObjects.Container {
  private readonly glow: Phaser.GameObjects.Arc;
  private readonly core: Phaser.GameObjects.Arc;
  private readonly ring: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, at: Point, label: string, onClick: () => void) {
    super(scene, at.x, at.y);
    const shadow = scene.add.ellipse(1.5, 2, 16, 8, 0x000000, 0.35);
    this.ring = scene.add.circle(0, -LIFT, 16).setStrokeStyle(2, 0xffffff, 0.95).setVisible(false);
    this.glow = scene.add.circle(0, -LIFT, 13, PACKET_IN_FLIGHT, 0.25).setBlendMode(Phaser.BlendModes.ADD);
    this.core = scene.add.circle(0, -LIFT, 6.5, PACKET_IN_FLIGHT, 1).setStrokeStyle(2, 0xffffff, 0.95);
    const shine = scene.add.circle(-2, -LIFT - 2.2, 2, 0xffffff, 0.85);
    const text = scene.add
      .text(0, -LIFT - 14, label, {
        fontFamily: FONT_MONO,
        fontSize: "9px",
        color: "#BFDBFE",
        resolution: TEXT_RESOLUTION,
        shadow: { offsetX: 0, offsetY: 1, color: "#020617", blur: 3, fill: true },
      })
      .setOrigin(0.5, 1);
    this.add([shadow, this.ring, this.glow, this.core, shine, text]);
    this.setDepth(DEPTH.packets);
    // Container hit areas are measured from its top-left corner, so the circle is offset by its radius.
    this.setSize(HIT_RADIUS * 2, HIT_RADIUS * 2);
    this.setInteractive({
      hitArea: new Phaser.Geom.Circle(HIT_RADIUS, HIT_RADIUS - LIFT, HIT_RADIUS),
      hitAreaCallback: Phaser.Geom.Circle.Contains,
      useHandCursor: true,
    });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, onClick);
    scene.add.existing(this);
  }

  tint(color: number): this {
    this.glow.setFillStyle(color, 0.22);
    this.core.setFillStyle(color, 1);
    return this;
  }

  setInspected(on: boolean): void {
    this.ring.setVisible(on);
  }
}

/**
 * Animates packets along their route. Everything runs on the scene clock and tween
 * manager, so freezing the scene freezes packets mid-flight.
 */
export class PacketFlowSystem {
  private lastSfxAt = -Infinity;
  /** Result tags currently shown above each device, so new ones stack instead of overlapping. */
  private readonly liveTags = new Map<DeviceNode, number>();
  private readonly sprites = new Map<string, PacketSprite>();
  /** Sender and target device of recent flows, still known after the packet has left the screen. */
  private readonly endpointsById = new Map<string, string[]>();
  private inspectedId: string | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly view: TopologyView,
    private readonly topology: Topology,
    private readonly hooks: PacketFlowHooks,
  ) {}

  play(flow: PacketFlow): void {
    this.endpointsById.set(flow.id, flow.dstId ? [flow.srcId, flow.dstId] : [flow.srcId]);
    if (this.endpointsById.size > MAX_REMEMBERED_FLOWS) {
      const oldest = this.endpointsById.keys().next().value;
      if (oldest !== undefined) this.endpointsById.delete(oldest);
    }
    this.scene.time.delayedCall(flow.delayMs ?? 0, () => this.launch(flow));
  }

  /** The devices a flow ran between, if the stage has played it. */
  endpoints(flowId: string): readonly string[] {
    return this.endpointsById.get(flowId) ?? [];
  }

  /** Rings the packet open in the inspector, if it is still on screen. */
  setInspected(flowId: string | null): void {
    if (this.inspectedId) this.sprites.get(this.inspectedId)?.setInspected(false);
    this.inspectedId = flowId;
    if (flowId) this.sprites.get(flowId)?.setInspected(true);
  }

  private launch(flow: PacketFlow): void {
    const nodes = routeHops(this.topology, flow.srcId, flow.dstId)
      .map((id) => this.view.node(id))
      .filter((n): n is DeviceNode => n !== undefined);
    if (nodes.length === 0) {
      this.hooks.settled(flow);
      return;
    }

    const dstIp = flow.dstIp ?? (flow.dstId ? this.view.node(flow.dstId)?.device.ip : undefined);
    const resolved: PacketFlow = { ...flow, dstIp };
    const sprite = new PacketSprite(this.scene, nodes[0], protocolLabel(resolved), () => this.hooks.inspect(flow.id));
    this.sprites.set(flow.id, sprite);
    sprite.once(Phaser.GameObjects.Events.DESTROY, () => this.sprites.delete(flow.id));
    if (flow.id === this.inspectedId) sprite.setInspected(true);
    this.sound("packet");

    this.travel(sprite, nodes, PACKET_IN_FLIGHT, () => this.arrive(resolved, sprite, nodes));
  }

  private arrive(flow: PacketFlow, sprite: PacketSprite, path: DeviceNode[]): void {
    const style = OUTCOMES[flow.outcome];
    const color = OUTCOME_COLOR[flow.outcome];
    const last = path[path.length - 1];

    sprite.tint(color);
    this.sound(style.sfx);
    this.floatTag(last, style.tag(flow), flow.outcome);

    if (style.returns) {
      last.flash(color);
      const back = [...path].reverse();
      this.travel(sprite, back, color, () => {
        back[back.length - 1].flash(color);
        this.fadeOut(sprite, 260);
        this.hooks.settled(flow);
      });
      return;
    }

    if (flow.outcome === "unreachable") {
      this.dropMark(last);
      this.scene.tweens.add({
        targets: sprite,
        scale: 0.2,
        alpha: 0,
        duration: 650,
        ease: "Quad.easeIn",
        onComplete: () => {
          sprite.destroy();
          this.hooks.settled(flow);
        },
      });
      return;
    }

    // Timeout: the packet sits at the silent target, wobbling, then gives up.
    this.scene.tweens.add({
      targets: sprite,
      x: sprite.x + 4,
      duration: 90,
      yoyo: true,
      repeat: 4,
      onComplete: () => {
        this.fadeOut(sprite, 600);
        this.hooks.settled(flow);
      },
    });
  }

  /** Move hop by hop along the cables, lighting each one while the packet is on it. */
  private travel(sprite: PacketSprite, path: DeviceNode[], color: number, done: () => void): void {
    const step = (i: number) => {
      if (i >= path.length) {
        done();
        return;
      }
      const from = path[i - 1];
      const to = path[i];
      const duration = segmentMs(from, to);
      const cable = this.view.cable(from.device.id, to.device.id) ?? straight(from, to);
      const points = Array.from({ length: TRAIL_STEPS + 1 }, (_, k) => cable(k / TRAIL_STEPS));
      const trail = this.scene.add.graphics().setDepth(DEPTH.trails).setBlendMode(Phaser.BlendModes.ADD);
      trail.lineStyle(10, color, 0.16);
      trail.strokePoints(points);
      trail.lineStyle(3, color, 0.85);
      trail.strokePoints(points.map((p) => ({ x: p.x, y: p.y - 1 })));

      this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration,
        ease: "Sine.easeInOut",
        onUpdate: (tween) => {
          const p = cable(tween.getValue() ?? 0);
          sprite.setPosition(p.x, p.y);
        },
        onComplete: () => {
          sprite.setPosition(to.x, to.y);
          this.scene.tweens.add({
            targets: trail,
            alpha: 0,
            duration: 600,
            onComplete: () => trail.destroy(),
          });
          step(i + 1);
        },
      });
    };
    step(1);
  }

  private floatTag(node: DeviceNode, text: string, outcome: PacketOutcome): void {
    const stacked = this.liveTags.get(node) ?? 0;
    this.liveTags.set(node, stacked + 1);
    const tag = this.scene.add
      .text(node.x, node.y - TAG_Y - stacked * 22, text, {
        fontFamily: FONT_MONO,
        fontSize: "11px",
        fontStyle: "700",
        color: OUTCOME_CSS[outcome],
        backgroundColor: "#0B0F19",
        padding: { x: 6, y: 3 },
        resolution: TEXT_RESOLUTION,
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.labels);
    this.scene.tweens.add({
      targets: tag,
      y: tag.y - 16,
      alpha: { from: 1, to: 0 },
      delay: 900,
      duration: 700,
      onComplete: () => {
        tag.destroy();
        const left = (this.liveTags.get(node) ?? 1) - 1;
        if (left > 0) this.liveTags.set(node, left);
        else this.liveTags.delete(node);
      },
    });
  }

  /** An "x" where an unroutable packet was dropped. */
  private dropMark(node: DeviceNode): void {
    const g = this.scene.add.graphics().setDepth(DEPTH.labels).setPosition(node.x + 40, node.y - 44);
    g.fillStyle(PALETTE.void, 1);
    g.fillCircle(0, 0, 9);
    g.lineStyle(2.5, PALETTE.amberGlow, 1);
    g.lineBetween(-4, -4, 4, 4);
    g.lineBetween(-4, 4, 4, -4);
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      delay: 1100,
      duration: 500,
      onComplete: () => g.destroy(),
    });
  }

  private fadeOut(sprite: PacketSprite, duration: number): void {
    this.scene.tweens.add({
      targets: sprite,
      alpha: 0,
      duration,
      onComplete: () => sprite.destroy(),
    });
  }

  private sound(name: SfxName): void {
    const now = this.scene.time.now;
    if (now - this.lastSfxAt < SFX_GAP_MS) return;
    this.lastSfxAt = now;
    playSfx(name);
  }
}
