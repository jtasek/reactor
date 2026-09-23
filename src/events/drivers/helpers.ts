import type { Camera, Point, ResizeHandlerType } from 'src/app/types';
import type { HandleTarget } from 'src/events/types';
import { isFinitePoint, screenToWorld } from 'src/app/camera';

type ScreenMatrix = Pick<DOMMatrix, 'a' | 'b' | 'c' | 'd' | 'e' | 'f'>;
type Surface = { getScreenCTM: () => ScreenMatrix | null };
type ClientPoint = { clientX: number; clientY: number };

export function dist(a: PointerEvent, b: PointerEvent) {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
}

export function midpoint(a: PointerEvent, b: PointerEvent) {
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

function toSurface(point: Point, surface: Surface | null, vector = false): Point | null {
    if (!surface || !isFinitePoint(point)) {
        return null;
    }

    try {
        const matrix = surface.getScreenCTM();

        if (!matrix) {
            return null;
        }

        const { a, b, c, d, e, f } = matrix;
        const determinant = a * d - b * c;

        if (![a, b, c, d, e, f, determinant].every(Number.isFinite) || determinant === 0) {
            return null;
        }

        const x = point.x - (vector ? 0 : e);
        const y = point.y - (vector ? 0 : f);
        const result = {
            x: (d * x - c * y) / determinant,
            y: (a * y - b * x) / determinant
        };

        return isFinitePoint(result) ? result : null;
    } catch {
        return null;
    }
}

export function clientToSurface(event: ClientPoint, surface: Surface | null): Point | null {
    return toSurface({ x: event.clientX, y: event.clientY }, surface);
}

export function screenDeltaToSurface(delta: Point, surface: Surface | null): Point | null {
    return toSurface(delta, surface, true);
}

export function screenToCanvas(
    event: ClientPoint,
    surface: Surface | null,
    camera: Camera
): Point | null {
    const point = clientToSurface(event, surface);

    return point ? screenToWorld(point, camera) : null;
}

// Keyed by every handler type so the compiler flags a missing entry.
const RESIZE_HANDLER_TYPES: Record<ResizeHandlerType, true> = {
    bottomLeft: true,
    bottomRight: true,
    middleBottom: true,
    middleLeft: true,
    middleRight: true,
    middleTop: true,
    topLeft: true,
    topRight: true
};

const isResizeHandlerType = (type: string): type is ResizeHandlerType =>
    Object.hasOwn(RESIZE_HANDLER_TYPES, type);

/** Resolves the resize/rotate handle (if any) that an event target belongs to. */
export function getHandleTarget(target: EventTarget | null): HandleTarget | undefined {
    const handle = target instanceof Element ? target.closest('[data-handle]') : null;
    const shapeId = handle?.getAttribute('data-shape-id');
    const type = handle?.getAttribute('data-type');

    if (!shapeId) {
        return undefined;
    }

    if (type === 'rotate' || (type && isResizeHandlerType(type))) {
        return { shapeId, type };
    }

    return undefined;
}

// Input types whose key presses do not enter text, so shortcuts still apply.
const NON_TEXT_INPUT_TYPES = new Set([
    'button',
    'checkbox',
    'color',
    'file',
    'hidden',
    'image',
    'radio',
    'range',
    'reset',
    'submit'
]);

/** Whether key presses on `target` edit text, so keyboard shortcuts must leave them alone. */
export function isTextEntry(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    if (
        target.isContentEditable ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
    ) {
        return true;
    }

    return target instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(target.type);
}
