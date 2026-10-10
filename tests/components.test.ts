import { componentSource } from 'src/app/componentSource';
import { componentPropValue, applyInstanceOverrides } from 'src/app/componentProps';
import { componentFingerprint } from 'src/app/componentLibrary';
import { isShapeVisible } from 'src/app/utils';
import {
    readEntity,
    restoreDocuments,
    serializePersistedState
} from 'src/app/services/documentStorage';
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
    expect(
        applyInstanceOverrides(document.shapes[sourceId], instance, component, document).fill
    ).toBe('#ff0000');
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

it.each([false, true])(
    'keeps detached members in their outer source (extra member: %s)',
    (extra) => {
        const { store, componentId } = setup();
        store.actions.insertComponentAt({ componentId, position: { x: 200, y: 300 } });
        const document = store.state.currentDocument;
        const nestedId = document.shapesIds[1];
        const members = [nestedId];

        if (extra) {
            store.actions.addShape({
                type: 'rectangle',
                position: { x: 250, y: 300 },
                size: { width: 20, height: 20 }
            });
            members.push(document.shapesIds[2]);
        }
        store.actions.addComponent({ id: 'outer', shapesIds: members });
        store.actions.insertComponentAt({ componentId: 'outer', position: { x: 400, y: 300 } });
        const before = componentSource(document, 'outer')?.box;

        store.actions.detachInstances([nestedId]);

        expect(document.shapes[nestedId]).toBeUndefined();
        expect(document.components.outer.shapesIds).toHaveLength(members.length);
        expect(document.components.outer.shapesIds).not.toContain(nestedId);
        expect(componentSource(document, 'outer')?.box).toEqual(before);
        expect(
            componentSource(document, 'outer')?.shapes.every((shape) => shape.type === 'rectangle')
        ).toBe(true);
    }
);

it('keeps library draw order and offers an update after only the order changes', () => {
    const { store, sourceId, componentId } = setup();
    const origin = store.state.currentDocumentId;
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 10, y: 20 },
        size: { width: 30, height: 40 }
    });
    const secondId = store.state.currentDocument.shapesIds[1];
    store.actions.addShapesToComponent({ componentId, shapeIds: [secondId] });
    const hash = componentFingerprint(store.state.currentDocument, componentId);
    store.actions.bringShapesToFront([sourceId]);
    expect(componentFingerprint(store.state.currentDocument, componentId)).not.toBe(hash);

    store.actions.addDocument({ id: 'copy' });
    store.actions.openDocument('copy');
    store.actions.importLibraryComponent({ documentId: origin, componentId });
    const order = () =>
        componentSource(store.state.currentDocument, componentId)?.shapes.map((shape) => shape.id);
    expect(order()).toEqual([secondId, sourceId]);

    store.actions.openDocument(origin);
    store.actions.bringShapesToFront([secondId]);
    store.actions.openDocument('copy');
    expect(order()).toEqual([secondId, sourceId]);
    store.actions.updateLibraryComponent(componentId);
    expect(order()).toEqual([sourceId, secondId]);
});

