import { json } from 'overmind';
import {
    createActionsHook,
    createEffectsHook,
    createReactionHook,
    createStateHook
} from 'overmind-react';
import { getCommand, getCommands } from './actions';
import { Context } from '.';
import { useCallback, useLayoutEffect, useReducer } from 'react';
import { isShapeLocked, isShapeVisible } from './utils';
import type { Command } from './types';

export const useActions = createActionsHook<Context>();
export const useEffects = createEffectsHook<Context>();
export const useReaction = createReactionHook<Context>();
export const useAppState = createStateHook<Context>();

export const useConfig = () => {
    return useAppState((state) => state.config);
};

export const useDebugMode = () => {
    return useConfig().debugMode;
};

export const useCommand = (commandId: string) => {
    return getCommand(commandId);
};

export const useCommands = () => {
    return getCommands();
};

/** Whether `command` can run now; re-renders when the state its guard reads changes. */
export const useCommandEnabled = (command: Command) => {
    return useAppState((state) => command.canExecute({ state }));
};

export const useComponent = (id: string) => {
    return useCurrentDocument()?.components[id];
};

export const useComponents = () => {
    return useCurrentDocument()?.components;
};

export const useEvents = () => {
    return useAppState((state) => state.events);
};

export const useKeyboard = () => {
    return useAppState((state) => state.events.keyboard);
};

export const usePointer = () => {
    return useAppState((state) => state.events.pointer);
};

export const useTools = () => {
    return useAppState((state) => state.tools);
};

export const useControls = () => {
    return useAppState((state) => state.ui);
};

export const useCurrentDocument = () => {
    return useAppState((state) => state.currentDocument);
};

export const useCurrentPage = () => {
    return useAppState((state) => state.currentPage);
};

export const useLoading = () => {
    return useAppState((state) => state.loading);
};

/**
 * Whether this copy's documents are saved and synced. It changes on its own, also
 * while the editor's page first renders, before overmind-react listens for
 * changes, so it is read again once the page shows.
 */
export const useSaveStatus = () => {
    const status = useAppState((state) => state.saveStatus);
    const reaction = useReaction();
    const [, catchUp] = useReducer((renders: number) => renders + 1, 0);

    useLayoutEffect(() => {
        const stop = reaction(
            (state) => state.saveStatus.kind,
            (kind) => {
                if (kind !== status.kind) {
                    catchUp();
                }
            },
            { immediate: true }
        );

        stop();
    }, [reaction, status.kind]);

    return status;
};

export const useAccount = () => {
    return useAppState((state) => state.account);
};

export const useCamera = () => {
    return useAppState((state) => state.currentDocument.camera);
};

/** The camera's zoom, for overlays drawn at a constant size on screen. */
export const useCameraScale = () => {
    return useAppState((state) => state.currentDocument.camera.scale);
};

export const useDocument = (id: string) => {
    return useAppState((state) => state.documents[id]);
};

export const useDocuments = () => {
    return useAppState((state) => state.documents) ?? [];
};

export const useDocumentsIds = () => {
    return useAppState((state) => state.documentsIds);
};

export const useCurrentDocumentId = () => {
    return useAppState((state) => state.currentDocumentId);
};

export const useShape = (id: string) => {
    return useCurrentDocument()?.shapes[id];
};

/** Whether the shape is drawn: see `isShapeVisible`. */
export const useShapeVisible = (id: string) => {
    return useAppState((state) => isShapeVisible(state.currentDocument, id));
};

/** Whether the shape can be edited: see `isShapeLocked`. */
export const useShapeLocked = (id: string) => {
    return useAppState((state) => isShapeLocked(state.currentDocument, id));
};

export const useShapes = () => {
    return useCurrentDocument()?.shapes ?? [];
};

/**
 * Shape ids in draw order, copied so a render tracks the list rather than each id.
 * The current document is read after tracking starts, so replacing or switching
 * documents re-renders too.
 */
export const useShapesIds = () => {
    const state = useAppState();

    return json(state.currentDocument.shapesIds);
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

export const useLog = () => {
    const debugMode = useDebugMode();

    return useCallback(
        (message?: unknown, ...optionalParams: unknown[]) => {
            if (debugMode) {
                console.info(message, ...optionalParams);
            }
        },
        [debugMode]
    );
};
