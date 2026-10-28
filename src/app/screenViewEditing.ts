import { sharedProperties, type PropertyRow } from './properties';
import { hasLayoutOffset, projectFrameLayout } from './frameLayout';
import { isShapeLocked, isShapeVisible, rectToBox } from './utils';
import { screenOwners, screenSourceShapes } from './screenViews';
import { isReadOnly } from './documentAccess';
import { groupFrame } from './membership';
import { localComponents } from './componentSelection';
import type { Context } from './index';
import type { Component, Document, Frame, Point, Shape } from './types';
import { frameParents, isFrameLocked, isFrameVisible } from './frameState';
import { MAX_PROJECTED_NODES, projectScreenViews } from './screenProjection';
import { hasNumericLayout } from './contextualLayout';
import { projectGeometry } from './contextualGeometry';
import { untracked } from './untracked';
import { json } from 'overmind';
import { componentSource, instanceBox, instanceSource } from './componentSource';
import { transformComponentShape } from './componentViewTransform';
import type { ScreenProjection } from './screenProjection';
import type { HandleOwner, ScreenViewAddress, ScreenViewGesture } from 'src/events/types';

export type ScreenViewContainer = Exclude<HandleOwner, { shapeId: string }>;

/** Keep the focused instance's layout footprint stable while its master bounds change. */
export function componentScreenViews(state: Context['state']) {
    const document = state.currentDocument;
    const focus = state.componentEditingReturn?.componentOrigin;
    const instance = focus ? document.shapes[focus.instanceId] : undefined;

    if (
        state.componentEditingReturn?.documentId !== document.id ||
        document.editingComponentId !== focus?.componentId ||
        instance?.type !== 'instance' ||
        instance.componentId !== focus.componentId
    ) {
        return projectScreenViews(document, state.previewModes[document.id]);
    }

    return projectScreenViews(
        {
            ...document,
            shapes: {
                ...document.shapes,
                [instance.id]: {
                    ...instance,
                    layoutSize: focus.size,
                    bounds: rectToBox({ ...instance.position, ...focus.size })
                }
            }
        },
        state.previewModes[document.id]
    );
}

function screenViewSource(state: Context['state'], address: ScreenViewAddress | null) {
    const document = state.currentDocument;
    const view = address?.documentId === document.id ? document.frames[address.viewId] : undefined;
    const screen = view?.screenId ? document.frames[view.screenId] : undefined;
    const component = document.components[document.editingComponentId ?? ''];
    const owners = component ? screenOwners(document.frames) : null;
    const focus =
        state.componentEditingReturn?.documentId === document.id
            ? state.componentEditingReturn.componentOrigin
            : undefined;
    const instance =
        focus && component && focus.componentId === component.id
            ? document.shapes[focus.instanceId]
            : undefined;
    const throughInstance =
        component?.sourceOnly &&
        instance?.type === 'instance' &&
        instance.componentId === component.id &&
        owners?.get(instance.parentFrameId ?? '') === screen?.id &&
        !isShapeLocked(document, instance.id);

    if (
        isReadOnly(state) ||
        document.locked ||
        view?.kind !== 'view' ||
        screen?.kind !== 'screen' ||
        (address?.drawingOrigin && address.drawingOrigin.screenId !== screen.id) ||
        frameParents(document.frames).get(screen.id) ||
        !isFrameVisible(document, view.id) ||
        !isFrameVisible(document, screen.id) ||
        isFrameLocked(document, view.id) ||
        isFrameLocked(document, screen.id) ||
        (component &&
            (component.library ||
                (component.sourceOnly
                    ? !throughInstance
                    : !component.shapesIds.every(
                          (id) =>
                              owners?.get(document.shapes[id]?.parentFrameId ?? '') === screen.id
                      ))))
    ) {
        return null;
    }

    return { view, screen };
}

/**
 * A placed component edits through its Screen; unplaced definitions use the source editor.
 * Pass `views` when they are already projected, so the views are not projected twice.
 */
