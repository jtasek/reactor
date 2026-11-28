import { containerStatesOf } from 'src/app/containerState';
import { groupAtPoint, groupFrame } from 'src/app/membership';
import type { Document } from 'src/app/types';
import { isShapeLocked } from 'src/app/utils';
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

describe('a selected group', () => {
    it('reads the container states its caller read once, not once per shape', () => {
        const store = storeWithGroups(30);
        const document = store.state.currentDocument;
        const states = containerStatesOf(document);
        const group = Object.values(document.groups)[1];
        let reads = 0;
        // Each read in a tracked render adds every path the states depend on,
        // about three per group, so each selected group cost as much as all groups.
        const counted = new Proxy(document, {
            get(target, key, receiver) {
                if (key === 'containerStates') {
                    reads++;
                }

                return Reflect.get(target, key, receiver);
            }
        }) as Document;

        expect(groupFrame(counted, group, states)?.box.width).toBe(16);
        expect(group.shapesIds.some((id) => isShapeLocked(counted, id, states))).toBe(false);
        expect(reads).toBe(0);
    });
});

describe('a click on the canvas', () => {
    it('leaves the entered group and component as they are when none is entered', () => {
        const store = storeWithGroups(3);
        store.actions.unselectShapes();
        const written: string[] = [];
        const stop = store.addMutationListener((mutation: { path: string }) => {
            written.push(mutation.path);
        });

        // Writing the same value still marks every derived value reading it as
        // changed, which worked out all group boxes again on each click.
        store.actions.events.setStartPosition({ x: 200, y: 200 });
        store.actions.events.setCurrentPosition({ x: 200, y: 200 });
        store.actions.selectShapes();
        store.actions.unselectShapes();
        stop();

        expect(written).not.toContain('enteredGroupId');
        expect(written).not.toContain('enteredComponentId');
        expect(written).not.toContain('selectedComponent');
    });
});
