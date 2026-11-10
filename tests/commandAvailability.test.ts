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
        const { store } = createTestStore();

        for (let index = 0; index < 30; index++) {
            store.actions.addShape({
                type: 'rectangle',
                position: { x: index * 10, y: 0 },
                size: { width: 6, height: 6 },
                selected: false
            });
        }

        const ids = store.state.currentDocument.shapesIds;
        const root = (
            store as unknown as {
                proxyStateTreeInstance: { addPathDependency: (...args: unknown[]) => void };
            }
        ).proxyStateTreeInstance;
        const addPath = vi.spyOn(root, 'addPathDependency');
        const stop = watchCommandAvailability(store.reaction);
        const subscribedForClick = (id: string) => {
            addPath.mockClear();
            store.actions.unselectShapes();
            store.actions.selectShape(id);

            return addPath.mock.calls.length;
        };
        subscribedForClick(ids[1]);
        const before = subscribedForClick(ids[0]);

        ids.forEach((id) => store.actions.selectShape(id));
        subscribedForClick(ids[1]);

        // Having read every shape once, a click costs what it did before.
        expect(subscribedForClick(ids[0])).toBe(before);
        addPath.mockRestore();
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
