import { selectCityNeeds, selectCompletedBuildingTypeCounts } from "../sim/selectors";
import type { Agent, AgentNeedId, CityState, ResourceId } from "../sim/types";

const STOCKPILE_RESOURCES: readonly ResourceId[] = ["food", "wood", "stone", "tools", "money"];
const AGENT_NEEDS: readonly AgentNeedId[] = ["food", "rest", "shelter", "money", "knowledge"];

type SimulationDebugOverlayControls = {
  paused: boolean;
  speed: number;
  selectedPlotId: string | null;
  onTogglePause: () => void;
  onSpeedChange: (speed: number) => void;
  onSave: () => void;
  onLoad: () => void;
  onReset: () => void;
};

const rounded = (value: number) => Math.round(value).toString();

const actionText = (agent: Agent) => {
  const action = agent.currentAction;
  if (action === null) return "choosing";
  if (action.targetProjectId !== null) return `${action.type} -> ${action.targetProjectId}`;
  if (action.targetResourceNodeId !== null) return `${action.type} -> ${action.resourceId}`;
  if (action.targetBuildingId !== null) return `${action.type} -> ${action.targetBuildingId}`;
  if (action.targetPlotId !== null) return `${action.type} -> ${action.targetPlotId}`;
  return action.type;
};

const line = (label: string, value: string) => {
  const row = document.createElement("div");
  row.className = "sim-debug__row";

  const labelElement = document.createElement("span");
  labelElement.className = "sim-debug__label";
  labelElement.textContent = label;

  const valueElement = document.createElement("span");
  valueElement.className = "sim-debug__value";
  valueElement.textContent = value;

  row.append(labelElement, valueElement);
  return row;
};

const button = (label: string, onClick: () => void) => {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "sim-debug__button";
  element.textContent = label;
  element.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return element;
};

const agentLine = (agent: Agent) => {
  const row = document.createElement("div");
  row.className = "sim-debug__agent";
  const needs = AGENT_NEEDS.map((need) => `${need} ${rounded(agent.needs[need])}`).join(" | ");
  const inventory = STOCKPILE_RESOURCES.filter((resource) => agent.inventory[resource] > 0)
    .map((resource) => `${resource} ${rounded(agent.inventory[resource])}`)
    .join(" | ");
  row.textContent = `${agent.name} [${agent.movementState}] ${actionText(agent)} | plot ${
    agent.claimedPlotId ?? "none"
  } | home ${agent.homeBuildingId ?? "none"} | inv ${inventory || "empty"} | ${needs}`;
  return row;
};

const projectLine = (state: CityState, projectIndex: number) => {
  const project = state.projects[projectIndex];
  const row = document.createElement("div");
  row.className = "sim-debug__project";
  const missing = Object.entries(project.requiredMaterials)
    .map(([resource, required]) => {
      const reserved = project.reservedMaterials[resource as ResourceId] ?? 0;
      return reserved >= (required ?? 0) ? null : `${resource} ${rounded((required ?? 0) - reserved)}`;
    })
    .filter(Boolean)
    .join(" | ");
  row.textContent = `${project.id} ${project.blueprintId ?? project.type}: ${project.status} labor ${rounded(
    project.progressLabor
  )}/${rounded(project.requiredLabor)}${missing ? ` | missing ${missing}` : ""} | by ${project.requestedByAgentId}`;
  return row;
};

export class SimulationDebugOverlay {
  private readonly root = document.createElement("aside");

  constructor(parent: HTMLElement = document.body) {
    this.root.className = "sim-debug";
    this.root.setAttribute("aria-label", "Simulation debug state");
    parent.appendChild(this.root);
  }

