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
