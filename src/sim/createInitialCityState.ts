import { pickAgentModelForSeed } from "../agents/agentModels";
import { STARTING_BLUEPRINT_IDS } from "./blueprints";
import { buildingFunctionIdsForType } from "./buildingFunctions";
import { BUILDING_TYPE_COLORS } from "./buildingMetadata";
import { CITY_CHARTER } from "./charter";
import { DEFAULT_PUBLIC_STOCKPILE, createResourceInventory } from "./resources";
import type { Agent, CityBuilding, CityState, PlotState, ResourceNode } from "./types";

export type InitialCityPlot = {
  id: string;
  group: 1 | 2 | 3 | 4;
  x: number;
  z: number;
  width: number;
  depth: number;
  area: number;
  centerX: number;
  centerZ: number;
};

type InitialCityStateOptions = {
  plots: readonly InitialCityPlot[];
  charterPlotId: string | null;
};

const AGENT_NAMES = ["Ada", "Babbage", "Grace", "Turing"] as const;

const createSkills = (overrides: Partial<Agent["skills"]> = {}): Agent["skills"] => ({
  building: overrides.building ?? 1,
  farming: overrides.farming ?? 1,
  trade: overrides.trade ?? 0,
  medicine: overrides.medicine ?? 0,
  research: overrides.research ?? 0,
  management: overrides.management ?? 0,
  logistics: overrides.logistics ?? 0,
  engineering: overrides.engineering ?? 0
});

const createAgent = (index: number, charterPlot: InitialCityPlot | null): Agent => {
  const position = {
    x: charterPlot?.centerX ?? 0,
    z: charterPlot?.centerZ ?? 0
  };

  return {
    id: `agent-${index + 1}`,
    name: AGENT_NAMES[index] ?? `Agent ${index + 1}`,
    modelId: pickAgentModelForSeed(`${AGENT_NAMES[index] ?? "agent"}-${index}`).id,
    position,
    destination: null,
    movementState: "idle",
    currentBuildingId: "building-charter-hall",
    destinationBuildingId: null,
    homeBuildingId: null,
    workplaceBuildingId: null,
    claimedPlotId: null,
    cash: 60,
    inventory: createResourceInventory(),
    needs: {
      food: 78,
      rest: 88,
      shelter: 35,
      money: 60,
      knowledge: 40
    },
    skills: createSkills({
      building: index === 0 ? 2 : 1,
      farming: index === 1 ? 2 : 1,
      trade: index === 2 ? 1 : 0,
      logistics: index === 3 ? 1 : 0
    }),
    knownBlueprintIds: [...STARTING_BLUEPRINT_IDS],
    role: index === 0 ? "founder" : "resident",
    currentAction: null,
    goals: ["read the charter", "survive", "build the first working city functions"]
  };
};

const createPlotStates = (plots: readonly InitialCityPlot[], charterPlotId: string | null): PlotState[] =>
  plots.map((plot) => ({
    plotId: plot.id,
    group: plot.group,
    x: plot.x,
    z: plot.z,
    width: plot.width,
    depth: plot.depth,
    area: plot.area,
    center: { x: plot.centerX, z: plot.centerZ },
    claimStatus: plot.id === charterPlotId ? "public" : "unclaimed",
    ownerAgentId: null,
    structureIds: plot.id === charterPlotId ? ["building-charter-hall"] : [],
    resourceNodeIds: [],
    activeProjectId: null
  }));

const createStarterResourceNodes = (plotStates: PlotState[], charterPlotId: string | null): ResourceNode[] => {
  const charterCenter = plotStates.find((plot) => plot.plotId === charterPlotId)?.center ?? plotStates[0]?.center ?? { x: 0, z: 0 };
  const candidates = plotStates
    .filter((plot) => plot.plotId !== charterPlotId)
    .sort((a, b) => {
      const da = Math.hypot(a.center.x - charterCenter.x, a.center.z - charterCenter.z);
      const db = Math.hypot(b.center.x - charterCenter.x, b.center.z - charterCenter.z);
      return da - db;
    })
    .slice(0, 36);

  return candidates.map((plot, index): ResourceNode => {
    const kind = index % 3 === 0 ? "wood" : index % 3 === 1 ? "stone" : "food";
    const offsetX = ((index % 5) - 2) * 2;
    const offsetZ = ((Math.floor(index / 5) % 5) - 2) * 2;
    return {
      id: `node-${index + 1}-${kind}`,
      plotId: plot.plotId,
      position: {
        x: Math.max(plot.x + 2, Math.min(plot.x + plot.width - 2, plot.center.x + offsetX)),
        z: Math.max(plot.z + 2, Math.min(plot.z + plot.depth - 2, plot.center.z + offsetZ))
      },
      resourceId: kind,
      amountRemaining: kind === "food" ? 18 : 35,
      gatherRate: kind === "food" ? 2 : 4
    };
  });
};

const attachResourceNodesToPlots = (plotStates: PlotState[], resourceNodes: readonly ResourceNode[]) =>
  plotStates.map((plot) => ({
    ...plot,
    resourceNodeIds: resourceNodes.filter((node) => node.plotId === plot.plotId).map((node) => node.id)
  }));

const createCharterHall = (charterPlotId: string | null): CityBuilding => ({
  id: "building-charter-hall",
  type: "charter_hall",
  name: "Charter Hall",
  color: BUILDING_TYPE_COLORS.charter_hall,
  status: "complete",
  plotId: charterPlotId ?? "",
  blueprintId: null,
  width: 12,
  length: 12,
  height: 6,
  ownerAgentId: null,
  businessId: null,
  residents: [],
  workers: [],
  capacity: 12,
  condition: 1,
  inventory: createResourceInventory(DEFAULT_PUBLIC_STOCKPILE),
  cash: 500,
  functionIds: buildingFunctionIdsForType("charter_hall"),
  settings: {}
});

export const createInitialCityState = ({ plots, charterPlotId }: InitialCityStateOptions): CityState => {
  const charterPlot = plots.find((plot) => plot.id === charterPlotId) ?? plots[0] ?? null;
  const basePlotStates = createPlotStates(plots, charterPlot?.id ?? null);
  const resourceNodes = createStarterResourceNodes(basePlotStates, charterPlot?.id ?? null);
  const plotStates = attachResourceNodesToPlots(basePlotStates, resourceNodes);

  return {
    schemaVersion: 1,
    tick: 0,
    day: 1,
    charter: CITY_CHARTER,
    plotStates,
    resourceNodes,
    publicStockpile: createResourceInventory(DEFAULT_PUBLIC_STOCKPILE),
    treasury: 500,
    knownBlueprintIds: [...STARTING_BLUEPRINT_IDS],
    availablePlotIds: plotStates.filter((plot) => plot.claimStatus === "unclaimed").map((plot) => plot.plotId),
    agents: AGENT_NAMES.map((_, index) => createAgent(index, charterPlot)),
    buildings: [createCharterHall(charterPlot?.id ?? null)],
    projects: [],
    transactions: [],
    structuredEvents: [],
    events: ["The founders gathered at Charter Hall and read the city charter."]
  };
};
