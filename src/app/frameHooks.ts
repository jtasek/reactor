import { canTransformScreenShape } from './screenViewEditing';
import { screenOwners, screenSourceShapes, screenViewName } from './screenViews';
import { withTheirGroups } from './membership';
import { hasSizingRules } from './stackSizing';
import {
    frameLayout,
    hasLayoutOffset,
    orderAtPosition,
    stackPosition,
    renderedFrame,
    renderedShape
} from './frameLayout';
// Only the editor page shows frames' controls, so these hooks load with it rather
// than with `hooks.ts`, which every page needs as it opens.
import { frameState, isFrameVisible, isFrameLocked } from './frameState';
import { frameParents, validFrameParent, frameMoveProblem } from './frameMembership';
import { isReadOnly } from './documentAccess';
import { isShapeLocked } from './utils';
import { explorerLayers, explorerTree } from './explorerTree';
import { useAppState } from './hooks';
import type { Document, Frame } from './types';

/** The current document's frames, without the one selected, then that one, so its handles are on top. */
export const useFramesIds = () =>
    useAppState((state) => {
        const document = state.currentDocument;

        if (document.editingComponentId) {
            return [];
        }

        const selected = document.selectedFrameId;
        const owners = screenOwners(document.frames);
        const canvasIds = document.framesIds.filter((id) => !owners.get(id));

        return [
            ...canvasIds.filter((id) => id !== selected && isFrameVisible(document, id)),
            ...canvasIds.filter((id) => id === selected && isFrameVisible(document, id))
        ];
    });

export const useSelectedFrameId = () =>
    useAppState((state) => state.currentDocument.selectedFrameId);

/** Each Explorer view builds only its own tree; the hidden one reads nothing. */
export const useExplorerTree = (shown = true) =>
    useAppState((state) =>
        shown ? explorerTree(state.currentDocument, state.currentDocument.filter) : undefined
    );

export const useExplorerLayers = (shown = true) =>
    useAppState((state) =>
        shown ? explorerLayers(state.currentDocument, state.currentDocument.filter) : undefined
    );

export const useExplorerView = () => useAppState((state) => state.config.explorerView);

