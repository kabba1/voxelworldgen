import type { CityState } from "./types";

const STORAGE_KEY = "agency.foundingLoopSnapshot.v1";

export const saveCityState = (state: CityState) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const loadCityState = (): CityState | null => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as CityState;
  } catch (error) {
    console.warn("Failed to load saved city state.", error);
    return null;
  }
};

export const clearSavedCityState = () => {
  window.localStorage.removeItem(STORAGE_KEY);
};
