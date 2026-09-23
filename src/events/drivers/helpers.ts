import type { Camera, Point } from 'src/app/types';
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
