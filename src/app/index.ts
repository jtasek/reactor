import { IConfig } from 'overmind';
import {
  createActionsHook,
  createEffectsHook,
  createHook,
  createReactionHook,
  createStateHook
} from 'overmind-react';
import { merge, namespaced } from 'overmind/config';

import * as actions from './actions';
import * as effects from './effects';

// Modules
import * as events from '../events';
import * as tools from '../tools';
import * as ui from '../ui';

import { onInitialize } from './onInitialize';
import { state } from './state';

export const config = merge(
  {
    actions,
    effects,
    onInitialize,
    state
  },
  namespaced({
    events,
    tools,
    ui
  })
);

declare module 'overmind' {
  // Due to circular typing we have to define an
  // explicit typing of state, actions and effects since
  // TS 3.9
  interface Config
    extends IConfig<{
      state: typeof config.state;
      actions: typeof config.actions;
      effects: typeof config.effects;
    }> {}
}

// declare module 'overmind' {
//   type Config = IConfig<typeof config>;
// }

export const useApp = createHook<typeof config>();
export const useState = createStateHook<typeof config>();
export const useActions = createActionsHook<typeof config>();
export const useEffects = createEffectsHook<typeof config>();
export const useReaction = createReactionHook<typeof config>();
