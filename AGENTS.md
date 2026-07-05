# AGENTS.md — Autonomous Voxel City Builder

This repository is building an autonomous voxel city-builder economy simulation. Treat this file as persistent project context for Codex.

## Working title

Autonomous Voxel City Builder

## Core concept

This is a voxel city-builder where AI agents are both the citizens and the city builders.

The player creates or observes a base world. Agents spawn into that world, read the city charter, learn the rules, satisfy survival needs, gather or allocate resources, propose projects, build buildings, start or work in businesses, earn and spend money, learn skills, and expand the city because they need to live in it.

The core loop is:

```txt
Agents have needs
→ agents seek building functions
→ missing functions create shortages
→ shortages create projects
→ projects consume resources and labor
→ completed projects create buildings
→ buildings unlock new functions
→ functions create jobs, goods, money, knowledge, and services
→ agents live better and expand further
```

This is not a Minecraft clone. It can look voxel/Minecraft-like, but the mechanics are closer to a city-builder plus an economic life simulator. Buildings are city systems. Agents use those systems to survive and build more systems.

## Current repository state

The current repo is a TypeScript + Vite + Three.js app.

Known project setup:

- Package name: `agency-voxel-world`
- Runtime dependency: `three`
- Dev dependencies: TypeScript, Vite, `@types/three`
- Useful scripts:
  - `npm run dev`
  - `npm run start`
  - `npm run typecheck`
  - `npm run build`
  - `npm run preview`

Current architecture:

- `src/main.ts`
  - App entry point.
  - Creates a `FlatWorld`.
  - Generates a plot layout.
  - Wraps it in `PlotWorld`.
  - Builds terrain.
  - Creates the current concrete box town.
  - Adds `ConcreteBoxRenderer`.
  - Sets up the player camera controller and render loop.

- `src/world/flatWorld.ts`
  - Defines the base flat voxel world.
  - Default world is large and flat.
  - Has stone/dirt/grass layers.
  - Provides `blockAt`, `surfaceBlockAt`, `containsColumn`, and world-size helpers.

- `src/world/plots.ts`
  - Generates procedural city districts, paths, and plots.
  - Plots have IDs, dimensions, groups, district IDs, centers, and `ownerAgentId`.
  - This is the start of the city-builder parcel system.

- `src/world/plotWorld.ts`
  - Extends `FlatWorld`.
  - Restricts valid world columns to generated plots and paths.
  - Tracks which cells are plots versus paths.
  - Exposes `plotAt`, `isBuildable`, and `canBuild`.
  - `canBuild(agentId, x, z)` already checks plot ownership rules.

- `src/world/boxTown.ts`
  - Defines the current color-coded seed town.
  - Current building types are:
    - `home`
    - `market`
    - `workshop`
    - `storage`
    - `food`
    - `clinic`
    - `archive`
    - `civic`
    - `utility`
    - `lab`
    - `inn`
  - Current concrete color legend:
    - white = homes / residences
    - yellow = shops / market buildings
    - orange = workshops / repair buildings
    - gray = storage / warehouses
    - green = food / garden buildings
    - red = clinic / emergency building
    - blue = school / archive building
    - light blue = civic / admin building
    - cyan = utility / power-water building
    - purple = research / data lab
    - brown = inn / common hall
  - Current town plan places multiple simple concrete box buildings on central plots.

- `src/world/concreteBoxes.ts`
  - Defines concrete box specs, doorway sides, and shell-cell generation.
  - Buildings are currently hollow shells with roofs and doorways.

- `src/render/concreteBoxRenderer.ts`
  - Renders concrete box specs as instanced voxel meshes.
  - Groups by block type/material.

- `src/render/terrainMesh.ts`
  - Builds optimized flat terrain from surface rects.
  - Renders grass/path tops and stone/dirt sides.

- `src/render/terrainMaterials.ts`
  - Loads block textures and creates Three materials.

- `src/input/PlayerCameraController.ts`
  - First-person camera controller with walk/fly modes.

