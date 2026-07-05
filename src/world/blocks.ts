export const BLOCKS = {
  air: 0,
  stone: 1,
  dirt: 2,
  grass: 3,
  path: 4,
  cobblestone: 5,
  mossyCobblestone: 6,
  stoneBricks: 7,
  crackedStoneBricks: 8,
  bricks: 9,
  oakLog: 10,
  oakPlanks: 11,
  oakDoor: 12,
  glass: 13,
  glassPane: 14,
  ironBars: 15,
  torch: 16,
  bed: 17,
  craftingTable: 18,
  furnace: 19,
  bookshelf: 20,
  cobweb: 21,
  gravel: 22,
  coarseDirt: 23,
  deadBush: 24
} as const;

type BlockConstantKey = keyof typeof BLOCKS;
export type BlockId = (typeof BLOCKS)[BlockConstantKey];
export type SolidBlockId = Exclude<BlockId, typeof BLOCKS.air>;

export const BLOCK_KEYS = {
  [BLOCKS.air]: "air",
  [BLOCKS.stone]: "stone",
  [BLOCKS.dirt]: "dirt",
  [BLOCKS.grass]: "grass",
  [BLOCKS.path]: "path",
  [BLOCKS.cobblestone]: "cobblestone",
  [BLOCKS.mossyCobblestone]: "mossy_cobblestone",
  [BLOCKS.stoneBricks]: "stone_bricks",
  [BLOCKS.crackedStoneBricks]: "cracked_stone_bricks",
  [BLOCKS.bricks]: "bricks",
  [BLOCKS.oakLog]: "oak_log",
  [BLOCKS.oakPlanks]: "oak_planks",
  [BLOCKS.oakDoor]: "oak_door",
  [BLOCKS.glass]: "glass",
  [BLOCKS.glassPane]: "glass_pane",
  [BLOCKS.ironBars]: "iron_bars",
  [BLOCKS.torch]: "torch",
  [BLOCKS.bed]: "bed",
  [BLOCKS.craftingTable]: "crafting_table",
  [BLOCKS.furnace]: "furnace",
  [BLOCKS.bookshelf]: "bookshelf",
  [BLOCKS.cobweb]: "cobweb",
  [BLOCKS.gravel]: "gravel",
  [BLOCKS.coarseDirt]: "coarse_dirt",
  [BLOCKS.deadBush]: "dead_bush"
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
  transparent?: boolean;
};

export type SolidBlockDefinition = BlockDefinition & {
  id: SolidBlockId;
  key: SolidBlockKey;
  solid: true;
  texturePath: string;
};

