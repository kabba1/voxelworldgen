import { createResourceInventory } from "../resources";
import type { Agent, CityBuilding, CityState, ResourceInventory } from "../types";

const FOOD_EAT_THRESHOLD = 70;
const FOOD_RECOVERY = 25;
const HOME_REST_THRESHOLD = 85;
const HOME_REST_RECOVERY = 3;
const TEMP_REST_THRESHOLD = 55;
const TEMP_REST_RECOVERY = 0.75;
const SHELTER_RECOVERY = 2;

const clampNeed = (value: number) => Math.max(0, Math.min(100, value));

const cloneInventory = (inventory: ResourceInventory): ResourceInventory => createResourceInventory(inventory);

const hasResidentSlot = (building: CityBuilding) => building.type === "home" && building.residents.length < building.capacity;

export const assignHousing = (state: CityState): CityState => {
  const buildings = state.buildings.map((building) => ({
    ...building,
    residents: [...building.residents]
  }));

  const agents = state.agents.map((agent) => {
    if (agent.homeBuildingId !== null) return agent;

    const home = buildings.find(hasResidentSlot);
    if (!home) return agent;

    home.residents.push(agent.id);
    return {
      ...agent,
      homeBuildingId: home.id,
      currentBuildingId: home.id
    };
  });

  return { ...state, agents, buildings };
};

export const produceFood = (state: CityState): CityState => ({
  ...state,
  buildings: state.buildings.map((building) =>
    building.type === "food"
      ? {
          ...building,
          inventory: {
            ...building.inventory,
            food: building.inventory.food + 1
          }
        }
      : building
  )
});

const consumeFood = (
  buildings: CityBuilding[],
  publicStockpile: ResourceInventory
): { buildings: CityBuilding[]; publicStockpile: ResourceInventory; sourceBuildingId: string | null; consumed: boolean } => {
  const foodBuildingIndex = buildings.findIndex((building) => building.type === "food" && building.inventory.food > 0);
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

export const updateAgentNeedsFromBuildings = (state: CityState): CityState => {
  let buildings = state.buildings;
  let publicStockpile = cloneInventory(state.publicStockpile);
  const charterHallId = state.buildings.find((building) => building.type === "charter_hall")?.id ?? null;

  const agents = state.agents.map((agent): Agent => {
    let nextAgent = agent;
    let ateFromBuildingId: string | null = null;

    if (nextAgent.needs.food < FOOD_EAT_THRESHOLD) {
      const foodResult = consumeFood(buildings, publicStockpile);
      buildings = foodResult.buildings;
      publicStockpile = foodResult.publicStockpile;
      ateFromBuildingId = foodResult.sourceBuildingId;

      if (foodResult.consumed) {
        nextAgent = {
          ...nextAgent,
          needs: {
            ...nextAgent.needs,
            food: clampNeed(nextAgent.needs.food + FOOD_RECOVERY)
          }
        };
      }
    }

    const hasHome = nextAgent.homeBuildingId !== null;
    const shouldRestAtHome = hasHome && nextAgent.needs.rest < HOME_REST_THRESHOLD;
    const shouldUseTemporaryRest = !hasHome && charterHallId !== null && nextAgent.needs.rest < TEMP_REST_THRESHOLD;
    const restRecovery = shouldRestAtHome ? HOME_REST_RECOVERY : shouldUseTemporaryRest ? TEMP_REST_RECOVERY : 0;

    if (hasHome || restRecovery > 0) {
      nextAgent = {
        ...nextAgent,
        needs: {
          ...nextAgent.needs,
          shelter: hasHome ? clampNeed(nextAgent.needs.shelter + SHELTER_RECOVERY) : nextAgent.needs.shelter,
          rest: restRecovery > 0 ? clampNeed(nextAgent.needs.rest + restRecovery) : nextAgent.needs.rest
        }
      };
    }

    if (nextAgent.currentAction?.functionId === "build_project") return nextAgent;
    if (ateFromBuildingId !== null || nextAgent.needs.food > agent.needs.food) {
      return {
        ...nextAgent,
        currentAction: {
          id: `action-eat-${state.tick}-${nextAgent.id}`,
          functionId: "buy_food",
          targetBuildingId: ateFromBuildingId,
          projectId: null,
          remainingTicks: 1
        }
      };
    }
    if (restRecovery > 0) {
      return {
        ...nextAgent,
        currentAction: {
          id: `action-rest-${state.tick}-${nextAgent.id}`,
          functionId: "rest",
          targetBuildingId: nextAgent.homeBuildingId ?? charterHallId,
          projectId: null,
          remainingTicks: 1
        }
      };
    }
    return { ...nextAgent, currentAction: null };
  });

  return { ...state, agents, buildings, publicStockpile };
};
