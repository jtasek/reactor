// Selection overlays load with the editor, keeping projection code out of startup.
import { useAppState } from './hooks';
import {
    measuredBoxes,
    selectionMenuPlacement,
    snappedBox,
    selectionOverlay,
    type SelectionOverlay
} from './selectionOverlays';

/** Resolve geometry outside components that subscribe to every pointer move. */
export const useSelectionOverlay = () =>
    useAppState((state) => (state.events.pointer.dragging ? null : selectionOverlay(state)));

export const useSelectionMenuPlacement = (
    overlay: SelectionOverlay | null,
    alreadyShown: boolean
) => useAppState((state) => selectionMenuPlacement(state, alreadyShown, overlay));

export const useMeasuredBoxes = (overlay: SelectionOverlay | null) =>
    useAppState((state) => measuredBoxes(state, overlay));

export const useSnappedBox = () => useAppState(snappedBox);
