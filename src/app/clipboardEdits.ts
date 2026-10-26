import { renderedShape } from './frameLayout';
import { initializeStackOrder } from './stackEdits';
import { isFrameLocked, lockedFrameForShapes } from './frameState';
import { orderAbove } from './drawOrder';
import { CLONE_OFFSET, translateShape } from './geometry';
import type {
    ActionWithParam,
    ActionWithResult,
    ActionWithParamAndResult,
    Application,
    Component,
    Point
} from './types';
import type { Context } from './index';
import type { PasteResult } from './clipboard';
import { createShape, createGroup, instanceName, shapeNamer } from './factories';
import { componentSource } from './componentSource';
import { focusedSourceOnlyId } from './componentSelection';
import { shownGroupShapesIds, containersHolding } from './membership';
import { isShapeLocked, isShapeVisible, shapeGeometry } from './utils';
import { screenToWorld } from './camera';
import { untracked } from './untracked';
import { editorHelpers } from './editorHelpers';
import { frameContents } from './frameMembership';
import { takesEditorInput } from 'src/events/input';
import { editableScreenView, pointerDocument, sourceOffset } from './screenViewEditing';
import { reachesComponent } from './actions/components';

const clipboardFormat = () => editorHelpers().clipboard;

/** The selection commands act on, shown shapes only, in drawing order. */
const selectedInDrawOrder = (state: Context['state']) => {
    const selected = new Set(state.currentDocument.selectedShapesIds);
    const document = pointerDocument(state);

    return document.shapesIds
        .filter((id) => selected.has(id))
        .map((id) => renderedShape(document, id));
};

/** Transfers keep the active view and focused definition, including after selection is cleared. */
function transferContext(state: Context['state']) {
    const document = state.currentDocument;
    const component = document.components[state.enteredComponentId ?? ''];
    const address = state.events.pointer.screenView;
    const placed = address ? editableScreenView(state, address) : null;

    if (
        (address && !placed) ||
        (state.enteredComponentId && (!component || component.library || component.locked))
    ) {
        return null;
    }

    return { component, placed };
}

function selectTransfer(
    { state, actions }: Context,
    ids: string[],
    component: Component | undefined
) {
    actions.unselectShapes();
    state.enteredGroupId = null;
    state.enteredComponentId = component?.id ?? null;
    ids.forEach((id) => {
        state.currentDocument.shapes[id].selected = true;
    });

    if (component && ids.length > 0) {
        state.selectedComponent = {
            documentId: state.currentDocumentId,
            componentId: component.id,
            shapeId: ids[0]
        };
    }
}

/** The groups selected as one, with the shapes of theirs that are shown, as only those are copied. */
const selectedGroups = ({ currentDocument }: Application) =>
    currentDocument.selectedGroupsIds.map((id) => {
        const group = currentDocument.groups[id];

        return { ...group, shapesIds: shownGroupShapesIds(currentDocument, group) };
    });

