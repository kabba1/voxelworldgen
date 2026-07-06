import { BLUEPRINT_BY_ID } from "./blueprints";
import { buildingFunctionIdsForType } from "./buildingFunctions";
import { BUILDING_TYPE_COLORS } from "./buildingMetadata";
import { appendSimEvent } from "./events";
import { RESOURCE_IDS, cloneInventory, createResourceInventory } from "./resources";
import { selectCityNeeds } from "./selectors";
import type {
  Agent,
  AgentAction,
  AgentActionType,
  Blueprint,
  BlueprintId,
  CityBuilding,
  CityState,
  PartialResourceInventory,
  PlotState,
  Project,
  ResourceId,
  ResourceInventory,
  ResourceNode,
  ValidAgentAction,
  WorldPosition
} from "./types";

const ARRIVAL_DISTANCE_BLOCKS = 1.5;
const MOVE_BLOCKS_PER_TICK = 90;
const FOOD_LOW = 54;
const REST_LOW = 36;
const STOCKPILE_FOOD_TARGET_PER_AGENT = 4;

const constructionResources: readonly ResourceId[] = ["wood", "stone", "tools"];

const clampNeed = (value: number) => Math.max(0, Math.min(100, value));

const distance = (a: WorldPosition, b: WorldPosition) => Math.hypot(a.x - b.x, a.z - b.z);

const actionId = (state: CityState, agent: Agent, type: AgentActionType) => `action-${state.tick}-${agent.id}-${type}`;

const toAgentAction = (state: CityState, action: ValidAgentAction, durationTicks = 1): AgentAction => ({
  ...action,
  functionId: functionIdForAction(action),
  projectId: action.targetProjectId,
  startedAtTick: state.tick,
  durationTicks,
  remainingTicks: durationTicks
});

const functionIdForAction = (action: ValidAgentAction): AgentAction["functionId"] => {
  if (action.type === "inspect_city_needs") return "view_city_needs";
  if (action.type === "claim_plot") return "claim_home";
  if (action.type === "deposit_resource") return "store_resource";
  if (action.type === "propose_build_project") return "propose_project";
  if (action.type === "reserve_project_resources") return "reserve_resources";
  if (action.type === "work_project") return "build_project";
  if (action.type === "rest") return "rest";
  if (action.type === "eat") return "buy_food";
  if (action.type === "use_building_function") return "produce_food";
  return null;
};

const makeAction = (
  state: CityState,
  agent: Agent,
  type: AgentActionType,
  reason: string,
  overrides: Partial<Omit<ValidAgentAction, "id" | "type" | "actorAgentId" | "reason">> = {}
): ValidAgentAction => ({
  id: actionId(state, agent, type),
  type,
  actorAgentId: agent.id,
  targetPlotId: overrides.targetPlotId ?? null,
  targetBuildingId: overrides.targetBuildingId ?? null,
  targetProjectId: overrides.targetProjectId ?? null,
  targetResourceNodeId: overrides.targetResourceNodeId ?? null,
  resourceId: overrides.resourceId ?? null,
  blueprintId: overrides.blueprintId ?? null,
  destination: overrides.destination ?? null,
  reason
});

const projectIsOpen = (project: Project) =>
  project.status === "proposed" || project.status === "resource_blocked" || project.status === "active";

const hasOpenProjectForBlueprint = (state: CityState, blueprintId: BlueprintId) =>
  state.projects.some((project) => project.blueprintId === blueprintId && projectIsOpen(project));

const remainingMaterialsForProject = (project: Project): PartialResourceInventory => {
  const missing: PartialResourceInventory = {};
  for (const resourceId of RESOURCE_IDS) {
    const need = (project.requiredMaterials[resourceId] ?? 0) - (project.reservedMaterials[resourceId] ?? 0);
    if (need > 0) missing[resourceId] = need;
  }
  return missing;
};

const hasMissingMaterials = (project: Project) =>
  RESOURCE_IDS.some((resourceId) => (remainingMaterialsForProject(project)[resourceId] ?? 0) > 0);

const projectCanFitPlot = (blueprint: Blueprint, plot: PlotState) =>
  plot.width >= blueprint.buildWidth + 4 &&
  plot.depth >= blueprint.buildLength + 4 &&
  (blueprint.requiredPlotGroup === undefined || plot.group >= blueprint.requiredPlotGroup);

