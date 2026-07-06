export type AgentModelCategory = "base" | "civilian" | "role" | "costume" | "creature";

export type AgentModelDefinition = {
  id: string;
  name: string;
  sourceFile: string;
  url: string;
  category: AgentModelCategory;
  agentEligible: boolean;
  tags: string[];
};

export const AGENT_MODEL_ASSET_BASE_URL = "/assets/agents/ultimate-animated-character-pack/gltf";

export const AGENT_MODEL_SOURCE = {
  name: "Ultimate Animated Character Pack - Nov 2019",
  author: "Quaternius",
  license: "CC0 1.0 Universal",
  noticePath: "/assets/agents/ultimate-animated-character-pack/License.txt"
} as const;

export const AGENT_MODEL_ANIMATIONS = [
  "Death",
  "Defeat",
  "Idle",
  "Jump",
  "PickUp",
  "Punch",
  "RecieveHit",
  "Roll",
  "Run",
  "Run_Carry",
  "Shoot_OneHanded",
  "SitDown",
  "StandUp",
  "SwordSlash",
  "Victory",
  "Walk",
  "Walk_Carry"
] as const;

const AGENT_MODEL_FILES = [
  "BaseCharacter.gltf",
  "BlueSoldier_Female.gltf",
  "BlueSoldier_Male.gltf",
  "Casual_Bald.gltf",
  "Casual_Female.gltf",
  "Casual_Male.gltf",
  "Casual2_Female.gltf",
  "Casual2_Male.gltf",
  "Casual3_Female.gltf",
  "Casual3_Male.gltf",
  "Chef_Female.gltf",
  "Chef_Hat.gltf",
  "Chef_Male.gltf",
  "Cow.gltf",
  "Cowboy_Female.gltf",
  "Cowboy_Hair.gltf",
  "Cowboy_Male.gltf",
  "Doctor_Female_Old.gltf",
  "Doctor_Female_Young.gltf",
  "Doctor_Male_Old.gltf",
  "Doctor_Male_Young.gltf",
  "Elf.gltf",
  "Goblin_Female.gltf",
  "Goblin_Male.gltf",
  "Kimono_Female.gltf",
  "Kimono_Male.gltf",
  "Knight_Golden_Female.gltf",
  "Knight_Golden_Male.gltf",
  "Knight_Male.gltf",
  "Ninja_Female.gltf",
  "Ninja_Male.gltf",
  "Ninja_Male_Hair.gltf",
  "Ninja_Sand.gltf",
  "Ninja_Sand_Female.gltf",
  "OldClassy_Female.gltf",
  "OldClassy_Male.gltf",
  "Pirate_Female.gltf",
  "Pirate_Male.gltf",
  "Pug.gltf",
  "Soldier_Female.gltf",
  "Soldier_Male.gltf",
  "Suit_Female.gltf",
  "Suit_Male.gltf",
  "Viking_Female.gltf",
  "Viking_Male.gltf",
  "VikingHelmet.gltf",
  "Witch.gltf",
  "Wizard.gltf",
  "Worker_Female.gltf",
  "Worker_Male.gltf",
  "Zombie_Female.gltf",
  "Zombie_Male.gltf"
] as const;

const stripExtension = (fileName: string) => fileName.replace(/\.gltf$/i, "");

const normalizedNameForFile = (fileName: string) =>
  stripExtension(fileName)
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([a-z])([0-9])/g, "$1 $2")
    .replace(/_/g, " ");

const wordsForFile = (fileName: string) => normalizedNameForFile(fileName).split(" ").filter(Boolean);

const idForFile = (fileName: string) =>
  normalizedNameForFile(fileName)
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

const titleForFile = (fileName: string) => wordsForFile(fileName).join(" ");

const tagsForFile = (fileName: string, category: AgentModelCategory) => [
  category,
  ...wordsForFile(fileName).map((word) => word.toLowerCase())
];

const categoryForFile = (fileName: string): AgentModelCategory => {
  const id = idForFile(fileName);
  if (id === "base_character") return "base";
  if (id === "cow" || id === "pug") return "creature";
  if (
    id.includes("chef") ||
    id.includes("doctor") ||
    id.includes("soldier") ||
    id.includes("suit") ||
    id.includes("worker")
  ) {
    return "role";
  }
  if (
    id.includes("casual") ||
    id.includes("old_classy") ||
    id.includes("kimono") ||
    id.includes("cowboy")
  ) {
    return "civilian";
  }
  return "costume";
};

const hashSeed = (seed: string) => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const AGENT_MODEL_LIBRARY: readonly AgentModelDefinition[] = AGENT_MODEL_FILES.map((sourceFile) => {
  const category = categoryForFile(sourceFile);
  return {
    id: idForFile(sourceFile),
    name: titleForFile(sourceFile),
    sourceFile,
    url: `${AGENT_MODEL_ASSET_BASE_URL}/${sourceFile}`,
    category,
    agentEligible: category !== "creature",
    tags: tagsForFile(sourceFile, category)
  };
});

export const AGENT_SPAWN_MODELS = AGENT_MODEL_LIBRARY.filter(
  (model) => model.agentEligible && model.category !== "costume" && !model.id.includes("zombie")
);
export const DEFAULT_AGENT_MODEL_ID = "casual_male";

export const getAgentModelDefinition = (modelId: string) =>
  AGENT_MODEL_LIBRARY.find((model) => model.id === modelId) ?? null;

export const isAgentSpawnModelId = (modelId: string) =>
  AGENT_SPAWN_MODELS.some((model) => model.id === modelId);

export const pickAgentModelForSeed = (seed: string, models = AGENT_SPAWN_MODELS) => {
  if (models.length === 0) {
    throw new Error("No agent models are available for spawning.");
  }

  return models[hashSeed(seed) % models.length];
};
