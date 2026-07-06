import type { CityState } from "./types";

const STORAGE_KEY = "agency.foundingLoopSnapshot.v1";
export const SIM_SNAPSHOT_SCHEMA_VERSION = 2;

type CityStateSnapshot = CityState & {
  schemaVersion: typeof SIM_SNAPSHOT_SCHEMA_VERSION;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const migrateCityStateSnapshot = (snapshot: unknown): CityStateSnapshot | null => {
  if (!isRecord(snapshot)) return null;

  if (snapshot.schemaVersion === undefined || snapshot.schemaVersion === 1 || snapshot.schemaVersion === SIM_SNAPSHOT_SCHEMA_VERSION) {
    const state = snapshot as CityState;
    return {
      ...state,
      schemaVersion: SIM_SNAPSHOT_SCHEMA_VERSION,
      pathRects: Array.isArray(state.pathRects) ? state.pathRects : [],
      agents: Array.isArray(state.agents)
        ? state.agents.map((agent) => ({
            ...agent,
            route: Array.isArray(agent.route) ? agent.route : []
          }))
        : []
    };
  }

  return null;
};

export const saveCityState = (state: CityState) => {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...state,
      schemaVersion: SIM_SNAPSHOT_SCHEMA_VERSION
    } satisfies CityStateSnapshot)
  );
};

export const loadCityState = (): CityState | null => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const migrated = migrateCityStateSnapshot(JSON.parse(raw));
    if (migrated) return migrated;
    console.warn("Saved city state uses an unsupported schema and was reset.");
    clearSavedCityState();
    return null;
  } catch (error) {
    console.warn("Failed to load saved city state.", error);
    clearSavedCityState();
    return null;
  }
};

export const clearSavedCityState = () => {
  window.localStorage.removeItem(STORAGE_KEY);
};