Current missing major systems:

- No agent simulation yet.
- No city state object yet.
- No resources/items/inventories yet.
- No building functions yet.
- No projects/construction lifecycle yet.
- No money/economy transactions yet.
- No Charter Hall / constitution system yet.
- No agent decision loop yet.
- No mapping from simulation-created buildings to rendered buildings yet.
- No UI/debug panel for city state yet.

## Design direction

The current box-town generator is useful as a visual prototype, but the target game should begin with a more meaningful founding setup.

Target startup:

```txt
Charter Hall
empty plots
paths/roads
starter public stockpile
basic blueprints
first agents
```

The current full seed town can remain as a demo mode or transitional state, but the main gameplay concept should move toward a single guaranteed spawn building: the Charter Hall. Do not delete the existing town generator unless specifically asked. Prefer adding a seed mode or simulation layer first.

## Charter Hall

The Charter Hall is the city bootloader.

It is the one guaranteed starting building. It acts as the constitution, tutorial, project board, city hall, and public planning office.

Agents spawn at the Charter Hall and learn:

```txt
You are in a city-builder world.
Your goal is to survive, build, and improve the city.
Food, shelter, health, and safety are priority needs.
Buildings provide functions.
Resources must be gathered, stored, moved, bought, sold, or reserved.
Projects must be proposed before major public construction.
Buildings must be built on valid plots.
Skills and blueprints unlock better buildings.
Agents may specialize, form work crews, start businesses, and expand the city.
```

The Charter Hall should not magically solve city problems. It should give agents the functions needed to solve problems together.

Initial Charter Hall functions:

```txt
read_charter
view_city_needs
view_available_plots
view_available_resources
view_known_blueprints
learn_basic_blueprint
propose_project
approve_project
reserve_public_resources
claim_role
form_work_crew
assign_project
```

The charter should eventually be both text and machine-readable rules.

Example:

```ts
export const CITY_CHARTER = {
  purpose: "Survive, build, and improve the city.",
  priorityOrder: [
    "food",
    "shelter",
    "health",
    "materials",
    "utilities",
    "knowledge",
    "commerce",
    "research"
  ],
  laws: {
    agentsCanClaimEmptyPlots: true,
    publicResourcesRequireApprovedProject: true,
    emergencyFoodAccess: true,
    privateBusinessAllowed: true,
    taxesEnabled: false
  }
};
```

## Buildings

Buildings are function containers.

Do not simulate interiors yet. Agents do not need to walk to a bed, fridge, desk, register, or shelf. If an agent is inside a building, it can access that building’s functions if requirements are met.

A building is not just a voxel object. It is a simulation entity with:

```txt
type
color
plot
owner
residents
workers
inventory
cash
capacity
condition
available functions
settings
```

Suggested type:

```ts
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

  inventory: Record<ResourceId, number>;
  cash: number;

  functionIds: BuildingFunctionId[];
  settings: Record<string, number>;
};
```

## Building functions

A building function is an action enabled by a building.

Functions should define:

```txt
requirements
inputs
outputs
duration
capacity
permissions
adjustable settings
failure conditions
```

Suggested type:

```ts
export type BuildingFunction = {
  id: BuildingFunctionId;
  label: string;
  buildingTypes: BuildingType[];

  requiresWorker: boolean;
  requiredAgentSkills?: Partial<Record<SkillId, number>>;
  requiredInventory?: Partial<Record<ResourceId, number>>;
  requiredCash?: number;

  inputs?: Partial<Record<ResourceId, number>>;
  outputs?: Partial<Record<ResourceId, number>>;

  durationTicks: number;
  capacity: number;

  allowedRoles?: AgentRole[];
  settingsSchema?: Record<string, {
    min: number;
    max: number;
    default: number;
  }>;
};
```

A market does not magically feed agents. It can only sell food if the market has food inventory, the buyer has money, and the market is open or staffed.

Example function logic:

