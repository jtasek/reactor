import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'overmind-react';
import { vi } from 'vitest';
import { registerEditor } from 'src/pages/registerEditor';
import { Shape } from 'src/ui/components/Shape/Shape';
import { useComponentSource } from 'src/app/hooks';
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
    const render = () =>
        renderToStaticMarkup(
            createElement(
                Provider,
                { value: store },
                createElement(Shape, { shapeId, inSelectedGroup: false, inClosedGroup: false })
            )
        );
    // The first render also looks up the store behind the hooks, once per store.
    render();
    const trees = vi.spyOn(proxyStateTreeInstance, 'getTrackStateTree');

    render();

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

    it('draws an instance without reading its source members’ selection or hover', () => {
        registerEditor();
        const { store } = createTestStore();
        store.actions.addShape({
            type: 'rectangle',
            position: { x: 10, y: 20 },
            size: { width: 30, height: 40 },
            selected: false
        });
        const [memberId] = store.state.currentDocument.shapesIds;
        store.actions.addComponent({ shapesIds: [memberId] });
        const [componentId] = store.state.currentDocument.componentsIds;
        store.actions.insertComponentAt({ componentId, position: { x: 100, y: 100 } });
        const instanceId = store.state.currentDocument.shapesIds.find(
            (id) => store.state.currentDocument.shapes[id].type === 'instance'
        )!;
        const { proxyStateTreeInstance } = store as unknown as {
            proxyStateTreeInstance: { getTrackStateTree: () => unknown };
        };
        const trees = vi.spyOn(proxyStateTreeInstance, 'getTrackStateTree');

        const markup = renderToStaticMarkup(
            createElement(
                Provider,
                { value: store },
                createElement(Shape, {
                    shapeId: instanceId,
                    inSelectedGroup: false,
                    inClosedGroup: false
                })
            )
        );
        expect(markup).toContain('<rect');

        const member = `documents.${store.state.currentDocumentId}.shapes.${memberId}`;
        const paths = trees.mock.results.flatMap(({ value }) => [
            ...(value as { pathDependencies: Set<string> }).pathDependencies
        ]);

        // The member's fill is read, so the check would see its flags if they were.
        expect(paths).toContain(`${member}.fill`);
        expect(paths).not.toContain(`${member}.selected`);
        expect(paths).not.toContain(`${member}.active`);
    });
});

it('subscribes to source member order instead of the whole canvas order', () => {
    const { store } = createTestStore();
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 0, y: 0 },
        size: { width: 20, height: 20 }
    });
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 30, y: 0 },
        size: { width: 20, height: 20 }
    });
    const ids = [...store.state.currentDocument.shapesIds];
    store.actions.addComponent({ id: 'card', shapesIds: ids });
    const { proxyStateTreeInstance } = store as unknown as {
        proxyStateTreeInstance: { getTrackStateTree: () => unknown };
    };
    const trees = vi.spyOn(proxyStateTreeInstance, 'getTrackStateTree');
    const Source = () => {
        expect(useComponentSource('card')?.shapes.map(({ id }) => id)).toEqual(ids);

        return null;
    };

    renderToStaticMarkup(createElement(Provider, { value: store }, createElement(Source)));
    const paths = trees.mock.results.flatMap(({ value }) => [
        ...(value as { pathDependencies: Set<string> }).pathDependencies
    ]);
    const document = `documents.${store.state.currentDocumentId}`;

    expect(paths).not.toContain(`${document}.shapesIds`);
    for (const id of ids) {
        expect(paths).toContain(`${document}.shapes.${id}.order`);
    }
});
