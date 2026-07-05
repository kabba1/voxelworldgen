import { BLUEPRINT_BY_ID } from "../blueprints";
import { BUILDING_TYPE_COLORS } from "../buildingMetadata";
import { appendCityEvent } from "../events";
import { createResourceInventory } from "../resources";
import type { Agent, CityBuilding, CityState } from "../types";

const CONSTRUCTION_REST_COST = 0.4;

const clampNeed = (value: number) => Math.max(0, Math.min(100, value));

const canContributeConstructionLabor = (agent: Agent) =>
  agent.role === "founder" || agent.role === "builder" || agent.skills.building >= 1;

const buildingFromCompletedProject = (state: CityState, projectIndex: number): CityBuilding | null => {
  const project = state.projects[projectIndex];
  if (!project || project.type !== "build" || project.blueprintId === null || project.targetPlotId === null) return null;

  const blueprint = BLUEPRINT_BY_ID[project.blueprintId];
  return {
    id: `building-${state.buildings.length + 1}`,
    type: blueprint.buildingType,
    name: blueprint.name,
    color: BUILDING_TYPE_COLORS[blueprint.buildingType],
    plotId: project.targetPlotId,
    blueprintId: blueprint.id,
    width: blueprint.buildWidth,
    length: blueprint.buildLength,
    height: blueprint.buildHeight,
    ownerAgentId: null,
    businessId: null,
    residents: [],
    workers: [],
    capacity: blueprint.capacity,
    condition: 1,
    inventory: createResourceInventory(),
    cash: 0,
    functionIds: [...blueprint.functionsUnlocked],
    settings: {}
  };
};

export const updateConstruction = (state: CityState): CityState => {
  const projectIndex = state.projects.findIndex((project) => project.type === "build" && project.status === "active");
  if (projectIndex < 0) {
    return {
      ...state,
      agents: state.agents.map((agent) =>
        agent.currentAction?.functionId === "build_project" ? { ...agent, currentAction: null } : agent
      )
    };
  }

  const project = state.projects[projectIndex];
  const contributors = state.agents.filter(
    (agent) =>
      agent.currentAction?.functionId === "build_project" &&
      agent.currentAction.projectId === project.id &&
      canContributeConstructionLabor(agent)
  );
  if (contributors.length === 0) return state;

  const progressLabor = Math.min(project.requiredLabor, project.progressLabor + contributors.length);
  const contributorIds = contributors.map((agent) => agent.id);
  const contributorIdSet = new Set(contributorIds);
  const assignedAgentIds = [...new Set([...project.assignedAgentIds, ...contributorIds])];
  const isComplete = progressLabor >= project.requiredLabor;
  const completedBuilding = isComplete ? buildingFromCompletedProject(state, projectIndex) : null;

  const nextState: CityState = {
    ...state,
    agents: state.agents.map((agent) =>
      contributorIdSet.has(agent.id)
        ? {
            ...agent,
            needs: {
              ...agent.needs,
              rest: clampNeed(agent.needs.rest - CONSTRUCTION_REST_COST)
            },
            currentAction: agent.currentAction
          }
        : agent.currentAction?.functionId === "build_project"
          ? { ...agent, currentAction: null }
          : agent
    ),
    availablePlotIds:
      isComplete && project.targetPlotId !== null
        ? state.availablePlotIds.filter((plotId) => plotId !== project.targetPlotId)
        : state.availablePlotIds,
    buildings: completedBuilding ? [...state.buildings, completedBuilding] : state.buildings,
    projects: state.projects.map((entry, index) =>
      index === projectIndex
        ? {
            ...entry,
            assignedAgentIds,
            progressLabor,
            status: isComplete ? "complete" : entry.status
          }
        : entry
    )
  };

  return completedBuilding ? appendCityEvent(nextState, `${project.id} completed ${completedBuilding.name}`) : nextState;
};
