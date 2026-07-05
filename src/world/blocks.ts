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

export type BlockKey = keyof typeof BLOCKS;
export type BlockId = (typeof BLOCKS)[BlockKey];
export type SolidBlockId = Exclude<BlockId, typeof BLOCKS.air>;

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
    key: "mossyCobblestone",
    name: "Mossy Cobblestone",
    color: 0x617157,
    solid: true,
    texturePath: "/textures/mossy_cobblestone.png"
  },
  [BLOCKS.stoneBricks]: {
    id: BLOCKS.stoneBricks,
    key: "stoneBricks",
    name: "Stone Bricks",
    color: 0x74777b,
    solid: true,
    texturePath: "/textures/stone_bricks.png"
  },
  [BLOCKS.crackedStoneBricks]: {
    id: BLOCKS.crackedStoneBricks,
    key: "crackedStoneBricks",
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
    key: "oakLog",
    name: "Oak Log",
    color: 0x8d673c,
    solid: true,
    texturePath: "/textures/oak_log.png"
  },
  [BLOCKS.oakPlanks]: {
    id: BLOCKS.oakPlanks,
    key: "oakPlanks",
    name: "Oak Planks",
    color: 0xb98a4d,
    solid: true,
    texturePath: "/textures/oak_planks.png"
  },
  [BLOCKS.oakDoor]: {
    id: BLOCKS.oakDoor,
    key: "oakDoor",
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
    key: "glassPane",
    name: "Glass Pane",
    color: 0xc4e7ec,
    solid: true,
    texturePath: "/textures/glass_pane.png",
    transparent: true
  },
  [BLOCKS.ironBars]: {
    id: BLOCKS.ironBars,
    key: "ironBars",
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
    key: "craftingTable",
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
    key: "coarseDirt",
    name: "Coarse Dirt",
    color: 0x7d5737,
    solid: true,
    texturePath: "/textures/coarse_dirt.png"
  },
  [BLOCKS.deadBush]: {
    id: BLOCKS.deadBush,
    key: "deadBush",
    name: "Dead Bush",
    color: 0x8d6d45,
    solid: true,
    texturePath: "/textures/dead_bush.png",
    transparent: true
  }
} as const satisfies Record<BlockId, BlockDefinition>;

export const ACTIVE_SOLID_BLOCKS = (Object.values(BLOCK_DEFINITIONS) as readonly BlockDefinition[]).filter(
  (definition): definition is SolidBlockDefinition => definition.solid
);

export const isSolidBlockId = (blockId: BlockId): blockId is SolidBlockId => BLOCK_DEFINITIONS[blockId].solid;

export const colorForBlock = (blockId: SolidBlockId) => BLOCK_DEFINITIONS[blockId].color;
