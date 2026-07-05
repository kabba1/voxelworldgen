import type { Plot } from "./plots";
import type { PlotWorld } from "./plotWorld";

export const RESOURCE_KINDS = [
  "wood",
  "stone",
  "scrap",
  "cloth",
  "food",
  "water",
  "power_cell",
  "data_shard"
] as const;

export type ResourceKind = (typeof RESOURCE_KINDS)[number];
export type ResourceInventory = Partial<Record<ResourceKind, number>>;

export type ResourceDefinition = {
  id: ResourceKind;
  name: string;
  unitName: string;
  color: number;
};

export type PublicSiteType =
  | "arrival"
  | "maker_yard"
  | "salvage_yard"
  | "resource_commons"
  | "shared_depot_zone"
  | "infrastructure"
  | "boundary";

export type PublicSite = {
  id: string;
  name: string;
  type: PublicSiteType;
  x: number;
  z: number;
  width: number;
  depth: number;
  condition: string;
};

export type ResourceNodeType = "tree" | "stone_outcrop" | "salvage" | "crate" | "water" | "data";

export type ResourceNode = {
  id: string;
  name: string;
  kind: ResourceKind;
  nodeType: ResourceNodeType;
  x: number;
  z: number;
  quantity: number;
  initialQuantity: number;
};

export type GenesisAgent = {
  id: string;
  name: string;
  x: number;
  z: number;
  claimPlotId: string | null;
  inventory: ResourceInventory;
  carryCapacity: number;
  currentGoal: string;
  activity: string;
  personality: string;
};

export type StockpileType = "genesis_depot" | "personal_cache" | "shared_depot";

export type Stockpile = {
  id: string;
  name: string;
  type: StockpileType;
  ownerAgentId: string | null;
  x: number;
  z: number;
  inventory: ResourceInventory;
  capacity: number;
};

export type ConstructibleId =
  | "claim_stake"
  | "personal_cache"
  | "shared_depot"
  | "shelter_frame"
  | "workbench"
  | "repair_marker";

export type ConstructibleDefinition = {
  id: ConstructibleId;
  name: string;
  cost: ResourceInventory;
  workRequired: number;
  footprint: { width: number; depth: number };
};

export type ConstructionStatus = "in_progress" | "complete";

export type ConstructionSite = {
  id: string;
  definitionId: ConstructibleId;
  name: string;
  ownerAgentId: string | null;
  x: number;
  z: number;
  status: ConstructionStatus;
  required: ResourceInventory;
  consumed: ResourceInventory;
  workRequired: number;
  workDone: number;
  contributors: Record<string, number>;
};

export type GenesisClaim = {
  id: string;
  plotId: string;
  agentId: string;
};

export type SettlementEventType =
  | "arrive"
  | "inspect"
  | "claim"
  | "gather"
  | "deposit"
  | "construct"
  | "work"
  | "complete"
  | "reject";

export type SettlementEvent = {
  tick: number;
  type: SettlementEventType;
  actorId?: string;
  summary: string;
};

export type GenesisDistrict = {
  center: { x: number; z: number };
  publicSites: PublicSite[];
  resourceNodes: ResourceNode[];
  agents: GenesisAgent[];
  claims: GenesisClaim[];
  stockpiles: Stockpile[];
  constructionSites: ConstructionSite[];
  events: SettlementEvent[];
};

export const RESOURCE_DEFINITIONS: Record<ResourceKind, ResourceDefinition> = {
  wood: { id: "wood", name: "Wood", unitName: "bundles", color: 0x8a5a32 },
  stone: { id: "stone", name: "Stone", unitName: "blocks", color: 0x777b82 },
  scrap: { id: "scrap", name: "Scrap", unitName: "parts", color: 0x8c9496 },
  cloth: { id: "cloth", name: "Cloth", unitName: "rolls", color: 0xc7a27a },
  food: { id: "food", name: "Food", unitName: "rations", color: 0x87a84f },
  water: { id: "water", name: "Water", unitName: "canisters", color: 0x4d9bd2 },
  power_cell: { id: "power_cell", name: "Power Cell", unitName: "cells", color: 0xffc857 },
  data_shard: { id: "data_shard", name: "Data Shard", unitName: "shards", color: 0x66e3ff }
};