```txt
buy_food
Requirements:
- building type is market or food
- building inventory has food
- agent has enough cash

Result:
- agent cash decreases
- building cash increases
- building food decreases
- agent food need improves
```

Early building functions by type:

```txt
charter_hall:
  read_charter
  view_city_needs
  view_available_plots
  view_available_resources
  view_known_blueprints
  learn_basic_blueprint
  propose_project
  approve_project
  reserve_public_resources
  claim_role
  form_work_crew

home:
  rest
  shelter
  store_personal_items

inn:
  temporary_rest
  socialize
  meeting

food:
  produce_food
  eat_basic_meal
  store_seeds

storage:
  deposit_resource
  withdraw_resource
  reserve_project_materials
  inspect_inventory

workshop:
  craft_tools
  craft_building_materials
  repair_tools
  contribute_construction

market:
  buy_goods
  sell_goods
  stock_inventory
  work_retail
  adjust_prices

clinic:
  heal
  treat_sickness
  consume_medicine

archive:
  study_skill
  unlock_blueprint
  read_records

civic:
  claim_plot
  approve_permit
  set_policy
  collect_tax

utility:
  provide_water
  provide_power
  maintain_capacity

lab:
  research_blueprint
  analyze_city_data
  improve_system
```

For early prototyping:

```txt
Basic functions may run slowly without workers.
Workers increase speed, capacity, or output.
Advanced functions require workers with sufficient skills.
```

## Agents

Agents are both citizens and builders.

They have survival needs, money, skills, knowledge, roles, and goals. They should only choose from valid functions available in the current city state.

Suggested type:

```ts
export type AgentNeedId =
  | "food"
  | "rest"
  | "shelter"
  | "health"
  | "social"
  | "knowledge"
  | "money";

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

export type Agent = {
  id: string;
  name: string;

  currentBuildingId: string | null;
  destinationBuildingId: string | null;
  homeBuildingId: string | null;
  workplaceBuildingId: string | null;

  cash: number;
  inventory: Record<ResourceId, number>;

  needs: Record<AgentNeedId, number>;
  skills: Record<SkillId, number>;

  knownBlueprintIds: string[];
  role: AgentRole | null;

  currentAction: AgentAction | null;
  goals: string[];
};
```

Agent goal hierarchy:

```txt
1. Stay alive.
2. Maintain food, rest, shelter, and health.
3. Get money or access to resources.
4. Learn skills.
5. Help solve urgent city shortages.
6. Build or improve the city.
7. Pursue personal/business goals when stable.
```

Early agent behavior should be rule-based. Do not use an LLM for every tick.

Decision priority:

```txt
If health is critical → seek clinic or emergency help.
If food is critical → seek food.
If no shelter → seek temporary rest, home, or housing project.
If cash is low → seek work.
If city has urgent shortage → join or propose project.
If skills are insufficient → study.
If stable → pursue personal/business goal.
```

## Needs

Needs are the engine of the simulation.

Start with:

```txt
food
rest
shelter
health
social
knowledge
money
```

Needs decay over time. Agents choose building functions to restore needs.

Examples:

```txt
food low → buy food, eat at food building, produce food, request emergency food
rest low → rest at home or inn
shelter missing → find home, use inn, propose housing
health low → seek clinic
knowledge low → study at archive
money low → work a job or sell items
```

If the city cannot satisfy a need, that should create pressure to build.

Examples:

```txt
No food function exists → propose garden
No shelter capacity exists → propose small home
No jobs exist → propose workshop or market
No healthcare exists → propose clinic
```

## Resources and items

Start simple. Use broad resource counts first, not detailed individual objects.

Initial resources:

```ts
export type ResourceId =
  | "food"
  | "water"
  | "wood"
  | "stone"
  | "metal"
  | "glass"
  | "tools"
  | "medicine"
  | "fuel"
  | "energy"
  | "data"
  | "knowledge"
  | "money"
  | "labor";
```

Categories:

```txt
survival:
  food, water, medicine

construction:
  wood, stone, metal, glass, tools

operations:
  fuel, energy, data

economy:
  money

abstract:
  labor, knowledge
```

Labor is usually generated by agents working, not stored as a normal item. It can still appear on projects as progress.

Knowledge can exist both as an agent skill/blueprint state and a city-level research resource.

Later, resources can split into finer items:

```txt
raw_food
cooked_food
lumber
stone_blocks
metal_parts
basic_tools
advanced_tools
medical_supplies
research_notes
```

Do not start with that complexity.

## Inventories

Inventories make the economy physical.

Use:

```txt
agent inventory
building inventory
public stockpile
project reserved inventory
business inventory
```

At startup, the Charter Hall or public stockpile should contain limited starter supplies:

```txt
food: 30
wood: 100
stone: 80
tools: 10
medicine: 5
money: 500
```

Those numbers are placeholders. Balance later.

Projects should reserve materials before construction so two projects cannot consume the same resource.

Resource flow example:

```txt
public stockpile
→ reserved project inventory
→ consumed by construction
→ completed building appears
```

## Blueprints

Blueprints define what agents can build.

A blueprint is not just a visual structure. It defines the simulation building.

Suggested type:

```ts
export type Blueprint = {
  id: string;
  name: string;
  buildingType: BuildingType;

  requiredPlotGroup?: number;
  requiredMaterials: Partial<Record<ResourceId, number>>;
  requiredSkills: Partial<Record<SkillId, number>>;
  requiredLabor: number;

  buildWidth: number;
  buildLength: number;
  buildHeight: number;

  functionsUnlocked: BuildingFunctionId[];
  capacity: number;

  unlockRequirements?: {
    requiredBlueprintIds?: string[];
    requiredCityKnowledge?: number;
    requiredBuildingTypes?: BuildingType[];
  };
};
```

Starting blueprints:

```txt
small_home
garden_plot
storage_shed
workshop_shed
market_stall
common_hall
```

Locked later blueprints:

```txt
clinic
school_archive
utility_station
data_lab
apartment_block
factory
bank
transit_station
```

Agents “learn to build” by gaining skills and unlocking blueprints.

## Projects

Projects are how the city changes.

Agents should not instantly create buildings. They should create projects.

Suggested type:

```ts
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
  blueprintId: string | null;

  requiredMaterials: Partial<Record<ResourceId, number>>;
  reservedMaterials: Partial<Record<ResourceId, number>>;

  requiredLabor: number;
  progressLabor: number;

  priority: number;
  createdAtTick: number;
};
```

Project lifecycle:

```txt
1. Need or opportunity appears.
2. Agent identifies need.
3. Agent proposes project at Charter Hall.
4. Charter Hall checks laws, city priorities, plots, resources, and blueprint.
5. Project is approved or delayed.
6. Materials are reserved.
7. Agents join work crew.
8. Labor progress increases.
9. Project completes.
10. Building appears on target plot.
11. Building functions become available.
```

Example:

```txt
Food shortage
→ agent proposes Build Garden
→ Charter Hall approves
→ wood/tools are reserved
→ builder/farmer agents work
→ green food building appears
→ food production begins
```

## Economy and KMVBPF layer

This project should eventually simulate economic life: jobs, wages, prices, business ownership, personal money, city budgets, and financial decisions.

Start with simple money:

```txt
agent.cash
building.cash
business.cash
city.treasury
```

Basic money flows:

```txt
wages
food purchases
rent
business revenue
business expenses
public project spending
taxes later
```

Suggested transaction type:

```ts
export type Transaction = {
  id: string;
  tick: number;
  fromId: string;
  toId: string;
  amount: number;
  reason: string;
};
```

Early economy:

```txt
Agents earn wages by working.
Agents spend money on food and rent.
Businesses/buildings earn money by selling goods.
Businesses/buildings spend money on wages and inventory.
The city funds public projects from treasury or public stockpile.
```

Later economy:

```txt
loans
debt
interest
savings
investments
insurance
bankruptcy
profit/loss statements
business plans
rent markets
tax policy
```

Do not implement all of this at once.

## Jobs and work

A job is a repeated function that produces value.

Examples:

```txt
farm_worker
builder
warehouse_clerk
market_worker
repair_worker
teacher
medic
researcher
civic_clerk
utility_worker
```

A job should produce:

```txt
wage for worker
output for building
service capacity for city
skill experience for agent
```

Examples:

```txt
Agent works at garden:
- agent earns wage
- food building gains food
- agent gains farming XP
- city food supply improves

Agent works at workshop:
- agent earns wage
- workshop produces tools/materials
- agent gains building/repair XP
```

## Businesses and organizations

A business can own or operate buildings.

Do not make every building a business immediately, but design toward it.

Suggested type:

```ts
export type Business = {
  id: string;
  name: string;
  ownerAgentIds: string[];
  buildingIds: string[];
  cash: number;
  inventory: Record<ResourceId, number>;
  workers: string[];
  prices: Partial<Record<ResourceId, number>>;
};
```

Future examples:

```txt
Agent starts food business.
Agent claims or rents plot.
Agent builds garden.
Agent sells food through market.
Agent hires worker.
Business expands.
```

## City needs

The city should compute aggregate needs separately from agent needs.

Suggested city stats:

```txt
population
housing capacity
food stockpile
food production per day
material stockpile
available jobs
unemployment
health coverage
education coverage
utility capacity
open plots
active projects
treasury
average happiness
```

Useful derived values:

```txt
housing_gap = population - available_beds
food_days = total_food / population
job_gap = agents_needing_work - available_jobs
clinic_gap = population - clinic_capacity
utility_gap = demand - utility_capacity
```

Agents should be able to view city needs at the Charter Hall.

## City charter and governance

Do not implement complex voting first.

First governance model:

```txt
The charter ranks priorities.
Agents propose projects.
The city approves useful projects.
Public resources are reserved for approved work.
```

Automatic approval examples:

```txt
food_days < 3 → food projects high priority
housing_capacity < population → housing projects high priority
tools low → workshop/storage projects high priority
health coverage low → clinic project high priority
```

Later governance:

```txt
voting
councils
laws
tax rates
zoning
public/private split
permits
political groups
```

## Movement and location

Do not build complex pathfinding first.

Use abstract building-level location:

```txt
agent.currentBuildingId
agent.destinationBuildingId
travelTimeRemaining
```

When an agent chooses a function in another building, calculate a simple travel time from plot/building distance.

Later add visible walking agents and pathfinding.

## Time

Use a tick system.

Recommended initial scale:

```txt
1 tick = 1 in-game hour
24 ticks = 1 day
```

Every tick:

```txt
needs decay
agents choose or continue actions
buildings process production
markets process sales
projects gain labor progress
inventories update
transactions record
city needs recalculate
events may trigger
```

Daily:

```txt
wages paid
rent charged
maintenance applied
agents update goals
businesses update stock targets
```

## Events and failure

The sim needs pressure.

Failure modes:

```txt
No food → hunger → health decline
No shelter → rest decline → productivity decline
No tools → construction slows
No materials → projects stall
No workers → buildings run slowly
No money → agents cannot buy goods
No utilities → advanced buildings shut down
No clinic → sickness spreads
No storage → resources decay or get lost
No education → advanced buildings remain locked
```

This makes buildings matter.

## Adjustable variables

Agents may adjust variables only through controlled settings, not by editing arbitrary state.

Examples:

Market owner can adjust:

```txt
food_price
worker_wage
stock_target
markup
open_hours
```

Workshop manager can adjust:

```txt
production_focus
tool_priority
repair_priority
worker_wage
```

Civic role can adjust:

```txt
tax_rate
public_project_priority
emergency_food_policy
resource_reservation_rules
```

Builder can adjust:

```txt
build_speed
build_quality
material_substitution
```

