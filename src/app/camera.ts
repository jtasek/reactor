import type { Camera, Point } from './types';

export const DEFAULT_SCALE = 1;
export const MIN_SCALE = 0.1;
export const MAX_SCALE = 10;
export const ZOOM_STEP = 0.1;

export const isFinitePoint = (point: Point): boolean =>
    Number.isFinite(point.x) && Number.isFinite(point.y);

export const isValidCamera = (camera: Camera): boolean =>
    Number.isFinite(camera.scale) && camera.scale > 0 && isFinitePoint(camera.position);

export function limitScale(scale: number): number | null {
    if (!Number.isFinite(scale) || scale <= 0) {
        return null;
    }

    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** Coordinates are surface-local SVG units, not viewport client pixels. */
export function screenToWorld(screen: Point, camera: Camera): Point | null {
    if (!isFinitePoint(screen) || !isValidCamera(camera)) {
        return null;
    }

    const point = {
        x: (screen.x - camera.position.x) / camera.scale,
        y: (screen.y - camera.position.y) / camera.scale
    };

    return isFinitePoint(point) ? point : null;
}

export function worldToScreen(world: Point, camera: Camera): Point | null {
    if (!isFinitePoint(world) || !isValidCamera(camera)) {
        return null;
    }

    const point = {
        x: world.x * camera.scale + camera.position.x,
        y: world.y * camera.scale + camera.position.y
    };

    return isFinitePoint(point) ? point : null;
}

export function zoomAt(camera: Camera, scale: number, point?: Point): Camera | null {
    const nextScale = limitScale(scale);

    if (nextScale === null || !isValidCamera(camera) || (point && !isFinitePoint(point))) {
        return null;
    }

    if (!point || nextScale === camera.scale) {
        return { scale: nextScale, position: { ...camera.position } };
    }

    const world = screenToWorld(point, camera);

    return world ? placeWorldPoint(camera, nextScale, world, point) : null;
}

/** Scales the camera and positions it so `world` is drawn at the surface-local `screen` point. */
export function placeWorldPoint(
    camera: Camera,
    scale: number,
    world: Point,
    screen: Point
): Camera | null {
    const nextScale = limitScale(scale);

    if (
        nextScale === null ||
        !isValidCamera(camera) ||
        !isFinitePoint(world) ||
        !isFinitePoint(screen)
    ) {
        return null;
    }

    const position = {
        x: screen.x - world.x * nextScale,
        y: screen.y - world.y * nextScale
    };

    return isFinitePoint(position) ? { scale: nextScale, position } : null;
}

/** Positive deltas move content right/down in surface-local SVG units. */
export function panBy(camera: Camera, delta: Point): Camera | null {
    if (!isValidCamera(camera) || !isFinitePoint(delta)) {
        return null;
    }

    const position = {
        x: camera.position.x + delta.x,
        y: camera.position.y + delta.y
    };

    return isFinitePoint(position) ? { scale: camera.scale, position } : null;
}