export const CONSTRUCTIBLE_DEFINITIONS: Record<ConstructibleId, ConstructibleDefinition> = {
  claim_stake: {
    id: "claim_stake",
    name: "Claim Stake",
    cost: { wood: 2, scrap: 1 },
    workRequired: 2,
    footprint: { width: 1, depth: 1 }
  },
  personal_cache: {
    id: "personal_cache",
    name: "Personal Cache",
    cost: { wood: 4, scrap: 1 },
    workRequired: 4,
    footprint: { width: 2, depth: 2 }
  },
  shared_depot: {
    id: "shared_depot",
    name: "Shared Depot",
    cost: { wood: 8, scrap: 4, cloth: 2 },
    workRequired: 8,
    footprint: { width: 4, depth: 3 }
  },
  shelter_frame: {
    id: "shelter_frame",
    name: "Shelter Frame",
    cost: { wood: 12, stone: 4, cloth: 2 },
    workRequired: 12,
    footprint: { width: 5, depth: 4 }
  },
  workbench: {
    id: "workbench",
    name: "Workbench",
    cost: { wood: 6, scrap: 6, data_shard: 1 },
    workRequired: 6,
    footprint: { width: 3, depth: 2 }
  },
  repair_marker: {
    id: "repair_marker",
    name: "Repair Marker",
    cost: { scrap: 4, power_cell: 1, data_shard: 1 },
    workRequired: 4,
    footprint: { width: 1, depth: 1 }
  }
};

const quantity = (inventory: ResourceInventory, kind: ResourceKind) => inventory[kind] ?? 0;

export const inventoryTotal = (inventory: ResourceInventory) =>
  RESOURCE_KINDS.reduce((sum, kind) => sum + quantity(inventory, kind), 0);

export const formatInventory = (inventory: ResourceInventory) => {
  const entries = RESOURCE_KINDS.flatMap((kind) => {
    const amount = quantity(inventory, kind);
    return amount > 0 ? [`${kind}:${amount}`] : [];
  });
  return entries.length > 0 ? entries.join(", ") : "empty";
};

const addInventory = (inventory: ResourceInventory, kind: ResourceKind, amount: number) => {
  if (amount <= 0) return;
  inventory[kind] = quantity(inventory, kind) + amount;
};

const removeInventory = (inventory: ResourceInventory, kind: ResourceKind, amount: number) => {
  if (amount <= 0) return true;
  if (quantity(inventory, kind) < amount) return false;
  const next = quantity(inventory, kind) - amount;
  if (next === 0) delete inventory[kind];
  else inventory[kind] = next;
  return true;
};

const hasInventory = (inventory: ResourceInventory, required: ResourceInventory) =>
  RESOURCE_KINDS.every((kind) => quantity(inventory, kind) >= quantity(required, kind));

const removeInventoryCost = (inventory: ResourceInventory, required: ResourceInventory) => {
  if (!hasInventory(inventory, required)) return false;
  for (const kind of RESOURCE_KINDS) removeInventory(inventory, kind, quantity(required, kind));
  return true;
};

const addEvent = (
  district: GenesisDistrict,
  type: SettlementEventType,
  summary: string,
  actorId?: string
) => {
  district.events.push({
    tick: district.events.length + 1,
    type,
    actorId,
    summary
  });
};

const rectContains = (rect: Pick<PublicSite, "x" | "z" | "width" | "depth">, x: number, z: number) =>
  x >= rect.x && x < rect.x + rect.width && z >= rect.z && z < rect.z + rect.depth;

const rectsOverlap = (
  a: Pick<PublicSite, "x" | "z" | "width" | "depth">,
  b: Pick<PublicSite, "x" | "z" | "width" | "depth">
) => a.x < b.x + b.width && a.x + a.width > b.x && a.z < b.z + b.depth && a.z + a.depth > b.z;

const plotOverlapsPublicSite = (plot: Plot, site: PublicSite) =>
  rectsOverlap(
    { x: plot.x, z: plot.z, width: plot.width, depth: plot.depth },
    site
  );

export const publicSiteAt = (district: GenesisDistrict, x: number, z: number) =>
  district.publicSites.find((site) => rectContains(site, x, z)) ?? null;

export const isPublicColumn = (district: GenesisDistrict, x: number, z: number) =>
  publicSiteAt(district, x, z) !== null;

export const plotIsClaimable = (district: GenesisDistrict, plot: Plot) =>
  !district.publicSites.some((site) => plotOverlapsPublicSite(plot, site));

const nearestClaimablePlots = (world: PlotWorld, district: GenesisDistrict) =>
  [...world.layout.plots]
    .filter((plot) => plotIsClaimable(district, plot))
    .sort((a, b) => {
      const adx = a.centerX - district.center.x;
      const adz = a.centerZ - district.center.z;
      const bdx = b.centerX - district.center.x;
      const bdz = b.centerZ - district.center.z;
      return adx * adx + adz * adz - (bdx * bdx + bdz * bdz);
    });

