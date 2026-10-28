import { createTestStore } from './support/store';
import { instanceSource } from 'src/app/componentSource';
import { projectGeometry } from 'src/app/contextualGeometry';
import { librarySnapshot } from 'src/app/componentLibrary';
import {
    migratePersistedState,
    restoreDocuments,
    serializePersistedState
} from 'src/app/services/documentStorage';

function setup() {
    const { store } = createTestStore();
    const document = store.state.currentDocument;
    store.actions.addShape({
        type: 'rectangle',
        name: 'Artwork',
        position: { x: 0, y: 0 },
        size: { width: 40, height: 20 }
    });
    const defaultShape = document.shapesIds.at(-1)!;
    store.actions.addShape({
        type: 'rectangle',
        name: 'Artwork',
        position: { x: 100, y: 0 },
        size: { width: 80, height: 20 }
    });
    const alternateShape = document.shapesIds.at(-1)!;
    store.actions.addComponent({ id: 'default', name: 'Default', shapesIds: [defaultShape] });
    store.actions.addComponent({ id: 'alternate', name: 'Alternate', shapesIds: [alternateShape] });
    store.actions.addShape({
        type: 'instance',
        componentId: 'default',
        position: { x: 200, y: 0 },
        overrides: {}
    });
    const instanceId = document.shapesIds.at(-1)!;

    return { store, document, instanceId };
}

it('switches between two authored component sources and falls back if one disappears', () => {
    const { store, document, instanceId } = setup();
    const instance = document.shapes[instanceId];
    if (instance.type !== 'instance') {
        throw new Error('Expected an instance');
    }
    expect(instanceSource(document, instance)?.box.width).toBe(40);
    store.actions.addComponentVariant({ componentId: 'default', variantId: 'alternate' });
    store.actions.setInstanceVariant({ instanceIds: [instanceId], variantId: 'alternate' });
    expect(instanceSource(document, instance)?.box.width).toBe(80);
    expect(projectGeometry(instance, document, {}).bounds?.width).toBe(80);
    store.actions.setInstanceVariant({ instanceIds: [instanceId] });
    expect(instanceSource(document, instance)?.box.width).toBe(40);
    store.actions.setInstanceVariant({ instanceIds: [instanceId], variantId: 'alternate' });
    const withoutAlternate = {
        ...document,
        components: { ...document.components }
    };
    delete withoutAlternate.components.alternate;
    expect(instanceSource(withoutAlternate, instance)?.box.width).toBe(40);
    expect(librarySnapshot(withoutAlternate, 'default', { components: {} })).not.toBeNull();
    expect(instance.variantId).toBe('alternate');
});

it('saves explicit selection and keeps older saved documents readable', () => {
    const { store, document, instanceId } = setup();
    store.actions.addComponentVariant({ componentId: 'default', variantId: 'alternate' });
    store.actions.setInstanceVariant({ instanceIds: [instanceId], variantId: 'alternate' });
    const saved = serializePersistedState(store.state);
    const restored = restoreDocuments(saved);
    expect(restored[document.id].components.default.variantIds).toEqual(['alternate']);
    expect(restored[document.id].shapes[instanceId]).toMatchObject({
        variantId: 'alternate'
    });
    expect(migratePersistedState({ ...saved, version: 17 })).not.toBeNull();
});

it('keeps a shared property ID and explicit override across variants', () => {
    const { store, document, instanceId } = setup();
    store.actions.addComponentVariant({ componentId: 'default', variantId: 'alternate' });
    store.actions.exposeComponentProp({
        componentId: 'default',
        shapeId: document.components.default.shapesIds[0],
        key: 'opacity',
        label: 'Opacity'
    });
    const propId = document.components.default.props![0].id;
    expect(document.components.alternate.props![0].id).toBe(propId);
    store.actions.setInstanceOverride({ instanceIds: [instanceId], propId, value: 40 });
    store.actions.setInstanceVariant({ instanceIds: [instanceId], variantId: 'alternate' });
    const instance = document.shapes[instanceId];
    if (instance.type !== 'instance') {
        throw new Error('Expected instance');
    }
    const projected = projectGeometry(instance, document, {});
    expect(projected.type === 'instance' && projected.projectedSource?.shapes[0].opacity).toBe(0.4);
    store.actions.setInstanceVariant({ instanceIds: [instanceId] });
    const base = projectGeometry(instance, document, {});
    expect(base.type === 'instance' && base.projectedSource?.shapes[0].opacity).toBe(0.4);
});

