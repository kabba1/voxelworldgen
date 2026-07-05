import type { AgentNeedId, CityState, ResourceId } from "../sim/types";

const STOCKPILE_RESOURCES: readonly ResourceId[] = ["food", "wood", "stone", "tools", "money"];
const AGENT_NEEDS: readonly AgentNeedId[] = ["food", "rest", "shelter", "money", "knowledge"];

const rounded = (value: number) => Math.round(value).toString();

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

const agentLine = (name: string, needs: Record<AgentNeedId, number>) => {
  const row = document.createElement("div");
  row.className = "sim-debug__agent";
  row.textContent = `${name}: ${AGENT_NEEDS.map((need) => `${need} ${rounded(needs[need])}`).join(" | ")}`;
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
    for (const agent of state.agents) agents.append(agentLine(agent.name, agent.needs));

    this.root.replaceChildren(
      title,
      line("tick", rounded(state.tick)),
      line("day", rounded(state.day)),
      line("agents", rounded(state.agents.length)),
      line("buildings", rounded(state.buildings.length)),
      line("projects", rounded(state.projects.length)),
      stockpile,
      agents
    );
  }

  dispose() {
    this.root.remove();
  }
}