it('invalidates instance measurement when source bounds change, including nested sources', () => {
    const { store, sourceId, componentId } = setup();
    const document = store.state.currentDocument;
    store.actions.insertComponentAt({ componentId, position: { x: 200, y: 300 } });
    store.actions.addComponent({ id: 'outer', shapesIds: [document.shapesIds[1]] });
    const directKey = componentSource(document, componentId)?.key;
    const nestedKey = componentSource(document, 'outer')?.key;

    store.actions.setShapeBounds({
        id: sourceId,
        bounds: {
            topLeft: { x: 12, y: 23 },
            bottomRight: { x: 39, y: 59 },
            width: 27,
            height: 36
        }
    });
    expect(componentSource(document, componentId)?.key).not.toBe(directKey);
    expect(componentSource(document, 'outer')?.key).not.toBe(nestedKey);

    const measuredKey = componentSource(document, componentId)?.key;
    store.actions.selectShape(sourceId);
    expect(componentSource(document, componentId)?.key).toBe(measuredKey);
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

it('keeps resolved source text and evaluates text overrides without changing the source', () => {
    const { store } = createTestStore();
    const variableId = store.actions.createVariable({ name: 'Name', type: 'text', value: 'Joe' });
    store.actions.addShape({
        type: 'text',
        position: { x: 0, y: 0 },
        value: 'Hello',
        fontSize: 20
    });
    const document = store.state.currentDocument;
    const sourceId = document.shapesIds[0];
    store.actions.setShapesProperty({ shapeIds: [sourceId], key: 'text', value: 'Hello ${Name}' });
    store.actions.createComponentFromSelection();
    const componentId = document.componentsIds[0];
    store.actions.exposeComponentProp({
        componentId,
        shapeId: sourceId,
        key: 'text',
        label: 'Text'
    });
    store.actions.insertComponentAt({ componentId, position: { x: 100, y: 100 } });
    const instance = document.shapes[document.shapesIds[1]];
    const component = document.components[componentId];
    const propId = component.props?.[0].id ?? '';

    if (instance.type !== 'instance' || !variableId) {
        throw new Error('Expected an instance and variable');
    }
    const rendered = () =>
        applyInstanceOverrides(document.shapes[sourceId], instance, component, document);
    expect(rendered()).toMatchObject({ value: 'Hello Joe' });
    store.actions.setInstanceOverride({
        instanceIds: [instance.id],
        propId,
        value: 'Welcome ${Name}'
    });
    expect(rendered()).toMatchObject({ value: 'Welcome Joe' });
    store.actions.setInstanceOverride({ instanceIds: [instance.id], propId, value: '\\${Name}' });
    expect(rendered()).toMatchObject({ value: '${Name}' });
    store.actions.bindInstanceOverride({ instanceIds: [instance.id], propId, variableId });
    expect(rendered()).toMatchObject({ value: 'Joe' });
    store.actions.resetInstanceOverrides({ instanceIds: [instance.id] });
    expect(rendered()).toMatchObject({ value: 'Hello Joe' });
    expect(document.shapes[sourceId]).toMatchObject({ value: 'Hello Joe' });
});

it.each([false, true])('detaches at the original stacking position (tied order: %s)', (tied) => {
    const { store, sourceId, componentId } = setup();
    store.actions.insertComponentAt({ componentId, position: { x: 200, y: 300 } });
    const document = store.state.currentDocument;
    const instanceId = document.shapesIds[1];
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 200, y: 300 },
        size: { width: 30, height: 40 }
    });
    const coverId = document.shapesIds[2];

    if (tied) {
        // Tie with the source below; both copies must remain below the covering shape.
        const view = readEntity('shapes', {
            ...JSON.parse(JSON.stringify(document.shapes[instanceId])),
            order: document.shapes[sourceId].order
        });
        store.actions.applyRemoteChanges({
            documentId: document.id,
            entities: {
                shapes: { [instanceId]: { view, changed: ['order'] } },
                groups: {},
                layers: {},
                components: {},
                links: {},
                guides: {},
                variables: {}
            }
        });
    }
    store.actions.detachInstances([instanceId]);
    const copiedId = document.shapesIds.find((id) => id !== sourceId && id !== coverId) ?? '';
    expect(document.shapesIds.indexOf(copiedId)).toBeLessThan(document.shapesIds.indexOf(coverId));
    expect(document.shapes[copiedId].order < document.shapes[coverId].order).toBe(true);
    expect(document.shapes[instanceId]).toBeUndefined();
});

