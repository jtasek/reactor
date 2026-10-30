import { json } from 'overmind';
import { createShape, createComponent, createDocument } from 'src/app/factories';
import { componentPropertyMappings, componentVariantProblems } from 'src/app/componentVariants';
import { projectGeometry } from 'src/app/contextualGeometry';
import { componentFingerprint } from 'src/app/componentLibrary';
import { restoreDocuments, serializePersistedState } from 'src/app/services/documentStorage';
import { createTestStore } from './support/store';
import {
    createCopies,
    edit,
    settle,
    shownDocument,
    sharedContent,
    DOCUMENT_ID
} from './support/collaboration';

function setup() {
    const { store } = createTestStore();
    const shapes = [
        ...(['base', 'first', 'second'] as const).map((id, index) =>
            createShape({
                type: 'text',
                name: id,
                value: id,
                fontSize: 16,
                order: `a${index}`,
                position: { x: index * 100, y: 0 }
            })
        ),
        createShape({
            name: 'Rectangle',
            type: 'rectangle',
            order: 'a3',
            position: { x: 0, y: 80 },
            size: { width: 40, height: 20 }
        }),
        createShape({
            name: 'Instance',
            type: 'instance',
            order: 'a4',
            componentId: 'family',
            variantId: 'alternate',
            position: { x: 300, y: 100 },
            overrides: { label: 'Continue' }
        })
    ];
    store.actions.addDocument(
        createDocument({
            id: store.state.currentDocumentId,
            shapes: Object.fromEntries(
                shapes.map((shape, index) => {
                    const id = ['base', 'first', 'second', 'rectangle', 'instance'][index];

                    return [id, { ...shape, id }];
                })
            ),
            components: {
                family: createComponent({
                    id: 'family',
                    name: 'Button',
                    sourceOnly: true,
                    shapesIds: ['base'],
                    variantIds: ['alternate'],
                    props: [{ id: 'label', key: 'text', shapeId: 'base', label: 'Label' }],
                    interaction: { role: 'button', props: { label: 'label' } }
                }),
                alternate: createComponent({
                    id: 'alternate',
                    name: 'Wide',
                    sourceOnly: true,
                    shapesIds: ['first', 'second', 'rectangle'],
                    interaction: { role: 'button', props: { label: 'label' } }
                })
            }
        })
    );
    const document = store.state.currentDocument;

    return { store, document };
}

const mapping = { componentId: 'alternate', propId: 'label', shapeId: 'second' };

it('repairs a missing shared mapping and retargets it without losing values, bindings or role links', () => {
    const { store, document } = setup();
    expect(componentPropertyMappings(document, 'alternate')[0]).toMatchObject({
        shapeId: '',
        editable: true,
        targets: [{ id: 'first' }, { id: 'second' }]
    });
    const before = json(document.shapes);
    store.actions.setComponentPropTarget(mapping);
    expect(document.components.alternate.props).toEqual([
        { id: 'label', key: 'text', shapeId: 'second', label: 'Label' }
    ]);
    expect(json(document.shapes)).toEqual(before);
    expect(componentVariantProblems(document, 'family', 'alternate')).toEqual([]);
    const instance = document.shapes.instance;
    if (instance.type !== 'instance') {
        throw new Error('Expected instance');
    }
    expect(projectGeometry(instance, document, {})).toMatchObject({
        projectedSource: {
            shapes: [
                expect.objectContaining({ value: 'first' }),
                expect.objectContaining({ value: 'Continue' }),
                expect.anything()
            ]
        }
    });
    const variableId = store.actions.createVariable({
        type: 'text',
        name: 'content/label',
        value: 'Submit'
    })!;
    store.actions.bindInstanceOverride({ instanceIds: ['instance'], propId: 'label', variableId });
    store.actions.setComponentPropTarget({ ...mapping, shapeId: 'first' });
    store.actions.setInstanceVariant({ instanceIds: ['instance'] });
    store.actions.setInstanceVariant({ instanceIds: ['instance'], variantId: 'alternate' });
    expect(instance.overrides).toEqual({ label: { variableId } });
    expect(document.components.alternate.interaction).toEqual(
        document.components.family.interaction
    );
    expect(projectGeometry(instance, document, {})).toMatchObject({
        projectedSource: {
            shapes: [
                expect.objectContaining({ value: 'Submit' }),
                expect.objectContaining({ value: 'second' }),
                expect.anything()
            ]
        }
    });
    const restored = restoreDocuments(serializePersistedState(store.state))[document.id];
    expect(restored.components.alternate.props).toEqual(json(document.components.alternate.props));
    expect(restored.shapes.instance).toMatchObject({
        variantId: 'alternate',
        overrides: { label: { variableId } }
    });
});

it('repairs the original field key while retaining its property identity', () => {
    const { store, document } = setup();
    store.actions.addComponent({
        ...json(document.components.alternate),
        props: [{ id: 'label', key: 'fontSize', shapeId: 'first', label: 'Label' }]
    });
    store.actions.setComponentPropTarget(mapping);
    expect(document.components.alternate.props).toEqual([
        { id: 'label', key: 'text', shapeId: 'second', label: 'Label' }
    ]);
    expect(document.shapes.instance).toMatchObject({ overrides: { label: 'Continue' } });
});

