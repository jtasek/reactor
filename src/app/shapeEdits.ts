import { json } from 'overmind';
import { drawingScreen, pointerDocument } from './screenViewEditing';
import { transformComponentShape } from './componentViewTransform';
import { initializeStackOrder } from './stackEdits';
import { frameLayout, renderedShape, hasLayoutOffset } from './frameLayout';
import { frameState, lockedFrameForShapes } from './frameState';
import { deleteIfPresent, untracked } from './untracked';
import {
    Action,
    ActionGuard,
    ActionWithParam,
    ActionWithParamAndResult,
    ActionWithResult,
    Application,
    Box,
    Corner,
    Group,
    Point,
    ResizeHandlerType,
    Shape,
    ShapeInput
} from './types';
import { unbind, unbindEditedProperties, unbindMovedProperties, writeText } from './variables';
import { Context } from 'src/app';
import { instanceName, createGroup, createShape, nextShapeName } from './factories';
import { containersHolding, groupAtPoint, shapeGroup, shownGroupShapesIds } from './membership';
import { deleteShape } from './deleteShape';
import {
    componentAtPoint,
    selectionMembers,
    shapeComponent,
    shownComponentShapesIds
} from './componentSelection';
import {
    orderAbove,
    ordersAbove,
    ordersBelow,
    ordersBetween,
    resolveDrawOrderTies
} from './drawOrder';
import { PropertyValue, SHAPE_PROPERTIES, applyProperty, canEdit } from './properties';
import type { Cut } from './services/clipboard';
import type { PasteResult } from './clipboard';
import { editorHelpers } from './editorHelpers';
import { takesEditorInput } from 'src/events/input';
import {
    cornerRadiusAfterDrag,
    hitTestShape,
    hitTolerance,
    keepsAspectRatio,
    resizeShapeFromHandle,
    shapeIntersectsBox,
    translateShape
} from './geometry';
import {
    boxesEqual,
    getShapeBounds,
    isShapeLocked,
    isShapeVisible,
    shapeGeometry,
    boxCenter,
    angleBetween,
    movedEdges,
    shapeStyle
} from './utils';
import { hasComponentInstances, reachesComponent } from './actions/components';
import { componentSource, instanceComponentId, instanceBox } from './componentSource';
import { detachedMembers } from './componentDetach';

const getShape = ({ currentDocument }: Application, shapeId: string) => {
    const shape = currentDocument.shapes[shapeId];

    if (!shape) {
        throw new Error(`Shape ${shapeId} not found`);
    }

    return shape;
};

/** Adds a new shape whose order is above every other shape's. */
const putOnTop = ({ currentDocument }: Application, shape: Shape) => {
    currentDocument.shapes[shape.id] = shape;
    currentDocument.shapesIds.push(shape.id);
};

const topOrder = ({ currentDocument }: Application) => {
    const { shapes, shapesIds } = currentDocument;
    const top = shapesIds[shapesIds.length - 1];

    return top ? shapes[top].order : null;
};

/** Shapes the pointer can hit, select and drag: visible and not locked. */
const isInteractive = ({ currentDocument }: Application, shapeId: string) =>
    isShapeVisible(currentDocument, shapeId) && !isShapeLocked(currentDocument, shapeId);

export const addShape: ActionWithParam<ShapeInput> = ({ state }, options) => {
    if (frameState(state.currentDocument, options.parentFrameId)?.lockedBy !== undefined) {
        return;
    }

    const shapes = Object.values(untracked(state.currentDocument).shapes);
    const component =
        options.type === 'instance' ? state.currentDocument.components[options.componentId] : null;
    const name =
        options.name ??
        (component
            ? instanceName(component.name, new Set(shapes.map((shape) => shape.name)))
            : nextShapeName(shapes, options.type));
    const shape = createShape({ ...options, name, order: orderAbove(topOrder(state)) });

    putOnTop(state, shape);
    if (shape.parentFrameId) {
        initializeStackOrder(state.currentDocument, [shape.parentFrameId]);
    }
};

/**
 * Adds a tool's shape to the entered component or selected layer, selects the
 * new shape alone, and leaves the entered group. The layer stays selected for
 * consecutive drawings.
 */