const moveAgentTo = (agent: GenesisAgent, x: number, z: number, activity: string) => {
  agent.x = x;
  agent.z = z;
  agent.activity = activity;
};

const gatherFromNode = (
  district: GenesisDistrict,
  agent: GenesisAgent,
  nodeId: string,
  requestedAmount: number
) => {
  const node = district.resourceNodes.find((entry) => entry.id === nodeId);
  if (!node) {
    addEvent(district, "reject", `${agent.name} could not find resource node ${nodeId}.`, agent.id);
    return 0;
  }

  const capacityLeft = Math.max(0, agent.carryCapacity - inventoryTotal(agent.inventory));
  const amount = Math.min(requestedAmount, capacityLeft, node.quantity);
  if (amount <= 0) {
    addEvent(district, "reject", `${agent.name} could not gather from ${node.name}.`, agent.id);
    return 0;
  }

  node.quantity -= amount;
  addInventory(agent.inventory, node.kind, amount);
  moveAgentTo(agent, node.x, node.z, `salvaging ${node.name}`);
  addEvent(district, "gather", `${agent.name} gathered ${amount} ${node.kind} from ${node.name}.`, agent.id);
  return amount;
};

const depositAll = (district: GenesisDistrict, agent: GenesisAgent, stockpileId: string) => {
  const stockpile = district.stockpiles.find((entry) => entry.id === stockpileId);
  if (!stockpile) {
    addEvent(district, "reject", `${agent.name} could not find stockpile ${stockpileId}.`, agent.id);
    return;
  }

  const capacityLeft = Math.max(0, stockpile.capacity - inventoryTotal(stockpile.inventory));
  let deposited = 0;
  for (const kind of RESOURCE_KINDS) {
    if (deposited >= capacityLeft) break;
    const amount = Math.min(quantity(agent.inventory, kind), capacityLeft - deposited);
    if (amount <= 0) continue;
    removeInventory(agent.inventory, kind, amount);
    addInventory(stockpile.inventory, kind, amount);
    deposited += amount;
  }

  moveAgentTo(agent, stockpile.x, stockpile.z, `depositing at ${stockpile.name}`);
  addEvent(district, "deposit", `${agent.name} deposited ${deposited} materials into ${stockpile.name}.`, agent.id);
};

const claimPlot = (world: PlotWorld, district: GenesisDistrict, agent: GenesisAgent, plot: Plot) => {
  if (!plotIsClaimable(district, plot)) {
    addEvent(district, "reject", `${agent.name} could not claim public land at ${plot.id}.`, agent.id);
    return false;
  }

  if (district.claims.some((claim) => claim.plotId === plot.id)) {
    addEvent(district, "reject", `${agent.name} could not claim occupied plot ${plot.id}.`, agent.id);
    return false;
  }

  plot.ownerAgentId = agent.id;
  agent.claimPlotId = plot.id;
  moveAgentTo(agent, plot.centerX, plot.centerZ, `claiming ${plot.id}`);
  district.claims.push({ id: `claim-${district.claims.length + 1}`, plotId: plot.id, agentId: agent.id });
  addEvent(district, "claim", `${agent.name} claimed ${plot.id}.`, agent.id);
  return world.plotAt(plot.x, plot.z)?.id === plot.id;
};

const createConstructionFromStockpile = (
  district: GenesisDistrict,
  definitionId: ConstructibleId,
  stockpileId: string,
  ownerAgentId: string | null,
  x: number,
  z: number
) => {
  const definition = CONSTRUCTIBLE_DEFINITIONS[definitionId];
  const stockpile = district.stockpiles.find((entry) => entry.id === stockpileId);
  if (!stockpile) {
    addEvent(district, "reject", `Construction failed: missing stockpile ${stockpileId}.`, ownerAgentId ?? undefined);
    return null;
  }

  if (!removeInventoryCost(stockpile.inventory, definition.cost)) {
    addEvent(district, "reject", `${definition.name} could not start because materials were missing.`, ownerAgentId ?? undefined);
    return null;
  }

  const site: ConstructionSite = {
    id: `construction-${district.constructionSites.length + 1}`,
    definitionId,
    name: definition.name,
    ownerAgentId,
    x,
    z,
    status: "in_progress",
    required: { ...definition.cost },
    consumed: { ...definition.cost },
    workRequired: definition.workRequired,
    workDone: 0,
    contributors: {}
  };
  district.constructionSites.push(site);
  addEvent(district, "construct", `${definition.name} started from stored materials.`, ownerAgentId ?? undefined);
  return site;
};