export function componentScreenView(
    state: Context['state'],
    views?: ReturnType<typeof projectScreenViews>
) {
    const address = state.events.pointer.screenView;

    if (!state.currentDocument.editingComponentId || !screenViewSource(state, address)) {
        return null;
    }
    const document = state.currentDocument;
    const component = document.components[document.editingComponentId ?? ''];

    if (component?.sourceOnly) {
        const projected = views ?? componentScreenViews(state);
        const placed = projected.find((item) => item.view.id === address?.viewId)?.projection;
        const extra = component.shapesIds.filter((id) => document.shapes[id]?.visible).length - 1;
        const nodes = projected.reduce(
            (total, item) =>
                total +
                (item.projection
                    ? 1 +
                      item.projection.frames.length +
                      item.projection.shapes.length +
                      (componentFocus(state, item.projection) ? extra : 0)
                    : 0),
            0
        );

        return placed && nodes <= MAX_PROJECTED_NODES && projectComponentView(state, placed)
            ? address
            : null;
    }

    return address;
}

/** Whether presses on a View edit its Screen; one that cannot lets them reach the canvas. */
export function canEditThroughView(state: Context['state'], viewId: string) {
    return screenViewSource(state, { documentId: state.currentDocument.id, viewId }) !== null;
}

/** Resolve a local editing address without putting projection data into the document. */
export function editableScreenView(state: Context['state'], address: ScreenViewAddress | null) {
    const source = screenViewSource(state, address);

    if (!source) {
        return null;
    }

    const projection = componentScreenViews(state).find(
        (item) => item.view.id === source.view.id
    )?.projection;

    if (!projection) {
        return null;
    }

    const focused = projectComponentView(state, projection);

    if (state.currentDocument.components[state.enteredComponentId ?? '']?.sourceOnly) {
        return focused
            ? {
                  ...source,
                  projection: {
                      ...projection,
                      shapes: focused.shapes,
                      componentRotation: focused.transform.rotation,
                      layoutOffsets: new Set<string>()
                  },
                  component: focused.transform
              }
            : null;
    }

    return { ...source, projection, component: undefined };
}

/** The instance a source-only master is edited through in this projection, if it can be. */
function componentFocus(state: Context['state'], projection: ScreenProjection) {
    const document = state.currentDocument;
    const focus =
        state.componentEditingReturn?.documentId === document.id
            ? state.componentEditingReturn.componentOrigin
            : undefined;
    const component = document.components[document.editingComponentId ?? ''];
    const instance = projection.shapes.find((shape) => shape.id === focus?.instanceId);

    if (
        !focus ||
        focus.componentId !== component?.id ||
        !component.sourceOnly ||
        instance?.type !== 'instance'
    ) {
        return null;
    }

    return { focus, component, instance };
}

/** Master geometry stays unchanged; the chosen instance supplies its local editing placement. */
export function projectComponentView(state: Context['state'], projection: ScreenProjection) {
    const document = state.currentDocument;
    const target = componentFocus(state, projection);

    if (!target) {
        return null;
    }

    const { focus, instance } = target;
    const context = instance.projectedSource?.context;
    const master = context
        ? projectGeometry(
              { ...instance, overrides: {} },
              document,
              context.modes,
              instance.id,
              context.availableWidth
          )
        : instance;
    const source = master.type === 'instance' ? instanceSource(document, master) : null;

    if (!source) {
        return null;
    }

    const transform = {
        instanceId: instance.id,
        origin: { ...focus.position },
        position: { ...instance.position },
        size: { ...focus.size },
        rotation: instance.rotation ?? 0
    };
    const shapes = source.shapes
        .filter((shape) => shape.visible)
        .map((member) => {
            const shape = json(member);
            const nested = shape.type === 'instance' ? instanceSource(document, shape) : null;

            if (shape.type === 'instance' && nested) {
                shape.bounds = instanceBox(shape, nested);
            }

            transformComponentShape(shape, transform);

            return shape;
        });

    return {
        shapes,
        transform
    };
}

