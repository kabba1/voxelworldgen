import type * as THREE from "three";
import type { HeightmapWorldStats } from "../world/heightmapWorld";
import type { FlyCameraController } from "../input/FlyCameraController";

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
    private readonly worldStats: HeightmapWorldStats
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

    this.element.innerHTML = [
      "<strong>Agency Voxel Stats</strong>",
      `fps ${this.fps.toFixed(0)} | frame ${this.frameMs.toFixed(1)}ms`,
      `draws ${renderInfo.calls} | tris ${renderInfo.triangles.toLocaleString()}`,
      `geometries ${memoryInfo.geometries} | textures ${memoryInfo.textures}`,
      `heightmap ${this.worldStats.heightmapSourceWidth}x${this.worldStats.heightmapSourceHeight} -> ${this.worldStats.heightmapWidth}x${this.worldStats.heightmapDepth}`,
      `world ${this.worldStats.width}x${this.worldStats.depth} blocks`,
      `border ${this.worldStats.borderMin}..${this.worldStats.borderMax}`,
      `max height ${this.worldStats.maxTerrainHeight} blocks`,
      `block size ${this.worldStats.blockSize}`,
      `mesh step ${this.worldStats.meshStep} blocks (${this.worldStats.meshMode})`,
      `chunks ${this.worldStats.generatedChunks}/${this.worldStats.chunkColumns}`,
      `terrain tris ${this.worldStats.triangles.toLocaleString()}`,
      `source ${this.worldStats.usedFallback ? "fallback" : this.worldStats.loadedFrom}`,
      `pos ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`,
      `mouse ${this.controller.isPointerLocked() ? "locked" : "click to look"}`
    ].join("<br />");
  }
}
