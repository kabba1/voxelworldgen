import { BLOCKS, type BlockId, type SolidBlockId } from "./blocks";

export type FlatWorldConfig = {
  width: number;
  depth: number;
  blockSize: number;
  stoneLayers: number;
  dirtLayers: number;
  grassLayers: number;
  chunkSize: number;
};

export type FlatWorldStats = {
  width: number;
  depth: number;
  height: number;
  totalBlocks: number;
  blockSize: number;
  chunkSize: number;
  chunkColumns: number;
  generatedChunks: number;
  exposedFaces: number;
  triangles: number;
};

export const WORLD_CONFIG: FlatWorldConfig = {
  width: 500,
  depth: 500,
  blockSize: 0.5,
  stoneLayers: 10,
  dirtLayers: 5,
  grassLayers: 1,
  chunkSize: 64
};

export class FlatWorld {
  readonly width: number;
  readonly depth: number;
  readonly blockSize: number;
  readonly stoneLayers: number;
  readonly dirtLayers: number;
  readonly grassLayers: number;
  readonly height: number;
  readonly chunkSize: number;
  readonly chunkColumns: number;

  constructor(config: FlatWorldConfig = WORLD_CONFIG) {
    this.width = config.width;
    this.depth = config.depth;
    this.blockSize = config.blockSize;
    this.stoneLayers = config.stoneLayers;
    this.dirtLayers = config.dirtLayers;
    this.grassLayers = config.grassLayers;
    this.height = config.stoneLayers + config.dirtLayers + config.grassLayers;
    this.chunkSize = config.chunkSize;
    this.chunkColumns = Math.ceil(this.width / this.chunkSize) * Math.ceil(this.depth / this.chunkSize);
  }

  blockAt(x: number, y: number, z: number): BlockId {
    if (x < 0 || x >= this.width || z < 0 || z >= this.depth || y < 0 || y >= this.height) {
      return BLOCKS.air;
    }

    if (y < this.stoneLayers) return BLOCKS.stone;
    if (y < this.stoneLayers + this.dirtLayers) return BLOCKS.dirt;
    return BLOCKS.grass;
  }

  isSolid(x: number, y: number, z: number) {
    return this.blockAt(x, y, z) !== BLOCKS.air;
  }

  solidBlockAt(x: number, y: number, z: number): SolidBlockId | null {
    const block = this.blockAt(x, y, z);
    return block === BLOCKS.air ? null : block;
  }

  worldWidth() {
    return this.width * this.blockSize;
  }

  worldDepth() {
    return this.depth * this.blockSize;
  }

  worldHeight() {
    return this.height * this.blockSize;
  }
}
