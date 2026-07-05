import { BLOCKS, isSolidBlockId, type BlockId, type SolidBlockId } from "./blocks";
import type { FlatWorld } from "./flatWorld";

export type BlockPosition = {
  x: number;
  y: number;
  z: number;
};

export type BlockOverride = BlockPosition & {
  block: BlockId;
};

export const blockKey = (x: number, y: number, z: number) => `${x},${y},${z}`;
export const columnKey = (x: number, z: number) => `${x},${z}`;

export type SurfaceBlockResolver = (x: number, z: number) => SolidBlockId;

const parseBlockKey = (key: string): BlockPosition => {
  const [x, y, z] = key.split(",").map(Number);
  return { x, y, z };
};

export class EditableWorld {
  private readonly overrides = new Map<string, BlockId>();

  constructor(
    private readonly baseWorld: FlatWorld,
    private readonly surfaceBlockAt: SurfaceBlockResolver = () => BLOCKS.grass
  ) {}

  blockAt(x: number, y: number, z: number): BlockId {
    const key = blockKey(x, y, z);
    return this.overrides.get(key) ?? this.baseBlockAt(x, y, z);
  }

  isSolid(x: number, y: number, z: number) {
    return isSolidBlockId(this.blockAt(x, y, z));
  }

  solidBlockAt(x: number, y: number, z: number): SolidBlockId | null {
    const block = this.blockAt(x, y, z);
    return isSolidBlockId(block) ? block : null;
  }

  hasOverride(x: number, y: number, z: number) {
    return this.overrides.has(blockKey(x, y, z));
  }

  setBlock(x: number, y: number, z: number, block: BlockId) {
    const key = blockKey(x, y, z);
    const baseBlock = this.baseBlockAt(x, y, z);
    if (block === baseBlock) {
      this.overrides.delete(key);
      return;
    }
    this.overrides.set(key, block);
  }

  breakBlock(x: number, y: number, z: number) {
    if (!this.isSolid(x, y, z)) return false;
    this.setBlock(x, y, z, BLOCKS.air);
    return true;
  }

  placeBlock(x: number, y: number, z: number, block: SolidBlockId) {
    if (this.isSolid(x, y, z)) return false;
    this.setBlock(x, y, z, block);
    return true;
  }

  overridesList(): BlockOverride[] {
    return [...this.overrides.entries()].map(([key, block]) => ({ ...parseBlockKey(key), block }));
  }

  topOverrideColumns() {
    const columns = new Set<string>();
    for (const override of this.overridesList()) {
      if (override.y === this.baseWorld.height - 1) columns.add(columnKey(override.x, override.z));
    }
    return columns;
  }

  overrideCount() {
    return this.overrides.size;
  }

  private baseBlockAt(x: number, y: number, z: number): BlockId {
    if (!this.baseWorld.containsColumn(x, z) || y < 0 || y >= this.baseWorld.height) return BLOCKS.air;
    if (y === this.baseWorld.height - 1) return this.surfaceBlockAt(x, z);
    return this.baseWorld.blockAt(x, y, z);
  }
}
