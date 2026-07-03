import type * as THREE from "three";
import type { FlatWorldStats } from "../world/flatWorld";
import type { PlotLayoutStats } from "../world/plots";
import type { FlyCameraController } from "../input/FlyCameraController";
import type { SkyCycleState } from "../render/skybox";

export class StatsOverlay {
  readonly element: HTMLDivElement;

  private lastSampleTime = performance.now();
  private frames = 0;
  private fps = 0;
  private frameMs = 0;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly controller: FlyCameraController,
    private readonly worldStats: FlatWorldStats,
    private readonly plotStats: PlotLayoutStats,
    private readonly getSkyState?: () => SkyCycleState | null
  ) {
    this.element = document.createElement("div");
    this.element.className = "stats";
    document.body.appendChild(this.element);
  }

  update(deltaSeconds: number) {
    this.frames += 1;
    this.frameMs = deltaSeconds * 1000;
    const now = performance.now();
    if (now - this.lastSampleTime >= 250) {
      this.fps = (this.frames * 1000) / (now - this.lastSampleTime);
      this.frames = 0;
      this.lastSampleTime = now;
      this.render();
    }
  }

  dispose() {
    this.element.remove();
  }

  private render() {
    const renderInfo = this.renderer.info.render;
    const memoryInfo = this.renderer.info.memory;
    const p = this.camera.position;
    const sky = this.getSkyState?.();

    const rows = [
      "<strong>Agency Voxel Stats</strong>",
      `fps ${this.fps.toFixed(0)} | frame ${this.frameMs.toFixed(1)}ms`,
      `draws ${renderInfo.calls} | tris ${renderInfo.triangles.toLocaleString()}`,
      `geometries ${memoryInfo.geometries} | textures ${memoryInfo.textures}`,
      sky ? `sky ${sky.phase} ${sky.clockLabel}` : null,
      sky ? `sky mix day ${sky.dayAlpha.toFixed(2)} | night ${sky.nightAlpha.toFixed(2)} | clouds ${sky.cloudAlpha.toFixed(2)}` : null,
      `world ${this.worldStats.width}x${this.worldStats.depth} blocks`,
      `border ${this.worldStats.borderMin}..${this.worldStats.borderMax}`,
      `height ${this.worldStats.height} blocks`,
      `block size ${this.worldStats.blockSize}`,
      `layers ${this.worldStats.stoneDepth} stone | ${this.worldStats.dirtDepth} dirt | ${this.worldStats.grassDepth} grass`,
      `mesh ${this.worldStats.meshMode}`,
      `chunks ${this.worldStats.generatedChunks}/${this.worldStats.chunkColumns}`,
      `terrain tris ${this.worldStats.triangles.toLocaleString()}`,
      `plots ${this.plotStats.plotCount} | sep ${this.plotStats.separatorBlocks}`,
      `plot sizes ${this.plotStats.smallPlots}/${this.plotStats.mediumPlots}/${this.plotStats.largePlots}`,
      `plot cover ${(this.plotStats.coverageRatio * 100).toFixed(1)}% | path tris ${this.plotStats.outlineTriangles.toLocaleString()}`,
      `pos ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`,
      `mouse ${this.controller.isPointerLocked() ? "locked" : "click to look"}`
    ];

    this.element.innerHTML = rows.filter(Boolean).join("<br />");
  }
}