/** Copy a selected source as one live instance, alongside any other selected shapes. */
const selectedForCopy = (state: Context['state']) => {
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
        return editorHelpers().frames.writeClipboard(frame, state.currentDocument);
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

    if (frame && !isFrameLocked(state.currentDocument, frame.id) && takesEditorInput(state)) {
        const contents = frameContents(untracked(state.currentDocument), frame.id);

        if (
            contents.frames.some((id) => state.currentDocument.frames[id].locked) ||
            contents.shapes.some((id) => isShapeLocked(state.currentDocument, id))
        ) {
            return null;
        }

        return {
            text: editorHelpers().frames.writeClipboard(frame, state.currentDocument),
            shapeIds: contents.shapes,
            frameIds: [frame.id, ...contents.frames],
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

/** A view paste uses its source coordinates, even when Explorer chose the view without a press. */
function transferTarget(context: Context, placed: ReturnType<typeof editableScreenView>) {
    if (!placed) {
        return pasteTarget(context);
    }

    const { view, screen, component } = placed;
    const pressed = pasteTarget(context);
    const inside =
        pressed &&
        pressed.x >= view.position.x &&
        pressed.x <= view.position.x + view.size.width &&
        pressed.y >= view.position.y &&
        pressed.y <= view.position.y + view.size.height;
    const point = inside
        ? pressed
        : {
              x: view.position.x + view.size.width / 2,
              y: view.position.y + view.size.height / 2
          };
    const offset = component
        ? {
              x: component.origin.x - component.position.x,
              y: component.origin.y - component.position.y
          }
        : sourceOffset(view, screen);

    return { x: point.x + offset.x, y: point.y + offset.y };
}

/**
 * Adds the shapes clipboard text holds, through `applyOperations`, selected in
 * place of the selection. Pastes nothing while the editor takes no input, when the
 * text holds no shapes, or when the batch is refused, answering why.
 */
export const pasteShapes: ActionWithParamAndResult<string, PasteResult> = (context, text) => {
    const { state, actions, effects } = context;

    if (!takesEditorInput(state)) {
        return 'notNow';
    }

    const destination = transferContext(state);

    if (!destination) {
        return 'notNow';
    }

    const { component, placed } = destination;
    const frame = editorHelpers().frames.readClipboard(text);

    if (frame) {
        if (component) {
            return 'notNow';
        }

        const id = actions.editFrame({
            kind: 'paste',
            frame: frame.frame,
            copied: frame,
            target: pasteTarget(context)
        });

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
        transferTarget(context, placed)
    );
    const additions = operations.filter((operation) => operation.op === 'addShape');

    if (placed || component?.sourceOnly) {
        additions.forEach(({ shape }) => {
            shape.parentFrameId = component?.sourceOnly ? undefined : placed?.screen.id;
        });
    }

    // Imported definitions participate in the same recursion guard as local sources.
    const dependencies = {
        shapes: state.currentDocument.shapes,
        components: {
            ...Object.fromEntries((copied.components ?? []).map((source) => [source.id, source])),
            ...state.currentDocument.components
        }
    };

    if (
        component &&
        additions.some(
            ({ shape }) =>
                shape.type === 'instance' &&
                reachesComponent(dependencies, shape.componentId, component.id)
        )
    ) {
        return { problem: 'A component cannot contain an instance of itself.' };
    }

    // Membership and the operation batch must be shared and undone together.
    const hold = Boolean(component) && !state.events.keyboard.repeating;

    if (hold) {
        effects.collaboration.startBatch(state.currentDocumentId, { kind: 'person' });
        effects.collaboration.pause();
    }

    try {
        const result = actions.applyOperations({
            documentId: state.currentDocumentId,
            by: { kind: 'person' },
            operations
        });

        if (!result.applied) {
            return { problem: result.problem };
        }

        const ids = additions.map(({ key }) => result.ids[key]);

        component?.shapesIds.push(...ids);
        selectTransfer(context, ids, component);

        return 'pasted';
    } finally {
        if (hold) {
            effects.collaboration.resume();
        }
    }
};

/**
 * Adds an independent copy of each shape, offset by `CLONE_OFFSET`, above all
 * other shapes and stacked like the originals, and selects the copies in place
 * of the selection. A copy keeps its original's geometry and appearance but gets
 * its own id, name and timestamps, and is measured afresh. Copies join their
 * originals' layers; a group copied whole is copied as a group of its own, and
 * copies of some of a group's shapes join it.
 */
export const cloneShapes: ActionWithParam<string[]> = (context, shapeIds) => {
    const { state, actions } = context;
    const destination = transferContext(state);
    const shown = new Set(destination?.placed?.projection.shapes.map((shape) => shape.id));

    if (!destination || (destination.placed && shapeIds.some((id) => !shown.has(id)))) {
        return;
    }

    const { component } = destination;
    const { currentDocument } = state;
    const { shapes, shapesIds } = currentDocument;
    const cloning = new Set(shapeIds.filter((id) => !lockedFrameForShapes(currentDocument, [id])));
    const clonesIds = new Map<string, string>();
    const top = shapesIds.at(-1);
    let order = top ? shapes[top].order : null;

    const present = Object.values(untracked(currentDocument).shapes);
    const nameShape = shapeNamer(present);
    const taken = new Set(present.map((shape) => shape.name));

    actions.unselectShapes();

    for (const id of shapesIds.filter((shapeId) => cloning.has(shapeId))) {
        const original = shapes[id];

        order = orderAbove(order);

        const component =
            original.type === 'instance' ? currentDocument.components[original.componentId] : null;
        const name = component ? instanceName(component.name, taken) : nameShape(original.type);

        taken.add(name);

        const clone = createShape({
            ...shapeGeometry(original),
            ...(original.type === 'instance'
                ? {
                      bounds: original.bounds,
                      interaction: original.interaction
                          ? { ...original.interaction, props: { ...original.interaction.props } }
                          : undefined
                  }
                : {}),
            order,
            name,
            description: original.description,
            parentShapeId: original.parentShapeId,
            parentFrameId: original.parentFrameId,
            rotation: original.rotation,
            locked: original.locked,
            visible: original.visible,
            selected: true
        });

        translateShape(clone, CLONE_OFFSET);
        shapes[clone.id] = clone;
        shapesIds.push(clone.id);
        clonesIds.set(id, clone.id);
    }

    const clonesOf = (ids: string[]) =>
        ids.map((id) => clonesIds.get(id)).filter((id) => id !== undefined);

    for (const layer of containersHolding(currentDocument.layers, clonesIds.keys())) {
        layer.shapesIds = [...layer.shapesIds, ...clonesOf(layer.shapesIds)];
    }

    for (const group of containersHolding(currentDocument.groups, clonesIds.keys())) {
        const copies = clonesOf(group.shapesIds);
        const shown = group.shapesIds.filter((id) => isShapeVisible(currentDocument, id));

        // Hidden shapes are not cloned, so a group is cloned whole when its shown ones are.
        if (copies.length === shown.length) {
            const copy = createGroup({
                shapesIds: copies,
                name: `Clone of ${group.name}`,
                rotation: group.rotation
            });

            currentDocument.groups[copy.id] = copy;
        } else {
            group.shapesIds = [...group.shapesIds, ...copies];
        }
    }

    // Clones in a stack join its order, after its other items or with their group.
    initializeStackOrder(
        currentDocument,
        clonesOf([...cloning]).map((id) => shapes[id].parentFrameId ?? '')
    );

    if (component) {
        const ids = [...clonesIds.values()];

        component.shapesIds.push(...ids);
        selectTransfer(context, ids, component);
    }
};