export const drawShape: ActionWithParam<ShapeInput> = ({ state, actions }, options) => {
    const document = state.currentDocument;
    const address = state.events.pointer.screenView;
    const placed = drawingScreen(state, address);

    if (address?.drawingOrigin && !placed && document.frames[address.drawingOrigin.screenId]) {
        return;
    }

    if (placed) {
        const drawing = json(options);
        const source =
            drawing.type === 'instance' && placed.component
                ? componentSource(document, instanceComponentId(document, drawing))
                : null;

        if (drawing.type === 'instance' && source) {
            drawing.bounds = instanceBox(drawing, source);
        }

        if (placed.component) {
            transformComponentShape(drawing, placed.component, true);
        } else {
            translateShape(drawing, placed.offset);
        }

        options = { ...drawing, parentFrameId: placed.componentId ? undefined : placed.screen.id };
    }

    const componentId = state.enteredComponentId;
    const component = componentId && document.components[componentId];
    const layerId = document.selectedLayersIds[0];
    const layer = !component && layerId ? document.layers[layerId] : undefined;

    if (frameState(document, options.parentFrameId)?.lockedBy !== undefined) {
        return;
    }

    if (componentId && (!component || component.library || component.locked)) {
        return;
    }
    if (layer?.locked) {
        return;
    }
    if (
        component &&
        options.type === 'instance' &&
        reachesComponent(document, options.componentId, component.id)
    ) {
        return;
    }
    actions.unselectShapes();
    state.enteredGroupId = null;
    state.enteredComponentId = null;
    actions.addShape(options);
    const shapeId = document.shapesIds.at(-1);

    if (!shapeId) {
        return;
    }
    if (layer) {
        layer.shapesIds.push(shapeId);
        layer.selected = true;
    }
    if (!component) {
        return;
    }
    component.shapesIds.push(shapeId);
    state.enteredComponentId = component.id;
    state.selectedComponent = {
        documentId: state.currentDocumentId,
        componentId: component.id,
        shapeId
    };
};

/** Cloning is an editor-only transfer, alongside copying and pasting. */
export const cloneShapes: ActionWithParam<string[]> = (context, shapeIds) =>
    editorHelpers().clipboardEdits.cloneShapes(context, shapeIds);

/** Clipboard editing is provided by the editor page, not loaded at startup. */
export const copySelection: ActionWithResult<string | null> = (context) =>
    takesEditorInput(context.state) ? editorHelpers().clipboardEdits.copySelection(context) : null;

export const selectionToCut: ActionWithResult<Cut | null> = (context) =>
    takesEditorInput(context.state) ? editorHelpers().clipboardEdits.selectionToCut(context) : null;

/**
 * Removes the shapes that still exist and are not locked, and the groups this
 * empties, as deleting or cutting a whole group removes it.
 */
export const removeShapes: ActionWithParam<string[]> = ({ state, actions }, shapeIds) => {
    const { currentDocument } = state;
    const requested = shapeIds.filter(
        (id) => currentDocument.shapes[id] && !isShapeLocked(currentDocument, id)
    );
    const blocked = new Set<string>();

    for (const component of Object.values(currentDocument.components)) {
        if (!hasComponentInstances(currentDocument, component.id)) {
            continue;
        }
        if (component.shapesIds.every((id) => requested.includes(id))) {
            component.shapesIds.forEach((id) => blocked.add(id));
        }
    }
    if (blocked.size > 0) {
        actions.displayWarning('A component with instances must keep at least one shape.');
    }
    const removed = requested.filter((id) => !blocked.has(id));
    const groups = containersHolding(currentDocument.groups, removed);

    removed.forEach((id) => deleteShape(state.currentDocument, id));
    groups
        .filter((group) => group.shapesIds.length === 0)
        .forEach((group) => delete currentDocument.groups[group.id]);
};