const contributeWork = (
  district: GenesisDistrict,
  agent: GenesisAgent,
  constructionId: string,
  amount: number
) => {
  const site = district.constructionSites.find((entry) => entry.id === constructionId);
  if (!site) {
    addEvent(district, "reject", `${agent.name} could not find construction site ${constructionId}.`, agent.id);
    return;
  }

  if (site.status === "complete") return;

  site.workDone = Math.min(site.workRequired, site.workDone + amount);
  site.contributors[agent.id] = (site.contributors[agent.id] ?? 0) + amount;
  moveAgentTo(agent, site.x, site.z, `working on ${site.name}`);
  addEvent(district, "work", `${agent.name} contributed ${amount} work to ${site.name}.`, agent.id);

  if (site.workDone >= site.workRequired) {
    site.status = "complete";
    addEvent(district, "complete", `${site.name} completed.`, agent.id);
  }
};

export const createGenesisDistrict = (world: PlotWorld): GenesisDistrict => {
  const center = { x: Math.floor(world.width / 2), z: Math.floor(world.depth / 2) };
  const publicSites: PublicSite[] = [
    {
      id: "arrival-ring",
      name: "Arrival Ring",
      type: "arrival",
      x: center.x - 10,
      z: center.z - 10,
      width: 20,
      depth: 20,
      condition: "dormant"
    },
    {
      id: "maker-yard",
      name: "Maker Yard",
      type: "maker_yard",
      x: center.x + 24,
      z: center.z - 22,
      width: 36,
      depth: 28,
      condition: "half-powered"
    },
    {
      id: "west-salvage",
      name: "West Salvage Yard",
      type: "salvage_yard",
      x: center.x - 68,
      z: center.z - 16,
      width: 38,
      depth: 34,
      condition: "collapsed"
    },
    {
      id: "resource-commons",
      name: "Resource Commons",
      type: "resource_commons",
      x: center.x - 38,
      z: center.z + 34,
      width: 58,
      depth: 32,
      condition: "overgrown"
    },
    {
      id: "depot-pad",
      name: "Shared Depot Pad",
      type: "shared_depot_zone",
      x: center.x + 8,
      z: center.z + 24,
      width: 22,
      depth: 18,
      condition: "empty"
    },
    {
      id: "broken-conduit",
      name: "Broken Conduit",
      type: "infrastructure",
      x: center.x - 4,
      z: center.z - 58,
      width: 46,
      depth: 10,
      condition: "offline"
    }
  ];

  const resourceNodes: ResourceNode[] = [
    { id: "node-wood-1", name: "Overgrown Timber Stand", kind: "wood", nodeType: "tree", x: center.x - 30, z: center.z + 48, quantity: 18, initialQuantity: 18 },
    { id: "node-wood-2", name: "Fallen Sign Beams", kind: "wood", nodeType: "salvage", x: center.x - 52, z: center.z + 4, quantity: 10, initialQuantity: 10 },
    { id: "node-stone-1", name: "Broken Paver Stack", kind: "stone", nodeType: "stone_outcrop", x: center.x + 36, z: center.z + 36, quantity: 16, initialQuantity: 16 },
    { id: "node-scrap-1", name: "Machine Husk", kind: "scrap", nodeType: "salvage", x: center.x - 52, z: center.z - 6, quantity: 18, initialQuantity: 18 },
    { id: "node-scrap-2", name: "Collapsed Utility Box", kind: "scrap", nodeType: "salvage", x: center.x + 30, z: center.z - 52, quantity: 12, initialQuantity: 12 },
    { id: "node-cloth-1", name: "Weathered Supply Crate", kind: "cloth", nodeType: "crate", x: center.x + 14, z: center.z + 34, quantity: 8, initialQuantity: 8 },
    { id: "node-food-1", name: "Seed Garden", kind: "food", nodeType: "tree", x: center.x - 14, z: center.z + 56, quantity: 10, initialQuantity: 10 },
    { id: "node-water-1", name: "Reservoir Sump", kind: "water", nodeType: "water", x: center.x + 48, z: center.z + 16, quantity: 20, initialQuantity: 20 },
    { id: "node-power-1", name: "Dormant Cell Rack", kind: "power_cell", nodeType: "crate", x: center.x + 40, z: center.z - 16, quantity: 4, initialQuantity: 4 },
    { id: "node-data-1", name: "Shattered Index", kind: "data_shard", nodeType: "data", x: center.x + 46, z: center.z - 6, quantity: 5, initialQuantity: 5 }
  ];

  const agents: GenesisAgent[] = [
    {
      id: "agent-lumen",
      name: "Lumen",
      x: center.x - 3,
      z: center.z + 2,
      claimPlotId: null,
      inventory: {},
      carryCapacity: 12,
      currentGoal: "secure shelter materials",
      activity: "arrived at the dormant district",
      personality: "careful builder"
    },
    {
      id: "agent-sable",
      name: "Sable",
      x: center.x + 3,
      z: center.z + 1,
      claimPlotId: null,
      inventory: {},
      carryCapacity: 12,
      currentGoal: "recover useful scrap",
      activity: "arrived at the dormant district",
      personality: "salvage-minded planner"
    },
    {
      id: "agent-orin",
      name: "Orin",
      x: center.x - 2,
      z: center.z - 3,
      claimPlotId: null,
      inventory: {},
      carryCapacity: 12,
      currentGoal: "map claimable land",
      activity: "arrived at the dormant district",
      personality: "territorial surveyor"
    },
    {
      id: "agent-vale",
      name: "Vale",
      x: center.x + 2,
      z: center.z - 3,
      claimPlotId: null,
      inventory: {},
      carryCapacity: 12,
      currentGoal: "restore a work surface",
      activity: "arrived at the dormant district",
      personality: "tool-focused organizer"
    }
  ];

  const stockpiles: Stockpile[] = [
    {
      id: "genesis-depot",
      name: "Dormant Depot Pad",
      type: "genesis_depot",
      ownerAgentId: null,
      x: center.x + 18,
      z: center.z + 33,
      inventory: {},
      capacity: 80
    }
  ];

  const district: GenesisDistrict = {
    center,
    publicSites,
    resourceNodes,
    agents,
    claims: [],
    stockpiles,
    constructionSites: [],
    events: []
  };

  for (const agent of agents) addEvent(district, "arrive", `${agent.name} manifested into the Genesis District.`, agent.id);
  return district;
};