  update(state: CityState, controls: SimulationDebugOverlayControls) {
    const cityNeeds = selectCityNeeds(state);
    const buildingTypeCounts = selectCompletedBuildingTypeCounts(state);
    const buildingSummary =
      Object.entries(buildingTypeCounts)
        .map(([type, count]) => `${type} ${count}`)
        .join(" | ") || "none";
    const claimedPlots = state.plotStates.filter((plot) => plot.claimStatus === "claimed").length;
    const selectedPlot = controls.selectedPlotId
      ? state.plotStates.find((plot) => plot.plotId === controls.selectedPlotId) ?? null
      : null;

    const title = document.createElement("div");
    title.className = "sim-debug__title";
    title.textContent = "Agency Founding Loop";

    const controlsRow = document.createElement("div");
    controlsRow.className = "sim-debug__controls";
    controlsRow.append(
      button(controls.paused ? "resume" : "pause", controls.onTogglePause),
      button("1x", () => controls.onSpeedChange(1)),
      button("4x", () => controls.onSpeedChange(4)),
      button("12x", () => controls.onSpeedChange(12)),
      button("save", controls.onSave),
      button("load", controls.onLoad),
      button("reset", controls.onReset)
    );

    const stockpile = document.createElement("div");
    stockpile.className = "sim-debug__section";
    stockpile.append(
      line(
        "stockpile",
        STOCKPILE_RESOURCES.map((resource) => `${resource} ${rounded(state.publicStockpile[resource])}`).join(" | ")
      )
    );

    const agents = document.createElement("div");
    agents.className = "sim-debug__section";
    for (const agent of state.agents) agents.append(agentLine(agent));

    const buildings = document.createElement("div");
    buildings.className = "sim-debug__section";
    buildings.append(line("types", buildingSummary));

    const events = document.createElement("div");
    events.className = "sim-debug__section";
    if (state.structuredEvents.length === 0) {
      const emptyEvent = document.createElement("div");
      emptyEvent.className = "sim-debug__event";
      emptyEvent.textContent = "no events yet";
      events.append(emptyEvent);
    } else {
      for (const event of state.structuredEvents.slice(-8).reverse()) {
        const eventRow = document.createElement("div");
        eventRow.className = "sim-debug__event";
        eventRow.textContent = `d${event.day} t${event.tick}: ${event.summary}`;
        events.append(eventRow);
      }
    }

    const projects = document.createElement("div");
    projects.className = "sim-debug__section";
    const visibleProjects = state.projects.slice(-5);
    if (visibleProjects.length === 0) {
      const emptyProject = document.createElement("div");
      emptyProject.className = "sim-debug__project";
      emptyProject.textContent = "no projects yet";
      projects.append(emptyProject);
    } else {
      for (let i = Math.max(0, state.projects.length - 5); i < state.projects.length; i += 1) {
        projects.append(projectLine(state, i));
      }
    }

    const selection = document.createElement("div");
    selection.className = "sim-debug__section";
    if (selectedPlot === null) {
      selection.append(line("selected", "click a plot"));
    } else {
      selection.append(
        line("selected", selectedPlot.plotId),
        line("group", selectedPlot.group.toString()),
        line("size", `${selectedPlot.width} x ${selectedPlot.depth}`),
        line("area", rounded(selectedPlot.area)),
        line("claimed", selectedPlot.claimStatus),
        line("owner", selectedPlot.ownerAgentId ?? "none"),
        line("project", selectedPlot.activeProjectId ?? "none"),
        line(
          "can build",
          selectedPlot.claimStatus === "claimed" && selectedPlot.ownerAgentId !== null ? "owner only" : selectedPlot.claimStatus === "unclaimed" ? "yes" : "no"
        )
      );
    }

    this.root.replaceChildren(
      title,
      controlsRow,
      line("tick/day", `${rounded(state.tick)} / ${rounded(state.day)} | ${controls.paused ? "paused" : `${controls.speed}x`}`),
      line("agents", rounded(state.agents.length)),
      line("plots", `open ${rounded(cityNeeds.openPlotCount)} | claimed ${rounded(claimedPlots)}`),
      line("food", `total ${rounded(cityNeeds.foodStockpile)} | food buildings ${rounded(cityNeeds.foodBuildings)}`),
      line("housing", `${rounded(cityNeeds.housingCapacity)} beds | gap ${rounded(cityNeeds.housingGap)}`),
      line("nodes", rounded(cityNeeds.resourceNodeCount)),
      stockpile,
      selection,
      buildings,
      projects,
      events,
      agents
    );
  }

  dispose() {
    this.root.remove();
  }
}