/** Replaces live instances with independent shapes in the same place. */
export const detachInstances: ActionWithParam<string[]> = ({ state }, instanceIds) => {
    const document = state.currentDocument;

    for (const id of instanceIds) {
        const instance = document.shapes[id];

        if (instance?.type !== 'instance' || isShapeLocked(document, id)) {
            continue;
        }
        const component = document.components[instance.componentId];
        if (!component) {
            continue;
        }
        const shownInstance = renderedShape(document, id);
        if (shownInstance.type !== 'instance') {
            continue;
        }
        // Auto picks its variant per projection; detach the one the canvas draws.
        const source = componentSource(document, instanceComponentId(document, shownInstance));

        if (!source) {
            continue;
        }
        const sources = containersHolding(document.components, [id]);
        const groups = containersHolding(document.groups, [id]);
        const layers = containersHolding(document.layers, [id]);
        const copyIds: string[] = [];
        // Merged orders can tie; separate them before inserting between neighbors.
        resolveDrawOrderTies(document.shapesIds.map((shapeId) => document.shapes[shapeId]));
        const index = document.shapesIds.indexOf(id);
        const next = document.shapes[document.shapesIds[index + 1]];
        const members = detachedMembers(document, shownInstance, source);
        const orders = ordersBetween(instance.order, next?.order ?? null, members.length);

        for (const [memberIndex, shown] of members.entries()) {
            const copy = createShape({
                ...shapeGeometry(shown),
                ...shapeStyle(shown),
                name: nextShapeName(Object.values(untracked(document).shapes), shown.type),
                order: orders[memberIndex],
                rotation: shown.rotation,
                bounds: shown.bounds,
                visible: shown.visible,
                locked: shown.locked,
                selected: true,
                parentFrameId: instance.parentFrameId,
                ...(instance.layoutOrder === undefined ? {} : { layoutOrder: instance.layoutOrder })
            });
            const parentOffset = frameLayout(document).frames[instance.parentFrameId ?? ''];
            if (parentOffset) {
                translateShape(copy, { x: -parentOffset.x, y: -parentOffset.y });
            }
            document.shapes[copy.id] = copy;
            copyIds.push(copy.id);
        }

        sources.forEach((source) => {
            source.shapesIds = source.shapesIds.flatMap((memberId) =>
                memberId === id ? copyIds : [memberId]
            );
        });
        deleteShape(state.currentDocument, id);
        document.shapesIds.splice(index, 0, ...copyIds);
        layers.forEach((layer) => {
            layer.shapesIds.push(...copyIds);
        });
        if (groups.length > 0) {
            groups.forEach((group) => group.shapesIds.push(...copyIds));
        } else if (copyIds.length > 1) {
            const group = createGroup({ shapesIds: copyIds });
            document.groups[group.id] = group;
        }
    }
};

export const pasteShapes: ActionWithParamAndResult<string, PasteResult> = (context, text) =>
    takesEditorInput(context.state)
        ? editorHelpers().clipboardEdits.pasteShapes(context, text)
        : 'notNow';

/**
 * Moves unlocked shapes to the top or the bottom of the draw order, keeping their
 * order among themselves.
 */
const moveToEdge = (
    { currentDocument }: Application,
    shapeIds: string[],
    edge: 'front' | 'back'
) => {
    const { shapes, shapesIds } = currentDocument;
    const moving = new Set(shapeIds.filter((id) => !isShapeLocked(currentDocument, id)));
    const moved = shapesIds.filter((id) => moving.has(id));
    const rest = shapesIds.filter((id) => !moving.has(id));

    if (moved.length === 0) {
        return;
    }

    const orders =
        edge === 'front'
            ? ordersAbove(shapes[shapesIds[shapesIds.length - 1]].order, moved.length)
            : ordersBelow(shapes[shapesIds[0]].order, moved.length);

    moved.forEach((id, index) => {
        shapes[id].order = orders[index];
    });
    currentDocument.shapesIds = edge === 'front' ? [...rest, ...moved] : [...moved, ...rest];
};

export const bringShapesToFront: ActionWithParam<string[]> = ({ state }, shapeIds) => {
    moveToEdge(state, shapeIds, 'front');
};

export const sendShapesToBack: ActionWithParam<string[]> = ({ state }, shapeIds) => {
    moveToEdge(state, shapeIds, 'back');
};

export const removeShape: ActionWithParam<string> = ({ state, actions }, shapeId) => {
    if (isShapeLocked(state.currentDocument, shapeId)) {
        return;
    }

    const lastSource = Object.values(state.currentDocument.components).some(
        (component) =>
            component.shapesIds.length === 1 &&
            component.shapesIds[0] === shapeId &&
            hasComponentInstances(state.currentDocument, component.id)
    );

    if (lastSource) {
        actions.displayWarning('A component with instances must keep at least one shape.');

        return;
    }

    deleteShape(state.currentDocument, shapeId);
};

