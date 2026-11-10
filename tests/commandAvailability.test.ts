import { registerCommand } from 'src/app/actions/startup';
import { commandAvailable, publishCommandAvailability } from 'src/app/commandAvailability';
import { DeleteCommand } from 'src/commands';
import { watchCommandAvailability } from 'src/pages/CommandAvailability';
import { createTestStore } from './support/store';

// Commands are registered by application startup, which the test store skips.
registerCommand(DeleteCommand);

describe('command availability', () => {
    it('answers false for a command nothing was published for', () => {
        expect(commandAvailable('never-registered')).toBe(false);
    });

    it('keeps the last published answer per command', () => {
        publishCommandAvailability({ delete: true, group: false });

        expect(commandAvailable('delete')).toBe(true);
        expect(commandAvailable('group')).toBe(false);

        publishCommandAvailability({ delete: false, group: false });

        expect(commandAvailable('delete')).toBe(false);
    });
});

describe('watching the store for command availability', () => {
    function watchedStore() {
        const { store } = createTestStore();

        store.actions.addShape({
            type: 'rectangle',
            position: { x: 100, y: 100 },
            size: { width: 10, height: 10 },
            selected: false
        });
        publishCommandAvailability({});

        return { store, stop: watchCommandAvailability(store.reaction) };
    }

    it('answers at once and again with the change that enables a command', () => {
        const { store, stop } = watchedStore();
        const [id] = store.state.currentDocument.shapesIds;

        expect(commandAvailable(DeleteCommand.id)).toBe(false);

        store.actions.selectShape(id);
        expect(commandAvailable(DeleteCommand.id)).toBe(true);

        store.actions.unselectShapes();
        expect(commandAvailable(DeleteCommand.id)).toBe(false);
        stop();
    });

    it('asks no guard while a gesture moves shapes and catches up when it ends', () => {
        const { store, stop } = watchedStore();
        const [id] = store.state.currentDocument.shapesIds;

        store.actions.selectShape(id);
        store.actions.events.beginGesture({ pointerId: 1, position: { x: 105, y: 105 } });
        expect(store.state.events.pointer.gesture.kind).toBe('moving');

        const guard = vi.spyOn(DeleteCommand, 'canExecute');

        // What the guard reads changes mid-gesture, and no guard is asked until it is over.
        store.actions.events.startTyping();
        expect(guard).not.toHaveBeenCalled();

        store.actions.events.cancelGesture();
        expect(guard).toHaveBeenCalled();
        guard.mockRestore();
        stop();
    });

    it('lets go of shapes it no longer reads', () => {
        const { store, stop } = watchedStore();
        const [first] = store.state.currentDocument.shapesIds;

        store.actions.addShape({
            type: 'rectangle',
            position: { x: 200, y: 100 },
            size: { width: 10, height: 10 },
            selected: false
        });

        // Read the first shape while it is selected, then select only the second.
        store.actions.selectShape(first);
        store.actions.unselectShapes();
        store.actions.selectShape(store.state.currentDocument.shapesIds[1]);

        const guard = vi.spyOn(DeleteCommand, 'canExecute');

        // The first shape is no longer selected, so locking it asks no guard.
        store.actions.toggleShapeLocked(first);
        expect(guard).not.toHaveBeenCalled();
        guard.mockRestore();
        stop();
    });

    it('keeps answering after an answer fails', () => {
        const { store, stop } = watchedStore();
        const [id] = store.state.currentDocument.shapesIds;
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        // Collecting the answers fails once, after the gesture was read.
        const collect = vi.spyOn(Object, 'fromEntries').mockImplementationOnce(() => {
            throw new Error('unreadable');
        });

        store.actions.selectShape(id);
        collect.mockRestore();
        expect(commandAvailable(DeleteCommand.id)).toBe(false);

        store.actions.unselectShapes();
        store.actions.selectShape(id);
        expect(commandAvailable(DeleteCommand.id)).toBe(true);
        error.mockRestore();
        stop();
    });

    it('stops answering once stopped', () => {
        const { store, stop } = watchedStore();
        const [id] = store.state.currentDocument.shapesIds;

        stop();
        store.actions.selectShape(id);
        expect(commandAvailable(DeleteCommand.id)).toBe(false);
    });
});