const plotIsFreeForProject = (plot: PlotState, agent: Agent) =>
  plot.claimStatus !== "public" &&
  plot.activeProjectId === null &&
  plot.structureIds.length === 0 &&
  (plot.claimStatus === "unclaimed" || plot.ownerAgentId === agent.id);

const firstBuildablePlotForBlueprint = (state: CityState, agent: Agent, blueprintId: BlueprintId) => {
  const blueprint = BLUEPRINT_BY_ID[blueprintId];
  const claimed = agent.claimedPlotId
    ? state.plotStates.find((plot) => plot.plotId === agent.claimedPlotId && projectCanFitPlot(blueprint, plot) && plotIsFreeForProject(plot, agent))
    : null;

  if (claimed) return claimed;

  return (
    state.plotStates
      .filter((plot) => projectCanFitPlot(blueprint, plot) && plotIsFreeForProject(plot, agent))
      .sort((a, b) => distance(agent.position, a.center) - distance(agent.position, b.center))[0] ?? null
  );
};

const nearestBuilding = (state: CityState, agent: Agent, predicate: (building: CityBuilding) => boolean) => {
  const plotsById = new Map(state.plotStates.map((plot) => [plot.plotId, plot]));
  return (
    state.buildings
      .filter((building) => building.status === "complete" && predicate(building))
      .sort((a, b) => {
        const pa = plotsById.get(a.plotId)?.center ?? agent.position;
        const pb = plotsById.get(b.plotId)?.center ?? agent.position;
        return distance(agent.position, pa) - distance(agent.position, pb);
      })[0] ?? null
  );
};

const buildingPosition = (state: CityState, buildingId: string | null) => {
  const building = state.buildings.find((entry) => entry.id === buildingId);
  if (!building) return null;
  return state.plotStates.find((plot) => plot.plotId === building.plotId)?.center ?? null;
};

const charterHall = (state: CityState) => state.buildings.find((building) => building.type === "charter_hall") ?? null;

const projectPosition = (state: CityState, project: Project) =>
  state.plotStates.find((plot) => plot.plotId === project.targetPlotId)?.center ?? null;

const nearestNeededResourceNode = (state: CityState, agent: Agent, resourceIds: readonly ResourceId[]) =>
  state.resourceNodes
    .filter((node) => resourceIds.includes(node.resourceId) && node.amountRemaining > 0)
    .sort((a, b) => distance(agent.position, a.position) - distance(agent.position, b.position))[0] ?? null;

const inventoryHasAny = (inventory: ResourceInventory, resources: readonly ResourceId[]) =>
  resources.some((resourceId) => inventory[resourceId] > 0);

const agentNeedsDeposit = (agent: Agent) => inventoryHasAny(agent.inventory, constructionResources) || agent.inventory.food > 0;

const chooseProjectBlueprint = (state: CityState, agent: Agent): BlueprintId | null => {
  const needs = selectCityNeeds(state);
  const openHomeCapacity = state.projects
    .filter((project) => projectIsOpen(project) && project.blueprintId === "small_home")
    .reduce((total, project) => total + BLUEPRINT_BY_ID[project.blueprintId ?? "small_home"].capacity, 0);

  if (needs.foodBuildings === 0 && !hasOpenProjectForBlueprint(state, "garden_plot")) {
    return firstBuildablePlotForBlueprint(state, agent, "garden_plot") ? "garden_plot" : null;
  }

  if (needs.population > needs.housingCapacity + openHomeCapacity && !hasOpenProjectForBlueprint(state, "small_home")) {
    return firstBuildablePlotForBlueprint(state, agent, "small_home") ? "small_home" : null;
  }

  return null;
};

const openResourceProject = (state: CityState) =>
  state.projects.find((project) => project.type === "build" && (project.status === "proposed" || project.status === "resource_blocked")) ?? null;

const activeBuildProject = (state: CityState) =>
  state.projects.find((project) => project.type === "build" && project.status === "active") ?? null;