export const toggleShapeSelected: ActionWithParam<string> = ({ state, actions }, shapeId) => {
    state.selectedComponent = null;
    const shape = getShape(state, shapeId);

    shape.selected = !shape.selected;
    if (!shape.selected) {
        return;
    }
    deleteIfPresent(state.currentDocument, 'selectedFrameId');
    actions.unselectGuides();
};

export const selectShape: ActionWithParam<string> = ({ state, actions }, shapeId) => {
    state.selectedComponent = null;
    const shape = getShape(state, shapeId);

    shape.selected = true;
    deleteIfPresent(state.currentDocument, 'selectedFrameId');
    actions.unselectGuides();
};

export const selectShapeByPoint: Action = ({ state }) => {
    const { current } = state.events.pointer;
    const tolerance = hitTolerance(state.currentDocument.camera.scale);

    const shapes = Object.values(state.currentDocument.shapes);
    shapes.forEach((shape) => {
        if (
            hitTestShape(renderedShape(state.currentDocument, shape.id), current, tolerance) &&
            isInteractive(state, shape.id)
        ) {
            shape.selected = true;
        }
    });
};

/** The topmost shape drawn under the pointer that it can press, by `canPress`, if any. */
const shapeAtPointer = (
    state: Context['state'],
    canPress = (id: string) => isInteractive(state, id)
): string | null => {
    const { current } = state.events.pointer;
    const placed = pointerDocument(state);
    const document = untracked(placed);
    const layout = frameLayout(placed);
    const { shapesIds, shapes, camera } = document;
    const tolerance = hitTolerance(camera.scale);

    // From the top down, so the first hit is the one drawn over the others.
    for (let index = shapesIds.length - 1; index >= 0; index--) {
        const id = shapesIds[index];
        const shape = shapes[id];

        if (
            shape &&
            hitTestShape(renderedShape(document, shape.id, layout), current, tolerance) &&
            canPress(id)
        ) {
            return id;
        }
    }

    return null;
};

/** Leaves the group double-clicked into when a shape in `shapeIds` is outside it. */
const leaveGroupWithout = (state: Context['state'], shapeIds: string[]) => {
    const entered = state.enteredGroupId && state.currentDocument.groups[state.enteredGroupId];

    if (
        state.enteredGroupId !== null &&
        (!entered || shapeIds.some((id) => !entered.shapesIds.includes(id)))
    ) {
        state.enteredGroupId = null;
    }
    const component =
        state.enteredComponentId && state.currentDocument.components[state.enteredComponentId];

    if (
        state.enteredComponentId !== null &&
        (!component || shapeIds.some((id) => !component.shapesIds.includes(id)))
    ) {
        state.enteredComponentId = null;
    }
};

const enterComponentUnderPointer = (
    { state, actions }: Context,
    wasSelected: (shapeId: string) => boolean
): boolean => {
    const hitId = shapeAtPointer(state);
    const component = hitId === null ? undefined : shapeComponent(state.currentDocument, hitId);

    if (
        !hitId ||
        !component ||
        component.id === state.enteredComponentId ||
        !shownComponentShapesIds(state.currentDocument, component).every(wasSelected)
    ) {
        return false;
    }
    actions.selectComponentChild({ componentId: component.id, shapeId: hitId });

    return true;
};

/**
 * Enters the group of the shape under the pointer when `wasSelected` says the
 * group was selected as one: the shape alone is selected, and its group's shapes
 * are pressed one by one until a press outside the group. Returns whether a
 * group was entered.
 */
const enterGroupUnderPointer = (
    { state, actions }: Context,
    wasSelected: (group: Group) => boolean
): boolean => {
    const hitId = shapeAtPointer(state);
    const group = hitId === null ? undefined : shapeGroup(state.currentDocument, hitId);

    if (hitId && shapeComponent(state.currentDocument, hitId)) {
        return false;
    }
    if (hitId === null || !group || !wasSelected(group)) {
        return false;
    }

    state.enteredGroupId = group.id;
    actions.unselectShapes();
    state.currentDocument.shapes[hitId].selected = true;

    return true;
};

/** Double-clicking a shape of a selected group, with the select tool, enters the group. */
export const enterGroupAtPointer: ActionGuard = (context) => {
    const { state } = context;

    if (state.tools.activeToolsIds[0] !== 'select') {
        return false;
    }

    if (enterComponentUnderPointer(context, (id) => state.currentDocument.shapes[id].selected)) {
        return true;
    }

    return enterGroupUnderPointer(context, (group) =>
        state.currentDocument.selectedGroupsIds.includes(group.id)
    );
};

