import { describe, expect, it } from 'vitest';
import { createCircleProps } from 'src/tools/components/Circle';
import { createEllipseProps } from 'src/tools/components/Ellipse';
import { createImageProps } from 'src/tools/components/Image';
import { createLineProps } from 'src/tools/components/Line';
import { createPenProps } from 'src/tools/components/Pen';
import { createRectProps } from 'src/tools/components/Rect';
import { createTestStore } from './support/store';
import { createTextProps } from 'src/tools/components/Text';
import { serializePersistedState } from 'src/app/services/documentStorage';

describe('real persisted documents', () => {
    it('preserves geometry and content produced by every drawing tool', async () => {
        const { store } = createTestStore();

        store.actions.events.setStartPosition({ x: 10, y: 20 });
        store.actions.events.setCurrentPosition({ x: 50, y: 70 });
        store.actions.events.updatePath({ x: 10, y: 20 });
        store.actions.events.updatePath({ x: 50, y: 70 });
        store.actions.events.typing('Restored text');

        const { keyboard, pointer } = store.state.events;
        const properties = [
            createCircleProps(pointer),
            createEllipseProps(pointer),
            createImageProps(pointer),
            createLineProps(pointer),
            createPenProps(pointer),
            createRectProps(pointer),
            createTextProps(pointer, keyboard)
        ];

        properties.forEach((props) => store.actions.addShape(props));

        const saved = serializePersistedState(store.state);
        const restored = createTestStore({ reactor: JSON.stringify(saved) });

        await restored.store.onInitialize();

        expect(restored.store.state.notifications).toEqual([]);
        expect(serializePersistedState(restored.store.state)).toEqual(saved);

        const shapes = Object.values(restored.store.state.currentDocument.shapes);

        properties.forEach((props, index) => {
            const { key, selected, ...durable } = props;

            expect(shapes[index]).toMatchObject(durable);
            expect(shapes[index].key).not.toBe(key);
            expect(shapes[index].selected).toBe(!selected);
        });
    });

    it('retains live derived indexes and dates after JSON restore', async () => {
        const first = createTestStore();

        first.store.actions.addShape({
            type: 'rectangle',
            position: { x: 0, y: 0 },
            size: { width: 20, height: 30 }
        });

        const saved = JSON.stringify(serializePersistedState(first.store.state));
        const { store } = createTestStore({ reactor: saved });

        await store.onInitialize();

        store.actions.addShape({
            type: 'rectangle',
            position: { x: 5, y: 6 },
            size: { width: 10, height: 20 }
        });

        expect(store.state.currentDocument.shapesIds).toHaveLength(2);
        expect(store.state.currentDocument.created).toBeInstanceOf(Date);

        const document = store.state.currentDocument;
        const [restoredId, addedId] = document.shapesIds;

        expect(document.shapes[restoredId].created).toBeInstanceOf(Date);
        expect(document.selectedShapesIds).toEqual([addedId]);

        store.actions.selectShape(restoredId);

        expect(document.selectedShapesIds).toEqual([restoredId, addedId]);
        expect(document.selectedShapes.map((shape) => shape.id)).toEqual([restoredId, addedId]);

        store.actions.removeShape(restoredId);

        expect(document.shapesIds).toEqual([addedId]);
        expect(document.selectedShapesIds).toEqual([addedId]);
        expect(document.selectedShapes.map((shape) => shape.id)).toEqual([addedId]);

        const roundtrip = createTestStore({
            reactor: JSON.stringify(serializePersistedState(store.state))
        });

        await roundtrip.store.onInitialize();

        expect(roundtrip.store.state.currentDocument.shapesIds).toEqual([addedId]);
        expect(roundtrip.store.state.currentDocument.selectedShapesIds).toEqual([]);
    });
});
