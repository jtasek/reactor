import { registerTool } from 'src/app/actions/startup';
import { createShape } from 'src/app/factories';
import type { ShapeInput } from 'src/app/types';
import { RectTool } from 'src/tools/components/Rect';
import { createTestStore } from './support/store';

// Tools are registered by application startup, which the test store skips.
registerTool(RectTool);

const square = (x: number): ShapeInput => ({
    type: 'rectangle',
    position: { x, y: 0 },
    size: { width: 10, height: 10 }
});

const circle: ShapeInput = { type: 'circle', position: { x: 0, y: 0 }, radius: 5 };

function setup() {
    const { store } = createTestStore();
    const names = () =>
        store.state.currentDocument.shapesIds.map(
            (id) => store.state.currentDocument.shapes[id].name
        );

    return { store, names };
}

describe('a new shape’s name', () => {
    it('numbers each type of shape in its own sequence', () => {
        const { store, names } = setup();

        store.actions.addShape(square(0));
        store.actions.addShape(square(20));
        store.actions.addShape(circle);
        store.actions.addShape(square(40));

        expect(names()).toEqual(['rectangle-1', 'rectangle-2', 'circle-1', 'rectangle-3']);
    });

    it('goes on from the highest number its type has in the document', () => {
        const { store, names } = setup();

        store.actions.addShape({ ...square(0), name: 'rectangle-7' });
        store.actions.addShape({ ...square(20), name: 'Rectangle 9' });
        store.actions.addShape({ ...square(40), name: 'circle-12' });
        store.actions.addShape(square(60));

        expect(names()[3]).toBe('rectangle-8');
    });

    it('starts again in a new document, and keeps a name it was given', () => {
        const { store, names } = setup();

        store.actions.addShape(square(0));
        store.actions.newDocument();
        store.actions.addShape({ ...square(0), name: 'Logo' });
        store.actions.addShape(square(20));

        expect(names()).toEqual(['Logo', 'rectangle-1']);
    });

    it('is given to what a tool draws', () => {
        const { store, names } = setup();
        const { events, tools } = store.actions;

        tools.activateTool('rectangle');
        events.beginGesture({ pointerId: 1, position: { x: 0, y: 0 } });
        events.endGesture({ pointerId: 1, position: { x: 30, y: 20 } });
        tools.activateTool('rectangle');
        events.beginGesture({ pointerId: 1, position: { x: 50, y: 0 } });
        events.endGesture({ pointerId: 1, position: { x: 80, y: 20 } });

        expect(names()).toEqual(['rectangle-1', 'rectangle-2']);
    });

    it('is the next in its sequence for a pasted shape whose name is taken', () => {
        const { store, names } = setup();

        store.actions.addShape({ ...square(0), selected: true });
        store.actions.addShape({ ...square(20), name: 'Logo', selected: true });
        const copied = store.actions.copySelection()!;

        store.actions.pasteShapes(copied);
        store.actions.newDocument();
        store.actions.pasteShapes(copied);

        expect(names()).toEqual(['rectangle-1', 'Logo']);
        store.actions.openDocument(store.state.documentsIds[0]);
        expect(names()).toEqual(['rectangle-1', 'Logo', 'rectangle-2', 'rectangle-3']);
    });

    it('is in its type’s sequence when a shape is created without one', () => {
        const shape = createShape({ ...circle, order: 'a0' });

        expect(shape.name).toBe('circle-1');
    });
});