/** Double-clicking a text shape with the select tool starts changing its words on the canvas. */
export const editTextAtPointer: ActionGuard = ({ state }) => {
    if (state.tools.activeToolsIds[0] !== 'select' || state.events.pointer.screenView) {
        return false;
    }

    const hitId = shapeAtPointer(state);
    const shape = hitId === null ? undefined : state.currentDocument.shapes[hitId];
    const property = SHAPE_PROPERTIES.find((item) => item.key === 'text');

    if (shape?.type !== 'text' || !property || !canEdit(property, shape, state.currentDocument)) {
        return false;
    }

    state.editingText = { documentId: state.currentDocumentId, shapeId: shape.id };

    return true;
};

/** Stops changing a text shape's words on the canvas. */
export const endTextEditing = ({ state }: Context) => {
    state.editingText = null;
};

/**
 * Clicking a shape of a group that was already selected enters the group.
 * `selection` is the selection before the press, as the press itself selects.
 */
export const enterClickedGroup: ActionWithParam<Record<string, boolean>> = (context, selection) => {
    const { state } = context;

    if (enterComponentUnderPointer(context, (id) => selection[id])) {
        return;
    }

    enterGroupUnderPointer(
        context,
        (group) =>
            group.id !== state.enteredGroupId &&
            shownGroupShapesIds(state.currentDocument, group).every((id) => selection[id])
    );
};

/**
 * Selects the pressed shapes alone, with their groups, those of them `canSelect`
 * takes; a selection they all belong to stays, so it moves together.
 */
const selectPressed = (
    state: Context['state'],
    pressed: string[],
    canSelect: (id: string) => boolean
) => {
    const { shapesIds, shapes } = state.currentDocument;

    leaveGroupWithout(state, pressed);

    if (pressed.every((id) => shapes[id]?.selected)) {
        return;
    }

    // A group is selected as one.
    const hit = selectionMembers(
        state.currentDocument,
        pressed,
        state.enteredGroupId,
        state.enteredComponentId
    );
    const plain = untracked(state.currentDocument).shapes;

    shapesIds.forEach((id: string) => {
        const selected = hit.has(id) && canSelect(id);

        // Read untracked; written through the store only where it changes.
        if (plain[id] && plain[id].selected !== selected) {
            shapes[id].selected = selected;
        }
    });
};

const boxMembersAtPointer = (state: Context['state']) => {
    const document = pointerDocument(state);

    return (
        (
            componentAtPoint(document, state.events.pointer.current, state.enteredComponentId) ??
            groupAtPoint(document, state.events.pointer.current, state.enteredGroupId)
        )?.shapesIds ?? []
    );
};

/** Uses the same hit and selection rules as a canvas press for a context menu. */
export const selectContextMenuTarget: ActionWithParamAndResult<Point, boolean> = (
    { state, actions },
    position
) => {
    state.events.pointer.current = position;
    state.events.pointer.lastPress = { documentId: state.currentDocumentId, position };
    const previousComponent = state.selectedComponent;
    state.selectedComponent = null;

    const hit = actions.selectShapeAtPointer() || actions.selectClickedShapes();

    if (!hit) {
        state.selectedComponent = previousComponent;
    }

    return hit;
};

/**
 * Resolves the shape under the pointer and updates the selection so a move can
 * begin, returning whether a shape was hit. Iterates shapesIds in z-order so the
 * topmost shape drawn under the point (see hitTestShape) wins. Pressing an
 * already-selected shape keeps the whole selection intact (so a multi-selection
 * can be dragged as a group); pressing an unselected shape replaces the
 * selection with just it. An empty hit leaves the selection untouched — the
 * caller decides what an empty-canvas press means (pan, marquee or deselect).
 */
export const selectShapeAtPointer: ActionGuard = ({ state }) => {
    const hitId = shapeAtPointer(state);
    // A press between a container's shapes selects the container.
    const pressed =
        hitId !== null
            ? [hitId]
            : boxMembersAtPointer(state).filter((id) => isInteractive(state, id));

    if (pressed.length === 0) {
        return false;
    }

    selectPressed(state, pressed, (id) => isInteractive(state, id));

    const component = shapeComponent(state.currentDocument, pressed[0]);
    if (
        component &&
        component.id !== state.enteredComponentId &&
        state.currentDocument.selectedShapesIds.every((id) => component.shapesIds.includes(id))
    ) {
        state.selectedComponent = {
            documentId: state.currentDocumentId,
            componentId: component.id
        };
    }

    return true;
};

