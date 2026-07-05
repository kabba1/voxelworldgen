import type { CityCharter } from "./types";

export const CITY_CHARTER: CityCharter = {
  purpose: "Survive, build, and improve the city.",
  priorityOrder: ["food", "shelter", "health", "materials", "utilities", "knowledge", "commerce", "research"],
  laws: {
    agentsCanClaimEmptyPlots: true,
    publicResourcesRequireApprovedProject: true,
    emergencyFoodAccess: true,
    privateBusinessAllowed: true,
    taxesEnabled: false
  }
};
