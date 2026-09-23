import { registerCommand } from 'src/app/actions/startup';
import { DeleteCommand } from 'src/commands/delete';
import { ZoomInCommand } from 'src/commands/zoom';
import { createTestStore } from './support/store';

// Commands are registered by application startup, which the test store skips.
registerCommand(DeleteCommand);
registerCommand(ZoomInCommand);

function storeWithShape(selected: boolean) {
    const { store } = createTestStore();

    store.actions.addShape({
        type: 'rectangle',
        position: { x: 0, y: 0 },
        size: { width: 10, height: 10 },
        selected
    });

    return store;
}

describe('running commands', () => {
    it('runs a command only when its guard allows it', () => {
        const unselected = storeWithShape(false);

        expect(unselected.actions.runCommand(DeleteCommand)).toBe(false);
        expect(unselected.state.currentDocument.shapesIds).toHaveLength(1);

        const selected = storeWithShape(true);

        expect(selected.actions.runCommand(DeleteCommand)).toBe(true);
        expect(selected.state.currentDocument.shapesIds).toHaveLength(0);
    });

    it('runs a typed command by id or name, ignoring case and spaces', () => {
        const store = storeWithShape(true);

        expect(store.actions.submitCommandLine('  Zoom In ')).toBeUndefined();
        expect(store.actions.submitCommandLine('zoom-in')).toBeUndefined();
        expect(store.state.currentDocument.camera.scale).toBeCloseTo(1.2);

        expect(store.actions.submitCommandLine('DELETE')).toBeUndefined();
        expect(store.state.currentDocument.shapesIds).toHaveLength(0);
    });

    it('reports typed commands that are unknown or cannot run, and ignores empty input', () => {
        const store = storeWithShape(false);

        expect(store.actions.submitCommandLine('fly')).toBe('Unknown command: fly');
        expect(store.actions.submitCommandLine('delete')).toBe('Delete is not available right now');
        expect(store.actions.submitCommandLine('   ')).toBeUndefined();
        expect(store.state.currentDocument.shapesIds).toHaveLength(1);
    });
});
