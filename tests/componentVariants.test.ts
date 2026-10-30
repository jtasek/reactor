import { json } from 'overmind';
import { componentVariantProblems, canLinkComponentVariant } from 'src/app/componentVariants';
import { componentVariants, instanceProperties } from 'src/app/computed/componentPanels';
import { createTestStore } from './support/store';
import { instanceSource } from 'src/app/componentSource';
import { projectGeometry } from 'src/app/contextualGeometry';
import { librarySnapshot } from 'src/app/componentLibrary';
import {
    createCopies,
    edit,
    settle,
    shownDocument,
    sharedContent,
    DOCUMENT_ID
} from './support/collaboration';
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

it('creates independent variant artwork with the same exposed property IDs and role', () => {
    const { store, document, instanceId } = setup();
    const family = document.components.default;
    const sourceId = family.shapesIds[0];
    store.actions.exposeComponentProp({
        componentId: family.id,
        shapeId: sourceId,
        key: 'opacity',
        label: 'Opacity'
    });
    const propId = family.props![0].id;
    store.actions.setInstanceOverride({ instanceIds: [instanceId], propId, value: 40 });
    store.actions.editRole({
        target: 'component',
        id: family.id,
        settings: { role: 'button', props: {} }
    });
    const ink = store.actions.createVariable({ name: 'Ink', type: 'color', value: '#112233' })!;
    store.actions.updateShape({
        id: sourceId,
        fill: '#112233',
        bindings: { fill: ink },
        rotation: 30
    });

    const id = store.actions.createComponentVariant(family.id)!;
    const variant = document.components[id];
    const shapeId = variant.shapesIds[0];
    expect(variant).toMatchObject({
        name: 'Default variant',
        sourceOnly: true,
        props: [{ id: propId, key: 'opacity', shapeId }],
        interaction: family.interaction
    });
    expect(family.variantIds).toEqual([id]);
    expect(shapeId).not.toBe(sourceId);
    expect(document.shapes[shapeId]).toMatchObject({
        name: 'Artwork',
        fill: '#112233',
        bindings: { fill: ink },
        rotation: 30
    });
    expect(store.state.enteredComponentId).toBe(id);
    expect(document.shapes[instanceId]).not.toHaveProperty('variantId');

    store.actions.setVariableValue({ variableId: ink, value: '#224455' });
    expect(document.shapes[shapeId].fill).toBe('#224455');

    store.actions.updateShape({ id: shapeId, fill: '#aabbcc', size: { width: 100, height: 20 } });
    const instance = document.shapes[instanceId];
    if (instance.type !== 'instance') {
        throw new Error('Expected instance');
    }
    store.actions.setInstanceVariant({ instanceIds: [instanceId], variantId: id });
    const projected = projectGeometry(instance, document, {});
    expect(projected.type === 'instance' && projected.projectedSource?.shapes[0].opacity).toBe(0.4);
    expect(document.shapes[sourceId]).toMatchObject({
        fill: '#224455',
        size: { width: 40, height: 20 }
    });
    expect(
        librarySnapshot(document, family.id, { components: {} })?.some((item) => item.id === id)
    ).toBe(true);
    const restored = restoreDocuments(serializePersistedState(store.state))[document.id];
    expect(restored.components[id].props).toEqual(variant.props);
    expect(restored.shapes[instanceId]).toMatchObject({
        variantId: id,
        overrides: { [propId]: 40 }
    });
    store.actions.setInstanceVariant({ instanceIds: [instanceId] });
    expect(instance.overrides[propId]).toBe(40);
});

