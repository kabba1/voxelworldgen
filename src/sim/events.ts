import type { CityState, SimEvent } from "./types";

const MAX_EVENT_COUNT = 2000;

export const appendCityEvents = (state: CityState, events: readonly string[]): CityState => {
  if (events.length === 0) return state;
  return {
    ...state,
    events: [...state.events, ...events].slice(-MAX_EVENT_COUNT)
  };
};

export const appendCityEvent = (state: CityState, event: string): CityState => appendCityEvents(state, [event]);

export const appendSimEvent = (state: CityState, event: Omit<SimEvent, "id" | "tick" | "day">): CityState => {
  const fullEvent: SimEvent = {
    ...event,
    id: `event-${state.tick}-${state.structuredEvents.length + 1}`,
    tick: state.tick,
    day: state.day
  };

  return {
    ...state,
    structuredEvents: [...state.structuredEvents, fullEvent].slice(-MAX_EVENT_COUNT),
    events: [...state.events, fullEvent.summary].slice(-MAX_EVENT_COUNT)
  };
};
