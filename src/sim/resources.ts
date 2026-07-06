import type { PartialResourceInventory, ResourceId, ResourceInventory } from "./types";

export const RESOURCE_IDS: readonly ResourceId[] = ["food", "wood", "stone", "tools", "money", "labor", "knowledge"];

export const createResourceInventory = (overrides: PartialResourceInventory = {}): ResourceInventory => ({
  food: overrides.food ?? 0,
  wood: overrides.wood ?? 0,
  stone: overrides.stone ?? 0,
  tools: overrides.tools ?? 0,
  money: overrides.money ?? 0,
  labor: overrides.labor ?? 0,
  knowledge: overrides.knowledge ?? 0
});

export const DEFAULT_PUBLIC_STOCKPILE: ResourceInventory = createResourceInventory({
  food: 18,
  wood: 8,
  stone: 3,
  tools: 4,
  money: 500
});

export const cloneInventory = (inventory: ResourceInventory): ResourceInventory => createResourceInventory(inventory);
