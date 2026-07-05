import type { BuildingColor, CityBuilding } from "../sim/types";
import { BLOCKS, type ConcreteBlockId } from "../world/blocks";
import type { ConcreteBoxSpec, ConcreteDoorSide } from "../world/concreteBoxes";
import type { Plot, PlotLayout } from "../world/plots";

const BUILDING_MARGIN_BLOCKS = 3;

const BLOCK_BY_BUILDING_COLOR: Record<BuildingColor, ConcreteBlockId> = {
  light_blue: BLOCKS.lightBlueConcrete,
  white: BLOCKS.whiteConcrete,
  yellow: BLOCKS.yellowConcrete,
  orange: BLOCKS.orangeConcrete,
  gray: BLOCKS.grayConcrete,
  green: BLOCKS.greenConcrete,
  red: BLOCKS.redConcrete,
  blue: BLOCKS.blueConcrete,
  cyan: BLOCKS.cyanConcrete,
  purple: BLOCKS.purpleConcrete,
  brown: BLOCKS.brownConcrete
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const doorSideForBox = (plot: Plot, x: number, z: number, width: number, length: number): ConcreteDoorSide => {
  const gaps = [
    { side: "north" as const, gap: z - plot.z },
    { side: "south" as const, gap: plot.z + plot.depth - (z + length) },
    { side: "west" as const, gap: x - plot.x },
    { side: "east" as const, gap: plot.x + plot.width - (x + width) }
  ];

  return gaps.sort((a, b) => a.gap - b.gap)[0].side;
};

const boxForBuilding = (building: CityBuilding, plot: Plot): ConcreteBoxSpec => {
  const maxWidth = Math.max(1, plot.width - BUILDING_MARGIN_BLOCKS * 2);
  const maxLength = Math.max(1, plot.depth - BUILDING_MARGIN_BLOCKS * 2);
  const width = clamp(building.width, 1, maxWidth);
  const length = clamp(building.length, 1, maxLength);
  const minX = plot.x + BUILDING_MARGIN_BLOCKS;
  const maxX = plot.x + plot.width - BUILDING_MARGIN_BLOCKS - width;
  const minZ = plot.z + BUILDING_MARGIN_BLOCKS;
  const maxZ = plot.z + plot.depth - BUILDING_MARGIN_BLOCKS - length;
  const x = clamp(Math.round(plot.x + (plot.width - width) / 2), minX, maxX);
  const z = clamp(Math.round(plot.z + (plot.depth - length) / 2), minZ, maxZ);

  return {
    blockId: BLOCK_BY_BUILDING_COLOR[building.color],
    x,
    z,
    width,
    length,
    height: Math.max(1, building.height),
    doorway: {
      side: doorSideForBox(plot, x, z, width, length),
      width: Math.min(2, width, length),
      height: Math.min(3, Math.max(1, building.height))
    }
  };
};

export const cityBuildingsToConcreteBoxes = (
  buildings: readonly CityBuilding[],
  plotLayout: PlotLayout
): ConcreteBoxSpec[] => {
  const plotsById = new Map(plotLayout.plots.map((plot) => [plot.id, plot]));
  return buildings.flatMap((building) => {
    const plot = plotsById.get(building.plotId);
    return plot ? [boxForBuilding(building, plot)] : [];
  });
};
