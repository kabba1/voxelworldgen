import { appendCityEvents } from "../events";
import { selectCityNeeds } from "../selectors";
import type { Agent, AgentAction, BuildingFunctionId, CityBuilding, CityState, Project } from "../types";

const FOOD_LOW_THRESHOLD = 70;
const REST_LOW_THRESHOLD = 60;
const BUILD_REST_THRESHOLD = 35;
const LOW_FOOD_STOCKPILE_PER_AGENT = 4;

const actionId = (tick: number, agentId: string, functionId: BuildingFunctionId) =>
  `action-${tick}-${agentId}-${functionId}`;

const hasFunction = (building: CityBuilding, functionId: BuildingFunctionId) =>
  building.functionIds.includes(functionId);

const firstBuildingWithFunction = (
  state: CityState,
  functionId: BuildingFunctionId,
  predicate: (building: CityBuilding) => boolean = () => true
) => state.buildings.find((building) => hasFunction(building, functionId) && predicate(building)) ?? null;

const firstFoodSource = (state: CityState) =>
  firstBuildingWithFunction(state, "buy_food", (building) => building.inventory.food > 0);

const firstAvailableHome = (state: CityState) =>
  firstBuildingWithFunction(
    state,
    "claim_home",
    (building) => building.type === "home" && building.residents.length < building.capacity
  );

const firstActiveBuildProject = (state: CityState): Project | null =>
  state.projects.find((project) => project.type === "build" && project.status === "active") ?? null;

const canBuild = (agent: Agent) => agent.skills.building >= 1 && agent.needs.rest > BUILD_REST_THRESHOLD;

const canFarm = (agent: Agent) => agent.skills.farming >= 1 && agent.needs.rest > BUILD_REST_THRESHOLD;

const createAction = (
  state: CityState,
  agent: Agent,
  functionId: BuildingFunctionId,
  targetBuildingId: string | null,
  projectId: string | null = null
): AgentAction => ({
  id: actionId(state.tick, agent.id, functionId),
  functionId,
  targetBuildingId,
  projectId,
  remainingTicks: 1
});

export const chooseAgentAction = (state: CityState, agent: Agent): AgentAction => {
  const cityNeeds = selectCityNeeds(state);
  const charterHall = firstBuildingWithFunction(state, "read_charter");
  const foodSource = firstFoodSource(state);

  if (agent.needs.food < FOOD_LOW_THRESHOLD && (foodSource !== null || state.publicStockpile.food > 0)) {
    return createAction(state, agent, "buy_food", foodSource?.id ?? null);
  }

  const home =
    agent.homeBuildingId !== null ? state.buildings.find((building) => building.id === agent.homeBuildingId) : null;
  const restTarget =
    home !== null && home !== undefined && hasFunction(home, "rest") ? home : firstBuildingWithFunction(state, "rest");
  if (agent.needs.rest < REST_LOW_THRESHOLD && restTarget !== null) {
    return createAction(state, agent, "rest", restTarget.id);
  }

  const availableHome = firstAvailableHome(state);
  if (agent.homeBuildingId === null && availableHome !== null) {
    return createAction(state, agent, "claim_home", availableHome.id);
  }

  const activeProject = firstActiveBuildProject(state);
  if (activeProject !== null && canBuild(agent) && firstBuildingWithFunction(state, "build_project") !== null) {
    return createAction(state, agent, "build_project", null, activeProject.id);
  }

  const foodBuilding = firstBuildingWithFunction(state, "produce_food", (building) => building.type === "food");
  if (
    foodBuilding !== null &&
    canFarm(agent) &&
    cityNeeds.foodStockpile < Math.max(1, cityNeeds.population * LOW_FOOD_STOCKPILE_PER_AGENT)
  ) {
    return createAction(state, agent, "produce_food", foodBuilding.id);
  }

  return createAction(state, agent, "read_charter", charterHall?.id ?? null);
};

const actionSignature = (action: AgentAction | null) =>
  action === null ? "none" : `${action.functionId}:${action.targetBuildingId ?? ""}:${action.projectId ?? ""}`;

const describeActionStart = (agent: Agent, action: AgentAction): string | null => {
  if (action.functionId === "build_project" && action.projectId !== null) {
    return `${agent.name} started building ${action.projectId}`;
  }
  return null;
};

export const applySimpleAgentPolicy = (state: CityState): CityState => {
  const events: string[] = [];
  const agents = state.agents.map((agent) => {
    const currentAction = chooseAgentAction(state, agent);
    if (actionSignature(agent.currentAction) !== actionSignature(currentAction)) {
      const event = describeActionStart(agent, currentAction);
      if (event !== null) events.push(event);
    }
    return { ...agent, currentAction };
  });

  return appendCityEvents({ ...state, agents }, events);
};
