import type { IProxyStateTree } from 'proxy-state-tree';
import { storeAnswer } from 'src/app/storeAnswer';
import { storeOf } from 'src/app/storeOf';
import type { Context } from 'src/app';
import { createTestStore } from './support/store';

type State = Context['state'];

function setup() {
    const { store } = createTestStore();

    for (let index = 0; index < 3; index++) {
        store.actions.addShape({
            type: 'rectangle',
            position: { x: index * 20, y: 0 },
            size: { width: 10, height: 10 },
            selected: false
        });
    }

    return store;
}

/** How many times an answer of `read` hears of a change while `change` runs. */
function changesDuring(
    store: ReturnType<typeof setup>,
    read: (state: State) => unknown,
    change: () => void
) {
    const answer = storeAnswer(storeOf(store.reaction) as IProxyStateTree<object, unknown>, read);
    let heard = 0;

    answer.read();
    const stop = answer.subscribe(() => heard++);
    change();
    stop();

    return heard;
}

it('hears once per action that changes what it read, and not of other changes', () => {
    const store = setup();
    const [first] = store.state.currentDocument.shapesIds;
    const selected = (state: State) => state.currentDocument.selectedShapesIds;

    expect(changesDuring(store, selected, () => store.actions.selectShape(first))).toBe(1);
    expect(
        changesDuring(store, selected, () =>
            store.actions.setShapesProperty({ shapeIds: [first], key: 'name', value: 'Renamed' })
        )
    ).toBe(0);
});

it('hears of a write of the same value as no change', () => {
    const store = setup();
    const visible = (state: State) => state.ui.contextMenu.visible;

    expect(store.state.ui.contextMenu.visible).toBe(false);
    expect(changesDuring(store, visible, () => store.actions.ui.hideContextMenu())).toBe(0);
});

it('hears of a shape added to a table it went through', () => {
    const store = setup();
    const count = (state: State) => Object.keys(state.currentDocument.shapes).length;

    expect(
        changesDuring(store, count, () =>
            store.actions.addShape({
                type: 'rectangle',
                position: { x: 0, y: 40 },
                size: { width: 10, height: 10 }
            })
        )
    ).toBe(1);
});