/**
 * The cheap checks for a shape's handles in a View: it belongs to the View's Screen,
 * is shown and unlocked, and has no layout offset in its source. `stacked` says
 * whether a stack among its frames could still move it at the View's viewport, so a
 * caller holding the View's projection reuses its layout instead of making one.
 */
export function screenViewTransformTarget(document: Document, viewId: string, shapeId: string) {
    return screenViewMembersTarget(document, viewId, [shapeId], false);
}

function screenViewMembersTarget(
    document: Document,
    viewId: string,
    shapeIds: string[],
    includeHidden: boolean
) {
    const view = document.frames[viewId];
    const screen = view?.screenId ? document.frames[view.screenId] : undefined;

    if (view?.kind !== 'view' || screen?.kind !== 'screen' || shapeIds.length === 0) {
        return null;
    }

    const owners = screenOwners(document.frames);
    const master = document.components[document.editingComponentId ?? ''];

    if (
        shapeIds.some(
            (id) =>
                !document.shapes[id] ||
                (!(master?.sourceOnly && master.shapesIds.includes(id)) &&
                    owners.get(document.shapes[id].parentFrameId ?? '') !== screen.id) ||
                (!includeHidden && !isShapeVisible(document, id)) ||
                isShapeLocked(document, id)
        ) ||
        hasLayoutOffset(document, shapeIds)
    ) {
        return null;
    }

    // Only stack rules place frames, so without a stack between the shape and its
    // Screen no viewport can offset it. The owner check above ends this walk.
    const parents = frameParents(document.frames);
    const stacked = shapeIds.some((shapeId) => {
        for (
            let id = document.shapes[shapeId].parentFrameId;
            id;
            id = id === screen.id ? undefined : parents.get(id)
        ) {
            if (document.frames[id].stack) {
                return true;
            }
        }

        return false;
    });

    return { view, screen, stacked };
}

/** A nested frame can move at this viewport even when its source has no layout offset. */
export function canTransformScreenViewShape(document: Document, viewId: string, shapeId: string) {
    const target = screenViewTransformTarget(document, viewId, shapeId);

    return target !== null && !placedLayoutOffset(document, target, [shapeId]);
}

/** Hidden members follow a container, but every member must belong to this Screen. */
export function screenViewContainerTarget(
    document: Document,
    viewId: string,
    owner: ScreenViewContainer
) {
    const container =
        'groupId' in owner
            ? document.groups[owner.groupId]
            : document.components[owner.componentId];

    if (!container || ('library' in container && container.library)) {
        return null;
    }

    const shapeIds = container.shapesIds.filter((id) => document.shapes[id]);
    const target = screenViewMembersTarget(document, viewId, shapeIds, true);

    return target ? { ...target, shapeIds } : null;
}

export function canTransformScreenViewContainer(
    document: Document,
    viewId: string,
    owner: ScreenViewContainer,
    target = screenViewContainerTarget(document, viewId, owner)
) {
    return target !== null && !placedLayoutOffset(document, target, target.shapeIds);
}

function placedLayoutOffset(
    document: Document,
    target: NonNullable<ReturnType<typeof screenViewTransformTarget>>,
    shapeIds: string[]
) {
    if (!target.stacked) {
        return false;
    }

    const { view, screen } = target;
    // Match the viewport layout used by projectScreen before editing authored geometry.
    const resized = {
        ...document,
        frames: {
            ...document.frames,
            [screen.id]: { ...screen, size: view.size, sizing: undefined }
        }
    };

    return hasLayoutOffset({ ...resized, frameLayout: projectFrameLayout(resized) }, shapeIds);
}

/**
 * A marquee only changes selection, so its placed geometry is projected once per
 * gesture rather than on every pointer move.
 */
const marqueeDocuments = new WeakMap<object, Document>();

