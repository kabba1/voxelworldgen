import type { Blueprint } from "./types";

export const STARTING_BLUEPRINTS = [
  {
    id: "small_home",
    name: "Small Home",
    buildingType: "home",
    requiredPlotGroup: 1,
    requiredMaterials: { wood: 20, stone: 5, tools: 1 },
    requiredSkills: { building: 1 },
    requiredLabor: 16,
    buildWidth: 8,
    buildLength: 10,
    buildHeight: 5,
    functionsUnlocked: ["claim_home", "rest", "store_resource"],
    capacity: 2
  },
  {
    id: "garden_plot",
    name: "Garden Plot",
    buildingType: "food",
    requiredPlotGroup: 1,
    requiredMaterials: { wood: 10, stone: 5, tools: 1 },
    requiredSkills: { farming: 1 },
    requiredLabor: 12,
    buildWidth: 10,
    buildLength: 14,
    buildHeight: 5,
    functionsUnlocked: ["produce_food", "store_resource", "buy_food"],
    capacity: 3
  },
  {
    id: "storage_shed",
    name: "Storage Shed",
    buildingType: "storage",
    requiredPlotGroup: 1,
    requiredMaterials: { wood: 18, stone: 10, tools: 1 },
    requiredSkills: { logistics: 1 },
    requiredLabor: 14,
    buildWidth: 12,
    buildLength: 14,
    buildHeight: 5,
    functionsUnlocked: ["store_resource", "reserve_resources"],
    capacity: 8
  },
  {
    id: "workshop_shed",
    name: "Workshop Shed",
    buildingType: "workshop",
    requiredPlotGroup: 2,
    requiredMaterials: { wood: 25, stone: 15, tools: 2 },
    requiredSkills: { building: 1 },
    requiredLabor: 22,
    buildWidth: 12,
    buildLength: 14,
    buildHeight: 6,
    functionsUnlocked: ["craft_tools", "build_project", "work_job", "store_resource"],
    capacity: 4
  },
  {
    id: "market_stall",
    name: "Market Stall",
    buildingType: "market",
    requiredPlotGroup: 1,
    requiredMaterials: { wood: 16, stone: 4, tools: 1 },
    requiredSkills: { trade: 1 },
    requiredLabor: 14,
    buildWidth: 10,
    buildLength: 10,
    buildHeight: 5,
    functionsUnlocked: ["buy_food", "work_job", "store_resource"],
    capacity: 4
  },
  {
    id: "common_hall",
    name: "Common Hall",
    buildingType: "inn",
    requiredPlotGroup: 2,
    requiredMaterials: { wood: 35, stone: 20, tools: 2 },
    requiredSkills: { management: 1 },
    requiredLabor: 28,
    buildWidth: 16,
    buildLength: 14,
    buildHeight: 6,
    functionsUnlocked: ["rest", "work_job", "store_resource"],
    capacity: 8
  }
] as const satisfies readonly Blueprint[];

export const STARTING_BLUEPRINT_IDS = STARTING_BLUEPRINTS.map((blueprint) => blueprint.id);

export const BLUEPRINT_BY_ID = STARTING_BLUEPRINTS.reduce(
  (lookup, blueprint) => ({ ...lookup, [blueprint.id]: blueprint }),
  {} as Record<(typeof STARTING_BLUEPRINT_IDS)[number], Blueprint>
);