it('retains nested instance choices and text templates, and copies source groups independently', () => {
    const { store, document } = setup();
    store.actions.addShape({
        type: 'instance',
        componentId: 'alternate',
        position: { x: 50, y: 0 },
        overrides: { label: { variableId: 'label' } },
        modeOverrides: { theme: 'dark' },
        interaction: { role: 'button', props: {}, navigateTo: 'checkout' }
    });
    const nestedId = document.shapesIds.at(-1)!;
    store.actions.addShape({
        type: 'text',
        position: { x: 0, y: 40 },
        value: 'Hello',
        template: '${label}',
        wrapWidth: 100,
        fontSize: 16,
        visible: false
    });
    const textId = document.shapesIds.at(-1)!;
    store.actions.addShapesToComponent({ componentId: 'default', shapeIds: [nestedId, textId] });
    const sourceIds = [...document.components.default.shapesIds];
    store.actions.addGroup({ id: 'group', name: 'Contents', shapesIds: sourceIds, rotation: 20 });

    const id = store.actions.createComponentVariant('default')!;
    const copies = document.components[id].shapesIds.map((shapeId) => document.shapes[shapeId]);
    const nested = copies.find((shape) => shape.type === 'instance')!;
    expect(nested).toMatchObject({
        componentId: 'alternate',
        modeOverrides: { theme: 'dark' },
        overrides: { label: { variableId: 'label' } },
        interaction: { navigateTo: 'checkout' }
    });
    expect(copies.find((shape) => shape.type === 'text')).toMatchObject({
        template: '${label}',
        wrapWidth: 100,
        fontSize: 16,
        visible: false
    });
    const group = Object.values(document.groups).find((item) => item.id !== 'group')!;
    expect(group).toMatchObject({
        name: 'Contents',
        rotation: 20,
        shapesIds: document.components[id].shapesIds
    });
    expect(document.groups.group.shapesIds).toEqual(sourceIds);

    if (nested.type !== 'instance') {
        throw new Error('Expected nested instance');
    }
    store.actions.updateShape({
        id: nested.id,
        modeOverrides: { theme: 'light' },
        interaction: { role: 'button', props: {}, navigateTo: 'other' }
    });
    expect(document.shapes[nestedId]).toMatchObject({
        modeOverrides: { theme: 'dark' },
        interaction: { navigateTo: 'checkout' }
    });
});

it('names successive variants and refuses creation for read-only sources and alternates', () => {
    const { store, document } = setup();
    const first = store.actions.createComponentVariant('default')!;
    const second = store.actions.createComponentVariant('default')!;
    expect(document.components[second].name).toBe('Default variant 2');
    const count = document.shapesIds.length;
    expect(store.actions.createComponentVariant(first)).toBeUndefined();
    expect(store.actions.createComponentVariant('missing')).toBeUndefined();
    store.actions.lockComponent('default');
    expect(store.actions.createComponentVariant('default')).toBeUndefined();
    store.actions.unlockComponent('default');
    store.actions.lockDocument(document.id);
    expect(store.actions.createComponentVariant('default')).toBeUndefined();
    store.actions.unlockDocument(document.id);
    store.actions.addComponent({
        ...document.components.default,
        library: { documentId: 'other', hash: 'hash' }
    });
    expect(store.actions.createComponentVariant('default')).toBeUndefined();
    expect(document.shapesIds).toHaveLength(count);
    expect(document.components.default.variantIds).toEqual([first, second]);
});

it('shares and undoes variant creation as one step, separate from neighboring edits', async () => {
    const copies = await createCopies(
        2,
        (store) => {
            store.actions.addShape({
                type: 'rectangle',
                position: { x: 0, y: 0 },
                size: { width: 40, height: 20 }
            });
            store.actions.addComponent({
                id: 'family',
                name: 'Card',
                sourceOnly: true,
                shapesIds: [...store.state.currentDocument.shapesIds]
            });
        },
        60_000
    );
    const [a, b] = copies;
    edit(a, (actions) => actions.updateComponent({ id: 'family', name: 'Button' }));
    edit(a, (actions) => actions.createComponentVariant('family'));
    const id = shownDocument(a).components.family.variantIds![0];
    edit(a, (actions) => actions.updateComponent({ id, name: 'Alternate' }));
    settle(copies);
    expect(sharedContent(b)).toEqual(sharedContent(a));
    a.collaboration.undo(shownDocument(a).id);
    expect(shownDocument(a).components[id].name).toBe('Button variant');
    a.collaboration.undo(shownDocument(a).id);
    settle(copies);
    expect(shownDocument(a).components[id]).toBeUndefined();
    expect(shownDocument(a).shapesIds).toHaveLength(1);
    expect(shownDocument(a).components.family.name).toBe('Button');
    expect(sharedContent(b)).toEqual(sharedContent(a));
    a.collaboration.redo(shownDocument(a).id);
    settle(copies);
    expect(shownDocument(a).components.family.variantIds).toEqual([id]);
    expect(shownDocument(a).shapesIds).toHaveLength(2);
    expect(sharedContent(b)).toEqual(sharedContent(a));
});

