import type { IProxyStateTree } from 'proxy-state-tree';
import { registerEditor } from 'src/pages/registerEditor';
import { hasLayoutOffset, renderedShape } from 'src/app/frameLayout';
import { artworkModes } from 'src/app/modeHooks';
import { themeColors } from 'src/app/themeColors';
import { getShapeBounds, isShapeLocked, isShapeVisible, shapeGeometryKey } from 'src/app/utils';
import { isMeasuringShape } from 'src/ui/components/Shape/measuring';
import { trackShapeReads } from 'src/app/shapeState';
import { storeOf } from 'src/app/storeOf';
import type { Context } from 'src/app';
import { createTestStore } from './support/store';

type State = Context['state'];

/** What Shape reads to draw one shape. */
function readLikeShape(state: State, id: string) {
    const document = state.currentDocument;
    const shape = renderedShape(document, id);
    const visible = isShapeVisible(document, id);

    themeColors(shape, document, artworkModes(state, shape).modes);
    isShapeLocked(document, id);
    isMeasuringShape(state, id, visible);
    hasLayoutOffset(document, [id]);
    shapeGeometryKey(document.shapes[id]);

    return shape;
}

function documentOf(count: number) {
    registerEditor();
    const { store } = createTestStore();

    for (let index = 0; index < count; index++) {
        store.actions.addShape({
            type: 'rectangle',
            position: { x: index * 20, y: 0 },
            size: { width: 10, height: 10 },
            selected: false
        });
    }

    return store;
}

/** How many times `read` would render again while `change` runs. */
function rendersDuring(
    store: ReturnType<typeof documentOf>,
    read: (state: State) => unknown,
    change: () => void
) {
    const tracked = trackShapeReads(storeOf(store.reaction) as IProxyStateTree<object, unknown>);
    let renders = 0;

    read(tracked.state);
    const stop = tracked.subscribe(() => renders++);
    change();
    stop();

    return renders;
}

describe('a shape drawn on the canvas', () => {
    it('does not render again when other shapes are removed or added', () => {
        const store = documentOf(5);
        const [first, , , , last] = store.state.currentDocument.shapesIds;

        expect(
            rendersDuring(
                store,
                (state) => readLikeShape(state, last),
                () => store.actions.removeShapes([first])
            )
        ).toBe(0);
        expect(
            rendersDuring(
                store,
                (state) => readLikeShape(state, last),
                () =>
                    store.actions.addShape({
                        type: 'rectangle',
                        position: { x: 0, y: 40 },
                        size: { width: 10, height: 10 }
                    })
            )
        ).toBe(0);
    });

    it('renders again when it changes or is removed', () => {
        const store = documentOf(3);
        const [id] = store.state.currentDocument.shapesIds;

        expect(
            rendersDuring(
                store,
                (state) => readLikeShape(state, id),
                () => store.actions.selectShape(id)
            )
        ).toBe(1);
        expect(
            rendersDuring(
                store,
                (state) => readLikeShape(state, id),
                () => store.actions.removeShapes([id])
            )
        ).toBe(1);
    });

    it('renders again when adding another shape moves it in a stack', () => {
        const store = documentOf(3);
        const stackId = store.actions.editFrame({
            kind: 'add',
            position: { x: 0, y: 0 },
            size: { width: 300, height: 300 }
        })!;
        store.actions.editFrame({
            kind: 'update',
            id: stackId,
            changes: {
                stack: { direction: 'column', gap: 10, padding: 0, align: 'center' },
                sizing: { width: { mode: 'hug' } }
            }
        });
        const add = (width: number) =>
            store.actions.addShape({
                type: 'rectangle',
                parentFrameId: stackId,
                position: { x: 0, y: 0 },
                size: { width, height: 10 },
                selected: false
            });
        add(10);
        const first = store.state.currentDocument.shapesIds.at(-1)!;
        const before = getShapeBounds(renderedShape(store.state.currentDocument, first)).topLeft.x;

        // Nothing it reads changes but the stack's layout, a derived value.
        expect(
            rendersDuring(
                store,
                (state) => readLikeShape(state, first),
                () => add(100)
            )
        ).toBe(1);
        expect(
            getShapeBounds(renderedShape(store.state.currentDocument, first)).topLeft.x
        ).not.toBe(before);
    });

    it('renders again when it reads every shape or the shape list', () => {
        const store = documentOf(3);
        const added = () =>
            store.actions.addShape({
                type: 'rectangle',
                position: { x: 0, y: 40 },
                size: { width: 10, height: 10 }
            });
        const [first] = store.state.currentDocument.shapesIds;

        expect(
            rendersDuring(
                store,
                (state) => Object.values(state.currentDocument.shapes).length,
                added
            )
        ).toBe(1);
        expect(
            rendersDuring(
                store,
                (state) => state.currentDocument.shapesIds.length,
                () => store.actions.removeShapes([first])
            )
        ).toBe(1);
    });
});
