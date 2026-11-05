import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'overmind-react';
import { vi } from 'vitest';
import { registerEditor } from 'src/pages/registerEditor';
import { Shape } from 'src/ui/components/Shape/Shape';
import { createTestStore } from './support/store';

/** How many Overmind tracking trees rendering one shape starts. */
const trackingTrees = () => {
    registerEditor();
    const { store } = createTestStore();
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 10, y: 20 },
        size: { width: 30, height: 40 },
        // A selected shape adds its handles, which read state themselves.
        selected: false
    });
    const [shapeId] = store.state.currentDocument.shapesIds;
    // overmind-react asks this for a new tree on each state hook call.
    const { proxyStateTreeInstance } = store as unknown as {
        proxyStateTreeInstance: { getTrackStateTree: () => unknown };
    };
    const trees = vi.spyOn(proxyStateTreeInstance, 'getTrackStateTree');

    renderToStaticMarkup(
        createElement(
            Provider,
            { value: store },
            createElement(Shape, { shapeId, inSelectedGroup: false, inClosedGroup: false })
        )
    );

    return trees.mock.calls.length;
};

describe('a shape on the canvas', () => {
    // Shapes render on every drag frame. Each state hook starts its own tracking
    // tree and subscription, so a shape reads all its state through one.
    it('reads its state through one tracking tree', () => {
        expect(trackingTrees()).toBe(1);
    });
});