export const updateAgentMovement = (state: CityState): CityState => ({
  ...state,
  agents: state.agents.map((agent) => {
    if (agent.destination === null) {
      return agent.movementState === "walking" ? { ...agent, movementState: "idle" } : agent;
    }

    const gap = distance(agent.position, agent.destination);
    if (gap <= ARRIVAL_DISTANCE_BLOCKS) {
      return {
        ...agent,
        position: agent.destination,
        destination: null,
        movementState: agent.currentAction?.type === "work_project" ? "working" : "idle"
      };
    }

    const step = Math.min(MOVE_BLOCKS_PER_TICK, gap);
    const t = step / gap;
    return {
      ...agent,
      position: {
        x: agent.position.x + (agent.destination.x - agent.position.x) * t,
        z: agent.position.z + (agent.destination.z - agent.position.z) * t
      },
      movementState: "walking"
    };
  })
});

export const generateValidActions = (state: CityState, agent: Agent): ValidAgentAction[] => {
  const actions: ValidAgentAction[] = [
    makeAction(state, agent, "inspect_city_needs", "Check the charter board before choosing the next civic move.", {
      targetBuildingId: charterHall(state)?.id ?? null,
      destination: buildingPosition(state, charterHall(state)?.id ?? null)
    }),
    makeAction(state, agent, "idle", "No urgent valid action is better than waiting.")
  ];

  if (agent.inventory.food > 0 || state.publicStockpile.food > 0) {
    actions.push(
      makeAction(state, agent, "eat", "Food need is a direct survival pressure.", {
        resourceId: "food",
        targetBuildingId: charterHall(state)?.id ?? null,
        destination: agent.inventory.food > 0 ? null : buildingPosition(state, charterHall(state)?.id ?? null)
      })
    );
  }

  const availableHome =
    agent.homeBuildingId === null
      ? nearestBuilding(state, agent, (building) => building.type === "home" && building.residents.length < building.capacity)
      : null;
  const restBuilding =
    agent.homeBuildingId !== null
      ? state.buildings.find((building) => building.id === agent.homeBuildingId) ?? null
      : availableHome ?? nearestBuilding(state, agent, (building) => building.functionIds.includes("rest"));
  if (restBuilding) {
    actions.push(
      makeAction(state, agent, "rest", "Rest restores enough energy to keep building.", {
        targetBuildingId: restBuilding.id,
        destination: buildingPosition(state, restBuilding.id)
      })
    );
  }

  if (state.charter.laws.agentsCanClaimEmptyPlots && agent.claimedPlotId === null) {
    const claimPlot =
      state.plotStates
        .filter((plot) => plot.claimStatus === "unclaimed" && plot.structureIds.length === 0)
        .sort((a, b) => distance(agent.position, a.center) - distance(agent.position, b.center))[0] ?? null;
    if (claimPlot) {
      actions.push(
        makeAction(state, agent, "claim_plot", "A founder needs a legal buildable plot before private construction.", {
          targetPlotId: claimPlot.plotId,
          destination: claimPlot.center
        })
      );
    }
  }

  const wantedBlueprintId = chooseProjectBlueprint(state, agent);
  if (wantedBlueprintId !== null) {
    const plot = firstBuildablePlotForBlueprint(state, agent, wantedBlueprintId);
    if (plot) {
      actions.push(
        makeAction(
          state,
          agent,
          "propose_build_project",
          wantedBlueprintId === "garden_plot"
            ? "The city has no food production, so a garden is the highest pressure project."
            : "The population has less housing than agents, so a home project is needed.",
          {
            targetPlotId: plot.plotId,
            targetBuildingId: charterHall(state)?.id ?? null,
            blueprintId: wantedBlueprintId,
            destination: buildingPosition(state, charterHall(state)?.id ?? null)
          }
        )
      );
    }
  }

  const resourceProject = openResourceProject(state);
  if (resourceProject) {
    const missing = remainingMaterialsForProject(resourceProject);
    const hasReservable = RESOURCE_IDS.some((resourceId) => (missing[resourceId] ?? 0) > 0 && state.publicStockpile[resourceId] > 0);
    if (hasReservable) {
      actions.push(
        makeAction(state, agent, "reserve_project_resources", "Public resources can be reserved only for a proposed project.", {
          targetProjectId: resourceProject.id,
          targetBuildingId: charterHall(state)?.id ?? null,
          destination: buildingPosition(state, charterHall(state)?.id ?? null)
        })
      );
    }

    const missingResources = RESOURCE_IDS.filter((resourceId) => (missing[resourceId] ?? 0) > 0);
    const node = nearestNeededResourceNode(state, agent, missingResources);
    if (node) {
      actions.push(
        makeAction(state, agent, "gather_resource", `The active proposal is short on ${node.resourceId}.`, {
          targetResourceNodeId: node.id,
          resourceId: node.resourceId,
          destination: node.position
        })
      );
    }
  }

  if (agentNeedsDeposit(agent)) {
    actions.push(
      makeAction(state, agent, "deposit_resource", "Carried resources should go to the public stockpile before projects reserve them.", {
        targetBuildingId: charterHall(state)?.id ?? null,
        destination: buildingPosition(state, charterHall(state)?.id ?? null)
      })
    );
  }

  const activeProject = activeBuildProject(state);
  if (activeProject) {
    const destination = projectPosition(state, activeProject);
    actions.push(
      makeAction(state, agent, "work_project", "The project has enough resources; labor is now the bottleneck.", {
        targetProjectId: activeProject.id,
        targetPlotId: activeProject.targetPlotId,
        destination
      })
    );
  }

  const foodBuilding = nearestBuilding(state, agent, (building) => building.type === "food" && building.functionIds.includes("produce_food"));
  const cityNeeds = selectCityNeeds(state);
  if (foodBuilding && cityNeeds.foodStockpile < cityNeeds.population * STOCKPILE_FOOD_TARGET_PER_AGENT) {
    actions.push(
      makeAction(state, agent, "use_building_function", "The garden can produce food for the city stockpile.", {
        targetBuildingId: foodBuilding.id,
        resourceId: "food",
        destination: buildingPosition(state, foodBuilding.id)
      })
    );
  }

  return actions;
};

