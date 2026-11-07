import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'overmind-react';
import { vi } from 'vitest';
import { registerEditor } from 'src/pages/registerEditor';
import { Shape } from 'src/ui/components/Shape/Shape';
import { createTestStore } from './support/store';
import { useScreenViewContainers } from 'src/app/frameHooks';
import { projectScreenViews } from 'src/app/screenProjection';
import { ScreenViews } from 'src/ui/components/Frames/ScreenViews';

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

    it('does not place Screen view artwork for absent container selections', () => {
        registerEditor();
        const { store } = createTestStore();
        const screenId = store.actions.editFrame({
            kind: 'add',
            position: { x: 100, y: 80 },
            size: { width: 300, height: 200 }
        })!;
        store.actions.editFrame({ kind: 'update', id: screenId, changes: { kind: 'screen' } });
        store.actions.addShape({
            type: 'rectangle',
            parentFrameId: screenId,
            position: { x: 120, y: 100 },
            size: { width: 40, height: 30 },
            selected: true
        });
        const { view, projection } = projectScreenViews(store.state.currentDocument)[0];
        const shapes = vi.fn(() => projection!.shapes);
        const input = {
            ...projection!,
            get shapes() {
                return shapes();
            }
        };
        const Containers = () => {
            expect(useScreenViewContainers(view.id, input, true)).toEqual([]);

            return null;
        };

        renderToStaticMarkup(createElement(Provider, { value: store }, createElement(Containers)));
        expect(shapes).not.toHaveBeenCalled();
    });

    it('reads Screen view selection apart from the projected artwork', () => {
        registerEditor();
        const { store } = createTestStore();
        const screenId = store.actions.editFrame({
            kind: 'add',
            position: { x: 100, y: 80 },
            size: { width: 300, height: 200 }
        })!;
        store.actions.editFrame({ kind: 'update', id: screenId, changes: { kind: 'screen' } });
        store.actions.addShape({
            type: 'rectangle',
            parentFrameId: screenId,
            position: { x: 120, y: 100 },
            size: { width: 40, height: 30 },
            selected: true
        });
        const [shapeId] = store.state.currentDocument.shapesIds;
        const { proxyStateTreeInstance } = store as unknown as {
            proxyStateTreeInstance: { getTrackStateTree: () => unknown };
        };
        const trees = vi.spyOn(proxyStateTreeInstance, 'getTrackStateTree');

        const markup = renderToStaticMarkup(
            createElement(Provider, { value: store }, createElement(ScreenViews))
        );
        expect(markup).toContain(`data-shape-id="${shapeId}"`);

        const shape = `documents.${store.state.currentDocumentId}.shapes.${shapeId}`;
        const readers = trees.mock.results
            .map(({ value }) => [...(value as { pathDependencies: Set<string> }).pathDependencies])
            .filter((paths) => paths.includes(`${shape}.selected`));

        // Only the outline reads the flag, so selecting repaints no artwork.
        expect(readers).toHaveLength(1);
        expect(
            readers[0].filter((path) => !shape.startsWith(path) && path !== 'currentDocumentId')
        ).toEqual([`${shape}.selected`]);
    });
});