it.each(['copy', 'cut'])(
    'transfers nested component dependencies and override variables on %s',
    (mode) => {
        const { store, sourceId, componentId } = setup();
        const document = store.state.currentDocument;
        const variableId = store.actions.createVariable({
            name: 'Brand',
            type: 'color',
            value: '#ff0000'
        });
        store.actions.exposeComponentProp({
            componentId,
            shapeId: sourceId,
            key: 'fill',
            label: 'Fill'
        });
        store.actions.insertComponentAt({ componentId, position: { x: 200, y: 300 } });
        const nestedId = document.shapesIds[1];
        const propId = document.components[componentId].props?.[0].id ?? '';
        store.actions.bindInstanceOverride({
            instanceIds: [nestedId],
            propId,
            variableId: variableId ?? ''
        });
        store.actions.addComponent({ id: 'outer', shapesIds: [nestedId] });
        store.actions.insertComponentAt({ componentId: 'outer', position: { x: 400, y: 300 } });
        const originalId = document.shapesIds[2];
        const text = store.actions.copySelection();

        if (mode === 'cut') {
            const cut = store.actions.selectionToCut();
            expect(cut?.text).toBe(text);
            store.actions.removeShapes(cut?.shapeIds ?? []);
            expect(document.shapes[originalId]).toBeUndefined();
        }
        store.actions.newDocument();
        expect(store.actions.pasteShapes(text ?? '')).toBe('pasted');
        const target = store.state.currentDocument;
        expect(target.shapesIds).toHaveLength(1);
        expect(Object.keys(target.components).sort()).toEqual([componentId, 'outer'].sort());
        const source = componentSource(target, 'outer');
        const nested = source?.shapes[0];

        if (nested?.type !== 'instance') {
            throw new Error('Expected the nested instance');
        }
        const newVariable = Object.values(target.variables)[0];
        expect(newVariable.id).not.toBe(variableId);
        expect(nested.overrides[propId]).toEqual({ variableId: newVariable.id });
        const leaf = target.components[componentId];
        const member = leaf.sourceShapes?.[sourceId];

        if (!member) {
            throw new Error('Expected a copied source member');
        }
        expect(applyInstanceOverrides(member, nested, leaf, target)).toMatchObject({
            fill: '#ff0000'
        });
        expect(componentSource(target, 'outer')?.box).toMatchObject({ width: 30, height: 40 });
        store.actions.removeDocument(document.id);
        expect(componentSource(target, 'outer')?.box.width).toBe(30);
    }
);

it('remaps templates in pasted text overrides when a variable name is taken', () => {
    const { store } = createTestStore();
    store.actions.createVariable({ name: 'Name', type: 'text', value: 'Joe' });
    store.actions.addShape({
        type: 'text',
        position: { x: 0, y: 0 },
        value: 'Default',
        fontSize: 20
    });
    const source = store.state.currentDocument;
    const sourceId = source.shapesIds[0];
    store.actions.createComponentFromSelection();
    const componentId = source.componentsIds[0];
    store.actions.exposeComponentProp({
        componentId,
        shapeId: sourceId,
        key: 'text',
        label: 'Text'
    });
    store.actions.insertComponentAt({ componentId, position: { x: 100, y: 100 } });
    const instanceId = source.shapesIds[1];
    const propId = source.components[componentId].props?.[0].id ?? '';
    store.actions.setInstanceOverride({
        instanceIds: [instanceId],
        propId,
        value: 'Hello ${Name}'
    });
    const text = store.actions.copySelection();
    expect(source.shapes[instanceId]).toMatchObject({ overrides: { [propId]: 'Hello ${Name}' } });
    store.actions.newDocument();
    store.actions.createVariable({ name: 'Name', type: 'color', value: '#ff0000' });
    expect(store.actions.pasteShapes(text ?? '')).toBe('pasted');
    const document = store.state.currentDocument;
    const instance = document.shapes[document.shapesIds[0]];
    const component = document.components[componentId];
    const member = component.sourceShapes?.[sourceId];

    if (instance.type !== 'instance' || !member) {
        throw new Error('Expected a pasted instance');
    }
    expect(applyInstanceOverrides(member, instance, component, document)).toMatchObject({
        value: 'Hello Joe'
    });
    expect(componentPropValue(instance, component, propId, document)).toBe('Hello ${Name 2}');
    const restored = restoreDocuments(serializePersistedState(store.state));
    expect(componentSource(restored[document.id], componentId)).not.toBeNull();
});

it('pastes a same-document instance without replacing its live source', () => {
    const { store, sourceId, componentId } = setup();
    store.actions.insertComponentAt({ componentId, position: { x: 200, y: 300 } });
    const copied = store.actions.copySelection();
    store.actions.updateShape({ id: sourceId, fill: '#00ff00' });
    expect(store.actions.pasteShapes(copied ?? '')).toBe('pasted');
    const document = store.state.currentDocument;
    expect(document.components[componentId].sourceShapes).toBeUndefined();
    expect(componentSource(document, componentId)?.shapes[0].fill).toBe('#00ff00');
});