const preferredAction = (actions: readonly ValidAgentAction[], type: AgentActionType) =>
  actions.find((action) => action.type === type) ?? null;

export const chooseAgentAction = (state: CityState, agent: Agent, actions: readonly ValidAgentAction[]): ValidAgentAction => {
  if (agent.destination !== null && agent.currentAction !== null) {
    return makeAction(state, agent, agent.currentAction.type, agent.currentAction.reason, {
      targetPlotId: agent.currentAction.targetPlotId,
      targetBuildingId: agent.currentAction.targetBuildingId,
      targetProjectId: agent.currentAction.targetProjectId,
      targetResourceNodeId: agent.currentAction.targetResourceNodeId,
      resourceId: agent.currentAction.resourceId,
      blueprintId: agent.currentAction.blueprintId,
      destination: agent.destination
    });
  }

  if (agent.needs.food < FOOD_LOW) return preferredAction(actions, "eat") ?? preferredAction(actions, "gather_resource") ?? actions[0];
  if (
    agent.homeBuildingId === null &&
    actions.some((action) => {
      const building = state.buildings.find((entry) => entry.id === action.targetBuildingId);
      return action.type === "rest" && building?.type === "home";
    })
  ) {
    return actions.find((action) => {
      const building = state.buildings.find((entry) => entry.id === action.targetBuildingId);
      return action.type === "rest" && building?.type === "home";
    }) ?? actions[0];
  }
  if (agent.inventory.food > 0 && state.publicStockpile.food < state.agents.length * STOCKPILE_FOOD_TARGET_PER_AGENT) {
    return preferredAction(actions, "deposit_resource") ?? actions[0];
  }
  if (inventoryHasAny(agent.inventory, constructionResources)) return preferredAction(actions, "deposit_resource") ?? actions[0];
  if (agent.needs.rest < REST_LOW) return preferredAction(actions, "rest") ?? actions[0];
  return (
    preferredAction(actions, "claim_plot") ??
    preferredAction(actions, "propose_build_project") ??
    preferredAction(actions, "reserve_project_resources") ??
    preferredAction(actions, "gather_resource") ??
    preferredAction(actions, "work_project") ??
    preferredAction(actions, "use_building_function") ??
    preferredAction(actions, "inspect_city_needs") ??
    actions[0]
  );
};