Farmer can adjust:

```txt
crop_focus
food_storage_target
seed_usage
```

Each setting needs bounds and consequences.

## Rendering integration

The simulation should drive rendering, not the other way around.

Current rendering uses concrete box specs. Preserve that path.

Near-term plan:

1. Keep `createCenteredBoxTown(world)` working.
2. Add simulation files under `src/sim`.
3. Add a converter from `CityBuilding` to `ConcreteBoxSpec`.
4. Let completed build projects append new `CityBuilding` records.
5. Render simulation buildings as concrete boxes.
6. Later, replace or supplement the demo seed town with Charter Hall startup.

Important rule:

```txt
Agents reason from city state, not raw voxels.
Voxels show the result of city state.
```

Do not import Three.js into simulation modules. Keep simulation code pure and deterministic where practical.

## Suggested folder structure

Add:

```txt
src/sim/
  types.ts
  ids.ts
  charter.ts
  resources.ts
  buildingFunctions.ts
  blueprints.ts
  createInitialCityState.ts
  tick.ts
  selectors.ts

  agents/
    simplePolicy.ts

  systems/
    needs.ts
    cityNeeds.ts
    actions.ts
    economy.ts
    projects.ts
    construction.ts
```

Recommended responsibilities:

- `types.ts`: core simulation types only.
- `ids.ts`: deterministic ID helpers.
- `charter.ts`: city charter and approval priorities.
- `resources.ts`: resource IDs/default stockpile.
- `buildingFunctions.ts`: function definitions and requirements.
- `blueprints.ts`: buildable building definitions.
- `createInitialCityState.ts`: creates agents, public stockpile, Charter Hall or seed state.
- `tick.ts`: top-level simulation update.
- `selectors.ts`: derived city stats and lookup helpers.
- `agents/simplePolicy.ts`: rule-based agent decision logic.
- `systems/needs.ts`: need decay and need restoration.
- `systems/projects.ts`: project proposal/approval/resource reservation.
- `systems/construction.ts`: project labor progress and completed building creation.
- `systems/economy.ts`: wages, purchases, transactions.

## First playable MVP

The first playable version should include:

```txt
Charter Hall
plots
agents
needs
resources
building functions
blueprints
projects
completed project → colored building appears
```

Only implement these building types first:

```txt
charter_hall
home
food
storage
workshop
market
```

Only implement these resources first:

```txt
food
wood
stone
tools
money
labor
knowledge
```

Only implement these needs first:

```txt
food
rest
shelter
money
knowledge
```

Only implement these functions first:

```txt
read_charter
view_city_needs
learn_blueprint
propose_project
reserve_resources
build_project
rest
produce_food
store_resource
craft_tools
buy_food
work_job
```

First working loop:

```txt
Agents spawn.
They read the charter.
Food need decreases.
There is no food production.
An agent proposes a garden.
Resources are reserved.
Agents build the garden.
Garden produces food.
Agents eat.
Housing need appears.
Agents build homes.
Workshop appears.
Workshop creates tools.
Market appears.
Agents get jobs and buy food.
```

## Implementation roadmap

### Phase 1 — Simulation scaffold

Goal: add pure simulation data structures without changing rendering heavily.

Tasks:

1. Add `src/sim/types.ts`.
2. Add `src/sim/charter.ts`.
3. Add `src/sim/resources.ts`.
4. Add `src/sim/buildingFunctions.ts`.
5. Add `src/sim/blueprints.ts`.
6. Add `src/sim/createInitialCityState.ts`.
7. Add `src/sim/tick.ts`.
8. Wire a city state instance in `main.ts` only enough to run or log it.
9. Run `npm run typecheck` and `npm run build`.

### Phase 2 — Charter Hall seed

Goal: support a startup mode with Charter Hall and empty plots.

Tasks:

1. Add `charter_hall` building type.
2. Add a Charter Hall blueprint/building definition.
3. Add a function to pick a central plot for Charter Hall.
4. Render Charter Hall as a concrete building.
5. Preserve existing demo town unless asked to remove it.

