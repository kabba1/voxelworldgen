import { BLOCKS, type BlockId, type SolidBlockId } from "./blocks";
import type { HeightmapData } from "./heightmapLoader";

export type HeightmapWorldConfig = {
  width: number;
  depth: number;
  blockSize: number;
  maxTerrainHeight: number;
  chunkSize: number;
  dirtDepth: number;
  steepDirtThreshold: number;
  steepStoneThreshold: number;
  borderMin: number;
  borderMax: number;
};

export type HeightmapWorldStats = {
  heightmapSourceWidth: number;
  heightmapSourceHeight: number;
  heightmapWidth: number;
  heightmapDepth: number;
  loadedFrom: string;
  usedFallback: boolean;
  width: number;
  depth: number;
  maxTerrainHeight: number;
  blockSize: number;
  chunkSize: number;
  chunkColumns: number;
  meshStep: number;
  generatedChunks: number;
  triangles: number;
  borderMin: number;
  borderMax: number;
};

export const HEIGHTMAP_WORLD_CONFIG: HeightmapWorldConfig = {
  width: 2000,
  depth: 2000,
  blockSize: 0.5,
  maxTerrainHeight: 256,
  chunkSize: 256,
  dirtDepth: 5,
  steepDirtThreshold: 4,
  steepStoneThreshold: 12,
  borderMin: -1000,
  borderMax: 1000
};

export class HeightmapWorld {
  readonly width: number;
  readonly depth: number;
  readonly blockSize: number;
  readonly maxTerrainHeight: number;
  readonly height: number;
  readonly chunkSize: number;
  readonly chunkColumns: number;
  readonly dirtDepth: number;
  readonly steepDirtThreshold: number;
  readonly steepStoneThreshold: number;
  readonly borderMin: number;
  readonly borderMax: number;
  readonly heightmapSourceWidth: number;
  readonly heightmapSourceHeight: number;
  readonly loadedFrom: string;
  readonly usedFallback: boolean;

  private readonly heights: Uint16Array;

  constructor(heightmap: HeightmapData, config: HeightmapWorldConfig = HEIGHTMAP_WORLD_CONFIG) {
    this.width = config.width;
    this.depth = config.depth;
    this.blockSize = config.blockSize;
    this.maxTerrainHeight = config.maxTerrainHeight;
    this.height = config.maxTerrainHeight;
    this.chunkSize = config.chunkSize;
    this.chunkColumns = Math.ceil(this.width / this.chunkSize) * Math.ceil(this.depth / this.chunkSize);
    this.dirtDepth = config.dirtDepth;
    this.steepDirtThreshold = config.steepDirtThreshold;
    this.steepStoneThreshold = config.steepStoneThreshold;
    this.borderMin = config.borderMin;
    this.borderMax = config.borderMax;
    this.heightmapSourceWidth = heightmap.sourceWidth;
    this.heightmapSourceHeight = heightmap.sourceHeight;
    this.loadedFrom = heightmap.loadedFrom;
    this.usedFallback = heightmap.usedFallback;
    this.heights = heightmap.heights;

    if (heightmap.width !== this.width || heightmap.depth !== this.depth) {
      throw new Error(`Heightmap was ${heightmap.width}x${heightmap.depth}; expected ${this.width}x${this.depth}.`);
    }
  }

  heightAt(x: number, z: number) {
    if (!this.containsColumn(x, z)) return 0;
    return this.heights[z * this.width + x];
  }

  blockAt(x: number, y: number, z: number): BlockId {
    if (!this.containsColumn(x, z) || y < 0 || y >= this.maxTerrainHeight) return BLOCKS.air;

    const columnHeight = this.heightAt(x, z);
    if (y >= columnHeight) return BLOCKS.air;

    const surfaceY = columnHeight - 1;
    if (y === surfaceY) return this.surfaceBlockAt(x, z);
    if (y >= Math.max(0, columnHeight - this.dirtDepth)) return BLOCKS.dirt;
    return BLOCKS.stone;
  }

  isSolid(x: number, y: number, z: number) {
    return this.blockAt(x, y, z) !== BLOCKS.air;
  }

  solidBlockAt(x: number, y: number, z: number): SolidBlockId | null {
    const block = this.blockAt(x, y, z);
    return block === BLOCKS.air ? null : block;
  }

  surfaceBlockAt(x: number, z: number): SolidBlockId {
    const steepness = this.steepnessAt(x, z);
    if (steepness >= this.steepStoneThreshold) return BLOCKS.stone;
    if (steepness >= this.steepDirtThreshold) return BLOCKS.dirt;
    return BLOCKS.grass;
  }

  steepnessAt(x: number, z: number) {
    const center = this.heightAt(x, z);
    let steepness = 0;

    for (const [offsetX, offsetZ] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]) {
      const neighborX = x + offsetX;
      const neighborZ = z + offsetZ;
      if (!this.containsColumn(neighborX, neighborZ)) continue;
      steepness = Math.max(steepness, Math.abs(center - this.heightAt(neighborX, neighborZ)));
    }

    return steepness;
  }

  containsColumn(x: number, z: number) {
    return x >= 0 && x < this.width && z >= 0 && z < this.depth;
  }

  worldWidth() {
    return this.width * this.blockSize;
  }

  worldDepth() {
    return this.depth * this.blockSize;
  }

  worldHeight() {
    return this.maxTerrainHeight * this.blockSize;
  }
}
