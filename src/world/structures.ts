import type { Plot } from "./plots";
import type { PlotWorld } from "./plotWorld";

export type StructureDefinition = {
  id: string;
  name: string;
  assetPath?: string;
  texturePath?: string;
  footprint: { width: number; depth: number };
  height: number;
  scale?: number;
  entrance: { x: number; z: number };
  materialCost?: Record<string, number>;
  interactionPoints: Array<{ id: string; type: string; x: number; z: number }>;
};

export type StructureInstance = {
  id: string;
  definitionId: string;
  plotId: string;
  x: number;
  z: number;
  rotation: 0 | 90 | 180 | 270;
};

export type StructurePlacementValidation =
  | { valid: true; plotId: string }
  | { valid: false; reason: string };

export const STRUCTURE_DEFINITIONS: readonly StructureDefinition[] = [
  {
    id: "starter_house",
    name: "Starter House",
    assetPath: "/assets/building_pack/OBJ/House.obj",
    texturePath: "/assets/building_pack/Textures/HouseTexture1.png",
    footprint: { width: 10, depth: 12 },
    height: 8,
    scale: 2.6,
    entrance: { x: 5, z: 11 },
    interactionPoints: [
      { id: "front_door", type: "entrance", x: 5, z: 11 },
      { id: "living_area", type: "interior", x: 5, z: 6 }
    ]
  },
  {
    id: "abandoned_house",
    name: "Abandoned House",
    assetPath: "/assets/building_pack/OBJ/House5.obj",
    texturePath: "/assets/building_pack/Textures/HouseTexture4.png",
    footprint: { width: 10, depth: 10 },
    height: 6,
    scale: 1.75,
    entrance: { x: 5, z: 9 },
    interactionPoints: [
      { id: "front_door", type: "entrance", x: 5, z: 9 },
      { id: "salvage_corner", type: "interior", x: 4, z: 5 }
    ]
  },
  {
    id: "general_store",
    name: "General Store",
    assetPath: "/assets/building_pack/OBJ/Shop.obj",
    texturePath: "/assets/building_pack/Textures/Shop.png",
    footprint: { width: 14, depth: 12 },
    height: 7,
    scale: 2.2,
    entrance: { x: 7, z: 11 },
    interactionPoints: [
      { id: "front_door", type: "entrance", x: 7, z: 11 },
      { id: "counter", type: "service_counter", x: 7, z: 6 }
    ]
  },
  {
    id: "clinic",
    name: "Clinic",
    assetPath: "/assets/building_pack/OBJ/Hospital.obj",
    texturePath: "/assets/building_pack/Textures/Hotel.png",
    footprint: { width: 14, depth: 12 },
    height: 12,
    scale: 1.25,
    entrance: { x: 7, z: 11 },
    interactionPoints: [
      { id: "front_door", type: "entrance", x: 7, z: 11 },
      { id: "triage", type: "service_counter", x: 7, z: 6 }
    ]
  },
  {
    id: "civic_archive",
    name: "Civic Archive",
    assetPath: "/assets/building_pack/OBJ/Bank.obj",
    texturePath: "/assets/building_pack/Textures/HouseTexture2.png",
    footprint: { width: 14, depth: 14 },
    height: 9,
    scale: 1.35,
    entrance: { x: 7, z: 13 },
    interactionPoints: [
      { id: "front_door", type: "entrance", x: 7, z: 13 },
      { id: "records_desk", type: "service_counter", x: 7, z: 7 }
    ]
  }
];

export const STRUCTURE_DEFINITIONS_BY_ID = Object.fromEntries(
  STRUCTURE_DEFINITIONS.map((definition) => [definition.id, definition])
) as Record<string, StructureDefinition>;

export const rotatedFootprint = (
  definition: Pick<StructureDefinition, "footprint">,
  rotation: StructureInstance["rotation"]
) =>
  rotation === 90 || rotation === 270
    ? { width: definition.footprint.depth, depth: definition.footprint.width }
    : definition.footprint;