/** The frames' names, sorted, reading only what the explorer's rows show. */
export const useFrameRows = () =>
    useAppState((state) => {
        const document = state.currentDocument;
        const { frames, framesIds } = document;
        const parents = frameParents(frames);

        return framesIds
            .map((id) => ({
                id,
                name: screenViewName(document, frames[id]),
                kind: frames[id].kind,
                screenId: frames[id].screenId,
                size: frames[id].size,
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
                    candidate.kind !== 'view' &&
                    (frameId === undefined ||
                        validFrameParent(document.frames, frameId, candidate.id))
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
            lockedBy === undefined ? '' : `Locked by frame ${document.frames[lockedBy].name}.`,
            hiddenBy === undefined && lockedBy === undefined
                ? ''
                : 'Use Explorer to show or unlock the frame.'
        ]
            .filter(Boolean)
            .join(' ');

        return {
            restriction: [
                restriction,
                (
                    frame
                        ? frameLayout(document).managedFrames.has(frame.id)
                        : hasLayoutOffset(document, shapeIds)
                )
                    ? 'Stack placement controls canvas transforms. Change the size in Inspector or choose another parent.'
                    : ''
            ]
                .filter(Boolean)
                .join(' '),
            orderShapeIds: [...withTheirGroups(document, shapeIds, null)],
            ...stackSlot(document, frame, shapeIds),
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

/** Sizing controls currently support frames and individual upright stack rectangles. */
export const useSizingTarget = (frameId?: string, shapeId?: string) =>
    useAppState((state) => {
        const document = state.currentDocument;
        const shape = shapeId === undefined ? undefined : document.shapes[shapeId];
        const frame = frameId === undefined ? undefined : document.frames[frameId];
        const target = frame ?? shape;
        const supported =
            Boolean(frame) ||
            Boolean(
                shape?.type === 'rectangle' &&
                !shape.rotation &&
                document.frames[shape.parentFrameId ?? '']?.stack &&
                !Object.values(document.groups).some((group) =>
                    group.shapesIds.includes(shape.id)
                ) &&
                !document.componentMembersIds.has(shape.id)
            );

        const shownFrame = frame ? renderedFrame(document, frame.id) : undefined;
        const shownShape = supported && shape ? renderedShape(document, shape.id) : undefined;

        return {
            documentId: document.id,
            shownSize: shownFrame
                ? { ...shownFrame.size }
                : shownShape?.type === 'rectangle'
                  ? { ...shownShape.size }
                  : undefined,
            supported,
            sizing: {
                ...(target?.sizing?.width ? { width: { ...target.sizing.width } } : {}),
                ...(target?.sizing?.height ? { height: { ...target.sizing.height } } : {})
            },
            size: frame?.size ?? (shape?.type === 'rectangle' ? shape.size : undefined),
            problem: target
                ? (frameLayout(document).problems[target.id] ??
                  (!supported && hasSizingRules(target.sizing)
                      ? 'Sizing rules require an unrotated, ungrouped rectangle in a stack. Intrinsic size is retained.'
                      : undefined))
                : undefined,
            disabled:
                !target ||
                document.locked ||
                isReadOnly(state) ||
                state.events.pointer.gesture.kind !== 'idle' ||
                Boolean(frame && isFrameLocked(document, frame.id)) ||
                Boolean(shape && isShapeLocked(document, shape.id))
        };
    });

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

/**
 * Where the frame, or the selected shapes as one slot, stand in their stack, and the
 * layout order that moves them to another place; nothing when they fill no one slot.
 */
function stackSlot(document: Document, frame: Frame | undefined, shapeIds: string[]) {
    const layout = frameLayout(document);
    const kind = frame ? 'frame' : 'shape';
    const ids = frame ? [frame.id] : shapeIds;
    const stackId = frame ? frame.parentFrameId : document.shapes[shapeIds[0] ?? '']?.parentFrameId;

    if (stackId === undefined || ids.length === 0) {
        return { inStack: false, stackSize: 0 };
    }

    const positions = new Set(ids.map((id) => stackPosition(layout, stackId, kind, id)));
    const [position] = positions;

    if (positions.size !== 1 || position === undefined) {
        return { inStack: false, stackSize: 0 };
    }

    return {
        inStack: true,
        stackPosition: position,
        stackSize: layout.slots[stackId].length,
        orderAt: (target: number) => orderAtPosition(layout, stackId, kind, ids[0], target)
    };
}

/** Source geometry is measured but never painted as another canvas placement. */
export const useScreenSourceShapes = () =>
    useAppState((state) =>
        state.currentDocument.editingComponentId
            ? new Set<string>()
            : screenSourceShapes(state.currentDocument)
    );

export const useScreenSourceGroup = (groupId: string) =>
    useAppState((state) => {
        const document = state.currentDocument;
        const ids = screenSourceShapes(document);

        return document.groups[groupId]?.shapesIds.some((id) => ids.has(id));
    });

export const useScreenSourceSelection = () =>
    useAppState((state) => {
        const document = state.currentDocument;
        const source = screenSourceShapes(document);

        return (
            document.selectedShapesIds.some((id) => source.has(id)) ||
            document.frames[document.selectedFrameId ?? '']?.kind === 'screen'
        );
    });

export const useFrameName = (id: string) =>
    useAppState((state) => screenViewName(state.currentDocument, state.currentDocument.frames[id]));

/** Mounted only for selected artwork; placement permissions are checked by its view. */
export const useScreenShapeTransformable = (viewId: string, shapeId: string) =>
    useAppState((state) => {
        const document = state.currentDocument;
        const screenId = document.frames[viewId]?.screenId;

        return Boolean(screenId && canTransformScreenShape(document, screenId, shapeId));
    });
