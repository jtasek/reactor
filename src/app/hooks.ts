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

export const useKeyboardState = () => {
  return useState().events.keyboard;
};

export const usePointerState = () => {
  return useState().events.pointer;
};

export const useCurrentDocument = () => {
  return useState().currentDocument;
};

export const useDocuments = () => {
  return useState().documents ?? [];
};

export const useShapes = () => {
  return useCurrentDocument()?.shapes ?? [];
};

export const useRulers = () => {
  return useCurrentDocument()?.rulers ?? [];
};

export const useGroups = () => {
  return useCurrentDocument()?.groups ?? [];
};

export const useLayers = () => {
  return useCurrentDocument()?.layers ?? [];
};
