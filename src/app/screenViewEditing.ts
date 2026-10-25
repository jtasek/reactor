import { screenSourceShapes } from './screenViews';
import { isReadOnly } from './documentAccess';
import { groupFrame } from './membership';
import { localComponents } from './componentSelection';
import type { Context } from './index';
import type { Document, Frame, Point } from './types';
import { frameParents, isFrameLocked, isFrameVisible } from './frameState';
import { projectScreenViews } from './screenProjection';
import { untracked } from './untracked';
import type { ScreenViewAddress, ScreenViewGesture } from 'src/events/types';

function screenViewSource(state: Context['state'], address: ScreenViewAddress | null) {
    const document = state.currentDocument;
    const view = address?.documentId === document.id ? document.frames[address.viewId] : undefined;
    const screen = view?.screenId ? document.frames[view.screenId] : undefined;

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
        isFrameLocked(document, screen.id)
    ) {
        return null;
    }

    return { view, screen };
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

    const projection = projectScreenViews(state.currentDocument).find(
        (item) => item.view.id === source.view.id
    )?.projection;

    return projection ? { ...source, projection } : null;
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
    const key = gesture.kind === 'marquee' ? untracked(gesture) : null;
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
    const shapes = projected?.shapes ?? [];

    const placed: Document = {
        ...document,
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

    return {
        ...placed,
        groupFrames: Object.fromEntries(
            Object.values(document.groups).map((group) => [
                group.id,
                groupFrame(placed, group) ?? undefined
            ])
        ),
        componentFrames: Object.fromEntries(
            localComponents(document).map((component) => [
                component.id,
                groupFrame(placed, component) ?? undefined
            ])
        )
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

    return (
        !current ||
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

    return { screen, offset: sourceOffset(origin, screen) };
}
