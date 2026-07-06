export type ResourceId = "food" | "wood" | "stone" | "tools" | "money" | "labor" | "knowledge";

export type AgentNeedId = "food" | "rest" | "shelter" | "money" | "knowledge";

export type SkillId =
  | "building"
  | "farming"
  | "trade"
  | "medicine"
  | "research"
  | "management"
  | "logistics"
  | "engineering";

export type AgentRole =
  | "founder"
  | "resident"
  | "worker"
  | "builder"
  | "farmer"
  | "merchant"
  | "medic"
  | "researcher"
  | "civic_clerk"
  | "manager"
  | "visitor";

export type BuildingType =
  | "charter_hall"
  | "home"
  | "market"
  | "workshop"
  | "storage"
  | "food"
  | "clinic"
  | "archive"
  | "civic"
  | "utility"
  | "lab"
  | "inn";

export type BuildingColor =
  | "light_blue"
  | "white"
  | "yellow"
  | "orange"
  | "gray"
  | "green"
  | "red"
  | "blue"
  | "cyan"
  | "purple"
  | "brown";

export type BuildingFunctionId =
  | "read_charter"
  | "view_city_needs"
  | "learn_blueprint"
  | "propose_project"
  | "reserve_resources"
  | "claim_home"
  | "build_project"
  | "rest"
  | "produce_food"
  | "store_resource"
  | "craft_tools"
  | "buy_food"
  | "work_job";

export type BlueprintId =
  | "small_home"
  | "garden_plot"
  | "storage_shed"
  | "workshop_shed"
  | "market_stall"
  | "common_hall";

export type CityPriorityId =
  | "food"
  | "shelter"
  | "health"
  | "materials"
  | "utilities"
  | "knowledge"
  | "commerce"
  | "research";

export type ResourceInventory = Record<ResourceId, number>;
export type PartialResourceInventory = Partial<Record<ResourceId, number>>;

export type WorldPosition = {
  x: number;
  z: number;
};

export type CityPathRect = {
  x: number;
  z: number;
  width: number;
  depth: number;
};

export type AgentMovementState = "idle" | "walking" | "working" | "inside";

export type PlotClaimStatus = "unclaimed" | "claimed" | "reserved" | "public";

export type PlotState = {
  plotId: string;
  group: 1 | 2 | 3 | 4;
  x: number;
  z: number;
  width: number;
  depth: number;
  area: number;
  center: WorldPosition;
  claimStatus: PlotClaimStatus;
  ownerAgentId: string | null;
  structureIds: string[];
  resourceNodeIds: string[];
  activeProjectId: string | null;
};

export type ResourceNode = {
  id: string;
  plotId: string | null;
  position: WorldPosition;
  resourceId: Extract<ResourceId, "food" | "wood" | "stone">;
  amountRemaining: number;
  gatherRate: number;
};

export type BuildingLifecycleStatus = "planned" | "under_construction" | "complete";

export type AgentActionType =
  | "inspect_city_needs"
  | "claim_plot"
  | "gather_resource"
  | "deposit_resource"
  | "propose_build_project"
  | "reserve_project_resources"
  | "work_project"
  | "use_building_function"
  | "rest"
  | "eat"
  | "idle";

export type SimEventType =
  | "city_inspected"
  | "plot_claimed"
  | "resource_gathered"
  | "resource_deposited"
  | "project_proposed"
  | "resources_reserved"
  | "construction_worked"
  | "building_completed"
  | "building_used"
  | "agent_rested"
  | "agent_ate"
  | "agent_idle";

export type SimEventTargetType = "city" | "plot" | "building" | "project" | "resource_node" | "agent";

export type SimEvent = {
  id: string;
  tick: number;
  day: number;
  actorAgentId: string | null;
  eventType: SimEventType;
  targetType: SimEventTargetType;
  targetId: string | null;
  summary: string;
  reason: string;
  cost?: PartialResourceInventory;
  effect?: PartialResourceInventory;
};

export type CityCharter = {
  purpose: string;
  priorityOrder: readonly CityPriorityId[];
  laws: {
    agentsCanClaimEmptyPlots: boolean;
    publicResourcesRequireApprovedProject: boolean;
    emergencyFoodAccess: boolean;
    privateBusinessAllowed: boolean;
    taxesEnabled: boolean;
  };
};