it('mirrors later exposed properties to the created copy, with repeated names and renamed copies', () => {
    const { store } = createTestStore();
    const document = store.state.currentDocument;
    const label = (y: number) => {
        store.actions.addShape({
            type: 'rectangle',
            name: 'Label',
            position: { x: 0, y },
            size: { width: 40, height: 20 }
        });

        return document.shapesIds.at(-1)!;
    };
    const top = label(0);
    const bottom = label(30);
    store.actions.addComponent({
        id: 'family',
        name: 'Card',
        sourceOnly: true,
        shapesIds: [top, bottom]
    });
    const id = store.actions.createComponentVariant('family')!;
    const [topCopy, bottomCopy] = document.components[id].shapesIds;

    store.actions.exposeComponentProp({
        componentId: 'family',
        shapeId: bottom,
        key: 'opacity',
        label: 'Bottom opacity'
    });
    expect(document.components[id].props).toEqual([
        expect.objectContaining({ key: 'opacity', shapeId: bottomCopy })
    ]);

    store.actions.updateShape({ id: topCopy, name: 'Heading' });
    store.actions.exposeComponentProp({
        componentId: 'family',
        shapeId: top,
        key: 'opacity',
        label: 'Top opacity'
    });
    expect(document.components[id].props?.map((prop) => prop.shapeId)).toEqual([
        bottomCopy,
        topCopy
    ]);

    store.actions.exposeComponentProp({
        componentId: 'family',
        shapeId: bottom,
        key: 'fill',
        label: 'Bottom fill'
    });
    expect(document.components[id].props?.at(-1)).toMatchObject({
        key: 'fill',
        shapeId: bottomCopy
    });
});

it('keeps the source members of a group that also holds other shapes', () => {
    const { store, document } = setup();
    const members = [...document.components.default.shapesIds];
    store.actions.addShape({
        type: 'rectangle',
        name: 'Second',
        position: { x: 0, y: 30 },
        size: { width: 40, height: 20 }
    });
    const second = document.shapesIds.at(-1)!;
    store.actions.addShapesToComponent({ componentId: 'default', shapeIds: [second] });
    store.actions.addShape({
        type: 'rectangle',
        name: 'Outside',
        position: { x: 0, y: 60 },
        size: { width: 40, height: 20 }
    });
    const outside = document.shapesIds.at(-1)!;
    store.actions.addGroup({
        id: 'mixed',
        name: 'Mixed',
        shapesIds: [...members, second, outside]
    });

    const id = store.actions.createComponentVariant('default')!;
    const copied = Object.values(document.groups).find((group) => group.id !== 'mixed');
    expect(copied).toMatchObject({ name: 'Mixed', shapesIds: document.components[id].shapesIds });
    expect(document.groups.mixed.shapesIds).toEqual([...members, second, outside]);
});

it('names a missing variant property without dropping its override on switch or reload', () => {
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
    store.actions.removeComponentProp({ componentId: 'alternate', propId });
    const before = JSON.stringify(serializePersistedState(store.state));
    expect(componentVariantProblems(document, 'default', 'alternate')).toEqual([
        'Missing property “Opacity”. Its instance override is kept but cannot apply here.'
    ]);
    expect(componentVariants(document, 'default').variants[0].problems).toHaveLength(1);
    expect(JSON.stringify(serializePersistedState(store.state))).toBe(before);
    const restored = restoreDocuments(serializePersistedState(store.state))[document.id];
    expect(restored.shapes[instanceId]).toMatchObject({
        variantId: 'alternate',
        overrides: { [propId]: 40 }
    });
    store.actions.setInstanceVariant({ instanceIds: [instanceId] });
    const shape = document.shapes[instanceId];
    expect(shape.type === 'instance' && projectGeometry(shape, document, {})).toMatchObject({
        projectedSource: { shapes: [expect.objectContaining({ opacity: 0.4 })] }
    });
});

