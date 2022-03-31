import { IContext } from 'overmind';
import {
  createActionsHook,
  createEffectsHook,
  createReactionHook,
  createStateHook
} from 'overmind-react';

import { config } from '.';
import { getCommand, getCommands } from './actions';

export type Context = IContext<typeof config>;

export const useActions = createActionsHook<Context>();
export const useEffects = createEffectsHook<Context>();
export const useReaction = createReactionHook<Context>();
export const useAppState = createStateHook<Context>();

export const useCommand = (commandId: string) => {
  return getCommand(commandId);
}

export const useCommands = () => {
  return getCommands();
}

export const useComponent = (id: string) => {
  return useCurrentDocument()?.components[id];
};

export const useComponents = () => {
  return useCurrentDocument()?.components;
}

export const useEvents = () => {
  return useAppState((state) => state.events);
};

export const useKeyboardState = () => {
  return useAppState(state => state.events.keyboard);
};

export const usePointerState = () => {
  return useAppState(state => state.events.pointer);
};

export const useCurrentDocument = () => {
  return useAppState(state => state.currentDocument);
};

export const useDocument = (id: string) => {
  return useAppState(state => state.documents[id]);
};

export const useDocuments = () => {
  return useAppState(state => state.documents)  ?? [];
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

export const useLink = (id: string) => {
  return useCurrentDocument()?.links[id];
};

export const useLinks = () => {
  return useCurrentDocument()?.links ?? [];
};

export const useLayer = (id: string) => {
  return useCurrentDocument()?.layers[id];
};

export const useLayers = () => {
  return useCurrentDocument()?.layers ?? [];
};
