import type { BuildingFunction, BuildingFunctionId, BuildingType } from "./types";

export const BUILDING_FUNCTIONS = [
  {
    id: "read_charter",
    label: "Read Charter",
    buildingTypes: ["charter_hall"],
    requiresWorker: false,
    durationTicks: 1,
    capacity: 12
  },
  {
    id: "view_city_needs",
    label: "View City Needs",
    buildingTypes: ["charter_hall"],
    requiresWorker: false,
    durationTicks: 1,
    capacity: 12
  },
  {
    id: "learn_blueprint",
    label: "Learn Blueprint",
    buildingTypes: ["charter_hall", "archive"],
    requiresWorker: false,
    durationTicks: 2,
    capacity: 6,
    outputs: { knowledge: 1 }
  },
  {
    id: "propose_project",
    label: "Propose Project",
    buildingTypes: ["charter_hall", "civic"],
    requiresWorker: false,
    durationTicks: 1,
    capacity: 8
  },
  {
    id: "reserve_resources",
    label: "Reserve Resources",
    buildingTypes: ["charter_hall", "storage", "civic"],
    requiresWorker: false,
    durationTicks: 1,
    capacity: 6
  },
  {
    id: "claim_home",
    label: "Claim Home",
    buildingTypes: ["home", "charter_hall"],
    requiresWorker: false,
    durationTicks: 1,
    capacity: 12
  },
  {
    id: "build_project",
    label: "Build Project",
    buildingTypes: ["charter_hall", "workshop"],
    requiresWorker: true,
    requiredAgentSkills: { building: 1 },
    durationTicks: 4,
    capacity: 8,
    outputs: { labor: 4 },
    allowedRoles: ["founder", "resident", "builder", "worker"]
  },
  {
    id: "rest",
    label: "Rest",
    buildingTypes: ["home", "inn", "charter_hall"],
    requiresWorker: false,
    durationTicks: 4,
    capacity: 4
  },
  {
    id: "produce_food",
    label: "Produce Food",
    buildingTypes: ["food"],
    requiresWorker: true,
    requiredAgentSkills: { farming: 1 },
    requiredInventory: { tools: 1 },
    outputs: { food: 6 },
    durationTicks: 6,
    capacity: 3,
    allowedRoles: ["founder", "resident", "farmer", "worker"]
  },
  {
    id: "store_resource",
    label: "Store Resource",
    buildingTypes: ["storage", "charter_hall", "food", "workshop", "market"],
    requiresWorker: false,
    durationTicks: 1,
    capacity: 12
  },
  {
    id: "craft_tools",
    label: "Craft Tools",
    buildingTypes: ["workshop"],
    requiresWorker: true,
    requiredAgentSkills: { building: 1 },
    inputs: { wood: 4, stone: 2 },
    outputs: { tools: 1 },
    durationTicks: 4,
    capacity: 3,
    allowedRoles: ["founder", "resident", "builder", "worker"]
  },
  {
    id: "buy_food",
    label: "Buy Food",
    buildingTypes: ["market", "food"],
    requiresWorker: false,
    requiredInventory: { food: 1 },
    requiredCash: 2,
    durationTicks: 1,
    capacity: 6
  },
  {
    id: "work_job",
    label: "Work Job",
    buildingTypes: ["food", "workshop", "market", "storage", "charter_hall"],
    requiresWorker: true,
    durationTicks: 8,
    capacity: 8,
    outputs: { money: 10, labor: 4 },
    allowedRoles: ["founder", "resident", "worker", "builder", "farmer", "merchant", "civic_clerk"]
  }
] as const satisfies readonly BuildingFunction[];

export const BUILDING_FUNCTION_BY_ID = BUILDING_FUNCTIONS.reduce(
  (lookup, buildingFunction) => ({ ...lookup, [buildingFunction.id]: buildingFunction }),
  {} as Record<BuildingFunctionId, BuildingFunction>
);

export const buildingFunctionIdsForType = (buildingType: BuildingType): BuildingFunctionId[] =>
  BUILDING_FUNCTIONS.filter((buildingFunction) =>
    (buildingFunction.buildingTypes as readonly BuildingType[]).includes(buildingType)
  ).map((buildingFunction) => buildingFunction.id);
