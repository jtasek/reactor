import {
  createActionsHook,
  createEffectsHook,
  createHook,
  createReactionHook,
  createStateHook
} from 'overmind-react';

import { config } from '.';

export const useApp = createHook<typeof config>();
export const useState = createStateHook<typeof config>();
export const useActions = createActionsHook<typeof config>();
export const useEffects = createEffectsHook<typeof config>();
export const useReaction = createReactionHook<typeof config>();
