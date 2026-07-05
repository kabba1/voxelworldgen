import { BLOCKS, type ConcreteBlockId } from "./blocks";
import type { ConcreteBoxSpec, ConcreteDoorSide } from "./concreteBoxes";
import type { Plot } from "./plots";
import type { PlotWorld } from "./plotWorld";

export type BoxTownBuildingType =
  | "home"
  | "market"
  | "workshop"
  | "storage"
  | "food"
  | "clinic"
  | "archive"
  | "civic"
  | "utility"
  | "lab"
  | "inn";

export type BoxTownBuilding = ConcreteBoxSpec & {
  name: string;
  type: BoxTownBuildingType;
  plotId: string;
};

type BoxTownPlan = {
  blockId: ConcreteBlockId;
  type: BoxTownBuildingType;
  name: string;
  width: number;
  length: number;
  height: number;
};

type PlannedPlacement = {
  x: number;
  z: number;
  width: number;
  length: number;
  doorwaySide: ConcreteDoorSide;
};

export const BOX_TOWN_LEGEND: Array<{ blockId: ConcreteBlockId; color: string; means: string }> = [
  { blockId: BLOCKS.whiteConcrete, color: "white", means: "homes / residences" },
  { blockId: BLOCKS.yellowConcrete, color: "yellow", means: "shops / market buildings" },
  { blockId: BLOCKS.orangeConcrete, color: "orange", means: "workshops / repair buildings" },
  { blockId: BLOCKS.grayConcrete, color: "gray", means: "storage / warehouses" },
  { blockId: BLOCKS.greenConcrete, color: "green", means: "food / garden buildings" },
  { blockId: BLOCKS.redConcrete, color: "red", means: "clinic / emergency building" },
  { blockId: BLOCKS.blueConcrete, color: "blue", means: "school / archive building" },
  { blockId: BLOCKS.lightBlueConcrete, color: "light blue", means: "civic / admin building" },
  { blockId: BLOCKS.cyanConcrete, color: "cyan", means: "utility / power-water building" },
  { blockId: BLOCKS.purpleConcrete, color: "purple", means: "research / data lab" },
  { blockId: BLOCKS.brownConcrete, color: "brown", means: "inn / common hall" }
];

const BOX_TOWN_PLAN: readonly BoxTownPlan[] = [
  { blockId: BLOCKS.whiteConcrete, type: "home", name: "Row Home 1", width: 8, length: 10, height: 5 },
  { blockId: BLOCKS.whiteConcrete, type: "home", name: "Row Home 2", width: 8, length: 10, height: 5 },
  { blockId: BLOCKS.whiteConcrete, type: "home", name: "Row Home 3", width: 10, length: 10, height: 5 },
  { blockId: BLOCKS.whiteConcrete, type: "home", name: "Row Home 4", width: 8, length: 12, height: 5 },
  { blockId: BLOCKS.whiteConcrete, type: "home", name: "Corner Home", width: 10, length: 12, height: 5 },
  { blockId: BLOCKS.whiteConcrete, type: "home", name: "Small Home", width: 7, length: 9, height: 4 },
  { blockId: BLOCKS.yellowConcrete, type: "market", name: "Market Hall", width: 14, length: 12, height: 6 },
  { blockId: BLOCKS.yellowConcrete, type: "market", name: "Corner Shop", width: 10, length: 10, height: 5 },
  { blockId: BLOCKS.orangeConcrete, type: "workshop", name: "Repair Shop", width: 12, length: 14, height: 6 },
  { blockId: BLOCKS.orangeConcrete, type: "workshop", name: "Maker Shed", width: 10, length: 12, height: 5 },
  { blockId: BLOCKS.grayConcrete, type: "storage", name: "Depot", width: 14, length: 16, height: 6 },
  { blockId: BLOCKS.grayConcrete, type: "storage", name: "Small Warehouse", width: 12, length: 14, height: 5 },
  { blockId: BLOCKS.greenConcrete, type: "food", name: "Food House", width: 10, length: 14, height: 5 },
  { blockId: BLOCKS.greenConcrete, type: "food", name: "Garden Shed", width: 8, length: 10, height: 4 },
  { blockId: BLOCKS.redConcrete, type: "clinic", name: "Clinic", width: 12, length: 12, height: 6 },
  { blockId: BLOCKS.blueConcrete, type: "archive", name: "Archive School", width: 14, length: 16, height: 6 },
  { blockId: BLOCKS.lightBlueConcrete, type: "civic", name: "Civic Office", width: 12, length: 14, height: 6 },
  { blockId: BLOCKS.cyanConcrete, type: "utility", name: "Utility Station", width: 10, length: 12, height: 5 },
  { blockId: BLOCKS.purpleConcrete, type: "lab", name: "Data Lab", width: 12, length: 12, height: 6 },
  { blockId: BLOCKS.brownConcrete, type: "inn", name: "Common Hall", width: 16, length: 14, height: 6 }
];

const SIDES: readonly ConcreteDoorSide[] = ["north", "south", "east", "west"];
const EDGE_MARGIN = 3;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const distanceSq = (ax: number, az: number, bx: number, bz: number) => {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
};

const sideProbe = (plot: Plot, side: ConcreteDoorSide) => {
  switch (side) {
    case "north":
      return { x: Math.floor(plot.centerX), z: plot.z - 1 };
    case "south":
      return { x: Math.floor(plot.centerX), z: plot.z + plot.depth };
    case "east":
      return { x: plot.x + plot.width, z: Math.floor(plot.centerZ) };
    case "west":
      return { x: plot.x - 1, z: Math.floor(plot.centerZ) };
  }
};

