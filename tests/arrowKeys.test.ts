import { registerCommand } from 'src/app/actions/startup';
import * as commands from 'src/commands';
import type { KeyPress } from 'src/events/shortcuts';
import type { Rectangle } from 'src/app/types';
import { createTestStore } from './support/store';

// Commands are registered by the editor page, which the test store skips.
Object.values(commands).forEach(registerCommand);

const press = (key: string): KeyPress => ({
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false
});

function setup(
    { selected = false, locked = false }: { selected?: boolean; locked?: boolean },
    arrowKeyStep?: number
) {
    const { store } = createTestStore({}, { arrowKeyStep });

    store.actions.addShape({
        type: 'rectangle',
        position: { x: 100, y: 100 },
        size: { width: 10, height: 10 },
        selected,
        locked
    });

    const [shapeId] = store.state.currentDocument.shapesIds;
    const position = () => (store.state.currentDocument.shapes[shapeId] as Rectangle).position;
    const camera = () => store.state.currentDocument.camera.position;

    return { store, position, camera };
}

describe('arrow keys', () => {
    it('move the selected shapes by the configured step', () => {
        const { store, position, camera } = setup({ selected: true });
        const step = store.state.config.arrowKeyStep;

        expect(store.actions.events.pressShortcut(press('ArrowRight'))).toBe(true);
        expect(store.actions.events.pressShortcut(press('ArrowDown'))).toBe(true);
        expect(position()).toEqual({ x: 100 + step, y: 100 + step });

        store.actions.events.pressShortcut(press('ArrowLeft'));
        store.actions.events.pressShortcut(press('ArrowLeft'));
        store.actions.events.pressShortcut(press('ArrowUp'));
        expect(position()).toEqual({ x: 100 - step, y: 100 });
        expect(camera()).toEqual({ x: 0, y: 0 });
    });

    it('take a step changed in the configuration', () => {
        const { store, position } = setup({ selected: true }, 3);

        store.actions.events.pressShortcut(press('ArrowRight'));

        expect(position()).toEqual({ x: 103, y: 100 });
    });

    it('pan the canvas by the step when nothing is selected', () => {
        const { store, position, camera } = setup({});
        const step = store.state.config.arrowKeyStep;

        expect(store.actions.events.pressShortcut(press('ArrowRight'))).toBe(true);
        expect(camera()).toEqual({ x: -step, y: 0 });

        store.actions.events.pressShortcut(press('ArrowUp'));
        expect(camera()).toEqual({ x: -step, y: step });
        expect(position()).toEqual({ x: 100, y: 100 });
    });

    it('move no locked shape, and pan no canvas under a selection', () => {
        const { store, position, camera } = setup({ selected: true, locked: true });

        store.actions.events.pressShortcut(press('ArrowRight'));

        expect(position()).toEqual({ x: 100, y: 100 });
        expect(camera()).toEqual({ x: 0, y: 0 });
    });
});
