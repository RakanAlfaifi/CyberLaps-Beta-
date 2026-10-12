import Phaser from "phaser";
import { deviceIntel, getLevelDefinition } from "@/core/levels";
import { useProgressStore } from "@/core/state/progressStore";
import { useStageStore, type WalkthroughState } from "@/core/state/stageStore";
import { useUiStore } from "@/core/state/uiStore";
import { useLanguageStore } from "@/i18n/languageStore";
import { translate, type Language } from "@/i18n/translate";
import type { LevelDefinition } from "@/types/topology";
import { spaceKey, vignetteKey } from "../objects/clayTextures";
import type { NodeLabels } from "../objects/DeviceNode";
import { TopologyView } from "../objects/TopologyView";
import { PacketFlowSystem } from "../systems/PacketFlowSystem";
import { DEFAULT_STAGE_INSETS, STAGE_INSETS_KEY, type StageInsets } from "../stageInsets";
import { DEPTH } from "../theme";
import { WalkthroughDirector, type Scheduler } from "../walkthrough/WalkthroughDirector";

export const NETWORK_SCENE_KEY = "network";

/** CSS pixels of breathing room between the map and the overlays or the stage edge. */
const FRAME_MARGIN = 6;
const MAX_ZOOM = 2.2;
/** How long the camera glides to a new framing when an overlay grows or shrinks. */
const REFRAME_MS = 420;

/** What the camera shows: its zoom and the world point at the middle of the canvas. */
interface CameraView {
  zoom: number;
  x: number;
  y: number;
}

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
  /** Deep space behind everything and a vignette over the floor, both pinned to the viewport. */
  private backdrop: Phaser.GameObjects.Image | null = null;
  private vignette: Phaser.GameObjects.Image | null = null;
  private unsubscribers: (() => void)[] = [];
  private destroyHooked = false;
  private cameraView: CameraView | null = null;
  private reframe: { from: CameraView; to: CameraView; elapsed: number } | null = null;

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

    this.backdrop = this.add.image(0, 0, spaceKey(this)).setScrollFactor(0).setDepth(DEPTH.backdrop);
    this.vignette = this.add.image(0, 0, vignetteKey(this)).setScrollFactor(0).setDepth(DEPTH.vignette);
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

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.registry.events.on(`changedata-${STAGE_INSETS_KEY}`, this.onInsetsChange, this);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onStagePointerDown, this);
    this.frameCamera(false);

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
          const packetId = s.activeModal?.kind === "packetInspector" ? s.activeModal.packetId : null;
          this.packets?.setInspected(packetId);
          view.setInspected(packetId ? (this.packets?.endpoints(packetId) ?? []) : []);
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

  override update(_time: number, delta: number): void {
    this.view?.update(delta);
    const glide = this.reframe;
    if (!glide) return;
    glide.elapsed += delta;
    const k = Math.min(1, glide.elapsed / REFRAME_MS);
    const f = Phaser.Math.Easing.Cubic.InOut(k);
    const { from, to } = glide;
    // Zoom is a scale, so blend it geometrically; the center moves linearly between the framings.
    this.applyView({
      zoom: from.zoom * Math.pow(to.zoom / from.zoom, f),
      x: from.x + (to.x - from.x) * f,
      y: from.y + (to.y - from.y) * f,
    });
    if (k >= 1) this.reframe = null;
  }

  private onResize(): void {
    this.frameCamera(false);
  }

  private onInsetsChange(): void {
    this.frameCamera(true);
  }

  /** A click on empty stage (no device, caption or packet under it) lets go of the selected device. */
  private onStagePointerDown(_pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (over.length === 0) this.view?.select(null);
  }

  /**
   * Scales and centers the diorama so it fills as much of the canvas as the React overlays leave
   * free. The overlays report their size live, so a collapsed instructions card frees its space.
   */
  private frameCamera(animate: boolean): void {
    if (!this.view) return;
    const { width, height } = this.scale.gameSize;
    this.cameras.main.setSize(width, height);
    const target = this.fitView(width, height);
    if (animate && this.cameraView) {
      this.reframe = { from: this.cameraView, to: target, elapsed: 0 };
    } else {
      this.reframe = null;
      this.applyView(target);
    }
  }

  private fitView(width: number, height: number): CameraView {
    const pxRatio = 1 / (this.scale.zoom || 1);
    const inset = this.overlayInsets();
    const availW = Math.max(1, width - inset.left - inset.right);
    const availH = Math.max(1, height - inset.top - inset.bottom);

    const box = this.view!.bounds();
    const zoom = Math.max(0.05, Math.min(availW / box.width, availH / box.height, MAX_ZOOM * pxRatio));
    return {
      zoom,
      x: box.centerX + (inset.right - inset.left) / 2 / zoom,
      y: box.centerY + (inset.bottom - inset.top) / 2 / zoom,
    };
  }

  /** Game pixels along each canvas edge that the React overlays cover, plus the breathing room. */
  private overlayInsets(): StageInsets {
    const pxRatio = 1 / (this.scale.zoom || 1);
    const insets: StageInsets = this.registry.get(STAGE_INSETS_KEY) ?? DEFAULT_STAGE_INSETS;
    const edge = (css: number) => (Math.max(0, css) + FRAME_MARGIN) * pxRatio;
    return { top: edge(insets.top), right: edge(insets.right), bottom: edge(insets.bottom), left: edge(insets.left) };
  }

  private applyView(view: CameraView): void {
    const cam = this.cameras.main;
    cam.setZoom(view.zoom);
    cam.centerOn(view.x, view.y);
    this.cameraView = view;
    this.fitScreenLayers(cam.width, cam.height, view.zoom);
    this.view?.setViewport(this.visibleArea(cam.width, cam.height, view));
  }

  /** The world rect a framing shows between the overlays, which device details must stay inside. */
  private visibleArea(width: number, height: number, view: CameraView): Phaser.Geom.Rectangle {
    const inset = this.overlayInsets();
    const z = view.zoom;
    return new Phaser.Geom.Rectangle(
      view.x + (inset.left - width / 2) / z,
      view.y + (inset.top - height / 2) / z,
      Math.max(1, width - inset.left - inset.right) / z,
      Math.max(1, height - inset.top - inset.bottom) / z,
    );
  }

  /** Viewport-pinned layers still scale with the camera zoom around the view's center, so size them against it. */
  private fitScreenLayers(width: number, height: number, zoom: number): void {
    const w = width / zoom;
    const h = height / zoom;
    if (this.backdrop) {
      const cover = Math.max(w / this.backdrop.width, h / this.backdrop.height);
      this.backdrop.setPosition(width / 2, height / 2).setScale(cover);
    }
    this.vignette?.setPosition(width / 2, height / 2).setDisplaySize(w, h);
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
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.registry.events.off(`changedata-${STAGE_INSETS_KEY}`, this.onInsetsChange, this);
    this.input?.off(Phaser.Input.Events.POINTER_DOWN, this.onStagePointerDown, this);
    this.reframe = null;
    this.cameraView = null;
    this.view = null;
    this.packets = null;
    this.director = null;
    this.backdrop = null;
    this.vignette = null;
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