/** Moves the given shapes by `delta`; the caller has checked they may move. */
export const moveShapesBy: ActionWithParam<{ shapeIds: string[]; delta: Point }> = (
    { state },
    { shapeIds, delta }
) => {
    for (const id of shapeIds) {
        const shape = state.currentDocument.shapes[id];

        if (shape && !hasLayoutOffset(state.currentDocument, [id])) {
            unbindMovedProperties(shape, delta);
            translateShape(shape, delta);
        }
    }
};

export const moveSelectedShapes: ActionWithParam<Point> = ({ state }, delta) => {
    const shapes = Object.values(state.currentDocument.shapes);
    shapes.forEach((shape) => {
        if (
            shape.selected &&
            isInteractive(state, shape.id) &&
            !hasLayoutOffset(state.currentDocument, [shape.id])
        ) {
            unbindMovedProperties(shape, delta);
            translateShape(shape, delta);
        }
    });
};

/**
 * What a click selects where a press passes through, on a locked item: the topmost
 * shape drawn under the pointer, or else the shown shapes of the group whose box it
 * is in; none on empty canvas.
 */
const shapesClickSelects = (state: Context['state']): string[] => {
    const document = state.currentDocument;
    const hitId = shapeAtPointer(state, (id) => isShapeVisible(document, id));

    if (hitId !== null) {
        return [hitId];
    }

    return boxMembersAtPointer(state).filter((id) => isShapeVisible(document, id));
};

/**
 * Selects what a click selects where a press passed through, as on a locked item,
 * shown shapes only; returns false on empty canvas, which selects nothing.
 */
export const selectClickedShapes: ActionGuard = ({ state }) => {
    const document = state.currentDocument;
    const clicked = shapesClickSelects(state);

    if (clicked.length === 0) {
        return false;
    }

    selectPressed(state, clicked, (id) => isShapeVisible(document, id));

    return true;
};

export const selectShapes: Action = ({ state }) => {
    const { topLeft, bottomRight, size } = state.events.pointer;
    const source = { topLeft, bottomRight };
    // A click without a drag clears the selection: presses select by hit-testing,
    // so a click that missed must not select a bounding box containing it.
    const isClick = size.width === 0 && size.height === 0;

    const document = state.currentDocument;
    // Read without the store's tracking: thousands of shapes are only looked at here.
    const placed = pointerDocument(state);
    const plain = untracked(placed);
    const layout = frameLayout(placed);
    const shapes = Object.values(plain.shapes);
    const hits = isClick
        ? []
        : shapes
              .filter(
                  (shape) =>
                      shapeIntersectsBox(renderedShape(plain, shape.id, layout), source) &&
                      isInteractive(state, shape.id)
              )
              .map((shape) => shape.id);

    // A click leaves the group double-clicked into; a box leaves it once it reaches a shape outside it.
    if (isClick) {
        state.enteredGroupId = null;
        state.enteredComponentId = null;
    }

    leaveGroupWithout(state, hits);

    const boxed = selectionMembers(document, hits, state.enteredGroupId, state.enteredComponentId);

    const hit = new Set(hits);

    Object.values(document.shapes).forEach((shape) => {
        const selected =
            boxed.has(shape.id) && (hit.has(shape.id) || isInteractive(state, shape.id));

        // Only write when the value actually changes so shapes that stay
        // outside (or inside) the marquee don't re-render every pointer move.
        if (shape.selected !== selected) {
            document.shapes[shape.id].selected = selected;
        }
    });
};

export const setShapeBounds: ActionWithParam<{ id: string; bounds: Box }> = (
    { state },
    { id, bounds }
) => {
    const shape = state.currentDocument.shapes[id];

    if (!shape) {
        return;
    }

    const layout = frameLayout(state.currentDocument);
    const size = layout.shapeSizes[id];
    if (
        shape.type === 'rectangle' &&
        size &&
        (size.width !== shape.size.width || size.height !== shape.size.height)
    ) {
        return;
    }
    const offset = layout.shapes[id];
    const measured = offset
        ? {
              ...bounds,
              topLeft: { x: bounds.topLeft.x - offset.x, y: bounds.topLeft.y - offset.y },
              bottomRight: {
                  x: bounds.bottomRight.x - offset.x,
                  y: bounds.bottomRight.y - offset.y
              }
          }
        : bounds;

    // Idempotent: skip the write when the measured box is unchanged so the
    // measurement effect cannot trigger a render loop.
    if (shape.bounds && boxesEqual(shape.bounds, measured)) {
        return;
    }

    shape.bounds = measured;
};

