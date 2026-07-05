import { buildingFunctionIdsForType } from "./buildingFunctions";
import { STARTING_BLUEPRINT_IDS } from "./blueprints";
import { CITY_CHARTER } from "./charter";
import { DEFAULT_PUBLIC_STOCKPILE, cloneInventory, createResourceInventory } from "./resources";
import type { Agent, AgentNeedId, CityBuilding, CityState, SkillId } from "./types";

type CreateInitialCityStateOptions = {
  availablePlotIds?: readonly string[];
  charterPlotId?: string | null;
};

const STARTING_AGENT_NAMES = ["Ada", "Babbage", "Grace", "Turing"] as const;

const createNeedProfile = (overrides: Partial<Record<AgentNeedId, number>> = {}): Record<AgentNeedId, number> => ({
  food: overrides.food ?? 90,
  rest: overrides.rest ?? 90,
  shelter: overrides.shelter ?? 35,
  money: overrides.money ?? 60,
  knowledge: overrides.knowledge ?? 40
});

const createSkillProfile = (overrides: Partial<Record<SkillId, number>> = {}): Record<SkillId, number> => ({
  building: overrides.building ?? 1,
  farming: overrides.farming ?? 1,
  trade: overrides.trade ?? 0,
  medicine: overrides.medicine ?? 0,
  research: overrides.research ?? 0,
  management: overrides.management ?? 0,
  logistics: overrides.logistics ?? 0,
  engineering: overrides.engineering ?? 0
});

const createFounderAgent = (name: string, index: number, charterHallId: string): Agent => ({
  id: `agent-${index + 1}`,
  name,
  currentBuildingId: charterHallId,
  destinationBuildingId: null,
  homeBuildingId: null,
  workplaceBuildingId: charterHallId,
  cash: 25,
  inventory: createResourceInventory(),
  needs: createNeedProfile(),
  skills: createSkillProfile(index === 1 ? { trade: 1 } : index === 2 ? { logistics: 1 } : {}),
  knownBlueprintIds: [...STARTING_BLUEPRINT_IDS],
  role: index === 0 ? "founder" : "resident",
  currentAction: null,
  goals: ["read charter", "stabilize food", "create shelter"]
});

const createCharterHall = (plotId: string): CityBuilding => ({
  id: "building-charter-hall",
  type: "charter_hall",
  name: "Charter Hall",
  color: "light_blue",
  plotId,
  ownerAgentId: null,
  businessId: null,
  residents: [],
  workers: [],
  capacity: 12,
  condition: 1,
  inventory: cloneInventory(DEFAULT_PUBLIC_STOCKPILE),
  cash: 500,
  functionIds: buildingFunctionIdsForType("charter_hall"),
  settings: {
    public_project_priority: 1,
    emergency_food_threshold: 3
  }
});

export const createInitialCityState = (options: CreateInitialCityStateOptions = {}): CityState => {
  const requestedAvailablePlotIds = [...(options.availablePlotIds ?? [])];
  const charterPlotId = options.charterPlotId ?? requestedAvailablePlotIds[0] ?? "plot-unassigned";
  const availablePlotIds = requestedAvailablePlotIds.filter((plotId) => plotId !== charterPlotId);
  const charterHall = createCharterHall(charterPlotId);

  return {
    tick: 0,
    day: 1,
    charter: CITY_CHARTER,
    publicStockpile: cloneInventory(DEFAULT_PUBLIC_STOCKPILE),
    treasury: 500,
    knownBlueprintIds: [...STARTING_BLUEPRINT_IDS],
    availablePlotIds,
    agents: STARTING_AGENT_NAMES.map((name, index) => createFounderAgent(name, index, charterHall.id)),
    buildings: [charterHall],
    projects: [],
    transactions: []
  };
};
