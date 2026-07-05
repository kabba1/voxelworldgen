import type { BuildingType, CityState } from "./types";

export type CityNeeds = {
  population: number;
  housingCapacity: number;
  housingGap: number;
  foodStockpile: number;
  foodBuildings: number;
  openPlotCount: number;
  activeProjectCount: number;
};

export const selectCityNeeds = (state: CityState): CityNeeds => {
  const population = state.agents.length;
  const housingCapacity = state.buildings
    .filter((building) => building.type === "home")
    .reduce((total, building) => total + building.capacity, 0);
  const buildingFood = state.buildings
    .filter((building) => building.type === "food")
    .reduce((total, building) => total + building.inventory.food, 0);
  const foodBuildings = state.buildings.filter((building) => building.type === "food").length;

  return {
    population,
    housingCapacity,
    housingGap: Math.max(0, population - housingCapacity),
    foodStockpile: state.publicStockpile.food + buildingFood,
    foodBuildings,
    openPlotCount: state.availablePlotIds.length,
    activeProjectCount: state.projects.filter((project) => project.status === "active").length
  };
};

export const selectCompletedBuildingTypeCounts = (state: CityState): Partial<Record<BuildingType, number>> =>
  state.buildings.reduce<Partial<Record<BuildingType, number>>>(
    (counts, building) => ({
      ...counts,
      [building.type]: (counts[building.type] ?? 0) + 1
    }),
    {}
  );
