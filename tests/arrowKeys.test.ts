import { registerCommand } from 'src/app/actions/startup';
import { Collaboration } from 'src/app/services/collaboration';
import * as commands from 'src/commands';
import type { KeyPress } from 'src/events/shortcuts';
import type { Rectangle } from 'src/app/types';
import { createTestStore } from './support/store';

// Commands are registered by the editor page, which the test store skips.
Object.values(commands).forEach(registerCommand);

const press = (key: string, repeat = false): KeyPress => ({
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    repeat
});

function setup(
    { selected = false, locked = false }: { selected?: boolean; locked?: boolean },
    arrowKeyStep?: number
) {
    const collaboration = new Collaboration();
    const { store } = createTestStore({}, { arrowKeyStep, collaboration });

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

    return { store, collaboration, position, camera };
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

    it('pan the canvas when the selection is locked, and move no locked shape', () => {
        const { store, position, camera } = setup({ selected: true, locked: true });
        const step = store.state.config.arrowKeyStep;

        store.actions.events.pressShortcut(press('ArrowRight'));

        expect(position()).toEqual({ x: 100, y: 100 });
        expect(camera()).toEqual({ x: -step, y: 0 });
    });

    it('share a held key’s moves once, when it is released', () => {
        const { store, collaboration } = setup({ selected: true });
        const pause = vi.spyOn(collaboration, 'pause');
        const resume = vi.spyOn(collaboration, 'resume');

        store.actions.events.pressShortcut(press('ArrowRight'));
        expect(pause).not.toHaveBeenCalled();

        store.actions.events.pressShortcut(press('ArrowRight', true));
        store.actions.events.pressShortcut(press('ArrowRight', true));
        expect(pause).toHaveBeenCalledTimes(1);
        expect(resume).not.toHaveBeenCalled();

        store.actions.events.releaseKeys();
        expect(resume).toHaveBeenCalledTimes(1);
    });

    it('do nothing while text is typed or the pointer is pressed', () => {
        const { store, position, camera } = setup({ selected: true });

        store.actions.events.startTyping();
        expect(store.actions.events.pressShortcut(press('ArrowRight'))).toBe(false);
        store.actions.events.endTyping();

        // A press on the shape, still within a click's slip.
        store.actions.events.beginGesture({ pointerId: 1, position: { x: 105, y: 105 } });
        expect(store.actions.events.pressShortcut(press('ArrowRight'))).toBe(false);
        store.actions.events.cancelGesture();

        expect(position()).toEqual({ x: 100, y: 100 });
        expect(camera()).toEqual({ x: 0, y: 0 });
    });
});
