import { chooseAgentAction, generateValidActions, progressAgentActions, resolveAgentAction, updateAgentMovement } from "./actions";
import type { Agent, CityState } from "./types";

const NEED_DECAY = {
  food: 1.5,
  rest: 0.8,
  shelter: 0.45,
  money: 0.2,
  knowledge: 0.12
} as const satisfies Record<keyof Agent["needs"], number>;

const clampNeed = (value: number) => Math.max(0, Math.min(100, value));

const decayNeeds = (agent: Agent): Agent => ({
  ...agent,
  needs: {
    food: clampNeed(agent.needs.food - NEED_DECAY.food),
    rest: clampNeed(agent.needs.rest - NEED_DECAY.rest),
    shelter: clampNeed(agent.homeBuildingId === null ? agent.needs.shelter - NEED_DECAY.shelter : agent.needs.shelter + 0.35),
    money: clampNeed(agent.needs.money - NEED_DECAY.money),
    knowledge: clampNeed(agent.needs.knowledge - NEED_DECAY.knowledge)
  }
});

const advanceClock = (state: CityState): CityState => {
  const tick = state.tick + 1;
  return {
    ...state,
    tick,
    day: Math.floor(tick / 24) + 1
  };
};

export const tickCityState = (state: CityState): CityState => {
  let nextState: CityState = {
    ...advanceClock(state),
    agents: state.agents.map(decayNeeds)
  };

  nextState = updateAgentMovement(nextState);
  nextState = progressAgentActions(nextState);

  for (const agent of nextState.agents) {
    const latestAgent = nextState.agents.find((entry) => entry.id === agent.id);
    if (!latestAgent || latestAgent.currentAction !== null) continue;
    const validActions = generateValidActions(nextState, latestAgent);
    const action = chooseAgentAction(nextState, latestAgent, validActions);
    nextState = resolveAgentAction(nextState, latestAgent.id, action);
  }

  return nextState;
};