export const validateStructurePlacement = (
  world: PlotWorld,
  definition: StructureDefinition,
  instance: StructureInstance
): StructurePlacementValidation => {
  if (instance.definitionId !== definition.id) {
    return { valid: false, reason: "definition mismatch" };
  }

  const footprint = rotatedFootprint(definition, instance.rotation);
  const originPlot = world.plotAt(instance.x, instance.z);
  if (!originPlot) return { valid: false, reason: "origin is not on a plot" };
  if (originPlot.id !== instance.plotId) return { valid: false, reason: "instance plot id does not match footprint" };

  const x1 = instance.x + footprint.width;
  const z1 = instance.z + footprint.depth;
  if (
    instance.x < originPlot.x ||
    instance.z < originPlot.z ||
    x1 > originPlot.x + originPlot.width ||
    z1 > originPlot.z + originPlot.depth
  ) {
    return { valid: false, reason: "footprint does not fit inside plot bounds" };
  }

  const plotIds = new Set<string>();
  for (let z = instance.z; z < z1; z += 1) {
    for (let x = instance.x; x < x1; x += 1) {
      const plot = world.plotAt(x, z);
      if (!plot) return { valid: false, reason: "footprint touches path or public cell" };
      plotIds.add(plot.id);
      if (plot.id !== originPlot.id) return { valid: false, reason: "footprint crosses plot boundary" };
    }
  }

  return plotIds.size === 1
    ? { valid: true, plotId: originPlot.id }
    : { valid: false, reason: "footprint is not associated with exactly one plot" };
};

const centeredInstanceOnPlot = (
  definition: StructureDefinition,
  plot: Plot,
  rotation: StructureInstance["rotation"],
  id: string
): StructureInstance => {
  const footprint = rotatedFootprint(definition, rotation);
  return {
    id,
    definitionId: definition.id,
    plotId: plot.id,
    x: Math.floor(plot.x + (plot.width - footprint.width) / 2),
    z: Math.floor(plot.z + (plot.depth - footprint.depth) / 2),
    rotation
  };
};