export const unselectShapes: Action = ({ state, actions }) => {
    state.selectedComponent = null;
    state.enteredComponentId = null;
    deleteIfPresent(state.currentDocument, 'selectedFrameId');
    deleteIfPresent(state.currentDocument, 'surfaceSelected');
    actions.unselectGuides();
    Object.values(state.currentDocument.layers).forEach((layer) => {
        layer.selected = false;
    });
    const shapes = Object.values(state.currentDocument.shapes);
    shapes.forEach((shape) => {
        // Only write when it actually changes, so a background click with nothing
        // selected doesn't needlessly re-render every shape.
        if (shape.selected) {
            shape.selected = false;
        }
    });
};

export const unselectShape: ActionWithParam<string> = ({ state }, shapeId) => {
    const shape = getShape(state, shapeId);

    shape.selected = false;
};

export const activateShape: ActionWithParam<string> = ({ state }, shapeId) => {
    const shape = getShape(state, shapeId);

    if (!shape.active) {
        shape.active = true;
    }
};

export const deactivateShape: ActionWithParam<string> = ({ state }, shapeId) => {
    const shape = getShape(state, shapeId);

    if (shape.active) {
        shape.active = false;
    }
};

export const lockShape: ActionWithParam<string> = ({ state }, shapeId) => {
    if (lockedFrameForShapes(state.currentDocument, [shapeId])) {
        return;
    }

    const shape = getShape(state, shapeId);

    unbind(shape, 'locked');
    shape.locked = true;
};

export const toggleShapeLocked: ActionWithParam<string> = ({ state }, shapeId) => {
    if (lockedFrameForShapes(state.currentDocument, [shapeId])) {
        return;
    }

    const shape = getShape(state, shapeId);

    unbind(shape, 'locked');
    shape.locked = !shape.locked;
};

export const toggleShapeVisible: ActionWithParam<string> = ({ state }, shapeId) => {
    if (lockedFrameForShapes(state.currentDocument, [shapeId])) {
        return;
    }

    const shape = getShape(state, shapeId);

    unbind(shape, 'visible');
    shape.visible = !shape.visible;
};

export const unlockShape: ActionWithParam<string> = ({ state }, shapeId) => {
    if (lockedFrameForShapes(state.currentDocument, [shapeId])) {
        return;
    }

    const shape = getShape(state, shapeId);

    unbind(shape, 'locked');
    shape.locked = false;
};

export const showShape: ActionWithParam<string> = ({ state }, shapeId) => {
    if (lockedFrameForShapes(state.currentDocument, [shapeId])) {
        return;
    }

    const shape = getShape(state, shapeId);

    unbind(shape, 'visible');
    shape.visible = true;
};

export const hideShape = ({ state }: Context, shapeId: string): void => {
    if (lockedFrameForShapes(state.currentDocument, [shapeId])) {
        return;
    }

    const shape = getShape(state, shapeId);

    unbind(shape, 'visible');
    shape.visible = false;
};

export const updateShape = (
    { state, actions }: Context,
    options: Partial<ShapeInput> & { id: string }
): void => {
    if (
        isShapeLocked(state.currentDocument, options.id) ||
        frameState(state.currentDocument, options.parentFrameId)?.lockedBy !== undefined
    ) {
        return;
    }

    if ('parentFrameId' in options || 'layoutOrder' in options) {
        const { id, ...changes } = options;
        actions.applyOperations({
            documentId: state.currentDocumentId,
            by: { kind: 'person' },
            operations: [{ op: 'updateShape', shape: id, changes }]
        });

        return;
    }
    if ('position' in options && frameLayout(state.currentDocument).managedShapes.has(options.id)) {
        return;
    }

    const shape = getShape(state, options.id);

    // A shape's type fixes which geometry it has, so an update cannot change it.
    if (options.type !== undefined && options.type !== shape.type) {
        return;
    }

    unbindEditedProperties(shape, Object.keys(options));
    if (shape.type === 'text' && 'value' in options && !('template' in options)) {
        delete shape.template;
    }
    Object.assign(shape, options);
};

