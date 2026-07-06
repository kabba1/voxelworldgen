import { createInitialCityState, type InitialCityPlot } from "./createInitialCityState";
import { tickCityState } from "./tick";
import type { CityState, SimEventType } from "./types";

export type FoundingLoopSmokeResult = {
  passed: true;
  ticks: number;
  agentCount: number;
  claimedPlots: number;
  projectCount: number;
  completedGarden: boolean;
  completedHome: boolean;
  gatheredEvents: number;
  depositedEvents: number;
  reservedEvents: number;
  constructionEvents: number;
  producedFoodEvents: number;
  ateFoodEvents: number;
  eventChain: string[];
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

function assertSmoke(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Founding loop smoke failed: ${message}`);
}

const countEvents = (state: CityState, eventType: SimEventType) =>
  state.structuredEvents.filter((event) => event.eventType === eventType).length;

const eventIndex = (state: CityState, predicate: (summary: string, eventType: SimEventType) => boolean) =>
  state.structuredEvents.findIndex((event) => predicate(event.summary, event.eventType));

const eventIndexAfter = (
  state: CityState,
  afterIndex: number,
  predicate: (summary: string, eventType: SimEventType) => boolean
) => state.structuredEvents.findIndex((event, index) => index > afterIndex && predicate(event.summary, event.eventType));

const projectWasProposedByAgent = (state: CityState, blueprintId: string) =>
  state.projects.some((project) => project.blueprintId === blueprintId && project.requestedByAgentId.startsWith("agent-"));

const runFreshCity = (ticks: number) => {
  const plots = makeSmokePlots();
  let state = createInitialCityState({
    plots,
    charterPlotId: plots[24]?.id ?? plots[0]?.id ?? null
  });

  for (let i = 0; i < ticks; i += 1) {
    state = tickCityState(state);
  }

  return state;
};

export const runFoundingLoopSmoke = (ticks = 520): FoundingLoopSmokeResult => {
  const state = runFreshCity(ticks);
  const gardenProposedIndex = eventIndex(
    state,
    (summary, eventType) => eventType === "project_proposed" && summary.includes("Garden Plot")
  );
  const gardenCompleteIndex = eventIndex(
    state,
    (summary, eventType) => eventType === "building_completed" && summary.includes("Garden Plot")
  );
  const foodProducedIndex = eventIndex(
    state,
    (summary, eventType) => eventType === "building_used" && summary.includes("harvested") && summary.includes("food")
  );
  const foodDepositedIndex = eventIndex(
    state,
    (summary, eventType) => eventType === "resource_deposited" && summary.includes("food")
  );
  const foodEatenIndex = eventIndexAfter(
    state,
    foodDepositedIndex,
    (summary, eventType) => eventType === "agent_ate" && summary.includes("food")
  );
  const homeProposedIndex = eventIndex(
    state,
    (summary, eventType) => eventType === "project_proposed" && summary.includes("Small Home")
  );
  const homeCompleteIndex = eventIndex(
    state,
    (summary, eventType) => eventType === "building_completed" && summary.includes("Small Home")
  );

  const gatheredEvents = countEvents(state, "resource_gathered");
  const depositedEvents = countEvents(state, "resource_deposited");
  const reservedEvents = countEvents(state, "resources_reserved");
  const constructionEvents = countEvents(state, "construction_worked");
  const producedFoodEvents = countEvents(state, "building_used");
  const ateFoodEvents = countEvents(state, "agent_ate");
  const completedGarden = state.buildings.some((building) => building.blueprintId === "garden_plot");
  const completedHome = state.buildings.some((building) => building.blueprintId === "small_home");

  assertSmoke(projectWasProposedByAgent(state, "garden_plot"), "no named agent proposed a garden project");
  assertSmoke(gardenProposedIndex >= 0, "garden proposal event is missing");
  assertSmoke(gatheredEvents > 0, "no resource gathering events were recorded");
  assertSmoke(depositedEvents > 0, "no resource deposit events were recorded");
  assertSmoke(reservedEvents > 0, "no resource reservation events were recorded");
  assertSmoke(constructionEvents > 0, "no construction labor events were recorded");
  assertSmoke(completedGarden, "garden building did not complete");
  assertSmoke(gardenCompleteIndex > gardenProposedIndex, "garden completed before proposal or without readable order");
  assertSmoke(foodProducedIndex > gardenCompleteIndex, "completed garden was not used to produce food");
  assertSmoke(foodDepositedIndex > foodProducedIndex, "harvested food was not stored after production");
  assertSmoke(foodEatenIndex > foodDepositedIndex, "agents did not eat from the resulting food supply");
  assertSmoke(projectWasProposedByAgent(state, "small_home"), "no named agent proposed a home project");
  assertSmoke(homeProposedIndex > gardenCompleteIndex, "home project was not proposed after food production existed");
  assertSmoke(completedHome, "home building did not complete");
  assertSmoke(homeCompleteIndex > homeProposedIndex, "home completed before proposal or without readable order");

  return {
    passed: true,
    ticks,
    agentCount: state.agents.length,
    claimedPlots: state.plotStates.filter((plot) => plot.claimStatus === "claimed").length,
    projectCount: state.projects.length,
    completedGarden,
    completedHome,
    gatheredEvents,
    depositedEvents,
    reservedEvents,
    constructionEvents,
    producedFoodEvents,
    ateFoodEvents,
    eventChain: state.structuredEvents.map((event) => event.summary)
  };
};
