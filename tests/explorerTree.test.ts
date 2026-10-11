import { sceneLayers } from 'src/app/componentTree';
import { outline } from 'src/app/membership';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { isShapeVisible } from 'src/app/utils';
import { createTestStore } from './support/store';

it('lists each source only under Components and scene objects under their layer or Surface', () => {
    const { store } = createTestStore();
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 10, y: 20 },
        size: { width: 30, height: 40 }
    });
    const document = store.state.currentDocument;
    const sourceId = document.shapesIds[0];
    store.actions.createComponentFromSelection();
    const componentId = document.componentsIds[0];
    const instanceId = document.shapesIds[1];
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 100, y: 20 },
        size: { width: 30, height: 40 }
    });
    const sceneId = document.shapesIds[2];
    store.actions.addGroup({ id: 'scene-group', shapesIds: [sourceId, sceneId] });

    expect(sceneLayers(outline(document), document)).toEqual([
        {
            layerId: null,
            groups: [{ groupId: 'scene-group', shapesIds: [sceneId] }],
            shapesIds: [instanceId]
        }
    ]);
    expect(isShapeVisible(document, sourceId)).toBe(false);
    store.actions.editComponentSource(componentId);
    expect(isShapeVisible(document, sourceId)).toBe(true);
    expect(isShapeVisible(document, sceneId)).toBe(false);
    store.actions.leaveComponentSource();
    expect(isShapeVisible(document, sceneId)).toBe(true);
    expect(document.selectedShapesIds).toEqual([instanceId]);
});

it('selecting a layer leaves layer isolation to its separate control', () => {
    const { store } = createTestStore();
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 10, y: 20 },
        size: { width: 30, height: 40 }
    });
    const document = store.state.currentDocument;
    store.actions.addLayer({ id: 'walls', name: 'Walls', shapesIds: [...document.shapesIds] });

    store.actions.selectExplorerLayer('walls');
    expect(document.layers.walls.selected).toBe(true);
    expect(document.shownLayerId).toBeUndefined();
    store.actions.selectShape(document.shapesIds[0]);
    expect(document.layers.walls.selected).toBe(true);
    store.actions.unselectShapes();
    expect(document.layers.walls.selected).toBe(false);
});

it('selects Surface without creating or saving a layer', () => {
    const { store } = createTestStore();
    const document = store.state.currentDocument;

    store.actions.selectExplorerLayer(null);
    expect(document.surfaceSelected).toBe(true);
    expect(document.layers).toEqual({});
    const saved = serializePersistedState(store.state);
    expect(saved.documents[document.id]).not.toHaveProperty('surfaceSelected');

    store.actions.addLayer({ id: 'walls', name: 'Walls' });
    store.actions.selectExplorerLayer('walls');
    expect(document.surfaceSelected).not.toBe(true);
    expect(document.layers.walls.selected).toBe(true);

    store.actions.selectExplorerLayer(null);
    expect(document.surfaceSelected).toBe(true);
    expect(document.layers.walls.selected).toBe(false);
    store.actions.unselectShapes();
    expect(document.surfaceSelected).not.toBe(true);
});

it('keeps existing canvas sources in their layer tree', () => {
    const { store } = createTestStore();
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 10, y: 20 },
        size: { width: 30, height: 40 }
    });
    const document = store.state.currentDocument;
    const shapeId = document.shapesIds[0];
    store.actions.addComponent({ shapesIds: [shapeId] });

    expect(sceneLayers(outline(document), document)[0].shapesIds).toEqual([shapeId]);
    expect(isShapeVisible(document, shapeId)).toBe(true);
});
