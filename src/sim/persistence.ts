import type { CityState } from "./types";

const STORAGE_KEY = "agency.foundingLoopSnapshot.v1";
export const SIM_SNAPSHOT_SCHEMA_VERSION = 1;

type CityStateSnapshot = CityState & {
  schemaVersion: typeof SIM_SNAPSHOT_SCHEMA_VERSION;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const migrateCityStateSnapshot = (snapshot: unknown): CityStateSnapshot | null => {
  if (!isRecord(snapshot)) return null;

  if (snapshot.schemaVersion === undefined) {
    return {
      ...(snapshot as CityState),
      schemaVersion: SIM_SNAPSHOT_SCHEMA_VERSION
    };
  }

  if (snapshot.schemaVersion === SIM_SNAPSHOT_SCHEMA_VERSION) {
    return snapshot as CityStateSnapshot;
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