export const runFirstSettlementBootstrap = (world: PlotWorld, district: GenesisDistrict) => {
  const [lumen, sable, orin, vale] = district.agents;
  const claimPlots = nearestClaimablePlots(world, district).slice(0, district.agents.length);

  gatherFromNode(district, lumen, "node-wood-1", 10);
  gatherFromNode(district, sable, "node-scrap-1", 10);
  gatherFromNode(district, orin, "node-stone-1", 6);
  gatherFromNode(district, vale, "node-cloth-1", 4);
  gatherFromNode(district, vale, "node-data-1", 1);

  for (const agent of district.agents) depositAll(district, agent, "genesis-depot");

  for (let index = 0; index < district.agents.length; index += 1) {
    const agent = district.agents[index];
    const plot = claimPlots[index];
    if (agent && plot) claimPlot(world, district, agent, plot);
  }

  for (const agent of district.agents) {
    const plot = agent.claimPlotId ? world.layout.plots.find((entry) => entry.id === agent.claimPlotId) : null;
    if (!plot) continue;
    const stake = createConstructionFromStockpile(
      district,
      "claim_stake",
      "genesis-depot",
      agent.id,
      Math.floor(plot.centerX),
      Math.floor(plot.centerZ)
    );
    if (stake) contributeWork(district, agent, stake.id, CONSTRUCTIBLE_DEFINITIONS.claim_stake.workRequired);
  }

  gatherFromNode(district, lumen, "node-wood-2", 10);
  depositAll(district, lumen, "genesis-depot");

  const shelterOwner = lumen?.id ?? null;
  const shelter = createConstructionFromStockpile(
    district,
    "shelter_frame",
    "genesis-depot",
    shelterOwner,
    district.center.x - 8,
    district.center.z + 14
  );
  if (shelter && lumen) {
    contributeWork(district, lumen, shelter.id, 7);
  }

  for (const agent of district.agents) {
    if (agent.activity.startsWith("working")) continue;
    agent.activity = agent.claimPlotId ? "watching the first claims settle" : "surveying unclaimed land";
  }

  return district;
};

export const createGenesisSettlement = (world: PlotWorld) =>
  runFirstSettlementBootstrap(world, createGenesisDistrict(world));

export const constructionSummaryForPlot = (district: GenesisDistrict, plotId: string) => {
  const plotClaim = district.claims.find((claim) => claim.plotId === plotId);
  if (!plotClaim) return null;
  const agent = district.agents.find((entry) => entry.id === plotClaim.agentId);
  return agent ? `claimed by ${agent.name}` : "claimed";
};
