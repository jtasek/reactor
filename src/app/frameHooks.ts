// Only the editor page shows frames' controls, so these hooks load with it rather
// than with `hooks.ts`, which every page needs as it opens.
import { frameState, isFrameVisible, isFrameLocked } from './frameState';
import { frameParents, validFrameParent, frameMoveProblem } from './frameMembership';
import { isReadOnly } from './documentAccess';
import { isShapeLocked } from './utils';
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
            ...document.framesIds.filter((id) => id !== selected && isFrameVisible(document, id)),
            ...document.framesIds.filter((id) => id === selected && isFrameVisible(document, id))
        ];
    });

export const useSelectedFrameId = () =>
    useAppState((state) => state.currentDocument.selectedFrameId);

/** The frames' names, sorted, reading only what the explorer's rows show. */
export const useFrameRows = () =>
    useAppState((state) => {
        const document = state.currentDocument;
        const { frames, framesIds } = document;
        const parents = frameParents(frames);

        return framesIds
            .map((id) => ({
                id,
                name: frames[id].name,
                parentFrameId: parents.get(id),
                visible: frames[id].visible,
                shown: isFrameVisible(document, id),
                inheritedLock: Boolean(
                    frameState(document, id)?.lockedBy && frameState(document, id)?.lockedBy !== id
                ),
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

/** Plain field values let the Inspector track just the membership controls it shows. */
export const useFrameParent = (frameId: string | undefined, shapeIds: string[]) =>
    useAppState((state) => {
        const document = state.currentDocument;
        const parents = frameParents(document.frames);
        const frame = frameId === undefined ? undefined : document.frames[frameId];
        const shapes = shapeIds.map((id) => document.shapes[id]).filter(Boolean);
        const values = new Set(shapes.map((shape) => shape.parentFrameId ?? ''));
        const value = frame
            ? (parents.get(frame.id) ?? '')
            : values.size === 1
              ? [...values][0]
              : 'mixed';
        const choices = Object.values(document.frames)
            .filter(
                (candidate) =>
                    frameId === undefined ||
                    validFrameParent(document.frames, frameId, candidate.id)
            )
            .map((candidate) => ({
                id: candidate.id,
                name: candidate.name,
                locked: isFrameLocked(document, candidate.id)
            }))
            .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
        const problem =
            frame?.parentFrameId !== undefined && parents.get(frame.id) === undefined
                ? 'Invalid parent reference. Shown on Canvas; choose a parent to repair it.'
                : undefined;

        const restrictionIds = frame
            ? [frameState(document, frame.id)]
            : shapes.map((shape) => frameState(document, shape.parentFrameId));
        const hiddenBy = restrictionIds.find(
            (item) => item?.hiddenBy !== undefined && item.hiddenBy !== frameId
        )?.hiddenBy;
        const lockedBy = restrictionIds.find(
            (item) => item?.lockedBy !== undefined && item.lockedBy !== frameId
        )?.lockedBy;
        const restriction = [
            hiddenBy === undefined ? '' : `Hidden by frame ${document.frames[hiddenBy].name}.`,
            lockedBy === undefined ? '' : `Locked by frame ${document.frames[lockedBy].name}.`
        ]
            .filter(Boolean)
            .join(' ');

        return {
            restriction,
            value: problem ? (frame?.parentFrameId ?? '') : value,
            choices,
            problem,
            disabled:
                document.locked ||
                isReadOnly(state) ||
                state.events.pointer.gesture.kind !== 'idle' ||
                Boolean(document.editingComponentId) ||
                Boolean(frame && isFrameLocked(document, frame.id)) ||
                shapes.some(
                    (shape) =>
                        isShapeLocked(document, shape.id) ||
                        document.componentMembersIds.has(shape.id)
                )
        };
    });

export const useFrameMoveProblem = (id: string) =>
    useAppState((state) => frameMoveProblem(state.currentDocument, id));

export const useFrameLocked = (id: string) =>
    useAppState((state) => isFrameLocked(state.currentDocument, id));

export const useShapesFrameState = (ids: string[]) =>
    useAppState((state) => {
        const document = state.currentDocument;
        const restrictions = ids.map((id) =>
            frameState(document, document.shapes[id]?.parentFrameId)
        );

        return {
            hidden: restrictions.some((item) => item?.hiddenBy !== undefined),
            locked: restrictions.some((item) => item?.lockedBy !== undefined)
        };
    });
