import { json } from 'overmind';
import {
    createActionsHook,
    createEffectsHook,
    createReactionHook,
    createStateHook
} from 'overmind-react';
import { commandsFor, commandsIn, getCommand, getCommands } from './actions';
import { Context } from '.';
import { useCallback, useEffect, useLayoutEffect, useReducer, useState } from 'react';
import { isShapeLocked, isShapeVisible } from './utils';
import type { Command, CommandPlace, CommandScope } from './types';
import { takesEditorInput } from '../events/input';
import { KEEPS_SHAPE_BOUNDS } from '../events/gestures';
import { placeSelectionMenu } from './selectionMenu';
import {
    groupFrame,
    hoveredGroupsIds,
    outline,
    selectedGroupsIdsOf,
    selectionScope
} from './membership';

export const useActions = createActionsHook<Context>();
export const useEffects = createEffectsHook<Context>();
export const useReaction = createReactionHook<Context>();
const useRootState = createStateHook<Context>();

/**
 * What `select` reads from the state. overmind-react runs a selector before
 * it starts tracking the component, which subscribes whichever component rendered
 * before to what the selector reads; selecting here, after it, subscribes this one.
 */
export const useAppState = <T>(select: (state: Context['state']) => T): T => {
    return select(useRootState());
};

export const useConfig = () => {
    return useAppState((state) => state.config);
};

export const useDocumentReset = () =>
    useAppState((state) =>
        state.resetDocumentId === state.currentDocumentId
            ? state.documents[state.resetDocumentId]?.name
            : undefined
    );

export const useDebugMode = () => {
    return useConfig().debugMode;
};

export const useCommand = (commandId: string) => {
    return getCommand(commandId);
};

export const useCommands = () => {
    return getCommands();
};

/** The commands offered in `place`: see `commandsIn`. */
export const usePlacedCommands = (place: CommandPlace) => commandsIn(place);

/** The commands an item of `scope` offers in its menu: see `commandsFor`. */
export const useScopedCommands = (scope: CommandScope | null) =>
    scope === null ? [] : commandsFor(scope);

/** The commands the selection takes, those that can run now, in menu order. */
export const useSelectionCommands = () => {
    const scope = useAppState((state) => selectionScope(state.currentDocument));
    const commands = useScopedCommands(scope);
    const enabled = useAppState((state) =>
        commands.map((command) => command.canExecute({ state }))
    );

    return commands.filter((_, index) => enabled[index]);
};

/** Whether each of `commands` can run now, in their order. */
export const useCommandsEnabled = (commands: Command[]) =>
    useAppState((state) => commands.map((command) => command.canExecute({ state })));

/** How many selected items Align and Space may move: see `movableSelectedItems`. */
export const useMovableSelectedItemsCount = () =>
    useAppState((state) => state.currentDocument.movableSelectedItems.length);

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

/** The image the image tool draws, once one is chosen. */
export const useImageToPlace = () => {
    return useAppState((state) => state.tools.imageToPlace);
};

/**
 * An address to show an image shape's `source` from: asked from the kept images
 * for an asset, so none until it is found.
 */
export const useImageUrl = (source: string) => {
    const { assets } = useEffects();
    const [found, setFound] = useState<{ source: string; url?: string }>();

    useEffect(() => {
        let current = true;

        void assets.url(source).then((url) => {
            if (current) {
                setFound({ source, url });
            }
        });

        return () => {
            current = false;
        };
    }, [assets, source]);

    return found?.source === source ? found.url : undefined;
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

export const useNotifications = () => {
    return useAppState((state) => state.notifications);
};

export const useCurrentPage = () => {
    return useAppState((state) => state.currentPage);
};

/** Whether the editor takes shortcuts and the clipboard now. */
export const useTakesEditorInput = () => {
    return useAppState(takesEditorInput);
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
/** Whether shapes are measured where drawn: not while a gesture keeps their bounds itself. */
export const useMeasuringShapes = () =>
    useAppState((state) => !KEEPS_SHAPE_BOUNDS[state.events.pointer.gesture.kind]);

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

/** Shape ids in draw order, copied so a render tracks the list rather than each id. */
export const useShapesIds = () => {
    return useAppState((state) => json(state.currentDocument.shapesIds));
};

export const useGuide = (id: string) => {
    return useCurrentDocument()?.guides[id];
};

export const useGuides = () => {
    return useCurrentDocument()?.guides ?? [];
};

export const useGroup = (id: string) => {
    return useCurrentDocument()?.groups[id];
};

/** The groups selected as one. */
export const useSelectedGroupsIds = () => {
    return useAppState((state) => selectedGroupsIdsOf(state.currentDocument, state.enteredGroupId));
};

/** Where the selection's menu goes; none without a selection or during a drag. */
export const useSelectionMenuPlacement = (alreadyShown: boolean) => {
    return useAppState((state) => {
        const { pointer } = state.events;

        if (pointer.dragging) {
            return null;
        }

        const { selectionExtent, camera } = state.currentDocument;

        return selectionExtent
            ? placeSelectionMenu(selectionExtent, camera, pointer, alreadyShown)
            : null;
    });
};

/** The groups the pointer highlights: see `hoveredGroupsIds`. */
export const useHoveredGroupsIds = () => {
    return useAppState((state) =>
        hoveredGroupsIds(state.currentDocument, state.enteredGroupId, state.events.pointer)
    );
};

/** Whether the group is selected as one. */
export const useGroupSelected = (id: string) => {
    return useAppState((state) =>
        selectedGroupsIdsOf(state.currentDocument, state.enteredGroupId).includes(id)
    );
};

/** Where a group is drawn: its box and rotation, none when no shape of it is shown. */
export const useGroupFrame = (id: string) => {
    return useAppState((state) => {
        const group = state.currentDocument.groups[id];

        return group ? groupFrame(state.currentDocument, group) : null;
    });
};

/** Whether a group, or any of its shapes, is locked, so it cannot be resized or rotated. */
export const useGroupLocked = (id: string) => {
    return useAppState((state) => {
        const document = state.currentDocument;
        const group = document.groups[id];

        return !group || group.shapesIds.some((shapeId) => isShapeLocked(document, shapeId));
    });
};

/**
 * The shapes of the groups not double-clicked into, which are not highlighted
 * one by one under the pointer, as a press there selects their group.
 */
export const useShapesInClosedGroupsIds = () => {
    return useAppState((state) =>
        Object.values(state.currentDocument.groups)
            .filter((group) => group.id !== state.enteredGroupId)
            .flatMap((group) => group.shapesIds)
    );
};

/** The shapes of the groups selected as one, which draw one selection for them. */
export const useShapesInSelectedGroupsIds = () => {
    return useAppState((state) => {
        const { groups } = state.currentDocument;

        return selectedGroupsIdsOf(state.currentDocument, state.enteredGroupId).flatMap(
            (id) => groups[id].shapesIds
        );
    });
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

/** The document as a tree of layers, their groups and shapes. */
export const useOutline = () => {
    return useAppState((state) => outline(state.currentDocument));
};

/** The one layer this screen shows, if it shows only one. */
export const useShownLayerId = () => {
    return useAppState((state) => {
        const { layers, shownLayerId } = state.currentDocument;

        return shownLayerId && layers[shownLayerId] ? shownLayerId : undefined;
    });
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