const candidateInstancesOnPlot = (
  definition: StructureDefinition,
  plot: Plot,
  rotation: StructureInstance["rotation"],
  id: string
): StructureInstance[] => {
  const footprint = rotatedFootprint(definition, rotation);
  const margin = 2;
  const minX = plot.x + margin;
  const minZ = plot.z + margin;
  const maxX = plot.x + plot.width - footprint.width - margin;
  const maxZ = plot.z + plot.depth - footprint.depth - margin;
  const center = centeredInstanceOnPlot(definition, plot, rotation, id);
  const positions = [
    { x: center.x, z: center.z },
    { x: minX, z: minZ },
    { x: maxX, z: minZ },
    { x: minX, z: maxZ },
    { x: maxX, z: maxZ },
    { x: center.x, z: minZ },
    { x: center.x, z: maxZ },
    { x: minX, z: center.z },
    { x: maxX, z: center.z }
  ];
  const seen = new Set<string>();

  return positions.flatMap((position) => {
    const key = `${position.x},${position.z}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ ...center, x: position.x, z: position.z }];
  });
};

const rotationOptionsFor = (plot: Plot, definition: StructureDefinition): Array<StructureInstance["rotation"]> => {
  if (plot.width < definition.footprint.width && plot.width >= definition.footprint.depth) return [90, 270, 0, 180];
  if (plot.depth < definition.footprint.depth && plot.depth >= definition.footprint.width) return [90, 270, 0, 180];
  return plot.width >= plot.depth ? [0, 180, 90, 270] : [90, 270, 0, 180];
};

const structureBounds = (definition: StructureDefinition, instance: StructureInstance) => {
  const footprint = rotatedFootprint(definition, instance.rotation);
  return {
    x0: instance.x,
    z0: instance.z,
    x1: instance.x + footprint.width,
    z1: instance.z + footprint.depth
  };
};

const overlaps = (a: ReturnType<typeof structureBounds>, b: ReturnType<typeof structureBounds>) =>
  a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;

const squaredDistance = (ax: number, az: number, bx: number, bz: number) => {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
};

const distanceToWorldCenter = (world: PlotWorld, plot: Plot) => {
  return squaredDistance(plot.centerX, plot.centerZ, world.width / 2, world.depth / 2);
};

const starterTownCenter = (world: PlotWorld) => {
  const worldCenterX = world.width / 2;
  const worldCenterZ = world.depth / 2;
  const district = [...world.layout.districts].sort((a, b) => {
    const ax = a.x + a.width / 2;
    const az = a.z + a.depth / 2;
    const bx = b.x + b.width / 2;
    const bz = b.z + b.depth / 2;
    return (
      squaredDistance(ax, az, worldCenterX, worldCenterZ) -
      squaredDistance(bx, bz, worldCenterX, worldCenterZ)
    );
  })[0];

  return district
    ? {
        districtId: district.id,
        x: worldCenterX,
        z: worldCenterZ
      }
    : {
        districtId: null,
        x: worldCenterX,
        z: worldCenterZ
      };
};

export const createStartingStructureInstances = (world: PlotWorld): StructureInstance[] => {
  const instances: StructureInstance[] = [];
  const usedPlots = new Set<string>();
  const occupied: Array<ReturnType<typeof structureBounds>> = [];
  const townCenter = starterTownCenter(world);

  const orderTownPlots = (plots: Plot[]) => {
    const byDistance = (plot: Plot) => squaredDistance(plot.centerX, plot.centerZ, townCenter.x, townCenter.z);
    const townDistrictPlots = plots
      .filter((plot) => townCenter.districtId !== null && plot.districtId === townCenter.districtId)
      .sort((a, b) => byDistance(a) - byDistance(b));
    const nearbyPlots = plots
      .filter((plot) => !townDistrictPlots.includes(plot) && byDistance(plot) <= 150 * 150)
      .sort((a, b) => byDistance(a) - byDistance(b));
    const fallbackPlots = plots
      .filter((plot) => !townDistrictPlots.includes(plot) && !nearbyPlots.includes(plot))
      .sort((a, b) => distanceToWorldCenter(world, a) - distanceToWorldCenter(world, b));

    return [...townDistrictPlots, ...nearbyPlots, ...fallbackPlots];
  };

  const addStructure = (
    definitionId: string,
    id: string,
    plotFilter: (plot: Plot) => boolean
  ) => {
    const definition = STRUCTURE_DEFINITIONS_BY_ID[definitionId];
    if (!definition) return false;

    const plots = orderTownPlots(world.layout.plots.filter(plotFilter));
    if (plots.length === 0) return false;

    const plotPasses = [plots];

    for (const plotPass of plotPasses) {
      for (const plot of plotPass) {
        for (const rotation of rotationOptionsFor(plot, definition)) {
          for (const candidate of candidateInstancesOnPlot(definition, plot, rotation, id)) {
            const bounds = structureBounds(definition, candidate);
            if (occupied.some((existingBounds) => overlaps(existingBounds, bounds))) continue;
            if (validateStructurePlacement(world, definition, candidate).valid) {
              instances.push(candidate);
              occupied.push(bounds);
              usedPlots.add(plot.id);
              return true;
            }
          }
        }
      }
    }

    return false;
  };

  addStructure("general_store", "structure-general-store-1", (plot) => plot.group >= 2);
  addStructure("clinic", "structure-clinic-1", (plot) => plot.group >= 2);
  addStructure("civic_archive", "structure-civic-archive-1", (plot) => plot.group >= 2);

  const housePlan: Array<[definitionId: string, id: string]> = [
    ["starter_house", "structure-starter-house-1"],
    ["starter_house", "structure-starter-house-2"],
    ["abandoned_house", "structure-abandoned-house-1"],
    ["starter_house", "structure-starter-house-3"],
    ["abandoned_house", "structure-abandoned-house-2"]
  ];

  for (const [definitionId, id] of housePlan) {
    addStructure(definitionId, id, (plot) => plot.group <= 3);
  }

  return instances;
};
