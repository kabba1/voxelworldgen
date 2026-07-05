import type { CityState } from "./types";

const MAX_EVENT_COUNT = 10;

export const appendCityEvents = (state: CityState, events: readonly string[]): CityState => {
  if (events.length === 0) return state;
  return {
    ...state,
    events: [...state.events, ...events].slice(-MAX_EVENT_COUNT)
  };
};

export const appendCityEvent = (state: CityState, event: string): CityState => appendCityEvents(state, [event]);
