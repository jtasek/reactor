import {
   createActionsHook,
   createEffectsHook,
   createReactionHook,
   createStateHook
} from 'overmind-react';

import { config } from '.';

export const useState = createStateHook<typeof config>();
export const useActions = createActionsHook<typeof config>();
export const useEffects = createEffectsHook<typeof config>();
export const useReaction = createReactionHook<typeof config>();

export const useControls = () => {
  return useState().ui;
}

export const useNavBar = () => {
  return useControls().navBar;
}

export const useEvents = () => {
  return useState().events;
}

export const useKeyboardState = () => {
  return useState().events.keyboard;
};

export const usePointerState = () => {
  return useState().events.pointer;
};

export const useCurrentDocument = () => {
  return useState().currentDocument;
};

export const useDocument = (id: string) => {
  return useState().documents[id];
};

export const useDocuments = () => {
  return useState().documents ?? [];
};

export const useShape = (id: string) => {
  return useCurrentDocument()?.shapes[id];
};

export const useShapes = () => {
  return useCurrentDocument()?.shapes ?? [];
};

export const useRuler = (id: string) => {
  return useCurrentDocument()?.rulers[id];
};

export const useRulers = () => {
  return useCurrentDocument()?.rulers ?? [];
};

export const useGroup = (id: string) => {
  return useCurrentDocument()?.groups[id];
};

export const useGroups = () => {
  return useCurrentDocument()?.groups ?? [];
};

export const useLayer = (id: string) => {
  return useCurrentDocument()?.layers[id];
};

export const useLayers = () => {
  return useCurrentDocument()?.layers ?? [];
};