export const BLOCKS = {
  air: 0,
  stone: 1,
  dirt: 2,
  grass: 3,
  path: 4
} as const;

type BlockConstantKey = keyof typeof BLOCKS;
export type BlockId = (typeof BLOCKS)[BlockConstantKey];
export type SolidBlockId = Exclude<BlockId, typeof BLOCKS.air>;

export const BLOCK_KEYS = {
  [BLOCKS.air]: "air",
  [BLOCKS.stone]: "stone",
  [BLOCKS.dirt]: "dirt",
  [BLOCKS.grass]: "grass",
  [BLOCKS.path]: "path"
} as const satisfies Record<BlockId, string>;

export type BlockKey = (typeof BLOCK_KEYS)[BlockId];
export type SolidBlockKey = Exclude<BlockKey, "air">;

export type BlockDefinition = {
  id: BlockId;
  key: BlockKey;
  name: string;
  color: number;
  solid: boolean;
  texturePath: string | null;
};

export type SolidBlockDefinition = BlockDefinition & {
  id: SolidBlockId;
  key: SolidBlockKey;
  solid: true;
  texturePath: string;
};

export const BLOCK_DEFINITIONS: Record<BlockId, BlockDefinition> = {
  [BLOCKS.air]: {
    id: BLOCKS.air,
    key: "air",
    name: "Air",
    color: 0x000000,
    solid: false,
    texturePath: null
  },
  [BLOCKS.stone]: {
    id: BLOCKS.stone,
    key: "stone",
    name: "Stone",
    color: 0x777b82,
    solid: true,
    texturePath: "/textures/stone.png"
  },
  [BLOCKS.dirt]: {
    id: BLOCKS.dirt,
    key: "dirt",
    name: "Dirt",
    color: 0x8b5a36,
    solid: true,
    texturePath: "/textures/dirt.png"
  },
  [BLOCKS.grass]: {
    id: BLOCKS.grass,
    key: "grass",
    name: "Grass",
    color: 0x4f9d45,
    solid: true,
    texturePath: "/textures/grass.png"
  },
  [BLOCKS.path]: {
    id: BLOCKS.path,
    key: "path",
    name: "Path",
    color: 0x8d8064,
    solid: true,
    texturePath: "/textures/path.png"
  }
};

export const ACTIVE_SOLID_BLOCKS = Object.values(BLOCK_DEFINITIONS).filter(
  (definition): definition is SolidBlockDefinition => definition.solid && definition.texturePath !== null
);

export const blockIdToKey = (blockId: BlockId) => BLOCK_KEYS[blockId] ?? null;

export const validateBlockKey = (blockKey: string): blockKey is BlockKey =>
  Object.values(BLOCK_KEYS).some((key) => key === blockKey);

export const blockKeyToId = (blockKey: string): BlockId | null => {
  for (const [id, key] of Object.entries(BLOCK_KEYS)) {
    if (key === blockKey) return Number(id) as BlockId;
  }
  return null;
};