it('diagnoses changed mappings, unusable source fields and family role drift', () => {
    const { store, document } = setup();
    store.actions.addComponentVariant({ componentId: 'default', variantId: 'alternate' });
    store.actions.exposeComponentProp({
        componentId: 'default',
        shapeId: document.components.default.shapesIds[0],
        key: 'opacity',
        label: 'Opacity'
    });
    const copy = restoreDocuments(serializePersistedState(store.state))[document.id];
    const alternate = copy.components.alternate;
    const prop = alternate.props![0];
    prop.key = 'fontSize';
    alternate.interaction = { role: 'button', props: {} };
    expect(componentVariantProblems(copy, 'default', 'alternate').join(' ')).toContain(
        'uses fontSize instead of opacity'
    );
    expect(componentVariantProblems(copy, 'default', 'alternate').join(' ')).toContain(
        'Role or action settings differ'
    );
    prop.key = 'opacity';
    prop.shapeId = 'unavailable';
    expect(componentVariantProblems(copy, 'default', 'alternate').join(' ')).toContain(
        'no compatible source field'
    );
    alternate.props!.push({
        id: 'extra',
        label: 'Extra',
        key: 'opacity',
        shapeId: alternate.shapesIds[0]
    });
    expect(componentVariantProblems(copy, 'default', 'alternate').join(' ')).toContain(
        '“Extra” is not shared'
    );
    copy.components.default.props![0].shapeId = 'unavailable';
    expect(componentVariantProblems(copy, 'default', 'alternate').join(' ')).toContain(
        'Repair the default source first'
    );
});

it('uses semantic role comparison and identical compatibility checks for linking and the picker', () => {
    const { store, document } = setup();
    const copy = restoreDocuments(serializePersistedState(store.state))[document.id];
    copy.components.default.interaction = {
        role: 'button',
        props: { label: 'label', disabled: 'disabled' },
        navigateTo: 'home'
    };
    copy.components.alternate.interaction = {
        role: 'button',
        props: { disabled: 'disabled', label: 'label' },
        navigateTo: 'home'
    };
    expect(canLinkComponentVariant(copy, 'default', 'alternate')).toBe(true);
    expect(componentVariants(copy, 'default').candidates).toContainEqual({
        id: 'alternate',
        name: 'Alternate'
    });
    copy.components.alternate.interaction.navigateTo = 'elsewhere';
    expect(canLinkComponentVariant(copy, 'default', 'alternate')).toBe(false);
    expect(componentVariants(copy, 'default').candidates).not.toContainEqual({
        id: 'alternate',
        name: 'Alternate'
    });
    store.actions.editRole({
        target: 'component',
        id: 'alternate',
        settings: { role: 'button', props: {} }
    });
    store.actions.addComponentVariant({ componentId: 'default', variantId: 'alternate' });
    expect(document.components.default.variantIds).toBeUndefined();
});

it('keeps an unavailable authored selection distinct from the default in Inspector data', () => {
    const { store, document, instanceId } = setup();
    store.actions.addComponentVariant({ componentId: 'default', variantId: 'alternate' });
    store.actions.setInstanceVariant({ instanceIds: [instanceId], variantId: 'alternate' });
    const copy = restoreDocuments(serializePersistedState(store.state))[document.id];
    delete copy.components.alternate;
    const data = instanceProperties({ ...copy, selectedShapes: [copy.shapes[instanceId]] });
    expect(data?.selectedVariantId).toBe('alternate');
    expect(data?.variantProblems).toEqual([
        expect.stringContaining('selected variant is unavailable')
    ]);
    expect(data?.variants.map((variant) => variant.id)).toEqual(['default']);
});

it('reports concurrent property removal while keeping another author’s instance edit through undo', async () => {
    const { store, document, instanceId } = setup();
    store.actions.addComponentVariant({ componentId: 'default', variantId: 'alternate' });
    store.actions.exposeComponentProp({
        componentId: 'default',
        shapeId: document.components.default.shapesIds[0],
        key: 'opacity',
        label: 'Opacity'
    });
    const propId = document.components.default.props![0].id;
    store.actions.setInstanceVariant({ instanceIds: [instanceId], variantId: 'alternate' });
    const copies = await createCopies(2, (target) =>
        target.actions.addDocument({ ...json(document), id: DOCUMENT_ID })
    );
    const [first, second] = copies;
    edit(first, (actions) => actions.removeComponentProp({ componentId: 'alternate', propId }));
    edit(second, (actions) =>
        actions.setInstanceOverride({ instanceIds: [instanceId], propId, value: 60 })
    );
    settle(copies);
    for (const copy of copies) {
        expect(
            componentVariantProblems(shownDocument(copy), 'default', 'alternate').join(' ')
        ).toContain('Missing property “Opacity”');
        expect(shownDocument(copy).shapes[instanceId]).toMatchObject({
            overrides: { [propId]: 60 }
        });
    }
    first.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(componentVariantProblems(shownDocument(second), 'default', 'alternate')).toEqual([]);
    expect(shownDocument(second).shapes[instanceId]).toMatchObject({ overrides: { [propId]: 60 } });
    copies.forEach((copy) => copy.collaboration.dispose());
});

