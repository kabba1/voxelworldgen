import { selectCityNeeds, selectCompletedBuildingTypeCounts } from "../sim/selectors";
import type { Agent, AgentNeedId, CityState, ResourceId } from "../sim/types";

const STOCKPILE_RESOURCES: readonly ResourceId[] = ["food", "wood", "stone", "tools", "money"];
const AGENT_NEEDS: readonly AgentNeedId[] = ["food", "rest", "shelter", "money", "knowledge"];

const rounded = (value: number) => Math.round(value).toString();

const actionText = (agent: Agent) => {
  const action = agent.currentAction;
  if (action === null) return "none";
  if (action.projectId !== null) return `${action.functionId} ${action.projectId}`;
  if (action.targetBuildingId !== null) return `${action.functionId} ${action.targetBuildingId}`;
  return action.functionId;
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

const agentLine = (agent: Agent) => {
  const row = document.createElement("div");
  row.className = "sim-debug__agent";
  row.textContent = `${agent.name} (${agent.homeBuildingId ?? "homeless"}) ${actionText(agent)}: ${AGENT_NEEDS.map(
    (need) => `${need} ${rounded(agent.needs[need])}`
  ).join(" | ")}`;
  return row;
};

const projectLine = (blueprintId: string, status: string, progressLabor: number, requiredLabor: number) => {
  const row = document.createElement("div");
  row.className = "sim-debug__project";
  row.textContent = `${blueprintId}: ${status} ${rounded(progressLabor)}/${rounded(requiredLabor)}`;
  return row;
};

export class SimulationDebugOverlay {
  private readonly root = document.createElement("aside");

  constructor(parent: HTMLElement = document.body) {
    this.root.className = "sim-debug";
    this.root.setAttribute("aria-label", "Simulation debug state");
    parent.appendChild(this.root);
  }

  update(state: CityState) {
    const cityNeeds = selectCityNeeds(state);
    const buildingTypeCounts = selectCompletedBuildingTypeCounts(state);
    const buildingSummary =
      Object.entries(buildingTypeCounts)
        .map(([type, count]) => `${type} ${count}`)
        .join(" | ") || "none";

    const title = document.createElement("div");
    title.className = "sim-debug__title";
    title.textContent = "Simulation";

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
    if (state.events.length === 0) {
      const emptyEvent = document.createElement("div");
      emptyEvent.className = "sim-debug__event";
      emptyEvent.textContent = "no events";
      events.append(emptyEvent);
    } else {
      for (const event of state.events.slice(-10)) {
        const eventRow = document.createElement("div");
        eventRow.className = "sim-debug__event";
        eventRow.textContent = event;
        events.append(eventRow);
      }
    }

    const projects = document.createElement("div");
    projects.className = "sim-debug__section";
    const visibleProjects = state.projects.slice(0, 4);
    if (visibleProjects.length === 0) {
      projects.append(projectLine("none", "idle", 0, 0));
    } else {
      for (const project of visibleProjects) {
        projects.append(
          projectLine(project.blueprintId ?? project.type, project.status, project.progressLabor, project.requiredLabor)
        );
      }
    }

    this.root.replaceChildren(
      title,
      line("tick", rounded(state.tick)),
      line("day", rounded(state.day)),
      line("agents", rounded(state.agents.length)),
      line("buildings", rounded(state.buildings.length)),
      line("projects", rounded(state.projects.length)),
      line("total food", rounded(cityNeeds.foodStockpile)),
      stockpile,
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