it('repairs the default first when its mapping is invalid without changing the alternate', () => {
    const { store, document } = setup();
    store.actions.addComponent({
        ...json(document.components.family),
        shapesIds: ['base', 'rectangle'],
        props: [{ id: 'label', key: 'text', shapeId: 'rectangle', label: 'Label' }]
    });
    store.actions.setComponentPropTarget(mapping);
    expect(document.components.alternate.props).toBeUndefined();
    store.actions.setComponentPropTarget({
        componentId: 'family',
        propId: 'label',
        shapeId: 'base'
    });
    expect(document.components.family.props![0].shapeId).toBe('base');
    expect(document.components.alternate.props).toBeUndefined();
    store.actions.setComponentPropTarget(mapping);
    expect(componentVariantProblems(document, 'family', 'alternate')).toEqual([]);
});

it.each(['missing', 'base', 'rectangle'])(
    'rejects missing, foreign and incompatible target %s',
    (shapeId) => {
        const { store, document } = setup();
        store.actions.setComponentPropTarget({ ...mapping, shapeId });
        store.actions.setComponentPropTarget({ ...mapping, propId: 'missing' });
        store.actions.setComponentPropTarget({ ...mapping, componentId: 'missing' });
        expect(document.components.alternate.props).toBeUndefined();
    }
);

it('does not steal an already exposed target or delete its independent property values', () => {
    const { store, document } = setup();
    store.actions.exposeComponentProp({
        componentId: 'alternate',
        shapeId: 'second',
        key: 'text',
        label: 'Independent label'
    });
    const original = json(document.components.alternate.props);
    expect(componentPropertyMappings(document, 'alternate')[0].targets[1]).toMatchObject({
        disabled: true,
        label: 'second · Text (already exposed)'
    });
    store.actions.setComponentPropTarget(mapping);
    expect(json(document.components.alternate.props)).toEqual(original);
    store.actions.setComponentPropTarget({ ...mapping, shapeId: 'first' });
    expect(document.components.alternate.props).toHaveLength(2);
});

it.each(['document', 'family', 'alternate', 'library', 'family-library', 'multiple-families'])(
    'refuses mapping edits for %s restrictions',
    (restriction) => {
        const { store, document } = setup();
        if (restriction === 'document') {
            store.actions.lockDocument(document.id);
        }
        if (restriction === 'family' || restriction === 'alternate') {
            store.actions.lockComponent(restriction);
        }
        if (restriction === 'library' || restriction === 'family-library') {
            const id = restriction === 'library' ? 'alternate' : 'family';
            store.actions.addComponent({
                ...json(document.components[id]),
                library: { documentId: 'origin', hash: 'hash' }
            });
        }
        if (restriction === 'multiple-families') {
            store.actions.addComponent({
                id: 'other',
                variantIds: ['alternate'],
                shapesIds: ['base']
            });
        }
        store.actions.setComponentPropTarget(mapping);
        expect(document.components.alternate.props).toBeUndefined();
    }
);

it('shares mapping repair and undoes it independently of a concurrent instance value edit', async () => {
    const { document } = setup();
    const copies = await createCopies(2, (store) =>
        store.actions.addDocument({ ...json(document), id: DOCUMENT_ID })
    );
    const [a, b] = copies;
    edit(a, (actions) => actions.setComponentPropTarget(mapping));
    edit(b, (actions) =>
        actions.setInstanceOverride({
            instanceIds: ['instance'],
            propId: 'label',
            value: 'Remote value'
        })
    );
    settle(copies);
    expect(sharedContent(a)).toEqual(sharedContent(b));
    expect(shownDocument(b).components.alternate.props![0].shapeId).toBe('second');
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).components.alternate.props).toBeUndefined();
    expect(shownDocument(b).shapes.instance).toMatchObject({
        overrides: { label: 'Remote value' }
    });
    a.collaboration.redo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).components.alternate.props![0].shapeId).toBe('second');
    expect(sharedContent(a)).toEqual(sharedContent(b));
    copies.forEach((copy) => copy.collaboration.dispose());
});

it('carries repaired mappings through a library update while preserving recipient instance values', () => {
    const { store, document } = setup();
    const origin = document.id;
    const before = componentFingerprint(document, 'family');
    store.actions.addDocument({ id: 'recipient' });
    store.actions.openDocument('recipient');
    store.actions.importLibraryComponent({ documentId: origin, componentId: 'family' });
    store.actions.addShape({
        name: 'Recipient instance',
        type: 'instance',
        componentId: 'family',
        variantId: 'alternate',
        position: { x: 0, y: 0 },
        overrides: { label: 'Local value' }
    });
    const recipientInstanceId = store.state.currentDocument.shapesIds.at(-1)!;
    store.actions.openDocument(origin);
    store.actions.setComponentPropTarget(mapping);
    expect(componentFingerprint(document, 'family')).not.toBe(before);
    store.actions.openDocument('recipient');
    expect(store.state.currentDocument.components.alternate.props).toBeUndefined();
    store.actions.updateLibraryComponent('family');
    const recipient = store.state.currentDocument;
    expect(recipient.components.alternate.props![0]).toMatchObject({
        id: 'label',
        shapeId: 'second'
    });
    const instance = recipient.shapes[recipientInstanceId];
    expect(instance).toMatchObject({ variantId: 'alternate', overrides: { label: 'Local value' } });
    if (instance.type !== 'instance') {
        throw new Error('Expected instance');
    }
    expect(projectGeometry(instance, recipient, {})).toMatchObject({
        projectedSource: {
            shapes: [
                expect.anything(),
                expect.objectContaining({ value: 'Local value' }),
                expect.anything()
            ]
        }
    });
    store.actions.setComponentPropTarget({ ...mapping, shapeId: 'first' });
    expect(recipient.components.alternate.props![0].shapeId).toBe('second');
});
