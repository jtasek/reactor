import { componentSource } from 'src/app/componentSource';
import { componentPropValue, instanceMember } from 'src/app/componentProps';
import { componentFingerprint } from 'src/app/componentLibrary';
import { isShapeVisible } from 'src/app/utils';
import { restoreDocuments, serializePersistedState } from 'src/app/services/documentStorage';
import { createTestStore } from './support/store';

function setup() {
    const { store } = createTestStore();
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 10, y: 20 },
        size: { width: 30, height: 40 }
    });
    const sourceId = store.state.currentDocument.shapesIds[0];
    store.actions.createComponentFromSelection();
    const componentId = store.state.currentDocument.componentsIds[0];

    return { store, sourceId, componentId };
}

it('keeps an instance in place while source geometry changes and after reload', () => {
    const { store, sourceId, componentId } = setup();
    store.actions.insertComponentAt({ componentId, position: { x: 200, y: 300 } });
    const instanceId = store.state.currentDocument.shapesIds[1];
    const instance = store.state.currentDocument.shapes[instanceId];
    expect(instance).toMatchObject({
        type: 'instance',
        componentId,
        position: { x: 200, y: 300 },
        bounds: { width: 30, height: 40 }
    });

    store.actions.moveShapesBy({ shapeIds: [sourceId], delta: { x: 25, y: 0 } });
    expect(instance).toMatchObject({ position: { x: 200, y: 300 } });
    expect(componentSource(store.state.currentDocument, componentId)?.box).toMatchObject({
        topLeft: { x: 35, y: 20 },
        width: 30
    });

    const saved = serializePersistedState(store.state);
    const restored = restoreDocuments(saved);
    const document = restored[store.state.currentDocumentId];
    expect(document.shapes[instanceId]).toMatchObject({
        type: 'instance',
        componentId,
        position: { x: 200, y: 300 }
    });
    expect(document.components[componentId].shapesIds).toEqual([sourceId]);
});

it('hiding or locking the source does not affect its instance', () => {
    const { store, sourceId, componentId } = setup();
    store.actions.insertComponentAt({ componentId, position: { x: 200, y: 300 } });
    const instanceId = store.state.currentDocument.shapesIds[1];
    store.actions.updateComponent({ id: componentId, visible: false, locked: true });

    expect(isShapeVisible(store.state.currentDocument, sourceId)).toBe(false);
    expect(isShapeVisible(store.state.currentDocument, instanceId)).toBe(true);
    expect(componentSource(store.state.currentDocument, componentId)?.shapes).toHaveLength(1);
});

it('protects a referenced source from being emptied or made recursive', () => {
    const { store, sourceId, componentId } = setup();
    store.actions.insertComponentAt({ componentId, position: { x: 200, y: 300 } });
    const instanceId = store.state.currentDocument.shapesIds[1];

    store.actions.removeShapes([sourceId]);
    expect(store.state.currentDocument.shapes[sourceId]).toBeDefined();
    store.actions.removeShapesFromComponent({ componentId, shapeIds: [sourceId] });
    expect(store.state.currentDocument.components[componentId].shapesIds).toEqual([sourceId]);
    store.actions.addShapesToComponent({ componentId, shapeIds: [instanceId] });
    expect(store.state.currentDocument.components[componentId].shapesIds).toEqual([sourceId]);
});

it('changes an exposed value only on the instance and can reset it', () => {
    const { store, sourceId, componentId } = setup();
    store.actions.exposeComponentProp({
        componentId,
        shapeId: sourceId,
        key: 'fill',
        label: 'Background'
    });
    const propId = store.state.currentDocument.components[componentId].props?.[0].id ?? '';
    store.actions.insertComponentAt({ componentId, position: { x: 200, y: 300 } });
    const instanceId = store.state.currentDocument.shapesIds[1];
    store.actions.setInstanceOverride({ instanceIds: [instanceId], propId, value: '#ff0000' });

    const document = store.state.currentDocument;
    const instance = document.shapes[instanceId];
    expect(instance.type).toBe('instance');
    if (instance.type !== 'instance') {
        return;
    }
    const component = document.components[componentId];
    expect(instanceMember(document.shapes[sourceId], instance, component, document).fill).toBe(
        '#ff0000'
    );
    expect(document.shapes[sourceId].fill).toBeUndefined();

    store.actions.updateShape({ id: sourceId, fill: '#0000ff' });
    expect(componentPropValue(instance, component, propId, document)).toBe('#ff0000');
    store.actions.resetInstanceOverrides({ instanceIds: [instanceId], propId });
    expect(componentPropValue(instance, component, propId, document)).toBe('#0000ff');
});

