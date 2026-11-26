// Selection overlays load with the editor, keeping projection code out of startup.
import { useRef } from 'react';
import { useAppState } from './hooks';
import { localComponents } from './componentSelection';
import { editorHelpers, editorLoaded } from './editorHelpers';
import { sharedProperties, type PropertyRow } from './properties';
import { useStoreAnswer } from './storeAnswer';
import {
    measuredBoxes,
    selectionMenuPlacement,
    snappedBox,
    selectionOverlay,
    type SelectionOverlay
} from './selectionOverlays';

/** Selection changes need not repaint the selected shape's artwork. */
export const useShapeSelected = (shapeId: string) =>
    useAppState((state) => state.currentDocument.shapes[shapeId]?.selected ?? false);

/**
 * Resolve geometry outside components that subscribe to every pointer move. A
 * placed Screen view is read through every shape of it: see `useStoreAnswer`.
 */
export const useSelectionOverlay = () =>
    useStoreAnswer((state) => (state.events.pointer.dragging ? null : selectionOverlay(state)), []);

export const useSelectionMenuPlacement = (
    overlay: SelectionOverlay | null,
    alreadyShown: boolean
) => useAppState((state) => selectionMenuPlacement(state, alreadyShown, overlay));

export const useMeasuredBoxes = (overlay: SelectionOverlay | null) =>
    useAppState((state) => measuredBoxes(state, overlay));

export const useSnappedBox = () => useAppState(snappedBox);

/**
 * The properties the selected shapes share, as the inspector lists them. During a
 * gesture the shapes are read untracked, and during a marquee the selection too,
 * so its moves do not render the inspector again; it shows the new values as the
 * gesture ends.
 * A placed Screen view is read through every shape of it: see `useStoreAnswer`.
 */
export const useSelectedShapesProperties = () => {
    const held = useRef<PropertyRow[]>([]);

    return useStoreAnswer((state) => {
        const document = state.currentDocument;
        const { kind } = state.events.pointer.gesture;

        if (kind !== 'idle') {
            return held.current;
        }

        const rows = sharedProperties(document.selectedShapes, document);
        if (state.events.pointer.screenView && editorLoaded()) {
            held.current = editorHelpers().pointer.selectedViewProperties(state, rows);

            return held.current;
        }
        held.current = rows;

        return held.current;
    }, []);
};

/**
 * The shapes of the groups not double-clicked into, which are not highlighted
 * one by one under the pointer, as a press there selects their group.
 */
export const useShapesInClosedGroupsIds = () => {
    return useAppState((state) => {
        const document = state.currentDocument;
        const entered = new Set(
            (state.enteredComponentId &&
                document.components[state.enteredComponentId]?.shapesIds) ||
                []
        );
        return [
            ...Object.values(document.groups)
                .filter((group) => group.id !== state.enteredGroupId)
                .flatMap((group) => group.shapesIds)
                .filter((id) => !entered.has(id)),
            ...localComponents(document)
                .filter((component) => component.id !== state.enteredComponentId)
                .flatMap((component) => component.shapesIds)
        ];
    });
};

/** The shapes of the groups selected as one, which draw one selection for them. */
export const useShapesInSelectedGroupsIds = () => {
    return useAppState((state) => {
        const { groups } = state.currentDocument;

        const document = state.currentDocument;
        const entered = new Set(
            (state.enteredComponentId &&
                document.components[state.enteredComponentId]?.shapesIds) ||
                []
        );
        return [
            ...document.selectedGroupsIds
                .flatMap((id) => groups[id].shapesIds)
                .filter((id) => !entered.has(id)),
            ...document.selectedComponentsIds.flatMap((id) => document.components[id].shapesIds)
        ];
    });
};
