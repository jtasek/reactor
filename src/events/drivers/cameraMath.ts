import type { Camera, Point } from 'src/app/types';

export const screenToWorld = (screen: Point, camera: Camera): Point => ({
    x: (screen.x - camera.position.x) / camera.scale,
    y: (screen.y - camera.position.y) / camera.scale
});

export const worldToScreen = (world: Point, camera: Camera): Point => ({
    x: world.x * camera.scale + camera.position.x,
    y: world.y * camera.scale + camera.position.y
});

export const zoomAt = (camera: Camera, newScale: number, screenPoint: Point): Camera => {
    const worldPoint = screenToWorld(screenPoint, camera);

    return {
        scale: newScale,
        position: {
            x: screenPoint.x - worldPoint.x * newScale,
            y: screenPoint.y - worldPoint.y * newScale
        }
    };
};

export const panBy = (camera: Camera, delta: Point): Camera => ({
    scale: camera.scale,
    position: {
        x: camera.position.x - delta.x,
        y: camera.position.y - delta.y
    }
});