### Phase 3 — Agent needs and simple policy

Goal: agents can choose actions from needs.

Tasks:

1. Spawn 6–12 agents.
2. Decay needs over time.
3. Implement simple rule-based action selection.
4. Let agents use building functions abstractly.
5. Add a small debug overlay or console output.

### Phase 4 — Projects and construction

Goal: city can change through projects.

Tasks:

1. Agents propose projects based on shortages.
2. Charter Hall approves useful projects.
3. Reserve resources.
4. Assign labor.
5. Complete project.
6. Add a new `CityBuilding`.
7. Render the new building.

### Phase 5 — Economy

Goal: money and jobs matter.

Tasks:

1. Agents earn wages.
2. Markets sell food.
3. Buildings/businesses have cash.
4. Transactions are recorded.
5. Basic prices and wages exist.

### Phase 6 — Skills, blueprints, and learning

Goal: agents learn to unlock city growth.

Tasks:

1. Work gives skill XP.
2. Archive/Charter Hall can teach basic skills.
3. Blueprints have skill requirements.
4. Advanced buildings require research/knowledge.

### Phase 7 — AI layer

Goal: use AI agents for high-level choices only.

Do not ask an LLM every tick. Use rule-based sim for routine behavior.

LLM should eventually choose high-level goals from valid options:

```txt
Given this agent state and city summary, choose one valid goal:
- get food
- rest
- find work
- study
- propose project
- join project
- start business
```

The LLM must not invent unsupported actions or directly mutate state.

## Development rules for Codex

1. Keep changes small and focused.
2. Prefer pure TypeScript modules for simulation.
3. Do not rewrite the renderer unless the task requires it.
4. Do not add new dependencies unless strongly justified.
5. Do not implement interiors, object-level furniture, or detailed pathfinding yet.
6. Do not use `any` casually. The repo uses strict TypeScript.
7. Preserve existing visual prototype behavior while adding systems.
8. Keep deterministic defaults where possible.
9. Run `npm run typecheck` before finalizing.
10. Run `npm run build` when changes touch app wiring/rendering.
11. Commit each completed task with a focused message.
12. After each commit, report:
    - what changed
    - files changed
    - checks run
    - commit SHA
    - recommended next step

## Current code constraints

- `PlotWorld` already has plot ownership/buildability hooks. Reuse them.
- `boxTown.ts` currently owns the semantic building plan. Do not duplicate the color mapping in many places; eventually centralize building type/color metadata.
- `ConcreteBoxRenderer` renders a fixed box list. If simulation buildings change over time, add an update/rebuild path rather than creating unrelated render systems.
- `terrainMesh` is optimized for surface rects. Avoid per-block terrain rendering.
- The simulation should not depend on Three.js. Rendering may depend on simulation output.

## Recommended first Codex task

Start with this task:

```txt
Add the initial pure simulation scaffold.

Create `src/sim/types.ts`, `src/sim/charter.ts`, `src/sim/resources.ts`, `src/sim/buildingFunctions.ts`, `src/sim/blueprints.ts`, `src/sim/createInitialCityState.ts`, and `src/sim/tick.ts`.

The scaffold should define:
- CityState
- Agent
- CityBuilding
- BuildingFunction
- Blueprint
- Project
- ResourceId
- AgentNeedId
- SkillId
- CityCharter

Include default resources, default charter, first building functions, and first blueprints.

Do not change rendering yet except optionally importing and creating an initial city state in `main.ts` and logging a short summary.

Run `npm run typecheck` and `npm run build`.
Commit the result.
```

## Design principle

Buildings do not exist to look good. Buildings exist to unlock functions.

Functions do not exist in isolation. Functions satisfy needs or produce resources.

Resources are not collectibles. Resources enable survival, projects, and economic life.

Projects are not quests. Projects are how the city changes itself.

Agents do not just live in the city. Agents build the city because they live in it.
