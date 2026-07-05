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

export type BuildingFunctionId =
  | "read_charter"
  | "view_city_needs"
  | "learn_blueprint"
  | "propose_project"
  | "reserve_resources"
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
  color: string;
  plotId: string;
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
  functionId: BuildingFunctionId;
  targetBuildingId: string | null;
  projectId: string | null;
  remainingTicks: number;
};

export type Agent = {
  id: string;
  name: string;
  currentBuildingId: string | null;
  destinationBuildingId: string | null;
  homeBuildingId: string | null;
  workplaceBuildingId: string | null;
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
  tick: number;
  day: number;
  charter: CityCharter;
  publicStockpile: ResourceInventory;
  treasury: number;
  knownBlueprintIds: BlueprintId[];
  availablePlotIds: string[];
  agents: Agent[];
  buildings: CityBuilding[];
  projects: Project[];
  transactions: Transaction[];
};