function buttonFamily() {
    const { store } = createTestStore();
    const document = store.state.currentDocument;
    store.actions.addShape({
        type: 'text',
        name: 'Label',
        value: 'Go',
        fontSize: 16,
        position: { x: 0, y: 0 }
    });
    const shapeId = document.shapesIds.at(-1)!;
    store.actions.addComponent({ id: 'default', name: 'Button', shapesIds: [shapeId] });
    store.actions.exposeComponentProp({
        componentId: 'default',
        shapeId,
        key: 'text',
        label: 'Label'
    });
    const first = store.actions.createComponentVariant('default')!;
    const second = store.actions.createComponentVariant('default')!;

    return { store, document, first, second, label: document.components.default.props![0].id };
}

it('carries role edits on the default to alternates that matched it', () => {
    const { store, document, first, second, label } = buttonFamily();
    store.actions.editRole({
        target: 'component',
        id: second,
        settings: { role: 'text', props: { content: label } }
    });
    store.actions.editRole({
        target: 'component',
        id: 'default',
        settings: { role: 'button', props: { label } }
    });
    expect(document.components[first].interaction).toEqual({ role: 'button', props: { label } });
    expect(document.components[second].interaction?.role).toBe('text');
    expect(componentVariantProblems(document, 'default', first)).toEqual([]);
    store.actions.editRole({ target: 'component', id: 'default', settings: null });
    expect(document.components[first].interaction).toBeUndefined();
    expect(document.components[second].interaction?.role).toBe('text');
});

it('lists the default’s problems once and repeated instance messages once', () => {
    const { store, document, first, second, label } = buttonFamily();
    store.actions.removeComponentProp({ componentId: first, propId: label });
    const ids: string[] = [];
    for (const x of [100, 200]) {
        store.actions.addShape({
            type: 'instance',
            name: 'Button',
            componentId: 'default',
            position: { x, y: 0 },
            overrides: {}
        });
        ids.push(document.shapesIds.at(-1)!);
    }
    store.actions.setInstanceVariant({ instanceIds: ids, variantId: first });
    const data = instanceProperties({
        ...document,
        selectedShapes: ids.map((id) => document.shapes[id])
    });
    expect(data?.variantProblems).toEqual([expect.stringContaining('Missing property “Label”')]);

    const copy = restoreDocuments(serializePersistedState(store.state))[document.id];
    copy.components.default.props![0].shapeId = 'unavailable';
    const panel = componentVariants(copy, 'default');
    expect(panel.defaultProblems).toEqual([expect.stringContaining('Repair the default source')]);
    expect(panel.variants.find((variant) => variant.id === second)?.problems).toEqual([]);
    expect(componentVariantProblems(copy, 'default', second)).toEqual(panel.defaultProblems);
});

it('offers exactly the components that linking accepts', () => {
    const { store, document } = setup();
    store.actions.addShape({
        type: 'rectangle',
        name: 'Other',
        position: { x: 0, y: 100 },
        size: { width: 10, height: 10 }
    });
    store.actions.addComponent({
        id: 'other',
        name: 'Other',
        shapesIds: [document.shapesIds.at(-1)!]
    });
    store.actions.editRole({
        target: 'component',
        id: 'other',
        settings: { role: 'image', props: {} }
    });
    const offered = componentVariants(document, 'default').candidates.map(({ id }) => id);
    const accepted = Object.keys(document.components).filter((id) =>
        canLinkComponentVariant(document, 'default', id)
    );
    expect(offered).toEqual(accepted);
    expect(offered).toEqual(['alternate']);
    store.actions.addComponentVariant({ componentId: 'default', variantId: 'alternate' });
    expect(componentVariants(document, 'alternate').candidates).toEqual([]);
});
