import Phaser from "phaser";
import { deviceIntel, getLevelDefinition } from "@/core/levels";
import { useProgressStore } from "@/core/state/progressStore";
import { useStageStore, type WalkthroughState } from "@/core/state/stageStore";
import { useUiStore } from "@/core/state/uiStore";
import { useLanguageStore } from "@/i18n/languageStore";
import { translate, type Language } from "@/i18n/translate";
import type { LevelDefinition } from "@/types/topology";
import type { NodeLabels } from "../objects/DeviceNode";
import { TopologyView } from "../objects/TopologyView";
import { PacketFlowSystem } from "../systems/PacketFlowSystem";
import { WalkthroughDirector, type Scheduler } from "../walkthrough/WalkthroughDirector";

export const NETWORK_SCENE_KEY = "network";

/** CSS pixels kept clear for the React overlays (legend on top, walkthrough bar at the bottom). */
const OVERLAY_INSETS = { top: 44, right: 20, bottom: 164, left: 20 };
const MAX_ZOOM = 1.6;

const nodeLabels = (language: Language): NodeLabels => ({
  unverified: translate(language, "stage.unverifiedNode"),
  you: translate(language, "stage.you"),
});

/**
 * The Visual Stage. Reads everything it needs from the Zustand stores and writes
 * walkthrough progress back, so React never has to reach into Phaser.
 */
export class NetworkScene extends Phaser.Scene {
  /** Only the newest scene may clear shared stage state; an old game can finish tearing down late. */
  private static current: NetworkScene | null = null;

  private level: LevelDefinition | null = null;
  private view: TopologyView | null = null;
  private packets: PacketFlowSystem | null = null;
  private director: WalkthroughDirector | null = null;
  private unsubscribers: (() => void)[] = [];
  private destroyHooked = false;

  constructor() {
    super(NETWORK_SCENE_KEY);
  }

  create(): void {
    NetworkScene.current = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);
    if (!this.destroyHooked) {
      this.events.once(Phaser.Scenes.Events.DESTROY, this.onDestroy, this);
      this.destroyHooked = true;
    }

    const levelId = useProgressStore.getState().currentLevelId;
    this.level = getLevelDefinition(levelId) ?? null;
    this.listenToProgress(levelId);
    if (!this.level) {
      useStageStore.getState().stageUnloaded();
      return;
    }

    this.view = new TopologyView(this, this.level.topology, nodeLabels(useLanguageStore.getState().language));
    this.packets = new PacketFlowSystem(this, this.view, this.level.topology, {
      settled: (flow) => useStageStore.getState().packetSettled(flow.id),
      inspect: (packetId) => useUiStore.getState().openModal({ kind: "packetInspector", packetId }),
    });
    this.director = new WalkthroughDirector(this.scheduler(), {
      beat: (index, beat, withPacket) => {
        const stage = useStageStore.getState();
        stage.setWalkthroughBeat(index, beat.text);
        stage.setHighlightedDevice(beat.highlightDeviceId ?? null);
        if (withPacket && beat.packet) {
          const { src, dst, proto, dstPort, outcome } = beat.packet;
          stage.emitPackets([{ srcId: src, dstId: dst, protocol: proto, dstPort, outcome }]);
        }
      },
      finished: () => useStageStore.getState().finishWalkthrough(),
    });

    this.scale.on(Phaser.Scale.Events.RESIZE, this.frameCamera, this);
    this.frameCamera();

    useStageStore.getState().stageLoaded(this.level.id, this.level.walkthrough.length);
    this.bindStores();

