import { limitScale, panBy, screenToWorld, worldToScreen, zoomAt } from '../camera';

describe('camera math', () => {
    const camera = { scale: 2.5, position: { x: 40, y: -15 } };

    it('converts between world and surface-local coordinates', () => {
        const world = { x: -12, y: 32 };
        const screen = worldToScreen(world, camera);

        expect(screen).toEqual({ x: 10, y: 65 });
        expect(screenToWorld({ x: 10, y: 65 }, camera)).toEqual(world);
    });

    it('clamps zoom without moving its anchor', () => {
        const point = { x: 100, y: 85 };
        const next = zoomAt(camera, 100, point);

        expect(next).toEqual({ scale: 10, position: { x: -140, y: -315 } });
        expect(camera).toEqual({ scale: 2.5, position: { x: 40, y: -15 } });
    });

    it('uses a positive content-following pan independent of zoom', () => {
        expect(panBy(camera, { x: 30, y: -5 })).toEqual({
            scale: 2.5,
            position: { x: 70, y: -20 }
        });
    });

    it('clamps positive scale without quantizing continuous input', () => {
        expect(limitScale(0.001)).toBe(0.1);
        expect(limitScale(100)).toBe(10);
        expect(limitScale(1.012345)).toBe(1.012345);
    });

    it('does not introduce positional drift when already at the zoom limit', () => {
        const atLimit = { scale: 10, position: { x: 0.3, y: 0.7 } };

        expect(zoomAt(atLimit, 100, { x: 100.1, y: 200.2 })).toEqual(atLimit);
    });

    it.each([0, -1, NaN, Infinity, -Infinity])('rejects invalid scale %s', (scale) => {
        const invalidCamera = { ...camera, scale };
        const point = { x: 10, y: 20 };

        expect(limitScale(scale)).toBeNull();
        expect(zoomAt(camera, scale, point)).toBeNull();
        expect(screenToWorld(point, invalidCamera)).toBeNull();
        expect(worldToScreen(point, invalidCamera)).toBeNull();
        expect(panBy(invalidCamera, point)).toBeNull();
    });

    it('rejects non-finite points and overflowed results', () => {
        expect(zoomAt(camera, 2, { x: Infinity, y: 0 })).toBeNull();
        expect(panBy(camera, { x: NaN, y: 0 })).toBeNull();
        expect(worldToScreen({ x: Number.MAX_VALUE, y: 0 }, camera)).toBeNull();
        expect(screenToWorld({ x: Number.MAX_VALUE, y: 0 }, { ...camera, scale: 0.1 })).toBeNull();
    });
});
