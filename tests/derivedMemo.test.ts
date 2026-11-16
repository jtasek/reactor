import type { IProxyStateTree, ITrackStateTree } from 'proxy-state-tree';
import { registerCommand } from 'src/app/actions/startup';
import { commandAvailable, publishCommandAvailability } from 'src/app/commandAvailability';
import { readingDerivedOnce } from 'src/app/derivedMemo';
import { storeOf } from 'src/app/storeOf';
import type { Document } from 'src/app/types';
import { ShowAllCommand } from 'src/commands';
import { watchCommandAvailability } from 'src/pages/CommandAvailability';
import { createTestStore } from './support/store';

registerCommand(ShowAllCommand);

function storeWith(count: number) {
    const { store } = createTestStore();

    for (let index = 0; index < count; index++) {
        store.actions.addShape({
            type: 'rectangle',
            position: { x: index * 10, y: 0 },
            size: { width: 6, height: 6 }
        });
    }
    store.actions.unselectShapes();

    return store;
}

type Tree = ITrackStateTree<object, unknown>;

/** How many paths `read` adds to a tracking tree, and the paths it ends with. */
function track(store: ReturnType<typeof storeWith>, read: (tree: Tree) => void) {
    const proxies = storeOf(store.reaction) as IProxyStateTree<object, unknown>;
    const tree = proxies.getTrackStateTree() as Tree;
    let added = 0;

    tree.trackPathListeners.push(() => added++);
    tree.trackScope(() => read(tree));

    return { added, paths: new Set(tree.pathDependencies) };
}

const documentOf = (tree: Tree) => (tree.state as { currentDocument: Document }).currentDocument;

describe('reading derived values once per answer', () => {
    it('adds a derived value’s paths once however often it is read', () => {
        const store = storeWith(20);
        store.state.currentDocument.shapesIds.forEach((id) => store.actions.selectShape(id));
        const proxies = storeOf(store.reaction);
        // Worked out before, as a derived value usually is when guards read it.
        track(store, (tree) => documentOf(tree).selectedShapesIds.length);

        const once = track(store, (tree) => documentOf(tree).selectedShapesIds.length);
        const memoized = track(store, (tree) =>
            readingDerivedOnce(proxies, tree, () => {
                for (let read = 0; read < 10; read++) {
                    expect(documentOf(tree).selectedShapesIds).toHaveLength(20);
                }
            })
        );
        const plain = track(store, (tree) => {
            for (let read = 0; read < 10; read++) {
                documentOf(tree).selectedShapesIds.forEach(() => {});
            }
        });

        expect(memoized.paths).toEqual(once.paths);
        expect(memoized.added).toBe(once.added);
        expect(plain.added).toBeGreaterThan(5 * once.added);
    });

    it('still gives a derived value worked out later the paths of one read earlier', () => {
        const store = storeWith(3);
        const [first] = store.state.currentDocument.shapesIds;
        const proxies = storeOf(store.reaction);

        // `selectedShapes` reads `selectedShapesIds`, here already read in this answer.
        track(store, (tree) =>
            readingDerivedOnce(proxies, tree, () => {
                documentOf(tree).selectedShapesIds.forEach(() => {});
                documentOf(tree).selectedShapes.forEach(() => {});
            })
        );
        store.actions.selectShape(first);

        expect(store.state.currentDocument.selectedShapes.map((shape) => shape.id)).toEqual([
            first
        ]);
    });
});

describe('Show all', () => {
    it('is offered as soon as something is hidden, and no longer once it is shown', () => {
        const store = storeWith(3);
        const [, second] = store.state.currentDocument.shapesIds;
        publishCommandAvailability({});
        const stop = watchCommandAvailability(store.reaction);

        expect(commandAvailable(ShowAllCommand.id)).toBe(false);

        store.actions.hideShape(second);
        expect(commandAvailable(ShowAllCommand.id)).toBe(true);

        store.actions.showAll();
        expect(commandAvailable(ShowAllCommand.id)).toBe(false);
        stop();
    });
});