/**
 * Sets an inspector property (see SHAPE_PROPERTIES) on each shape where it
 * can change now (see canEdit): locked shapes only take metadata such as their
 * name, and nothing changes in a locked document.
 */
export const setShapesProperty = (
    { state }: Context,
    { shapeIds, key, value }: { shapeIds: string[]; key: string; value: PropertyValue }
): void => {
    const property = SHAPE_PROPERTIES.find((item) => item.key === key);

    if (!property) {
        return;
    }

    shapeIds.forEach((id) => {
        const shape = state.currentDocument.shapes[id];

        if (!shape || !canEdit(property, shape, state.currentDocument)) {
            return;
        }

        unbindEditedProperties(shape, [key]);

        if (key === 'text' && shape.type === 'text' && typeof value === 'string') {
            writeText(shape, value, state.currentDocument.variables);

            return;
        }

        const offset = frameLayout(state.currentDocument).shapes[id];
        const coordinate = key === 'x' ? offset?.x : key === 'y' ? offset?.y : undefined;
        applyProperty(
            property,
            shape,
            typeof value === 'number' && coordinate !== undefined ? value - coordinate : value
        );
    });
};

export const resizeShape = (
    { state }: Context,
    payload: {
        shapeId: string;
        handlerType: ResizeHandlerType;
        position: Point;
        /** The shape as it was when the drag began; the shape itself when there is none. */
        original?: Shape;
    }
): void => {
    const { shapeId, handlerType, position, original } = payload;

    const shape = state.currentDocument?.shapes[shapeId];

    if (
        !shape ||
        !isInteractive(state, shapeId) ||
        hasLayoutOffset(state.currentDocument, [shapeId])
    ) {
        return;
    }

    unbindResizedAxes(shape, handlerType, original ?? shape);
    unbindEditedProperties(shape, ['fontSize']);
    resizeShapeFromHandle(shape, handlerType, position, original ?? shape);
};

/**
 * A resize replaces the coordinate bindings of the axes whose top or left edge it
 * may move: those the handle moves, the axis a side handle centers when the shape
 * keeps its proportions, and both when the shape is turned or sized by its radius.
 */
function unbindResizedAxes(shape: Shape, handle: ResizeHandlerType, original: Shape) {
    const both =
        Boolean(original.rotation) || original.type === 'circle' || original.type === 'ellipse';
    const { left, top } = movedEdges(handle);
    const proportional = keepsAspectRatio(original);
    const centersX = proportional && (handle === 'middleTop' || handle === 'middleBottom');
    const centersY = proportional && (handle === 'middleLeft' || handle === 'middleRight');

    if (both || left || centersX) {
        unbind(shape, 'x');
    }

    if (both || top || centersY) {
        unbind(shape, 'y');
    }
}

/**
 * Rounds a rectangle's corners as the radius handle of `corner` is dragged from
 * `from` to `to`, from the rectangle as it was when the drag began (`original`).
 */
export const roundCorners: ActionWithParam<{
    shapeId: string;
    corner: Corner;
    from: Point;
    to: Point;
    original: Shape;
}> = ({ state }, { shapeId, corner, from, to, original }) => {
    const shape = state.currentDocument.shapes[shapeId];

    if (
        shape?.type !== 'rectangle' ||
        original.type !== 'rectangle' ||
        !isInteractive(state, shapeId)
    ) {
        return;
    }

    unbind(shape, 'cornerRadius');
    const radius = cornerRadiusAfterDrag(original, corner, from, to);

    if (shape.cornerRadius !== radius) {
        shape.cornerRadius = radius;
    }
};

export const rotateShape = (
    { state }: Context,
    payload: {
        shapeId: string;
        position: Point;
    }
): void => {
    const { shapeId, position } = payload;

    const shape = state.currentDocument?.shapes[shapeId];

    if (
        !shape ||
        !isInteractive(state, shapeId) ||
        hasLayoutOffset(state.currentDocument, [shapeId])
    ) {
        return;
    }

    const center = boxCenter(getShapeBounds(shape));

    // The rotate handle sits directly above the shape, so a pointer straight up
    // from the center maps to 0°. atan2 measures from the +x axis, hence +90.
    unbind(shape, 'rotation');
    shape.rotation = angleBetween(center, position) + 90;
};
