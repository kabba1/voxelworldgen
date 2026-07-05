import { appendCityEvents } from "../events";
import { createResourceInventory } from "../resources";
import type { Agent, CityBuilding, CityState, ResourceInventory } from "../types";

const FOOD_RECOVERY = 25;
const HOME_REST_RECOVERY = 3;
const TEMP_REST_RECOVERY = 0.75;
const SHELTER_RECOVERY = 2;

const clampNeed = (value: number) => Math.max(0, Math.min(100, value));

const cloneInventory = (inventory: ResourceInventory): ResourceInventory => createResourceInventory(inventory);

const hasResidentSlot = (building: CityBuilding) => building.type === "home" && building.residents.length < building.capacity;

export const assignHousing = (state: CityState): CityState => {
  const events: string[] = [];
  const buildings = state.buildings.map((building) => ({
    ...building,
    residents: [...building.residents]
  }));

  const agents = state.agents.map((agent) => {
    if (
      agent.homeBuildingId !== null ||
      agent.currentAction?.functionId !== "claim_home" ||
      agent.currentAction.targetBuildingId === null
    ) {
      return agent;
    }

    const home = buildings.find((building) => building.id === agent.currentAction?.targetBuildingId && hasResidentSlot(building));
    if (!home) return agent;

    home.residents.push(agent.id);
    events.push(`${agent.name} claimed ${home.id}`);
    return {
      ...agent,
      homeBuildingId: home.id,
      currentBuildingId: home.id
    };
  });

  return appendCityEvents({ ...state, agents, buildings }, events);
};

export const produceFood = (state: CityState): CityState => {
  const events: string[] = [];
  const buildings = state.buildings.map((building) => ({
    ...building,
    inventory: cloneInventory(building.inventory)
  }));

  for (const agent of state.agents) {
    if (agent.currentAction?.functionId !== "produce_food" || agent.currentAction.targetBuildingId === null) continue;

    const building = buildings.find(
      (entry) =>
        entry.id === agent.currentAction?.targetBuildingId &&
        entry.type === "food" &&
        entry.functionIds.includes("produce_food")
    );
    if (!building) continue;

    building.inventory.food += 1;
    events.push(`${agent.name} produced food at ${building.id}`);
  }

  return appendCityEvents({ ...state, buildings }, events);
};

const consumeFood = (
  buildings: CityBuilding[],
  publicStockpile: ResourceInventory,
  preferredBuildingId: string | null
): { buildings: CityBuilding[]; publicStockpile: ResourceInventory; sourceBuildingId: string | null; consumed: boolean } => {
  const preferredIndex =
    preferredBuildingId === null
      ? -1
      : buildings.findIndex((building) => building.id === preferredBuildingId && building.inventory.food > 0);
  const foodBuildingIndex =
    preferredIndex >= 0
      ? preferredIndex
      : buildings.findIndex((building) => building.type === "food" && building.inventory.food > 0);

  if (foodBuildingIndex >= 0) {
    return {
      publicStockpile,
      sourceBuildingId: buildings[foodBuildingIndex].id,
      consumed: true,
      buildings: buildings.map((building, index) =>
        index === foodBuildingIndex
          ? {
              ...building,
              inventory: {
                ...building.inventory,
                food: building.inventory.food - 1
              }
            }
          : building
      )
    };
  }

  if (publicStockpile.food <= 0) return { buildings, publicStockpile, sourceBuildingId: null, consumed: false };

  return {
    buildings,
    sourceBuildingId: null,
    consumed: true,
    publicStockpile: {
      ...publicStockpile,
      food: publicStockpile.food - 1
    }
  };
};

const updateShelterFromHome = (agent: Agent): Agent => {
  if (agent.homeBuildingId === null) return agent;
  return {
    ...agent,
    needs: {
      ...agent.needs,
      shelter: clampNeed(agent.needs.shelter + SHELTER_RECOVERY)
    }
  };
};

export const updateAgentNeedsFromBuildings = (state: CityState): CityState => {
  const events: string[] = [];
  let buildings = state.buildings;
  let publicStockpile = cloneInventory(state.publicStockpile);

  const agents = state.agents.map((agent): Agent => {
    let nextAgent = updateShelterFromHome(agent);

    if (nextAgent.currentAction?.functionId === "buy_food") {
      const foodResult = consumeFood(buildings, publicStockpile, nextAgent.currentAction.targetBuildingId);
      buildings = foodResult.buildings;
      publicStockpile = foodResult.publicStockpile;

      if (foodResult.consumed) {
        events.push(`${nextAgent.name} ate food`);
        nextAgent = {
          ...nextAgent,
          currentBuildingId: foodResult.sourceBuildingId ?? nextAgent.currentBuildingId,
          needs: {
            ...nextAgent.needs,
            food: clampNeed(nextAgent.needs.food + FOOD_RECOVERY)
          }
        };
      }
    }

    if (nextAgent.currentAction?.functionId !== "rest" || nextAgent.currentAction.targetBuildingId === null) {
      return nextAgent;
    }

    const restBuilding = state.buildings.find((building) => building.id === nextAgent.currentAction?.targetBuildingId);
    if (!restBuilding || !restBuilding.functionIds.includes("rest")) return nextAgent;

    const isHomeRest = nextAgent.homeBuildingId === restBuilding.id;
    const restRecovery = isHomeRest ? HOME_REST_RECOVERY : TEMP_REST_RECOVERY;
    return {
      ...nextAgent,
      currentBuildingId: restBuilding.id,
      needs: {
        ...nextAgent.needs,
        rest: clampNeed(nextAgent.needs.rest + restRecovery)
      }
    };
  });

  return appendCityEvents({ ...state, agents, buildings, publicStockpile }, events);
};
