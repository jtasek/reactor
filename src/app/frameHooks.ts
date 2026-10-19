// Only the editor page shows frames' controls, so these hooks load with it rather
// than with `hooks.ts`, which every page needs as it opens.
import { useAppState } from './hooks';

/** The current document's frames, without the one selected, then that one, so its handles are on top. */
export const useFramesIds = () =>
    useAppState((state) => {
        const document = state.currentDocument;

        if (document.editingComponentId) {
            return [];
        }

        const selected = document.selectedFrameId;

        return [
            ...document.framesIds.filter((id) => id !== selected),
            ...document.framesIds.filter((id) => id === selected)
        ];
    });

export const useSelectedFrameId = () =>
    useAppState((state) => state.currentDocument.selectedFrameId);

/** The frames' names, sorted, reading only what the explorer's rows show. */
export const useFrameRows = () =>
    useAppState((state) => {
        const { frames, framesIds } = state.currentDocument;

        return framesIds
            .map((id) => ({
                id,
                name: frames[id].name,
                visible: frames[id].visible,
                locked: frames[id].locked
            }))
            .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    });

/** How many items are selected: the shapes, or the frame. */
export const useSelectionCount = () =>
    useAppState(
        (state) =>
            state.currentDocument.selectedShapesIds.length +
            Number(Boolean(state.currentDocument.selectedFrameId))
    );
