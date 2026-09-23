import { GroupCommand } from 'src/commands/group';
import { DeleteCommand } from 'src/commands/delete';
import { LayerCommand } from 'src/commands/layer';
import {
    PERSISTENCE_KEY,
    SCHEMA_VERSION,
    migratePersistedState,
    serializePersistedState
} from 'src/app/services/documentStorage';
import { isShapeVisible } from 'src/app/utils';
import { createTestStore } from './support/store';

function setup() {
    const { store } = createTestStore();
    const addRect = (x: number, selected = false) => {
        store.actions.addShape({
            type: 'rectangle',
            position: { x, y: 0 },
            size: { width: 100, height: 100 },
            selected
        });

        const ids = store.state.currentDocument.shapesIds;

        return ids[ids.length - 1];
    };
    const pressAt = (x: number, y: number) => {
        store.actions.events.setCurrentPosition({ x, y });

        return store.actions.selectShapeAtPointer();
    };

    return { store, addRect, pressAt, document: () => store.state.currentDocument };
}

describe('shape visibility policy', () => {
    it('hides a shape when it or any group or layer containing it is hidden', () => {
        const { store, addRect, document } = setup();
        const id = addRect(0);

        expect(isShapeVisible(document(), id)).toBe(true);

        store.actions.addGroup({ id: 'group', shapesIds: [id], visible: true });
        store.actions.addLayer({ id: 'layer', shapesIds: [id], visible: false });

        expect(isShapeVisible(document(), id)).toBe(false);

        store.actions.showLayer('layer');
        store.actions.hideGroup('group');

        expect(isShapeVisible(document(), id)).toBe(false);

        store.actions.showGroup('group');
        store.actions.hideShape(id);

        expect(isShapeVisible(document(), id)).toBe(false);
        expect(isShapeVisible(document(), 'missing')).toBe(false);
    });

    it('does not let a hidden topmost shape intercept a press', () => {
        const { store, addRect, pressAt, document } = setup();
        const bottom = addRect(0);
        const top = addRect(0);

        store.actions.hideShape(top);

        expect(pressAt(50, 50)).toBe(true);
        expect(document().shapes[bottom].selected).toBe(true);
        expect(document().shapes[top].selected).toBe(false);
    });

    it('ignores shapes in a hidden layer for presses and marquee selection', () => {
        const { store, addRect, pressAt, document } = setup();
        const id = addRect(0);

        store.actions.addLayer({ id: 'layer', shapesIds: [id], visible: false });

        expect(pressAt(50, 50)).toBe(false);

        store.actions.events.setStartPosition({ x: -10, y: -10 });
        store.actions.events.setCurrentPosition({ x: 200, y: 200 });
        store.actions.selectShapes();

        expect(document().shapes[id].selected).toBe(false);
    });

    it('excludes hidden shapes from the selection that commands act on', () => {
        const { store, addRect, document } = setup();
        const visible = addRect(0, true);
        const hidden = addRect(200, true);

        store.actions.hideShape(hidden);

        expect(document().selectedShapesIds).toEqual([visible]);

        store.actions.runCommand(DeleteCommand);

        expect(document().shapesIds).toEqual([hidden]);
    });

    it('does not move, resize or rotate hidden shapes', () => {
        const { store, addRect, document } = setup();
        const id = addRect(0, true);

        store.actions.addLayer({ id: 'layer', shapesIds: [id], visible: false });
        store.actions.moveSelectedShapes({ x: 10, y: 10 });
        store.actions.resizeShape({
            shapeId: id,
            handlerType: 'bottomRight',
            position: { x: 300, y: 300 }
        });
        store.actions.rotateShape({ shapeId: id, position: { x: 500, y: 50 } });

        expect(document().shapes[id]).toMatchObject({
            position: { x: 0, y: 0 },
            size: { width: 100, height: 100 },
            rotation: 0
        });
    });

    it('creates groups and layers visible so grouping never hides shapes', () => {
        const { store, addRect, document } = setup();
        const id = addRect(0, true);

        store.actions.runCommand(GroupCommand);
        store.actions.runCommand(LayerCommand);

        expect(Object.values(document().groups).map((group) => group.visible)).toEqual([true]);
        expect(Object.values(document().layers).map((layer) => layer.visible)).toEqual([true]);
        expect(isShapeVisible(document(), id)).toBe(true);
    });
});

describe('visibility migration', () => {
    function savedWithHiddenLayer(version: number) {
        const { store, addRect } = setup();
        const id = addRect(0);

        store.actions.addLayer({ id: 'layer', shapesIds: [id], visible: false });
        store.actions.addGroup({ id: 'group', shapesIds: [id], visible: false });

        return { id, payload: { ...serializePersistedState(store.state), version } };
    }

    it.each([1, 2])(
        'shows groups and layers saved by version %i, which never hid their shapes',
        (version) => {
            const { payload } = savedWithHiddenLayer(version);
            const migrated = migratePersistedState(payload);
            const document = migrated?.documents['test-document'];

            expect(migrated?.version).toBe(SCHEMA_VERSION);
            expect(document?.layers.layer.visible).toBe(true);
            expect(document?.groups.group.visible).toBe(true);
        }
    );

    it('keeps hidden groups and layers saved by the current version', () => {
        const { payload } = savedWithHiddenLayer(SCHEMA_VERSION);
        const document = migratePersistedState(payload)?.documents['test-document'];

        expect(document?.layers.layer.visible).toBe(false);
        expect(document?.groups.group.visible).toBe(false);
    });

    it('backs up the previous version before restoring it', async () => {
        const { payload } = savedWithHiddenLayer(2);
        const original = JSON.stringify(payload);
        const { store, storage } = createTestStore({ [PERSISTENCE_KEY]: original });

        await store.onInitialize();

        expect(storage.get(`${PERSISTENCE_KEY}:backup`)).toBe(original);
        expect(store.state.currentDocument.layers.layer.visible).toBe(true);
    });
});