it('detaches an instance into independent shapes at its placed position', () => {
    const { store, sourceId, componentId } = setup();
    store.actions.insertComponentAt({ componentId, position: { x: 200, y: 300 } });
    const instanceId = store.state.currentDocument.shapesIds[1];

    store.actions.detachInstances([instanceId]);

    const document = store.state.currentDocument;
    expect(document.shapes[instanceId]).toBeUndefined();
    const detachedId = document.shapesIds.find((id) => id !== sourceId);
    expect(detachedId).toBeDefined();
    expect(document.shapes[detachedId ?? '']).toMatchObject({
        type: 'rectangle',
        position: { x: 200, y: 300 },
        size: { width: 30, height: 40 }
    });

    store.actions.moveShapesBy({ shapeIds: [sourceId], delta: { x: 10, y: 0 } });
    expect(document.shapes[detachedId ?? '']).toMatchObject({ position: { x: 200, y: 300 } });
});

it('copies a library source, updates it on request, and works after its origin is deleted', () => {
    const { store, sourceId, componentId } = setup();
    const firstId = store.state.currentDocumentId;
    store.actions.exposeComponentProp({
        componentId,
        shapeId: sourceId,
        key: 'fill',
        label: 'Background'
    });
    const propId = store.state.currentDocument.components[componentId].props?.[0].id ?? '';
    store.actions.addDocument({ id: 'destination' });
    store.actions.openDocument('destination');
    store.actions.importLibraryComponent({ documentId: firstId, componentId });
    const copy = store.state.currentDocument.components[componentId];
    expect(copy.sourceShapes?.[sourceId]).toBeDefined();
    expect(store.state.currentDocument.shapes[sourceId]).toBeUndefined();
    store.actions.insertComponentAt({ componentId, position: { x: 200, y: 300 } });
    const instanceId = store.state.currentDocument.shapesIds[0];
    store.actions.setInstanceOverride({ instanceIds: [instanceId], propId, value: '#ff0000' });
    const oldHash = copy.library?.hash;

    store.actions.openDocument(firstId);
    store.actions.updateShape({ id: sourceId, fill: '#0000ff' });
    const newHash = componentFingerprint(store.state.currentDocument, componentId);
    expect(newHash).not.toBe(oldHash);
    store.actions.openDocument('destination');
    expect(store.state.currentDocument.components[componentId].library?.hash).toBe(oldHash);
    store.actions.updateLibraryComponent(componentId);
    expect(store.state.currentDocument.components[componentId].library?.hash).toBe(newHash);
    expect(store.state.currentDocument.shapes[instanceId]).toMatchObject({
        overrides: { [propId]: '#ff0000' }
    });

    const saved = serializePersistedState(store.state);
    const restored = restoreDocuments(saved);
    expect(restored.destination.components[componentId].sourceShapes?.[sourceId]).toBeDefined();
    store.actions.removeDocument(firstId);
    expect(componentSource(store.state.currentDocument, componentId)?.box.width).toBe(30);
});

it('repairs a cycle and duplicate source membership when reloading a merged document', () => {
    const { store } = createTestStore();
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 10, y: 20 },
        size: { width: 30, height: 40 }
    });
    const sourceId = store.state.currentDocument.shapesIds[0];
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 80, y: 20 },
        size: { width: 20, height: 20 }
    });
    const secondId = store.state.currentDocument.shapesIds[1];
    store.actions.addShape({
        type: 'instance',
        componentId: 'b',
        position: { x: 100, y: 100 },
        overrides: {}
    });
    const bInA = store.state.currentDocument.shapesIds[2];
    store.actions.addShape({
        type: 'instance',
        componentId: 'a',
        position: { x: 200, y: 100 },
        overrides: {}
    });
    const aInB = store.state.currentDocument.shapesIds[3];
    store.actions.addComponent({ id: 'a', shapesIds: [sourceId, bInA] });
    store.actions.addComponent({ id: 'b', shapesIds: [secondId, aInB, sourceId] });

    const restored = restoreDocuments(serializePersistedState(store.state));
    const document = restored[store.state.currentDocumentId];
    expect(document.components.a.shapesIds).toContain(bInA);
    expect(document.components.b.shapesIds).not.toContain(aInB);
    expect(document.components.b.shapesIds).not.toContain(sourceId);
    expect(componentSource(document, 'a')).not.toBeNull();
});