/** Hit tests and snapping read the same placed geometry as the renderer. */
export function pointerDocument(state: Context['state']): Document {
    const document = state.currentDocument;
    const address = state.events.pointer.screenView;

    if (!address || address.documentId !== document.id) {
        if (document.editingComponentId) {
            return document;
        }

        const source = screenSourceShapes(document);

        if (source.size === 0) {
            return document;
        }

        const canvas: Document = {
            ...document,
            shapes: Object.fromEntries(
                Object.entries(document.shapes).filter(([id]) => !source.has(id))
            ),
            shapesIds: document.shapesIds.filter((id) => !source.has(id))
        };

        return {
            ...canvas,
            groupFrames: Object.fromEntries(
                Object.values(document.groups).map((group) => [
                    group.id,
                    group.shapesIds.some((id) => source.has(id))
                        ? (groupFrame(canvas, group) ?? undefined)
                        : document.groupFrames[group.id]
                ])
            ),
            componentFrames: Object.fromEntries(
                localComponents(document).map((component) => [
                    component.id,
                    component.shapesIds.some((id) => source.has(id))
                        ? (groupFrame(canvas, component) ?? undefined)
                        : document.componentFrames[component.id]
                ])
            )
        };
    }

    const { gesture } = state.events.pointer;
    // Numeric inputs can change mid-marquee; those views must not keep stale geometry.
    const key =
        gesture.kind === 'marquee' && !hasNumericLayout(document) ? untracked(gesture) : null;
    const cached = key ? marqueeDocuments.get(key) : undefined;

    if (cached) {
        return cached;
    }

    const placedDocument = placedPointerDocument(state, address);

    if (key) {
        marqueeDocuments.set(key, placedDocument);
    }

    return placedDocument;
}

function placedPointerDocument(state: Context['state'], address: ScreenViewAddress): Document {
    const document = state.currentDocument;

    const projected = editableScreenView(state, address)?.projection;
    const members = document.components[document.editingComponentId ?? '']?.shapesIds;
    const shapes = (projected?.shapes ?? []).filter(
        (shape) => !members || members.includes(shape.id)
    );

    const placed = placedScreenDocument(document, shapes, projected?.componentRotation);

    return {
        ...placed,
        groupFrames: Object.fromEntries(
            Object.values(document.groups).map((group) => [
                group.id,
                groupFrame(placed, placed.groups[group.id]) ?? undefined
            ])
        ),
        componentFrames: Object.fromEntries(
            localComponents(document).map((component) => [
                component.id,
                groupFrame(placed, placed.components[component.id]) ?? undefined
            ])
        )
    };
}

/** Projected shapes already contain their layout; do not apply it a second time. */
export function placedScreenDocument(document: Document, shapes: Shape[], rotation = 0): Document {
    const containers = <T extends { rotation?: number }>(table: Record<string, T>) =>
        rotation
            ? Object.fromEntries(
                  Object.entries(table).map(([id, item]) => [
                      id,
                      { ...item, rotation: (item.rotation ?? 0) + rotation }
                  ])
              )
            : table;

    return {
        ...document,
        groups: containers(document.groups),
        components: containers(document.components),
        shapes: Object.fromEntries(shapes.map((shape) => [shape.id, shape])),
        shapesIds: shapes.map((shape) => shape.id),
        frameLayout: {
            shapes: {},
            frames: {},
            managedShapes: new Set(),
            managedFrames: new Set(),
            problems: {},
            frameSizes: {},
            shapeSizes: {},
            slots: {}
        }
    };
}

export function sourceOffset(
    view: Pick<Frame, 'position'>,
    screen: Pick<Frame, 'position'>
): Point {
    return { x: screen.position.x - view.position.x, y: screen.position.y - view.position.y };
}