const updateAgent = (state: CityState, agentId: string, update: (agent: Agent) => Agent): CityState => ({
  ...state,
  agents: state.agents.map((agent) => (agent.id === agentId ? update(agent) : agent))
});

const setAgentTravel = (state: CityState, agent: Agent, action: ValidAgentAction): CityState => {
  const current = toAgentAction(state, action);
  if (action.destination === null || distance(agent.position, action.destination) <= ARRIVAL_DISTANCE_BLOCKS) {
    return updateAgent(state, agent.id, (entry) => ({
      ...entry,
      currentAction: current,
      movementState: action.type === "work_project" ? "working" : "idle",
      destination: null
    }));
  }

  return updateAgent(state, agent.id, (entry) => ({
    ...entry,
    currentAction: current,
    destination: action.destination,
    destinationBuildingId: action.targetBuildingId,
    movementState: "walking"
  }));
};

const canResolveAtTarget = (agent: Agent, action: ValidAgentAction) =>
  action.destination === null || distance(agent.position, action.destination) <= ARRIVAL_DISTANCE_BLOCKS;

const reserveMaterials = (stockpile: ResourceInventory, project: Project) => {
  const publicStockpile = cloneInventory(stockpile);
  const reservedMaterials: PartialResourceInventory = { ...project.reservedMaterials };

  for (const resourceId of RESOURCE_IDS) {
    const missing = (project.requiredMaterials[resourceId] ?? 0) - (reservedMaterials[resourceId] ?? 0);
    if (missing <= 0) continue;
    const amount = Math.min(missing, publicStockpile[resourceId]);
    if (amount <= 0) continue;
    publicStockpile[resourceId] -= amount;
    reservedMaterials[resourceId] = (reservedMaterials[resourceId] ?? 0) + amount;
  }

  return { publicStockpile, reservedMaterials };
};

const projectWithReservationStatus = (project: Project, reservedMaterials: PartialResourceInventory): Project => {
  const nextProject = { ...project, reservedMaterials };
  return {
    ...nextProject,
    status: hasMissingMaterials(nextProject) ? "resource_blocked" : "active"
  };
};

