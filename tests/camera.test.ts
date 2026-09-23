import { describe, expect, it } from 'vitest';
import { ZoomInCommand, ZoomOutCommand, ZoomResetCommand } from 'src/commands/zoom';
import { createTestStore } from './support/store';

describe('camera actions', () => {
    it('bounds command zoom and disables commands at their limits', () => {
        const { store } = createTestStore();

        for (let index = 0; index < 120; index++) {
            store.actions.executeCommand(ZoomInCommand.execute);
        }

        expect(store.state.currentDocument.camera.scale).toBe(10);
        expect(store.actions.canExecuteCommand(ZoomInCommand.canExecute)).toBe(false);

        for (let index = 0; index < 120; index++) {
            store.actions.executeCommand(ZoomOutCommand.execute);
        }

        expect(store.state.currentDocument.camera.scale).toBe(0.1);
        expect(store.actions.canExecuteCommand(ZoomOutCommand.canExecute)).toBe(false);

        store.actions.executeCommand(ZoomResetCommand.execute);

        expect(store.state.currentDocument.camera.scale).toBe(1);
    });

    it('clamps custom tool zoom steps without overshooting', () => {
        const { store } = createTestStore();

        store.actions.tools.zoomIn(100);

        expect(store.state.currentDocument.camera.scale).toBe(10);

        store.actions.tools.zoomOut(100);

        expect(store.state.currentDocument.camera.scale).toBe(0.1);
    });

    it.each([0, -1, NaN, Infinity, -Infinity])('ignores invalid scale or step %s', (value) => {
        const { store } = createTestStore();

        store.actions.tools.zoom({ scale: value });
        store.actions.tools.zoomIn(value);
        store.actions.tools.zoomOut(value);

        expect(store.state.currentDocument.camera).toEqual({ scale: 1, position: { x: 0, y: 0 } });
    });

    it('preserves camera position for absolute slider zoom', () => {
        const { store } = createTestStore();

        store.actions.tools.panCamera({ dx: 90, dy: -40 });
        store.actions.tools.zoom({ scale: 2 });

        expect(store.state.currentDocument.camera).toEqual({
            scale: 2,
            position: { x: 90, y: -40 }
        });
    });

    it.each([0, NaN, Infinity, -Infinity])('ignores wheel delta %s', (deltaY) => {
        const { store } = createTestStore();

        store.actions.tools.zoomAtPoint({ point: { x: 80, y: 50 }, deltaY });

        expect(store.state.currentDocument.camera).toEqual({ scale: 1, position: { x: 0, y: 0 } });
    });

    it('composes continuous pinch updates around the same anchor without rounding', () => {
        const { store } = createTestStore();
        const point = { x: 80, y: 60 };

        store.actions.tools.panCamera({ dx: 20, dy: -30 });

        for (let index = 0; index < 10; index++) {
            store.actions.tools.zoomAtPoint({ point, deltaY: -0.5 });
        }

        const camera = store.state.currentDocument.camera;

        expect(camera.scale).toBeCloseTo(Math.exp(0.05), 12);
        expect((point.x - camera.position.x) / camera.scale).toBeCloseTo(60, 12);
        expect((point.y - camera.position.y) / camera.scale).toBeCloseTo(90, 12);
    });

    it('bounds extreme wheel deltas and ignores invalid pan and anchor coordinates', () => {
        const { store } = createTestStore();

        store.actions.tools.panCamera({ dx: NaN, dy: 1 });
        store.actions.tools.zoomAtPoint({ point: { x: Infinity, y: 0 }, deltaY: -1 });

        expect(store.state.currentDocument.camera).toEqual({ scale: 1, position: { x: 0, y: 0 } });

        store.actions.tools.zoomAtPoint({ point: { x: 0, y: 0 }, deltaY: -Number.MAX_VALUE });

        expect(store.state.currentDocument.camera.scale).toBe(10);

        store.actions.tools.zoomAtPoint({ point: { x: 0, y: 0 }, deltaY: Number.MAX_VALUE });

        expect(store.state.currentDocument.camera.scale).toBe(0.1);
    });
});