/** A changed placement invalidates the gesture's coordinate system; never guess a new one. */
export function screenViewGestureBlocked(state: Context['state'], context: ScreenViewGesture) {
    const current = screenViewSource(state, context.address);
    const component = context.component;
    const placed = component ? editableScreenView(state, context.address)?.component : undefined;

    return (
        !current ||
        (component &&
            (!placed ||
                placed.instanceId !== component.instanceId ||
                placed.position.x !== component.position.x ||
                placed.position.y !== component.position.y ||
                placed.rotation !== component.rotation ||
                placed.origin.x !== component.origin.x ||
                placed.origin.y !== component.origin.y)) ||
        current.screen.id !== context.screenId ||
        current.view.position.x !== context.position.x ||
        current.view.position.y !== context.position.y ||
        current.view.size.width !== context.size.width ||
        current.view.size.height !== context.size.height ||
        current.screen.position.x !== context.sourcePosition.x ||
        current.screen.position.y !== context.sourcePosition.y
    );
}

/**
 * Where artwork started through a View is added: its source Screen. A drawing
 * gesture is cancelled when its View changes, but two-phase text commits later,
 * so only the Screen chosen at placement is needed; the View may since have moved,
 * been hidden or removed without losing the typed text.
 */
export function drawingScreen(state: Context['state'], address: ScreenViewAddress | null) {
    const origin = address?.drawingOrigin;
    const document = state.currentDocument;
    const screen = origin ? document.frames[origin.screenId] : undefined;

    if (
        !origin ||
        address?.documentId !== document.id ||
        isReadOnly(state) ||
        document.locked ||
        screen?.kind !== 'screen' ||
        frameParents(document.frames).get(screen.id)
    ) {
        return null;
    }

    if (origin.component) {
        return document.components[origin.component.id] &&
            state.enteredComponentId === origin.component.id
            ? {
                  screen,
                  component: origin.component.transform,
                  offset: { x: 0, y: 0 },
                  componentId: origin.component.id
              }
            : null;
    }

    return {
        screen,
        offset: sourceOffset(origin, screen),
        component: undefined,
        componentId: undefined
    };
}

/** Why a keyboard command did nothing in a view that became locked, hidden or deleted. */
export const UNAVAILABLE_VIEW_MESSAGE =
    'That Screen view is locked, hidden or deleted. Click the canvas or another view, then try again.';

/** Explains the refusal once, rather than on every repeat of a held key. */
export function reportUnavailableView({ state, actions }: Pick<Context, 'state' | 'actions'>) {
    if (!state.notifications.some(({ message }) => message === UNAVAILABLE_VIEW_MESSAGE)) {
        actions.displayError(UNAVAILABLE_VIEW_MESSAGE);
    }
}

/** Use placed dimensions for read-only measurements without replacing authored inputs. */
export function selectedViewProperties(state: Context['state'], rows: PropertyRow[]) {
    const placed = pointerDocument(state);
    const selected = state.currentDocument.selectedShapesIds
        .map((id) => placed.shapes[id])
        .filter(Boolean);
    const projected = sharedProperties(selected, placed);

    return rows.map((row) =>
        row.readOnly && ['width', 'height'].includes(row.property.key)
            ? (projected.find((item) => item.property.key === row.property.key) ?? row)
            : row
    );
}

/** Pin the rendered source origin while entering focused editing through an instance. */
export function componentEditingOrigin(state: Context['state'], component: Component) {
    if (!component.sourceOnly) {
        return undefined;
    }
    const document = state.currentDocument;
    const instanceId = document.selectedShapesIds.find((id) => {
        const shape = document.shapes[id];

        return shape.type === 'instance' && shape.componentId === component.id;
    });
    if (!instanceId) {
        return undefined;
    }
    const placed = editableScreenView(
        state,
        state.events.pointer.screenView
    )?.projection.shapes.find((shape) => shape.id === instanceId);
    const source =
        (placed?.type === 'instance' ? placed.projectedSource : undefined) ??
        componentSource(document, component.id);
    if (!source) {
        return undefined;
    }

    return {
        componentId: component.id,
        instanceId,
        position: { ...source.box.topLeft },
        size: { width: source.box.width, height: source.box.height }
    };
}