it('gives the instance the alternate size when the choice changes', () => {
    const { store, document, instanceId } = setup();
    store.actions.addComponentVariant({ componentId: 'default', variantId: 'alternate' });
    store.actions.setInstanceVariant({ instanceIds: [instanceId], variantId: 'alternate' });
    expect(document.shapes[instanceId].bounds?.width).toBe(80);
    store.actions.setInstanceVariant({ instanceIds: [instanceId] });
    expect(document.shapes[instanceId].bounds?.width).toBe(40);
});

it('keeps overrides when an instance showing the alternate is detached', () => {
    const { store, document, instanceId } = setup();
    store.actions.addComponentVariant({ componentId: 'default', variantId: 'alternate' });
    store.actions.exposeComponentProp({
        componentId: 'default',
        shapeId: document.components.default.shapesIds[0],
        key: 'opacity',
        label: 'Opacity'
    });
    const propId = document.components.default.props![0].id;
    store.actions.setInstanceOverride({ instanceIds: [instanceId], propId, value: 40 });
    store.actions.setInstanceVariant({ instanceIds: [instanceId], variantId: 'alternate' });
    const before = new Set(document.shapesIds);
    store.actions.detachInstances([instanceId]);
    const detached = document.shapesIds
        .filter((id) => !before.has(id))
        .map((id) => document.shapes[id]);
    expect(detached).toHaveLength(1);
    expect(detached[0]).toMatchObject({ type: 'rectangle', opacity: 0.4 });
    expect(detached[0].type === 'rectangle' && detached[0].size.width).toBe(80);
});

it('refuses a variant choice that would make a source contain itself', () => {
    const { store, document } = setup();
    store.actions.addShape({
        type: 'instance',
        componentId: 'default',
        position: { x: 300, y: 0 },
        overrides: {}
    });
    const nested = document.shapesIds.at(-1)!;
    store.actions.addShapesToComponent({ componentId: 'alternate', shapeIds: [nested] });
    store.actions.addComponentVariant({ componentId: 'default', variantId: 'alternate' });
    store.actions.setInstanceVariant({ instanceIds: [nested], variantId: 'alternate' });
    const shape = document.shapes[nested];
    expect(shape.type === 'instance' && shape.variantId).toBeUndefined();
});

it('unlinks variants, and clones and deletes leave no stale links', () => {
    const { store, document, instanceId } = setup();
    store.actions.addComponentVariant({ componentId: 'default', variantId: 'alternate' });
    store.actions.cloneComponent('default');
    const clone = Object.values(document.components).find(
        (component) => component.id !== 'default' && component.id !== 'alternate'
    );
    expect(clone?.variantIds).toBeUndefined();

    store.actions.setInstanceVariant({ instanceIds: [instanceId], variantId: 'alternate' });
    store.actions.removeComponentVariant({ componentId: 'default', variantId: 'alternate' });
    const instance = document.shapes[instanceId];
    expect(document.components.default.variantIds).toBeUndefined();
    expect(instance.type === 'instance' && instance.variantId).toBeUndefined();
    expect(instance.bounds?.width).toBe(40);

    store.actions.addComponentVariant({ componentId: 'default', variantId: 'alternate' });
    store.actions.setInstanceVariant({ instanceIds: [instanceId], variantId: 'alternate' });
    store.actions.removeComponent('alternate');
    expect(document.components.alternate).toBeUndefined();
    expect(document.components.default.variantIds).toBeUndefined();
    expect(instance.type === 'instance' && instance.variantId).toBeUndefined();
});
