export const BLOCKS = {
  air: 0,
  stone: 1,
  dirt: 2,
  grass: 3,
  path: 4,
  whiteConcrete: 5,
  orangeConcrete: 6,
  magentaConcrete: 7,
  lightBlueConcrete: 8,
  yellowConcrete: 9,
  limeConcrete: 10,
  pinkConcrete: 11,
  grayConcrete: 12,
  lightGrayConcrete: 13,
  cyanConcrete: 14,
  purpleConcrete: 15,
  blueConcrete: 16,
  brownConcrete: 17,
  greenConcrete: 18,
  redConcrete: 19,
  blackConcrete: 20
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
  [BLOCKS.whiteConcrete]: "white_concrete",
  [BLOCKS.orangeConcrete]: "orange_concrete",
  [BLOCKS.magentaConcrete]: "magenta_concrete",
  [BLOCKS.lightBlueConcrete]: "light_blue_concrete",
  [BLOCKS.yellowConcrete]: "yellow_concrete",
  [BLOCKS.limeConcrete]: "lime_concrete",
  [BLOCKS.pinkConcrete]: "pink_concrete",
  [BLOCKS.grayConcrete]: "gray_concrete",
  [BLOCKS.lightGrayConcrete]: "light_gray_concrete",
  [BLOCKS.cyanConcrete]: "cyan_concrete",
  [BLOCKS.purpleConcrete]: "purple_concrete",
  [BLOCKS.blueConcrete]: "blue_concrete",
  [BLOCKS.brownConcrete]: "brown_concrete",
  [BLOCKS.greenConcrete]: "green_concrete",
  [BLOCKS.redConcrete]: "red_concrete",
  [BLOCKS.blackConcrete]: "black_concrete"
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

export type ConcreteBlockId =
  | typeof BLOCKS.whiteConcrete
  | typeof BLOCKS.orangeConcrete
  | typeof BLOCKS.magentaConcrete
  | typeof BLOCKS.lightBlueConcrete
  | typeof BLOCKS.yellowConcrete
  | typeof BLOCKS.limeConcrete
  | typeof BLOCKS.pinkConcrete
  | typeof BLOCKS.grayConcrete
  | typeof BLOCKS.lightGrayConcrete
  | typeof BLOCKS.cyanConcrete
  | typeof BLOCKS.purpleConcrete
  | typeof BLOCKS.blueConcrete
  | typeof BLOCKS.brownConcrete
  | typeof BLOCKS.greenConcrete
  | typeof BLOCKS.redConcrete
  | typeof BLOCKS.blackConcrete;

const concreteDefinition = (id: ConcreteBlockId, key: SolidBlockKey, name: string, color: number): SolidBlockDefinition => ({
  id,
  key,
  name,
  color,
  solid: true,
  texturePath: `/textures/concrete/${key}.png`
});

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
  },
  [BLOCKS.whiteConcrete]: concreteDefinition(BLOCKS.whiteConcrete, "white_concrete", "White Concrete", 0xe5e6dd),
  [BLOCKS.orangeConcrete]: concreteDefinition(BLOCKS.orangeConcrete, "orange_concrete", "Orange Concrete", 0xe06124),
  [BLOCKS.magentaConcrete]: concreteDefinition(BLOCKS.magentaConcrete, "magenta_concrete", "Magenta Concrete", 0xac4bb2),
  [BLOCKS.lightBlueConcrete]: concreteDefinition(
    BLOCKS.lightBlueConcrete,
    "light_blue_concrete",
    "Light Blue Concrete",
    0x4c9ecf
  ),
  [BLOCKS.yellowConcrete]: concreteDefinition(BLOCKS.yellowConcrete, "yellow_concrete", "Yellow Concrete", 0xefbe30),
  [BLOCKS.limeConcrete]: concreteDefinition(BLOCKS.limeConcrete, "lime_concrete", "Lime Concrete", 0x67b234),
  [BLOCKS.pinkConcrete]: concreteDefinition(BLOCKS.pinkConcrete, "pink_concrete", "Pink Concrete", 0xd6658f),
  [BLOCKS.grayConcrete]: concreteDefinition(BLOCKS.grayConcrete, "gray_concrete", "Gray Concrete", 0x464b4e),
  [BLOCKS.lightGrayConcrete]: concreteDefinition(
    BLOCKS.lightGrayConcrete,
    "light_gray_concrete",
    "Light Gray Concrete",
    0x949999
  ),
  [BLOCKS.cyanConcrete]: concreteDefinition(BLOCKS.cyanConcrete, "cyan_concrete", "Cyan Concrete", 0x238993),
  [BLOCKS.purpleConcrete]: concreteDefinition(BLOCKS.purpleConcrete, "purple_concrete", "Purple Concrete", 0x7036a4),
  [BLOCKS.blueConcrete]: concreteDefinition(BLOCKS.blueConcrete, "blue_concrete", "Blue Concrete", 0x304398),
  [BLOCKS.brownConcrete]: concreteDefinition(BLOCKS.brownConcrete, "brown_concrete", "Brown Concrete", 0x60432b),
  [BLOCKS.greenConcrete]: concreteDefinition(BLOCKS.greenConcrete, "green_concrete", "Green Concrete", 0x4a5b24),
  [BLOCKS.redConcrete]: concreteDefinition(BLOCKS.redConcrete, "red_concrete", "Red Concrete", 0x8f2c26),
  [BLOCKS.blackConcrete]: concreteDefinition(BLOCKS.blackConcrete, "black_concrete", "Black Concrete", 0x1b1e21)
};

export const CONCRETE_BLOCKS = [
  BLOCK_DEFINITIONS[BLOCKS.whiteConcrete],
  BLOCK_DEFINITIONS[BLOCKS.orangeConcrete],
  BLOCK_DEFINITIONS[BLOCKS.magentaConcrete],
  BLOCK_DEFINITIONS[BLOCKS.lightBlueConcrete],
  BLOCK_DEFINITIONS[BLOCKS.yellowConcrete],
  BLOCK_DEFINITIONS[BLOCKS.limeConcrete],
  BLOCK_DEFINITIONS[BLOCKS.pinkConcrete],
  BLOCK_DEFINITIONS[BLOCKS.grayConcrete],
  BLOCK_DEFINITIONS[BLOCKS.lightGrayConcrete],
  BLOCK_DEFINITIONS[BLOCKS.cyanConcrete],
  BLOCK_DEFINITIONS[BLOCKS.purpleConcrete],
  BLOCK_DEFINITIONS[BLOCKS.blueConcrete],
  BLOCK_DEFINITIONS[BLOCKS.brownConcrete],
  BLOCK_DEFINITIONS[BLOCKS.greenConcrete],
  BLOCK_DEFINITIONS[BLOCKS.redConcrete],
  BLOCK_DEFINITIONS[BLOCKS.blackConcrete]
] as SolidBlockDefinition[];

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
