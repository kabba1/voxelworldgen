import { BLOCKS, type BlockId, type SolidBlockId } from "./blocks";

export type FlatWorldConfig = {
  width: number;
  depth: number;
  blockSize: number;
  stoneDepth: number;
  dirtDepth: number;
  grassDepth: number;
};

export type FlatWorldStats = {
  width: number;
  depth: number;
  blockSize: number;
  stoneDepth: number;
  dirtDepth: number;
  grassDepth: number;
  height: number;
  borderMin: number;
  borderMax: number;
  meshMode: string;
  generatedChunks: number;
  chunkColumns: number;
  triangles: number;
};

export const FLAT_WORLD_CONFIG: FlatWorldConfig = {
  width: 4000,
  depth: 4000,
  blockSize: 0.5,
  stoneDepth: 50,
  dirtDepth: 10,
  grassDepth: 1
};

export class FlatWorld {
  readonly width: number;
  readonly depth: number;
  readonly blockSize: number;
  readonly stoneDepth: number;
  readonly dirtDepth: number;
  readonly grassDepth: number;
  readonly height: number;
  readonly borderMin: number;
  readonly borderMax: number;

  constructor(config: FlatWorldConfig = FLAT_WORLD_CONFIG) {
    this.width = config.width;
    this.depth = config.depth;
    this.blockSize = config.blockSize;
    this.stoneDepth = config.stoneDepth;
    this.dirtDepth = config.dirtDepth;
    this.grassDepth = config.grassDepth;
    this.height = this.stoneDepth + this.dirtDepth + this.grassDepth;
    this.borderMin = -this.width / 2;
    this.borderMax = this.width / 2;
  }

  heightAt(x: number, z: number) {
    return this.containsColumn(x, z) ? this.height : 0;
  }

  blockAt(x: number, y: number, z: number): BlockId {
    if (!this.containsColumn(x, z) || y < 0 || y >= this.height) return BLOCKS.air;
    if (y < this.stoneDepth) return BLOCKS.stone;
    if (y < this.stoneDepth + this.dirtDepth) return BLOCKS.dirt;
    return BLOCKS.grass;
  }

  isSolid(x: number, y: number, z: number) {
    return this.blockAt(x, y, z) !== BLOCKS.air;
  }

  solidBlockAt(x: number, y: number, z: number): SolidBlockId | null {
    const block = this.blockAt(x, y, z);
    return block === BLOCKS.air ? null : block;
  }

  surfaceBlockAt(_x: number, _z: number): SolidBlockId {
    return BLOCKS.grass;
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

  containsColumn(x: number, z: number) {
    return x >= 0 && x < this.width && z >= 0 && z < this.depth;
  }
}
