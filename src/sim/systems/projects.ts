import { BLUEPRINT_BY_ID } from "../blueprints";
import { RESOURCE_IDS, createResourceInventory } from "../resources";
import { selectCityNeeds } from "../selectors";
import type {
  BlueprintId,
  CityState,
  PartialResourceInventory,
  Project,
  ProjectStatus,
  ResourceInventory
} from "../types";

const OPEN_PROJECT_STATUSES: readonly ProjectStatus[] = [
  "proposed",
  "approved",
  "resource_blocked",
  "labor_blocked",
  "active"
];

const hasOpenBuildProject = (state: CityState, blueprintId: BlueprintId) =>
  state.projects.some(
    (project) =>
      project.type === "build" &&
      project.blueprintId === blueprintId &&
      OPEN_PROJECT_STATUSES.includes(project.status)
  );

const firstUntargetedAvailablePlotId = (state: CityState) => {
  const targetedPlotIds = new Set(
    state.projects
      .filter((project) => project.targetPlotId !== null && OPEN_PROJECT_STATUSES.includes(project.status))
      .map((project) => project.targetPlotId)
  );

  return state.availablePlotIds.find((plotId) => !targetedPlotIds.has(plotId)) ?? null;
};

const hasRequiredMaterials = (stockpile: ResourceInventory, requiredMaterials: PartialResourceInventory) =>
  RESOURCE_IDS.every((resourceId) => stockpile[resourceId] >= (requiredMaterials[resourceId] ?? 0));

const reserveMaterials = (
  stockpile: ResourceInventory,
  requiredMaterials: PartialResourceInventory
): { publicStockpile: ResourceInventory; reservedMaterials: PartialResourceInventory } => {
  const publicStockpile = createResourceInventory(stockpile);
  const reservedMaterials: PartialResourceInventory = {};

  for (const resourceId of RESOURCE_IDS) {
    const amount = requiredMaterials[resourceId] ?? 0;
    if (amount <= 0) continue;
    publicStockpile[resourceId] -= amount;
    reservedMaterials[resourceId] = amount;
  }

  return { publicStockpile, reservedMaterials };
};

const createBuildProject = (state: CityState, blueprintId: BlueprintId, priority: number): CityState => {
  const blueprint = BLUEPRINT_BY_ID[blueprintId];
  const targetPlotId = firstUntargetedAvailablePlotId(state);
  if (!targetPlotId) return state;

  const baseProject: Project = {
    id: `project-${state.projects.length + 1}`,
    type: "build",
    status: "proposed",
    requestedByAgentId: state.agents[0]?.id ?? "city",
    assignedAgentIds: [],
    targetPlotId,
    blueprintId,
    requiredMaterials: { ...blueprint.requiredMaterials },
    reservedMaterials: {},
    requiredLabor: blueprint.requiredLabor,
    progressLabor: 0,
    priority,
    createdAtTick: state.tick
  };

  if (!hasRequiredMaterials(state.publicStockpile, blueprint.requiredMaterials)) {
    return {
      ...state,
      projects: [...state.projects, { ...baseProject, status: "resource_blocked" }]
    };
  }

  const reservation = reserveMaterials(state.publicStockpile, blueprint.requiredMaterials);
  return {
    ...state,
    publicStockpile: reservation.publicStockpile,
    projects: [
      ...state.projects,
      {
        ...baseProject,
        status: "active",
        reservedMaterials: reservation.reservedMaterials
      }
    ]
  };
};

export const updateProjects = (state: CityState): CityState => {
  const needs = selectCityNeeds(state);
  let nextState = state;

  if (needs.foodBuildings === 0 && !hasOpenBuildProject(nextState, "garden_plot")) {
    nextState = createBuildProject(nextState, "garden_plot", 100);
  }

  const nextNeeds = selectCityNeeds(nextState);
  if (nextNeeds.housingCapacity < nextNeeds.population && !hasOpenBuildProject(nextState, "small_home")) {
    nextState = createBuildProject(nextState, "small_home", 90);
  }

  return nextState;
};