const buildingFromProject = (state: CityState, project: Project): CityBuilding | null => {
  if (project.blueprintId === null || project.targetPlotId === null) return null;
  const blueprint = BLUEPRINT_BY_ID[project.blueprintId];
  const ownerAgentId = state.plotStates.find((plot) => plot.plotId === project.targetPlotId)?.ownerAgentId ?? null;

  return {
    id: `building-${state.buildings.length + 1}`,
    type: blueprint.buildingType,
    name: blueprint.name,
    color: BUILDING_TYPE_COLORS[blueprint.buildingType],
    status: "complete",
    plotId: project.targetPlotId,
    blueprintId: blueprint.id,
    width: blueprint.buildWidth,
    length: blueprint.buildLength,
    height: blueprint.buildHeight,
    ownerAgentId,
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

const completeProjectIfReady = (state: CityState, projectId: string): CityState => {
  const project = state.projects.find((entry) => entry.id === projectId);
  if (!project || project.status !== "active" || project.progressLabor < project.requiredLabor) return state;

  const building = buildingFromProject(state, project);
  if (!building || project.targetPlotId === null) return state;

  let nextState: CityState = {
    ...state,
    buildings: [...state.buildings, building],
    projects: state.projects.map((entry) => (entry.id === projectId ? { ...entry, status: "complete" } : entry)),
    plotStates: state.plotStates.map((plot) =>
      plot.plotId === project.targetPlotId
        ? {
            ...plot,
            activeProjectId: null,
            claimStatus: plot.ownerAgentId !== null ? "claimed" : plot.claimStatus,
            structureIds: [...plot.structureIds, building.id]
          }
        : plot
    ),
    availablePlotIds: state.availablePlotIds.filter((plotId) => plotId !== project.targetPlotId)
  };

  if (building.type === "home" && building.ownerAgentId !== null) {
    nextState = {
      ...nextState,
      agents: nextState.agents.map((agent) =>
        agent.id === building.ownerAgentId && agent.homeBuildingId === null
          ? {
              ...agent,
              homeBuildingId: building.id,
              currentBuildingId: building.id,
              needs: {
                ...agent.needs,
                shelter: clampNeed(agent.needs.shelter + 40)
              }
            }
          : agent
      ),
      buildings: nextState.buildings.map((entry) =>
        entry.id === building.id && building.ownerAgentId !== null
          ? { ...entry, residents: [...entry.residents, building.ownerAgentId] }
          : entry
      )
    };
  }

  return appendSimEvent(nextState, {
    actorAgentId: project.assignedAgentIds[0] ?? project.requestedByAgentId,
    eventType: "building_completed",
    targetType: "building",
    targetId: building.id,
    summary: `${building.name} completed on ${project.targetPlotId}.`,
    reason: project.reason
  });
};

const resolveArrivedAction = (state: CityState, agent: Agent, action: ValidAgentAction): CityState => {
  if (action.type === "idle") {
    return updateAgent(state, agent.id, (entry) => ({ ...entry, currentAction: toAgentAction(state, action), movementState: "idle" }));
  }

  if (action.type === "inspect_city_needs") {
    return updateAgent(state, agent.id, (entry) => ({
      ...entry,
      currentAction: toAgentAction(state, action),
      currentBuildingId: action.targetBuildingId
    }));
  }

  if (action.type === "claim_plot" && action.targetPlotId !== null) {
    const plot = state.plotStates.find((entry) => entry.plotId === action.targetPlotId);
    if (!plot || plot.claimStatus !== "unclaimed") return state;
    return appendSimEvent(
      {
        ...updateAgent(state, agent.id, (entry) => ({
          ...entry,
          claimedPlotId: plot.plotId,
          currentAction: toAgentAction(state, action),
          movementState: "idle"
        })),
        plotStates: state.plotStates.map((entry) =>
          entry.plotId === plot.plotId
            ? { ...entry, claimStatus: "claimed", ownerAgentId: agent.id }
            : entry
        ),
        availablePlotIds: state.availablePlotIds.filter((plotId) => plotId !== plot.plotId)
      },
      {
        actorAgentId: agent.id,
        eventType: "plot_claimed",
        targetType: "plot",
        targetId: plot.plotId,
        summary: `${agent.name} claimed ${plot.plotId} (${plot.width}x${plot.depth}).`,
        reason: action.reason
      }
    );
  }

  if (action.type === "propose_build_project" && action.blueprintId !== null && action.targetPlotId !== null) {
    const blueprint = BLUEPRINT_BY_ID[action.blueprintId];
    const project: Project = {
      id: `project-${state.projects.length + 1}`,
      type: "build",
      status: "proposed",
      requestedByAgentId: agent.id,
      reason: action.reason,
      assignedAgentIds: [],
      targetPlotId: action.targetPlotId,
      blueprintId: action.blueprintId,
      requiredMaterials: { ...blueprint.requiredMaterials },
      reservedMaterials: {},
      requiredLabor: blueprint.requiredLabor,
      progressLabor: 0,
      priority: action.blueprintId === "garden_plot" ? 100 : 90,
      createdAtTick: state.tick
    };

    return appendSimEvent(
      {
        ...updateAgent(state, agent.id, (entry) => ({ ...entry, currentAction: toAgentAction(state, action), currentBuildingId: action.targetBuildingId })),
        projects: [...state.projects, project],
        plotStates: state.plotStates.map((plot) =>
          plot.plotId === action.targetPlotId
            ? {
                ...plot,
                claimStatus: plot.claimStatus === "unclaimed" ? "reserved" : plot.claimStatus,
                ownerAgentId: plot.ownerAgentId ?? agent.id,
                activeProjectId: project.id
              }
            : plot
        )
      },
      {
        actorAgentId: agent.id,
        eventType: "project_proposed",
        targetType: "project",
        targetId: project.id,
        summary: `${agent.name} proposed ${blueprint.name} on ${action.targetPlotId}.`,
        reason: action.reason,
        cost: blueprint.requiredMaterials
      }
    );
  }

  if (action.type === "reserve_project_resources" && action.targetProjectId !== null) {
    const project = state.projects.find((entry) => entry.id === action.targetProjectId);
    if (!project) return state;
    const reservation = reserveMaterials(state.publicStockpile, project);
    const nextProject = projectWithReservationStatus(project, reservation.reservedMaterials);
    return appendSimEvent(
      {
        ...updateAgent(state, agent.id, (entry) => ({ ...entry, currentAction: toAgentAction(state, action), currentBuildingId: action.targetBuildingId })),
        publicStockpile: reservation.publicStockpile,
        projects: state.projects.map((entry) => (entry.id === project.id ? nextProject : entry))
      },
      {
        actorAgentId: agent.id,
        eventType: "resources_reserved",
        targetType: "project",
        targetId: project.id,
        summary: `${agent.name} reserved materials for ${project.blueprintId}.`,
        reason: action.reason,
        cost: reservation.reservedMaterials
      }
    );
  }

  if (action.type === "gather_resource" && action.targetResourceNodeId !== null && action.resourceId !== null) {
    const node = state.resourceNodes.find((entry) => entry.id === action.targetResourceNodeId);
    if (!node || node.amountRemaining <= 0) return state;
    const amount = Math.min(node.gatherRate, node.amountRemaining);
    return appendSimEvent(
      {
        ...updateAgent(state, agent.id, (entry) => ({
          ...entry,
          currentAction: toAgentAction(state, action),
          movementState: "working",
          inventory: {
            ...entry.inventory,
            [node.resourceId]: entry.inventory[node.resourceId] + amount
          },
          needs: {
            ...entry.needs,
            rest: clampNeed(entry.needs.rest - 1)
          }
        })),
        resourceNodes: state.resourceNodes.map((entry) =>
          entry.id === node.id ? { ...entry, amountRemaining: entry.amountRemaining - amount } : entry
        )
      },
      {
        actorAgentId: agent.id,
        eventType: "resource_gathered",
        targetType: "resource_node",
        targetId: node.id,
        summary: `${agent.name} gathered ${amount} ${node.resourceId}.`,
        reason: action.reason,
        effect: { [node.resourceId]: amount }
      }
    );
  }

  if (action.type === "deposit_resource") {
    const carried = createResourceInventory(agent.inventory);
    const deposit: PartialResourceInventory = {};
    for (const resourceId of RESOURCE_IDS) {
      if (carried[resourceId] > 0) deposit[resourceId] = carried[resourceId];
    }

    return appendSimEvent(
      {
        ...updateAgent(state, agent.id, (entry) => ({
          ...entry,
          currentAction: toAgentAction(state, action),
          currentBuildingId: action.targetBuildingId,
          inventory: createResourceInventory()
        })),
        publicStockpile: RESOURCE_IDS.reduce(
          (inventory, resourceId) => ({
            ...inventory,
            [resourceId]: inventory[resourceId] + carried[resourceId]
          }),
          cloneInventory(state.publicStockpile)
        )
      },
      {
        actorAgentId: agent.id,
        eventType: "resource_deposited",
        targetType: "building",
        targetId: action.targetBuildingId,
        summary: `${agent.name} deposited resources at Charter Hall.`,
        reason: action.reason,
        effect: deposit
      }
    );
  }

  if (action.type === "work_project" && action.targetProjectId !== null) {
    const project = state.projects.find((entry) => entry.id === action.targetProjectId);
    if (!project || project.status !== "active") return state;
    const labor = Math.max(2, 2 + agent.skills.building);
    const progressLabor = Math.min(project.requiredLabor, project.progressLabor + labor);
    const workedState = appendSimEvent(
      {
        ...updateAgent(state, agent.id, (entry) => ({
          ...entry,
          currentAction: toAgentAction(state, action),
          movementState: "working",
          needs: {
            ...entry.needs,
            rest: clampNeed(entry.needs.rest - 2),
            money: clampNeed(entry.needs.money + 1)
          }
        })),
        projects: state.projects.map((entry) =>
          entry.id === project.id
            ? {
                ...entry,
                progressLabor,
                assignedAgentIds: [...new Set([...entry.assignedAgentIds, agent.id])]
              }
            : entry
        )
      },
      {
        actorAgentId: agent.id,
        eventType: "construction_worked",
        targetType: "project",
        targetId: project.id,
        summary: `${agent.name} added ${labor} labor to ${project.blueprintId}.`,
        reason: action.reason,
        effect: { labor }
      }
    );
    return completeProjectIfReady(workedState, project.id);
  }

  if (action.type === "eat") {
    const useInventory = agent.inventory.food > 0;
    if (!useInventory && state.publicStockpile.food <= 0) return state;
    return appendSimEvent(
      {
        ...updateAgent(state, agent.id, (entry) => ({
          ...entry,
          currentAction: toAgentAction(state, action),
          currentBuildingId: action.targetBuildingId,
          inventory: {
            ...entry.inventory,
            food: useInventory ? entry.inventory.food - 1 : entry.inventory.food
          },
          needs: {
            ...entry.needs,
            food: clampNeed(entry.needs.food + 34)
          }
        })),
        publicStockpile: useInventory
          ? state.publicStockpile
          : {
              ...state.publicStockpile,
              food: state.publicStockpile.food - 1
            }
      },
      {
        actorAgentId: agent.id,
        eventType: "agent_ate",
        targetType: useInventory ? "agent" : "building",
        targetId: useInventory ? agent.id : action.targetBuildingId,
        summary: `${agent.name} ate food.`,
        reason: action.reason,
        cost: { food: 1 }
      }
    );
  }

  if (action.type === "rest") {
    const restBuilding = state.buildings.find((building) => building.id === action.targetBuildingId) ?? null;
    const canClaimHome =
      restBuilding?.type === "home" && agent.homeBuildingId === null && restBuilding.residents.length < restBuilding.capacity;
    const isHome = action.targetBuildingId !== null && (action.targetBuildingId === agent.homeBuildingId || canClaimHome);
    return appendSimEvent(
      {
        ...updateAgent(state, agent.id, (entry) => ({
          ...entry,
          currentAction: toAgentAction(state, action, 3),
          movementState: "inside",
          currentBuildingId: action.targetBuildingId,
          homeBuildingId: canClaimHome && restBuilding !== null ? restBuilding.id : entry.homeBuildingId,
          needs: {
            ...entry.needs,
            rest: clampNeed(entry.needs.rest + (isHome ? 28 : 16)),
            shelter: clampNeed(entry.needs.shelter + (isHome ? 18 : 4))
          }
        })),
        buildings:
          canClaimHome && restBuilding !== null
            ? state.buildings.map((building) =>
                building.id === restBuilding.id ? { ...building, residents: [...building.residents, agent.id] } : building
              )
            : state.buildings
      },
      {
        actorAgentId: agent.id,
        eventType: "agent_rested",
        targetType: "building",
        targetId: action.targetBuildingId,
        summary: `${agent.name} ${canClaimHome ? "claimed a bed and rested" : isHome ? "rested at home" : "rested at Charter Hall"}.`,
        reason: action.reason
      }
    );
  }

  if (action.type === "use_building_function" && action.targetBuildingId !== null) {
    const building = state.buildings.find((entry) => entry.id === action.targetBuildingId);
    if (!building || building.type !== "food") return state;
    const foodProduced = 3 + Math.max(0, agent.skills.farming);
    return appendSimEvent(
      {
        ...updateAgent(state, agent.id, (entry) => ({
          ...entry,
          currentAction: toAgentAction(state, action, 2),
          movementState: "working",
          currentBuildingId: building.id,
          needs: {
            ...entry.needs,
            rest: clampNeed(entry.needs.rest - 1)
          }
        })),
        buildings: state.buildings.map((entry) =>
          entry.id === building.id
            ? {
                ...entry,
                inventory: {
                  ...entry.inventory,
                  food: entry.inventory.food + foodProduced
                }
              }
            : entry
        )
      },
      {
        actorAgentId: agent.id,
        eventType: "building_used",
        targetType: "building",
        targetId: building.id,
        summary: `${agent.name} produced ${foodProduced} food at ${building.name}.`,
        reason: action.reason,
        effect: { food: foodProduced }
      }
    );
  }

  return state;
};

export const resolveAgentAction = (state: CityState, agentId: string, action: ValidAgentAction): CityState => {
  const agent = state.agents.find((entry) => entry.id === agentId);
  if (!agent) return state;

  const travelState = setAgentTravel(state, agent, action);
  const movedAgent = travelState.agents.find((entry) => entry.id === agentId);
  if (!movedAgent || !canResolveAtTarget(movedAgent, action)) return travelState;

  return resolveArrivedAction(travelState, movedAgent, action);
};
