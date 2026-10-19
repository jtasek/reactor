import type { ActionWithResult, ActionWithParamAndResult, Application, Point } from './types';
import type { Context } from './index';
import type { PasteResult } from './clipboard';
import { createShape } from './factories';
import { componentSource } from './componentSource';
import { focusedSourceOnlyId } from './componentSelection';
import { shownGroupShapesIds } from './membership';
import { isShapeLocked } from './utils';
import { screenToWorld } from './camera';
import { untracked } from './untracked';
import { editorHelpers } from './editorHelpers';
import { takesEditorInput } from 'src/events/input';

const clipboardFormat = () => editorHelpers().clipboard;

/** The selection commands act on, shown shapes only, in drawing order. */
const selectedInDrawOrder = ({ currentDocument }: Application) => {
    const selected = new Set(currentDocument.selectedShapesIds);

    return currentDocument.shapesIds
        .filter((id) => selected.has(id))
        .map((id) => currentDocument.shapes[id]);
};

/** The groups selected as one, with the shapes of theirs that are shown, as only those are copied. */
const selectedGroups = ({ currentDocument }: Application) =>
    currentDocument.selectedGroupsIds.map((id) => {
        const group = currentDocument.groups[id];

        return { ...group, shapesIds: shownGroupShapesIds(currentDocument, group) };
    });

/** Copy a selected source as one live instance, alongside any other selected shapes. */
const selectedForCopy = (state: Application) => {
    const document = state.currentDocument;
    const focusedSourceId = focusedSourceOnlyId(state);
    const sourceInstance = (componentId: string, order: string) => {
        const source = componentSource(document, componentId);

        if (!source) {
            return null;
        }

        return createShape({
            type: 'instance',
            componentId,
            position: source.box.topLeft,
            overrides: {},
            name: document.components[componentId].name,
            order
        });
    };
    const sources = new Map(
        document.selectedComponentsIds.flatMap((id) =>
            document.components[id].shapesIds.map((shapeId) => [shapeId, id] as const)
        )
    );
    const copiedSources = new Set<string>();

    const selected = selectedInDrawOrder(state).flatMap((shape) => {
        const componentId = sources.get(shape.id);

        if (!componentId) {
            return [shape];
        }
        if (copiedSources.has(componentId)) {
            return [];
        }
        copiedSources.add(componentId);
        const instance = sourceInstance(componentId, shape.order);

        return instance ? [instance] : [];
    });

    if (!focusedSourceId) {
        return selected;
    }
    const firstId = document.components[focusedSourceId].shapesIds[0];
    const firstShape = document.shapes[firstId];

    if (!firstShape) {
        return selected;
    }
    const instance = sourceInstance(focusedSourceId, firstShape.order);

    return instance ? [instance, ...selected] : selected;
};

/** The selected items as clipboard text, or null when there are none to copy. */
export const copySelection: ActionWithResult<string | null> = ({ state }) => {
    const frame = state.currentDocument.frames[state.currentDocument.selectedFrameId ?? ''];

    if (frame && takesEditorInput(state)) {
        return editorHelpers().frames.writeClipboard(frame);
    }

    const selected = takesEditorInput(state) ? selectedForCopy(state) : [];

    return selected.length > 0
        ? clipboardFormat().writeClipboard(
              selected,
              selectedGroups(state),
              state.currentDocument.variables,
              state.currentDocument
          )
        : null;
};

/**
 * The selected shapes that are not locked, as clipboard text and their ids, or
 * null when there are none to cut. They are removed once the clipboard holds them.
 */
export const selectionToCut: ActionWithResult<
    { text: string; shapeIds: string[]; frameIds?: string[]; documentId?: string } | null
> = ({ state }) => {
    const frame = state.currentDocument.frames[state.currentDocument.selectedFrameId ?? ''];

    if (frame && !frame.locked && !state.currentDocument.locked && takesEditorInput(state)) {
        return {
            text: editorHelpers().frames.writeClipboard(frame),
            shapeIds: [],
            frameIds: [frame.id],
            documentId: state.currentDocumentId
        };
    }

    const cut = takesEditorInput(state)
        ? selectedInDrawOrder(state).filter(
              (shape) => !isShapeLocked(state.currentDocument, shape.id)
          )
        : [];

    return cut.length > 0
        ? {
              text: clipboardFormat().writeClipboard(
                  cut,
                  selectedGroups(state),
                  state.currentDocument.variables,
                  state.currentDocument
              ),
              shapeIds: cut.map((shape) => shape.id)
          }
        : null;
};

/**
 * Where a paste is centered: where this document's canvas was last pressed, or
 * the middle of the view once that place is out of sight. None before any press.
 */
const pasteTarget = ({ state, effects }: Context): Point | null => {
    const { lastPress } = state.events.pointer;
    const { camera } = state.currentDocument;
    const { width, height } = effects.viewSize();
    const topLeft = screenToWorld({ x: 0, y: 0 }, camera);
    const bottomRight = screenToWorld({ x: width, y: height }, camera);

    if (lastPress?.documentId !== state.currentDocumentId || !topLeft || !bottomRight) {
        return null;
    }

    const { x, y } = lastPress.position;
    const inView = x >= topLeft.x && x <= bottomRight.x && y >= topLeft.y && y <= bottomRight.y;

    return inView
        ? lastPress.position
        : { x: (topLeft.x + bottomRight.x) / 2, y: (topLeft.y + bottomRight.y) / 2 };
};

/**
 * Adds the shapes clipboard text holds, through `applyOperations`, selected in
 * place of the selection. Pastes nothing while the editor takes no input, when the
 * text holds no shapes, or when the batch is refused, answering why.
 */
export const pasteShapes: ActionWithParamAndResult<string, PasteResult> = (context, text) => {
    const { state, actions } = context;

    if (!takesEditorInput(state)) {
        return 'notNow';
    }

    const frame = editorHelpers().frames.readClipboard(text);

    if (frame) {
        const id = actions.editFrame({ kind: 'paste', frame, target: pasteTarget(context) });

        return id ? 'pasted' : 'notNow';
    }

    const { readClipboard, pasteOperations } = clipboardFormat();
    const copied = readClipboard(text);

    if (copied.shapes.length === 0) {
        return 'noShapes';
    }

    const operations = pasteOperations(
        copied,
        untracked(state.currentDocument),
        pasteTarget(context)
    );
    const result = actions.applyOperations({
        documentId: state.currentDocumentId,
        by: { kind: 'person' },
        operations
    });

    if (!result.applied) {
        return { problem: result.problem };
    }

    actions.unselectShapes();
    state.enteredGroupId = null;
    operations.forEach((operation) => {
        if (operation.op === 'addShape') {
            state.currentDocument.shapes[result.ids[operation.key]].selected = true;
        }
    });

    return 'pasted';
};
