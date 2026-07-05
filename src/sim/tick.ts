import type { Agent, AgentNeedId, CityState } from "./types";
import { updateConstruction } from "./systems/construction";
import { updateProjects } from "./systems/projects";

export const TICKS_PER_DAY = 24;

const NEED_DECAY_PER_TICK: Record<AgentNeedId, number> = {
  food: 0.8,
  rest: 0.6,
  shelter: 0.15,
  money: 0.05,
  knowledge: 0.1
};

const clampNeed = (value: number) => Math.max(0, Math.min(100, value));

const decayAgentNeeds = (agent: Agent): Agent => ({
  ...agent,
  needs: {
    food: clampNeed(agent.needs.food - NEED_DECAY_PER_TICK.food),
    rest: clampNeed(agent.needs.rest - NEED_DECAY_PER_TICK.rest),
    shelter: clampNeed(agent.needs.shelter - NEED_DECAY_PER_TICK.shelter),
    money: clampNeed(agent.needs.money - NEED_DECAY_PER_TICK.money),
    knowledge: clampNeed(agent.needs.knowledge - NEED_DECAY_PER_TICK.knowledge)
  }
});

export const tickCityState = (state: CityState): CityState => {
  const nextTick = state.tick + 1;
  const decayedState: CityState = {
    ...state,
    tick: nextTick,
    day: Math.floor(nextTick / TICKS_PER_DAY) + 1,
    agents: state.agents.map(decayAgentNeeds)
  };

  return updateConstruction(updateProjects(decayedState));
};
