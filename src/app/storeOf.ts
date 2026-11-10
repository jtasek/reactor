import { PROXY_TREE, type IProxyStateTree } from 'proxy-state-tree';
import type { Context } from '.';

/**
 * The store behind `reaction`'s state. `shapeState.ts` and `CommandAvailability` use
 * proxy-state-tree's tracking trees directly (as `untracked.ts` uses its markers);
 * `tests/shapeState.test.ts` and `tests/commandAvailability.test.ts` check them
 * after an upgrade.
 */
export function storeOf(reaction: Context['reaction']) {
    let store: IProxyStateTree<object, unknown> | undefined;

    // Reading the tree marker tracks nothing, so this reaction never fires.
    reaction(
        (state) => {
            store = (state as unknown as { [PROXY_TREE]: { root: typeof store } })[PROXY_TREE].root;

            return null;
        },
        () => {}
    )();

    return store!;
}
