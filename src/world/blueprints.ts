import { BLOCKS, isSolidBlockId, type SolidBlockId } from "./blocks";
import type { EditableWorld } from "./editableWorld";
import type { Plot } from "./plots";
import type { PlotWorld } from "./plotWorld";

const LOCAL_PLAYER_AGENT_ID = "local-player";

export type StructureBlueprintBlock = {
  x: number;
  y: number;
  z: number;
  block: SolidBlockId;
};

export type StructureBlueprint = {
  id: string;
  name: string;
  width: number;
  depth: number;
  height: number;
  blocks: StructureBlueprintBlock[];
  entrance?: { x: number; z: number };
  tags?: string[];
};

export type StructureBlueprintOrigin = {
  x: number;
  y: number;
  z: number;
};

export type BlueprintExportOptions = {
  id: string;
  name: string;
  tags?: string[];
  entrance?: { x: number; z: number };
};

const assertInteger = (label: string, value: number) => {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer. Received ${value}.`);
  }
};

const assertPositiveInteger = (label: string, value: number) => {
  assertInteger(label, value);
  if (value <= 0) {
    throw new Error(`${label} must be greater than 0. Received ${value}.`);
  }
};

const assertOrigin = (origin: StructureBlueprintOrigin) => {
  assertInteger("Blueprint origin x", origin.x);
  assertInteger("Blueprint origin y", origin.y);
  assertInteger("Blueprint origin z", origin.z);
  if (origin.y < 0) {
    throw new Error(`Blueprint origin y cannot be below the world. Received ${origin.y}.`);
  }
};

const plotContainsFootprint = (plot: Plot, origin: StructureBlueprintOrigin, blueprint: StructureBlueprint) =>
  origin.x >= plot.x &&
  origin.z >= plot.z &&
  origin.x + blueprint.width <= plot.x + plot.width &&
  origin.z + blueprint.depth <= plot.z + plot.depth;

const assertBlockInsideBlueprint = (blueprint: StructureBlueprint, block: StructureBlueprintBlock, index: number) => {
  assertInteger(`Blueprint ${blueprint.id} block ${index} x`, block.x);
  assertInteger(`Blueprint ${blueprint.id} block ${index} y`, block.y);
  assertInteger(`Blueprint ${blueprint.id} block ${index} z`, block.z);

  if (!isSolidBlockId(block.block)) {
    throw new Error(`Blueprint ${blueprint.id} block ${index} uses inactive or non-solid block id ${block.block}.`);
  }

  if (block.x < 0 || block.x >= blueprint.width) {
    throw new Error(`Blueprint ${blueprint.id} block ${index} x=${block.x} is outside width ${blueprint.width}.`);
  }

  if (block.y < 0 || block.y >= blueprint.height) {
    throw new Error(`Blueprint ${blueprint.id} block ${index} y=${block.y} is outside height ${blueprint.height}.`);
  }

  if (block.z < 0 || block.z >= blueprint.depth) {
    throw new Error(`Blueprint ${blueprint.id} block ${index} z=${block.z} is outside depth ${blueprint.depth}.`);
  }
};

export const validateBlueprintForPlot = (
  world: PlotWorld,
  blueprint: StructureBlueprint,
  plot: Plot,
  origin: StructureBlueprintOrigin,
  viewerAgentId = LOCAL_PLAYER_AGENT_ID
) => {
  assertPositiveInteger(`Blueprint ${blueprint.id} width`, blueprint.width);
  assertPositiveInteger(`Blueprint ${blueprint.id} depth`, blueprint.depth);
  assertPositiveInteger(`Blueprint ${blueprint.id} height`, blueprint.height);
  assertOrigin(origin);

  if (!plotContainsFootprint(plot, origin, blueprint)) {
    throw new Error(
      `Blueprint ${blueprint.id} footprint ${blueprint.width}x${blueprint.depth} at (${origin.x}, ${origin.z}) does not fit inside plot ${plot.id} ${plot.width}x${plot.depth}.`
    );
  }

  if (blueprint.entrance) {
    assertInteger(`Blueprint ${blueprint.id} entrance x`, blueprint.entrance.x);
    assertInteger(`Blueprint ${blueprint.id} entrance z`, blueprint.entrance.z);
    if (
      blueprint.entrance.x < 0 ||
      blueprint.entrance.x >= blueprint.width ||
      blueprint.entrance.z < 0 ||
      blueprint.entrance.z >= blueprint.depth
    ) {
      throw new Error(`Blueprint ${blueprint.id} entrance must sit inside the blueprint footprint.`);
    }
  }

  blueprint.blocks.forEach((block, index) => {
    assertBlockInsideBlueprint(blueprint, block, index);

    const worldX = origin.x + block.x;
    const worldZ = origin.z + block.z;
    const worldY = origin.y + block.y;
    if (worldY < 0) {
      throw new Error(`Blueprint ${blueprint.id} block ${index} would be placed below the world at y=${worldY}.`);
    }

    const targetPlot = world.plotAt(worldX, worldZ);
    if (targetPlot?.id !== plot.id) {
      throw new Error(
        `Blueprint ${blueprint.id} block ${index} would write outside plot ${plot.id} at (${worldX}, ${worldZ}).`
      );
    }

    if (!world.canBuild(viewerAgentId, worldX, worldZ)) {
      throw new Error(`Blueprint ${blueprint.id} block ${index} cannot be built at (${worldX}, ${worldZ}).`);
    }
  });
};

export const placeBlueprint = (
  editableWorld: EditableWorld,
  world: PlotWorld,
  blueprint: StructureBlueprint,
  plot: Plot,
  origin: StructureBlueprintOrigin
) => {
  validateBlueprintForPlot(world, blueprint, plot, origin, LOCAL_PLAYER_AGENT_ID);

  for (const block of blueprint.blocks) {
    editableWorld.setBlock(origin.x + block.x, origin.y + block.y, origin.z + block.z, block.block);
  }

  return blueprint.blocks.length;
};

export const createBlueprintFromOverrides = (
  editableWorld: EditableWorld,
  origin: StructureBlueprintOrigin,
  options: BlueprintExportOptions
): StructureBlueprint => {
  assertOrigin(origin);

  const blocks = editableWorld
    .overridesList()
    .filter((override) => isSolidBlockId(override.block))
    .map((override) => ({
      x: override.x - origin.x,
      y: override.y - origin.y,
      z: override.z - origin.z,
      block: override.block as SolidBlockId
    }))
    .sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);

  if (blocks.length === 0) {
    throw new Error("Cannot export a structure blueprint because there are no solid edited blocks.");
  }

  blocks.forEach((block, index) => {
    if (block.x < 0 || block.y < 0 || block.z < 0) {
      throw new Error(
        `Cannot export blueprint ${options.id}: block ${index} is before the chosen origin at (${block.x}, ${block.y}, ${block.z}).`
      );
    }
  });

  return {
    id: options.id,
    name: options.name,
    width: Math.max(...blocks.map((block) => block.x)) + 1,
    depth: Math.max(...blocks.map((block) => block.z)) + 1,
    height: Math.max(...blocks.map((block) => block.y)) + 1,
    blocks,
    entrance: options.entrance,
    tags: options.tags
  };
};

export const stringifyBlueprint = (blueprint: StructureBlueprint) => `${JSON.stringify(blueprint, null, 2)}\n`;

const makeDevTestShack = (): StructureBlueprint => {
  const blocks: StructureBlueprintBlock[] = [];

  for (let x = 0; x < 5; x += 1) {
    for (let z = 0; z < 5; z += 1) {
      blocks.push({ x, y: 0, z, block: BLOCKS.oakPlanks });
    }
  }

  for (let y = 1; y <= 3; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      for (let z = 0; z < 5; z += 1) {
        const isWall = x === 0 || x === 4 || z === 0 || z === 4;
        if (!isWall) continue;
        const isDoor = x === 2 && z === 0 && y <= 2;
        const isWindow = y === 2 && ((x === 0 && z === 2) || (x === 4 && z === 2));
        if (isDoor) {
          blocks.push({ x, y, z, block: BLOCKS.oakDoor });
        } else if (isWindow) {
          blocks.push({ x, y, z, block: BLOCKS.glass });
        } else {
          blocks.push({ x, y, z, block: y === 1 ? BLOCKS.cobblestone : BLOCKS.oakLog });
        }
      }
    }
  }

  for (let x = 0; x < 5; x += 1) {
    for (let z = 0; z < 5; z += 1) {
      blocks.push({ x, y: 4, z, block: BLOCKS.stoneBricks });
    }
  }

  return {
    id: "dev_test_shack",
    name: "Dev Test Shack",
    width: 5,
    depth: 5,
    height: 5,
    entrance: { x: 2, z: 0 },
    tags: ["dev-only", "validation"],
    blocks
  };
};

export const DEV_TEST_SHACK_BLUEPRINT = makeDevTestShack();