    if (useProgressStore.getState().phase === "watch") useStageStore.getState().playWalkthrough();
  }

  private bindStores(): void {
    const view = this.view!;
    const level = this.level!;

    this.unsubscribers.push(
      useStageStore.subscribe((s, prev) => {
        if (s.outbox.length > 0) {
          for (const flow of useStageStore.getState().drainOutbox()) this.packets?.play(flow);
        }
        if (s.highlightedDeviceId !== prev.highlightedDeviceId) view.highlight(s.highlightedDeviceId);
        if (s.walkthrough !== prev.walkthrough) this.onWalkthroughChange(s.walkthrough, prev.walkthrough);
      }),

      useUiStore.subscribe((s, prev) => {
        if (s.simulationPaused !== prev.simulationPaused) this.applyFreeze();
        if (s.activeModal !== prev.activeModal) {
          this.packets?.setInspected(s.activeModal?.kind === "packetInspector" ? s.activeModal.packetId : null);
        }
      }),

      // Per-level evidence, not the shared ledger: every level starts with unverified nodes.
      useProgressStore.subscribe((s, prev) => {
        const proof = s.evidence[level.id];
        if (proof !== prev.evidence[level.id]) view.syncIntel(deviceIntel(level, proof), true);
      }),

      useLanguageStore.subscribe((s, prev) => {
        if (s.language !== prev.language) view.setLabels(nodeLabels(s.language));
      }),
    );

    view.syncIntel(deviceIntel(level, useProgressStore.getState().evidence[level.id]), false);
    this.applyFreeze();
  }

  /**
   * A level change or restart rebuilds the whole scene (simpler than diffing maps). Phase
   * changes within the level start or stop the demo: it autoplays on "watch".
   */
  private listenToProgress(levelId: number): void {
    this.unsubscribers.push(
      useProgressStore.subscribe((s, prev) => {
        if (s.currentLevelId !== levelId || s.restartCount !== prev.restartCount) {
          this.teardown();
          this.scene.restart();
          return;
        }
        if (s.phase === prev.phase || !this.level) return;
        const stage = useStageStore.getState();
        if (s.phase === "watch") stage.playWalkthrough();
        else stage.stopWalkthrough();
      }),
    );
  }

  private onWalkthroughChange(next: WalkthroughState, prev: WalkthroughState): void {
    const director = this.director;
    if (!director || !this.level) return;

    if (next.runId !== prev.runId && next.status === "playing") {
      director.start(this.level.walkthrough);
    } else if (next.stepId !== prev.stepId && next.status === "playing") {
      director.next();
    } else if (next.status === "finished" && director.isRunning) {
      director.skipToEnd();
    } else if (next.status === "idle") {
      director.stop();
    }

    if (next.status !== prev.status) this.applyFreeze();
  }

  /** A modal or a paused demo stops every timer and tween on the stage. */
  private applyFreeze(): void {
    const frozen =
      useUiStore.getState().simulationPaused || useStageStore.getState().walkthrough.status === "paused";
    this.time.paused = frozen;
    this.tweens.timeScale = frozen ? 0 : 1;
  }

  /** Fit the map into the area not covered by overlays. */
  private frameCamera(): void {
    if (!this.view) return;
    const cam = this.cameras.main;
    const { width, height } = this.scale.gameSize;
    const pxRatio = 1 / (this.scale.zoom || 1);
    const inset = {
      top: OVERLAY_INSETS.top * pxRatio,
      right: OVERLAY_INSETS.right * pxRatio,
      bottom: OVERLAY_INSETS.bottom * pxRatio,
      left: OVERLAY_INSETS.left * pxRatio,
    };
    const availW = Math.max(1, width - inset.left - inset.right);
    const availH = Math.max(1, height - inset.top - inset.bottom);

    const box = this.view.bounds();
    const zoom = Math.min(availW / box.width, availH / box.height, MAX_ZOOM * pxRatio);

    cam.setSize(width, height);
    cam.setZoom(zoom);
    const offsetX = (inset.right - inset.left) / 2 / zoom;
    const offsetY = (inset.bottom - inset.top) / 2 / zoom;
    cam.centerOn(box.centerX + offsetX, box.centerY + offsetY);
  }

  private scheduler(): Scheduler {
    return {
      after: (ms, fn) => {
        const event = this.time.delayedCall(ms, fn);
        return () => event.remove(false);
      },
    };
  }

  private teardown(): void {
    this.director?.stop();
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];
    this.scale.off(Phaser.Scale.Events.RESIZE, this.frameCamera, this);
    this.view = null;
    this.packets = null;
    this.director = null;
    this.level = null;
  }

  private onDestroy(): void {
    this.teardown();
    if (NetworkScene.current === this) {
      NetworkScene.current = null;
      useStageStore.getState().stageUnloaded();
    }
  }
}