export const BLOCK_DEFINITIONS = {
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
  },
  [BLOCKS.cobblestone]: {
    id: BLOCKS.cobblestone,
    key: "cobblestone",
    name: "Cobblestone",
    color: 0x6f7378,
    solid: true,
    texturePath: "/textures/cobblestone.png"
  },
  [BLOCKS.mossyCobblestone]: {
    id: BLOCKS.mossyCobblestone,
    key: "mossy_cobblestone",
    name: "Mossy Cobblestone",
    color: 0x617157,
    solid: true,
    texturePath: "/textures/mossy_cobblestone.png"
  },
  [BLOCKS.stoneBricks]: {
    id: BLOCKS.stoneBricks,
    key: "stone_bricks",
    name: "Stone Bricks",
    color: 0x74777b,
    solid: true,
    texturePath: "/textures/stone_bricks.png"
  },
  [BLOCKS.crackedStoneBricks]: {
    id: BLOCKS.crackedStoneBricks,
    key: "cracked_stone_bricks",
    name: "Cracked Stone Bricks",
    color: 0x666a70,
    solid: true,
    texturePath: "/textures/cracked_stone_bricks.png"
  },
  [BLOCKS.bricks]: {
    id: BLOCKS.bricks,
    key: "bricks",
    name: "Bricks",
    color: 0x9a5646,
    solid: true,
    texturePath: "/textures/bricks.png"
  },
  [BLOCKS.oakLog]: {
    id: BLOCKS.oakLog,
    key: "oak_log",
    name: "Oak Log",
    color: 0x8d673c,
    solid: true,
    texturePath: "/textures/oak_log.png"
  },
  [BLOCKS.oakPlanks]: {
    id: BLOCKS.oakPlanks,
    key: "oak_planks",
    name: "Oak Planks",
    color: 0xb98a4d,
    solid: true,
    texturePath: "/textures/oak_planks.png"
  },
  [BLOCKS.oakDoor]: {
    id: BLOCKS.oakDoor,
    key: "oak_door",
    name: "Oak Door",
    color: 0xa97b42,
    solid: true,
    texturePath: "/textures/oak_door.png",
    transparent: true
  },
  [BLOCKS.glass]: {
    id: BLOCKS.glass,
    key: "glass",
    name: "Glass",
    color: 0xc4e7ec,
    solid: true,
    texturePath: "/textures/glass.png",
    transparent: true
  },
  [BLOCKS.glassPane]: {
    id: BLOCKS.glassPane,
    key: "glass_pane",
    name: "Glass Pane",
    color: 0xc4e7ec,
    solid: true,
    texturePath: "/textures/glass_pane.png",
    transparent: true
  },
  [BLOCKS.ironBars]: {
    id: BLOCKS.ironBars,
    key: "iron_bars",
    name: "Iron Bars",
    color: 0xa7adb2,
    solid: true,
    texturePath: "/textures/iron_bars.png",
    transparent: true
  },
  [BLOCKS.torch]: {
    id: BLOCKS.torch,
    key: "torch",
    name: "Torch",
    color: 0xd99d43,
    solid: true,
    texturePath: "/textures/torch.png",
    transparent: true
  },
  [BLOCKS.bed]: {
    id: BLOCKS.bed,
    key: "bed",
    name: "Bed",
    color: 0xb95c5c,
    solid: true,
    texturePath: "/textures/bed.png"
  },
  [BLOCKS.craftingTable]: {
    id: BLOCKS.craftingTable,
    key: "crafting_table",
    name: "Crafting Table",
    color: 0x8b5c32,
    solid: true,
    texturePath: "/textures/crafting_table.png"
  },
  [BLOCKS.furnace]: {
    id: BLOCKS.furnace,
    key: "furnace",
    name: "Furnace",
    color: 0x6f7175,
    solid: true,
    texturePath: "/textures/furnace.png"
  },
  [BLOCKS.bookshelf]: {
    id: BLOCKS.bookshelf,
    key: "bookshelf",
    name: "Bookshelf",
    color: 0x9b6b3e,
    solid: true,
    texturePath: "/textures/bookshelf.png"
  },
  [BLOCKS.cobweb]: {
    id: BLOCKS.cobweb,
    key: "cobweb",
    name: "Cobweb",
    color: 0xdfe6e8,
    solid: true,
    texturePath: "/textures/cobweb.png",
    transparent: true
  },
  [BLOCKS.gravel]: {
    id: BLOCKS.gravel,
    key: "gravel",
    name: "Gravel",
    color: 0x77736d,
    solid: true,
    texturePath: "/textures/gravel.png"
  },
  [BLOCKS.coarseDirt]: {
    id: BLOCKS.coarseDirt,
    key: "coarse_dirt",
    name: "Coarse Dirt",
    color: 0x7d5737,
    solid: true,
    texturePath: "/textures/coarse_dirt.png"
  },
  [BLOCKS.deadBush]: {
    id: BLOCKS.deadBush,
    key: "dead_bush",
    name: "Dead Bush",
    color: 0x8d6d45,
    solid: true,
    texturePath: "/textures/dead_bush.png",
    transparent: true
  }
} as const satisfies Record<BlockId, BlockDefinition>;

const BLOCK_ID_BY_KEY = Object.fromEntries(
  Object.entries(BLOCK_KEYS).map(([blockId, blockKey]) => [blockKey, Number(blockId) as BlockId])
) as Record<BlockKey, BlockId>;

export const ACTIVE_SOLID_BLOCKS = (Object.values(BLOCK_DEFINITIONS) as readonly BlockDefinition[]).filter(
  (definition): definition is SolidBlockDefinition => definition.solid
);

export const validateBlockKey = (blockKey: string): BlockKey => {
  if (!Object.prototype.hasOwnProperty.call(BLOCK_ID_BY_KEY, blockKey)) {
    throw new Error(`Unknown block key "${blockKey}".`);
  }

  return blockKey as BlockKey;
};

export const blockKeyToId = (blockKey: string): BlockId => BLOCK_ID_BY_KEY[validateBlockKey(blockKey)];

export const blockIdToKey = (blockId: number): BlockKey => {
  const blockKey = (BLOCK_KEYS as Partial<Record<number, BlockKey>>)[blockId];
  if (!blockKey) {
    throw new Error(`Unknown block id ${blockId}.`);
  }

  return blockKey;
};

export const isSolidBlockId = (blockId: number): blockId is SolidBlockId =>
  Boolean((BLOCK_DEFINITIONS as Partial<Record<number, BlockDefinition>>)[blockId]?.solid);

export const colorForBlock = (blockId: SolidBlockId) => BLOCK_DEFINITIONS[blockId].color;