const edgeFacesPublicPath = (world: PlotWorld, plot: Plot, side: ConcreteDoorSide) => {
  const probe = sideProbe(plot, side);
  return world.containsColumn(probe.x, probe.z) && world.plotAt(probe.x, probe.z) === null;
};

const fallbackSideTowardCenter = (world: PlotWorld, plot: Plot): ConcreteDoorSide => {
  const centerX = world.width / 2;
  const centerZ = world.depth / 2;
  const dx = centerX - plot.centerX;
  const dz = centerZ - plot.centerZ;
  if (Math.abs(dx) > Math.abs(dz)) return dx >= 0 ? "east" : "west";
  return dz >= 0 ? "south" : "north";
};

const doorwaySideForPlot = (world: PlotWorld, plot: Plot) => {
  const pathSides = SIDES.filter((side) => edgeFacesPublicPath(world, plot, side));
  if (pathSides.length === 0) return fallbackSideTowardCenter(world, plot);

  return pathSides.sort((a, b) => {
    const probeA = sideProbe(plot, a);
    const probeB = sideProbe(plot, b);
    return (
      distanceSq(probeA.x, probeA.z, world.width / 2, world.depth / 2) -
      distanceSq(probeB.x, probeB.z, world.width / 2, world.depth / 2)
    );
  })[0];
};

const footprintStaysOnPlot = (
  world: PlotWorld,
  plot: Plot,
  x: number,
  z: number,
  width: number,
  length: number
) => {
  for (let cellZ = z; cellZ < z + length; cellZ += 1) {
    for (let cellX = x; cellX < x + width; cellX += 1) {
      if (world.plotAt(cellX, cellZ)?.id !== plot.id) return false;
    }
  }
  return true;
};

const fitDimension = (desired: number, available: number) => Math.max(4, Math.min(desired, available - EDGE_MARGIN * 2));

const placementForPlot = (world: PlotWorld, plot: Plot, plan: BoxTownPlan): PlannedPlacement | null => {
  const width = fitDimension(plan.width, plot.width);
  const length = fitDimension(plan.length, plot.depth);
  if (width > plot.width - EDGE_MARGIN * 2 || length > plot.depth - EDGE_MARGIN * 2) return null;

  const doorwaySide = doorwaySideForPlot(world, plot);
  const minX = plot.x + EDGE_MARGIN;
  const maxX = plot.x + plot.width - EDGE_MARGIN - width;
  const minZ = plot.z + EDGE_MARGIN;
  const maxZ = plot.z + plot.depth - EDGE_MARGIN - length;
  let x = Math.round(plot.centerX - width / 2);
  let z = Math.round(plot.centerZ - length / 2);

  if (doorwaySide === "north") z = minZ;
  if (doorwaySide === "south") z = maxZ;
  if (doorwaySide === "west") x = minX;
  if (doorwaySide === "east") x = maxX;

  x = clamp(x, minX, maxX);
  z = clamp(z, minZ, maxZ);

  if (!footprintStaysOnPlot(world, plot, x, z, width, length)) return null;
  return { x, z, width, length, doorwaySide };
};

const centralDistrictId = (world: PlotWorld) =>
  [...world.layout.districts].sort(
    (a, b) =>
      distanceSq(a.x + a.width / 2, a.z + a.depth / 2, world.width / 2, world.depth / 2) -
      distanceSq(b.x + b.width / 2, b.z + b.depth / 2, world.width / 2, world.depth / 2)
  )[0]?.id ?? null;

const orderedCentralPlots = (world: PlotWorld) => {
  const districtId = centralDistrictId(world);
  const nearCenter = [...world.layout.plots].sort(
    (a, b) =>
      distanceSq(a.centerX, a.centerZ, world.width / 2, world.depth / 2) -
      distanceSq(b.centerX, b.centerZ, world.width / 2, world.depth / 2)
  );
  const localPlots = districtId ? nearCenter.filter((plot) => plot.districtId === districtId) : [];
  const fallbackPlots = nearCenter.filter((plot) => plot.districtId !== districtId);

  return [...localPlots, ...fallbackPlots]
    .slice(0, Math.max(BOX_TOWN_PLAN.length * 2, BOX_TOWN_PLAN.length))
    .sort((a, b) => a.z - b.z || a.x - b.x);
};

export const createCenteredBoxTown = (world: PlotWorld): BoxTownBuilding[] => {
  const plots = orderedCentralPlots(world);
  const usedPlotIds = new Set<string>();
  const buildings: BoxTownBuilding[] = [];

  for (const plan of BOX_TOWN_PLAN) {
    const plot = plots.find((candidate) => {
      if (usedPlotIds.has(candidate.id)) return false;
      return placementForPlot(world, candidate, plan) !== null;
    });
    if (!plot) break;

    const placement = placementForPlot(world, plot, plan);
    if (!placement) continue;
    usedPlotIds.add(plot.id);
    buildings.push({
      name: plan.name,
      type: plan.type,
      plotId: plot.id,
      blockId: plan.blockId,
      x: placement.x,
      z: placement.z,
      width: placement.width,
      length: placement.length,
      height: plan.height,
      doorway: { side: placement.doorwaySide, width: 2, height: 3 }
    });
  }

  return buildings;
};
