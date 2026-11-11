import { groupAtPoint } from 'src/app/membership';
import type { Document } from 'src/app/types';
import { createTestStore } from './support/store';

/** A store with `count` groups of two rectangles each, side by side. */
function storeWithGroups(count: number) {
    const { store } = createTestStore();

    for (let index = 0; index < count * 2; index++) {
        store.actions.addShape({
            type: 'rectangle',
            position: { x: index * 10, y: 0 },
            size: { width: 6, height: 6 }
        });
    }
    const ids = store.state.currentDocument.shapesIds;

    for (let group = 0; group < count; group++) {
        store.actions.addGroup({ shapesIds: ids.slice(group * 2, group * 2 + 2) });
    }

    return store;
}

describe('the group under the pointer', () => {
    it('reads the table of group boxes once, however many groups there are', () => {
        const store = storeWithGroups(30);
        const document = store.state.currentDocument;
        let reads = 0;
        // In a tracked render every read of a derived value adds all the paths it
        // depends on again, so reading it per group cost groups × shapes.
        const counted = new Proxy(document, {
            get(target, key, receiver) {
                if (key === 'groupFrames') {
                    reads++;
                }

                return Reflect.get(target, key, receiver);
            }
        }) as Document;

        const group = groupAtPoint(counted, { x: 23, y: 3 }, null);

        expect(group?.shapesIds).toEqual(document.shapesIds.slice(2, 4));
        expect(reads).toBe(1);
    });
});