export type CityBuilding = {
  id: string;
  type: BuildingType;
  name: string;
  color: BuildingColor;
  status: BuildingLifecycleStatus;
  plotId: string;
  blueprintId: BlueprintId | null;
  width: number;
  length: number;
  height: number;
  ownerAgentId: string | null;
  businessId: string | null;
  residents: string[];
  workers: string[];
  capacity: number;
  condition: number;
  inventory: ResourceInventory;
  cash: number;
  functionIds: BuildingFunctionId[];
  settings: Record<string, number>;
};

export type BuildingFunction = {
  id: BuildingFunctionId;
  label: string;
  buildingTypes: readonly BuildingType[];
  requiresWorker: boolean;
  requiredAgentSkills?: Partial<Record<SkillId, number>>;
  requiredInventory?: PartialResourceInventory;
  requiredCash?: number;
  inputs?: PartialResourceInventory;
  outputs?: PartialResourceInventory;
  durationTicks: number;
  capacity: number;
  allowedRoles?: readonly AgentRole[];
  settingsSchema?: Record<string, { min: number; max: number; default: number }>;
};

export type Blueprint = {
  id: BlueprintId;
  name: string;
  buildingType: BuildingType;
  requiredPlotGroup?: 1 | 2 | 3 | 4;
  requiredMaterials: PartialResourceInventory;
  requiredSkills: Partial<Record<SkillId, number>>;
  requiredLabor: number;
  buildWidth: number;
  buildLength: number;
  buildHeight: number;
  functionsUnlocked: readonly BuildingFunctionId[];
  capacity: number;
  unlockRequirements?: {
    requiredBlueprintIds?: readonly BlueprintId[];
    requiredCityKnowledge?: number;
    requiredBuildingTypes?: readonly BuildingType[];
  };
};

export type AgentAction = {
  id: string;
  type: AgentActionType;
  functionId: BuildingFunctionId | null;
  actorAgentId: string;
  targetBuildingId: string | null;
  targetPlotId: string | null;
  targetProjectId: string | null;
  targetResourceNodeId: string | null;
  projectId: string | null;
  resourceId: ResourceId | null;
  blueprintId: BlueprintId | null;
  destination: WorldPosition | null;
  reason: string;
  startedAtTick: number;
  durationTicks: number;
  remainingTicks: number;
};

export type ValidAgentAction = Omit<AgentAction, "functionId" | "projectId" | "startedAtTick" | "durationTicks" | "remainingTicks">;

export type Agent = {
  id: string;
  name: string;
  modelId: string;
  position: WorldPosition;
  destination: WorldPosition | null;
  route: WorldPosition[];
  movementState: AgentMovementState;
  currentBuildingId: string | null;
  destinationBuildingId: string | null;
  homeBuildingId: string | null;
  workplaceBuildingId: string | null;
  claimedPlotId: string | null;
  cash: number;
  inventory: ResourceInventory;
  needs: Record<AgentNeedId, number>;
  skills: Record<SkillId, number>;
  knownBlueprintIds: BlueprintId[];
  role: AgentRole | null;
  currentAction: AgentAction | null;
  goals: string[];
};

export type ProjectStatus =
  | "proposed"
  | "approved"
  | "resource_blocked"
  | "labor_blocked"
  | "active"
  | "complete"
  | "failed"
  | "cancelled";

export type Project = {
  id: string;
  type: "build" | "upgrade" | "repair" | "deliver" | "research";
  status: ProjectStatus;
  requestedByAgentId: string;
  reason: string;
  assignedAgentIds: string[];
  targetPlotId: string | null;
  blueprintId: BlueprintId | null;
  requiredMaterials: PartialResourceInventory;
  reservedMaterials: PartialResourceInventory;
  requiredLabor: number;
  progressLabor: number;
  priority: number;
  createdAtTick: number;
};

export type Transaction = {
  id: string;
  tick: number;
  fromId: string;
  toId: string;
  amount: number;
  reason: string;
};

export type CityState = {
  schemaVersion: number;
  tick: number;
  day: number;
  charter: CityCharter;
  plotStates: PlotState[];
  pathRects: CityPathRect[];
  resourceNodes: ResourceNode[];
  publicStockpile: ResourceInventory;
  treasury: number;
  knownBlueprintIds: BlueprintId[];
  availablePlotIds: string[];
  agents: Agent[];
  buildings: CityBuilding[];
  projects: Project[];
  transactions: Transaction[];
  structuredEvents: SimEvent[];
  events: string[];
};
