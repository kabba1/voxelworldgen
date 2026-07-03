export type BlockId = 0 | 1 | 2 | 3;

export const BLOCKS = {
  air: 0,
  stone: 1,
  dirt: 2,
  grass: 3
} as const satisfies Record<string, BlockId>;

export type SolidBlockId = typeof BLOCKS.stone | typeof BLOCKS.dirt | typeof BLOCKS.grass;

export type BlockDefinition = {
  id: SolidBlockId;
  name: string;
  color: number;
};

export const BLOCK_DEFINITIONS: Record<SolidBlockId, BlockDefinition> = {
  [BLOCKS.stone]: {
    id: BLOCKS.stone,
    name: "Stone",
    color: 0x777b82
  },
  [BLOCKS.dirt]: {
    id: BLOCKS.dirt,
    name: "Dirt",
    color: 0x8b5a36
  },
  [BLOCKS.grass]: {
    id: BLOCKS.grass,
    name: "Grass",
    color: 0x4f9d45
  }
};

export const colorForBlock = (blockId: SolidBlockId) => BLOCK_DEFINITIONS[blockId].color;
