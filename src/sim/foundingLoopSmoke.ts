import { createInitialCityState, type InitialCityPlot } from "./createInitialCityState";
import { tickCityState } from "./tick";

export type FoundingLoopSmokeResult = {
  ticks: number;
  agentCount: number;
  claimedPlots: number;
  projectCount: number;
  completedGarden: boolean;
  completedHome: boolean;
  gatheredEvents: number;
  reservedEvents: number;
  constructionEvents: number;
};

const makeSmokePlots = (): InitialCityPlot[] => {
  const plots: InitialCityPlot[] = [];
  let id = 1;
  for (let z = 0; z < 7; z += 1) {
    for (let x = 0; x < 7; x += 1) {
      const width = x % 3 === 0 ? 50 : x % 2 === 0 ? 40 : 30;
      const depth = z % 3 === 0 ? 50 : z % 2 === 0 ? 40 : 30;
      const px = x * 58;
      const pz = z * 58;
      const area = width * depth;
      plots.push({
        id: `smoke-plot-${id}`,
        group: area >= 2000 ? 4 : area >= 1200 ? 3 : area >= 800 ? 2 : 1,
        x: px,
        z: pz,
        width,
        depth,
        area,
        centerX: px + width / 2,
        centerZ: pz + depth / 2
      });
      id += 1;
    }
  }
  return plots;
};

export const runFoundingLoopSmoke = (ticks = 220): FoundingLoopSmokeResult => {
  const plots = makeSmokePlots();
  let state = createInitialCityState({
    plots,
    charterPlotId: plots[24]?.id ?? plots[0]?.id ?? null
  });

  for (let i = 0; i < ticks; i += 1) {
    state = tickCityState(state);
  }

  return {
    ticks,
    agentCount: state.agents.length,
    claimedPlots: state.plotStates.filter((plot) => plot.claimStatus === "claimed").length,
    projectCount: state.projects.length,
    completedGarden: state.buildings.some((building) => building.blueprintId === "garden_plot"),
    completedHome: state.buildings.some((building) => building.blueprintId === "small_home"),
    gatheredEvents: state.structuredEvents.filter((event) => event.eventType === "resource_gathered").length,
    reservedEvents: state.structuredEvents.filter((event) => event.eventType === "resources_reserved").length,
    constructionEvents: state.structuredEvents.filter((event) => event.eventType === "construction_worked").length
  };
};
