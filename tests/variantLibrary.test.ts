import { json } from 'overmind';
import type { Document, InstanceShape } from 'src/app/types';
import { componentPropValue } from 'src/app/componentProps';
import {
    instanceProperties,
    libraryUpdateAvailable,
    libraryUpdateProblem
} from 'src/app/computed/componentPanels';
import { instanceComponentId } from 'src/app/componentSource';
import { projectGeometry } from 'src/app/contextualGeometry';
import { restoreDocuments, serializePersistedState } from 'src/app/services/documentStorage';
import { createTestStore } from './support/store';
import { variantLibrary } from './support/variantLibrary';
import {
    createCopies,
    DOCUMENT_ID,
    edit,
    settle,
    sharedContent,
    shownDocument
} from './support/collaboration';

function setup() {
    const { source, target } = variantLibrary();
    const { store } = createTestStore();
    store.actions.addDocument(source);
    store.actions.addDocument(target);
    store.actions.openDocument(target.id);

    return { store, sourceId: source.id, targetId: target.id };
}

function instance(document: Document, id = 'button'): InstanceShape {
    const shape = document.shapes[id];
    if (shape.type !== 'instance') {
        throw new Error('Expected instance');
    }

    return shape;
}

function drawn(document: Document, id = 'button') {
    return projectGeometry(instance(document, id), document, {}) as InstanceShape;
}

function inspector(document: Document) {
    return instanceProperties({ ...document, selectedShapes: [instance(document)] })!;
}

it('updates alternate artwork under the same ID and preserves choices, values and authored actions', () => {
    const { store, sourceId, targetId } = setup();
    const before = json(instance(store.state.currentDocument));
    store.actions.openDocument(sourceId);
    store.actions.addShape({
        type: 'text',
        name: 'Replacement label',
        value: 'Replacement',
        fontSize: 48,
        position: { x: 0, y: 0 }
    });
    const id = store.state.currentDocument.shapesIds.at(-1)!;
    store.actions.addComponent({
        ...json(store.state.currentDocument.components.wide),
        shapesIds: [id],
        props: [{ id: 'label', key: 'text', label: 'Label', shapeId: id }]
    });
    store.actions.openDocument(targetId);
    expect(libraryUpdateAvailable(store.state, 'outer')).toBe(true);
    store.actions.updateLibraryComponent('outer');
    const target = store.state.currentDocument;
    expect(json(instance(target))).toEqual(before);
    expect(drawn(target).projectedSource?.shapes[0]).toMatchObject({
        id,
        value: 'Continue',
        fontSize: 48
    });
    expect(drawn(target, 'nested-use').projectedSource?.shapes[0]).toMatchObject({
        projectedSource: { shapes: [expect.objectContaining({ value: 'Nested', fontSize: 48 })] }
    });
    expect(libraryUpdateAvailable(store.state, 'outer')).toBe(false);
});

it.each(['unlink', 'delete', 'replacement'])(
    'falls back for %s without reconnecting an obsolete cached variant or changing its selection',
    (change) => {
        const { store, sourceId, targetId } = setup();
        store.actions.openDocument(sourceId);
        const source = store.state.currentDocument;
        if (change === 'unlink') {
            store.actions.removeComponentVariant({ componentId: 'family', variantId: 'wide' });
        }
        if (change === 'delete') {
            // A remote deletion can leave an authored dangling variant ID.
            const next = json(source);
            delete next.components.wide;
            store.actions.addDocument(next);
        }
        if (change === 'replacement') {
            store.actions.addComponent({
                ...json(source.components.wide),
                id: 'replacement',
                name: 'Replacement'
            });
            store.actions.addComponent({
                ...json(source.components.family),
                variantIds: ['replacement']
            });
        }
        store.actions.openDocument(targetId);
        store.actions.updateLibraryComponent('outer');
        const target = store.state.currentDocument;
        expect(instance(target)).toMatchObject({
            variantId: 'wide',
            overrides: { label: 'Continue' }
        });
        expect(instanceComponentId(target, instance(target))).toBe('family');
        expect(drawn(target).projectedSource?.shapes[0]).toMatchObject({
            value: 'Continue',
            fontSize: 16
        });
        expect(inspector(target).variantProblems).toEqual([expect.stringContaining('unavailable')]);
        expect(drawn(target, 'nested-use').projectedSource?.shapes[0]).toMatchObject({
            projectedSource: { shapes: [expect.objectContaining({ fontSize: 16 })] }
        });
        expect(drawn(target, 'direct-wide').projectedSource?.shapes[0]).toMatchObject({
            value: 'Standalone',
            fontSize: 32
        });
        const restored = restoreDocuments(serializePersistedState(store.state))[targetId];
        expect(instance(restored).variantId).toBe('wide');
        expect(instanceComponentId(restored, instance(restored))).toBe('family');
        if (change === 'replacement') {
            store.actions.setInstanceVariant({ instanceIds: ['button'], variantId: 'replacement' });
            expect(instance(target)).toMatchObject({
                variantId: 'replacement',
                overrides: { label: 'Continue' }
            });
            expect(inspector(target).variantProblems).toEqual([]);
        }
    }
);

it('restores a missing variant when the same identity returns upstream', () => {
    const { store, sourceId, targetId } = setup();
    const original = json(store.state.documents[sourceId]);
    store.actions.openDocument(sourceId);
    store.actions.removeComponentVariant({ componentId: 'family', variantId: 'wide' });
    store.actions.openDocument(targetId);
    store.actions.updateLibraryComponent('outer');
    expect(
        instanceComponentId(store.state.currentDocument, instance(store.state.currentDocument))
    ).toBe('family');
    store.actions.addDocument(original);
    store.actions.updateLibraryComponent('outer');
    expect(drawn(store.state.currentDocument).projectedSource?.shapes[0]).toMatchObject({
        value: 'Continue',
        fontSize: 32
    });
});

it('retains removed and newly identified properties through updates, reload and paste until the original ID returns', () => {
    const { store, sourceId, targetId } = setup();
    const original = json(store.state.documents[sourceId]);
    const variableId = store.actions.createVariable({
        name: 'Caption',
        type: 'text',
        value: 'Custom caption'
    })!;
    store.actions.bindInstanceOverride({ instanceIds: ['button'], propId: 'label', variableId });
    store.actions.openDocument(sourceId);
    for (const id of ['family', 'wide']) {
        const component = store.state.currentDocument.components[id];
        store.actions.addComponent({
            ...json(component),
            props: component.props!.map((prop) => ({ ...prop, id: 'replacement-label' }))
        });
    }
    store.actions.openDocument(targetId);
    store.actions.updateLibraryComponent('outer');
    const target = store.state.currentDocument;
    expect(instance(target).overrides).toEqual({ label: { variableId } });
    expect(inspector(target).propertyProblems).toEqual([
        expect.stringContaining('1 saved property value is no longer exposed')
    ]);
    expect(drawn(target).projectedSource?.shapes[0]).toMatchObject({ value: 'Wide' });
    const restored = restoreDocuments(serializePersistedState(store.state))[targetId];
    expect(instance(restored).overrides).toEqual({ label: { variableId } });
    store.actions.unselectShapes();
    store.actions.selectShape('button');
    const clipboard = store.actions.copySelection()!;
    store.actions.newDocument();
    expect(store.actions.pasteShapes(clipboard)).toBe('pasted');
    const pasted = store.state.currentDocument;
    expect(instance(pasted, pasted.shapesIds[0]).overrides).toEqual({
        label: { variableId: pasted.variablesIds[0] }
    });
    store.actions.openDocument(targetId);
    store.actions.addDocument(original);
    store.actions.updateLibraryComponent('outer');
    expect(drawn(target).projectedSource?.shapes[0]).toMatchObject({ value: 'Custom caption' });
    expect(inspector(target).propertyProblems).toEqual([]);
});

it.each(['literal', 'binding'])(
    'ignores incompatible retained %s values and keeps source bindings until their field type returns',
    (kind) => {
        const { store, sourceId, targetId } = setup();
        const original = json(store.state.documents[sourceId]);
        if (kind === 'binding') {
            const variableId = store.actions.createVariable({
                name: 'Caption',
                type: 'text',
                value: 'Continue'
            })!;
            store.actions.bindInstanceOverride({
                instanceIds: ['button'],
                propId: 'label',
                variableId
            });
        }
        const overrides = json(instance(store.state.currentDocument).overrides);
        store.actions.openDocument(sourceId);
        for (const id of ['family', 'wide']) {
            const component = store.state.currentDocument.components[id];
            store.actions.addComponent({
                ...json(component),
                props: component.props!.map((prop) => ({ ...prop, key: 'fontSize' }))
            });
        }
        store.actions.openDocument(targetId);
        store.actions.updateLibraryComponent('outer');
        const target = store.state.currentDocument;
        const size = store.actions.createVariable({ name: 'Size', type: 'number', value: 40 })!;
        const wide = json(target.components.wide);
        wide.sourceShapes!['wide-text'].bindings = { fontSize: size };
        store.actions.addComponent(wide);
        expect(componentPropValue(instance(target), target.components.wide, 'label', target)).toBe(
            32
        );
        expect(drawn(target).projectedSource?.shapes[0]).toMatchObject({ fontSize: 40 });
        expect(instance(target).overrides).toEqual(overrides);
        expect(inspector(target).propertyProblems).toEqual([
            expect.stringContaining('cannot apply')
        ]);
        store.actions.addDocument(original);
        store.actions.updateLibraryComponent('outer');
        expect(drawn(target).projectedSource?.shapes[0]).toMatchObject({ value: 'Continue' });
    }
);

it.each(['missing-family', 'trashed-library', 'removed-library'])(
    'keeps the last usable snapshot for %s',
    (change) => {
        const { store, sourceId } = setup();
        const before = json(store.state.currentDocument.components);
        const changedSource = json(store.state.documents[sourceId]);
        const changedText = changedSource.shapes['wide-text'];
        if (changedText.type === 'text') {
            changedText.fontSize = 64;
        }
        store.actions.addDocument(changedSource);
        if (change === 'missing-family') {
            const source = json(store.state.documents[sourceId]);
            delete source.components.family;
            store.actions.addDocument(source);
        }
        if (change === 'trashed-library') {
            store.actions.trashDocument(sourceId);
        }
        if (change === 'removed-library') {
            store.actions.removeDocument(sourceId);
        }
        expect(libraryUpdateAvailable(store.state, 'family')).toBe(false);
        expect(libraryUpdateProblem(store.state, 'family')).toEqual(
            change === 'removed-library'
                ? null
                : expect.stringContaining(
                      change === 'trashed-library' ? 'Recently Deleted' : 'no longer has'
                  )
        );
        store.actions.updateLibraryComponent('family');
        expect(json(store.state.currentDocument.components)).toEqual(before);
        expect(drawn(store.state.currentDocument).projectedSource?.shapes[0]).toMatchObject({
            value: 'Continue',
            fontSize: 32
        });
    }
);

it('rejects an entire update when a replacement dependency conflicts with local content', () => {
    const { store, sourceId, targetId } = setup();
    store.actions.addComponent({ id: 'replacement', name: 'Local component', shapesIds: [] });
    const before = json(store.state.currentDocument.components);
    store.actions.openDocument(sourceId);
    const source = store.state.currentDocument;
    store.actions.addComponent({ ...json(source.components.wide), id: 'replacement' });
    store.actions.addComponent({ ...json(source.components.family), variantIds: ['replacement'] });
    store.actions.openDocument(targetId);
    store.actions.updateLibraryComponent('outer');
    expect(json(store.state.currentDocument.components)).toEqual(before);
});

it('shares an update as one undo step without overwriting a concurrent instance edit', async () => {
    const { source, target } = variantLibrary();
    const copies = await createCopies(
        2,
        (store) => {
            store.actions.addDocument(source);
            store.actions.addDocument({ ...target, id: DOCUMENT_ID });
        },
        60_000
    );
    const [a, b] = copies;
    a.store.actions.openDocument(source.id);
    a.store.actions.addComponent({
        ...json(a.store.state.currentDocument.components.family),
        variantIds: [],
        props: []
    });
    a.store.actions.openDocument(DOCUMENT_ID);
    edit(a, (actions) => actions.updateShape({ id: 'button', name: 'Local rename' }));
    edit(a, (actions) => actions.updateLibraryComponent('family'));
    edit(b, (actions) =>
        actions.setInstanceOverride({
            instanceIds: ['button'],
            propId: 'label',
            value: 'Remote edit'
        })
    );
    settle(copies);
    expect(sharedContent(a)).toEqual(sharedContent(b));
    expect(instance(shownDocument(b))).toMatchObject({
        name: 'Local rename',
        variantId: 'wide',
        overrides: { label: 'Remote edit' }
    });
    expect(shownDocument(b).components.family.props).toEqual([]);
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).components.family.props).toHaveLength(1);
    expect(instance(shownDocument(b))).toMatchObject({
        name: 'Local rename',
        variantId: 'wide',
        overrides: { label: 'Remote edit' }
    });
    a.collaboration.redo(DOCUMENT_ID);
    settle(copies);
    expect(sharedContent(a)).toEqual(sharedContent(b));
    expect(shownDocument(b).components.family.props).toEqual([]);
    copies.forEach((copy) => copy.collaboration.dispose());
});

it('does not apply a library update to a read-only document', () => {
    const { store, sourceId, targetId } = setup();
    const before = json(store.state.currentDocument.components);
    store.actions.openDocument(sourceId);
    store.actions.updateShape({ id: 'wide-text', fontSize: 64 });
    store.actions.openDocument(targetId);
    store.actions.lockDocument(targetId);
    store.actions.updateLibraryComponent('outer');
    expect(json(store.state.currentDocument.components)).toEqual(before);
});

it('still rejects missing variable and component references for dormant overrides', () => {
    const { store } = setup();
    const document = store.state.currentDocument;
    const check = (componentId: string, value: string | { variableId: string }) =>
        store.actions.checkOperations({
            documentId: document.id,
            operations: [
                {
                    op: 'addShape',
                    key: 'copy',
                    shape: {
                        type: 'instance',
                        componentId,
                        position: { x: 0, y: 0 },
                        overrides: { retired: value }
                    }
                }
            ]
        });
    expect(check('family', { variableId: 'missing' }).valid).toBe(false);
    expect(check('missing', 'Unknown component').valid).toBe(false);
    store.actions.addComponent({ id: 'local', shapesIds: [], props: [] });
    expect(check('local', 'Unknown property').valid).toBe(false);
});

it('retains a dormant value when pasted back into a local family with a removed property', () => {
    const { store } = setup();
    const document = store.state.currentDocument;
    const family = json(document.components.family);
    delete family.library;
    family.props = [];
    store.actions.addComponent(family);
    store.actions.unselectShapes();
    store.actions.selectShape('button');
    const clipboard = store.actions.copySelection()!;
    expect(store.actions.pasteShapes(clipboard)).toBe('pasted');
    const pastedId = document.shapesIds.at(-1)!;
    expect(instance(document, pastedId).overrides).toEqual({ label: 'Continue' });
});

it.each(['family', 'wide'])('keeps the previous snapshot when %s loses all its artwork', (id) => {
    const { store, sourceId, targetId } = setup();
    const before = json(store.state.currentDocument.components);
    store.actions.openDocument(sourceId);
    store.actions.addComponent({
        ...json(store.state.currentDocument.components[id]),
        shapesIds: [],
        props: []
    });
    store.actions.openDocument(targetId);
    expect(libraryUpdateAvailable(store.state, 'family')).toBe(false);
    expect(libraryUpdateProblem(store.state, 'family')).toBe(
        `${id === 'family' ? 'Button' : 'Button Wide'} has no usable artwork in the library. ` +
            "Updates wait until it's fixed; the last copy stays in use."
    );
    store.actions.updateLibraryComponent('family');
    expect(json(store.state.currentDocument.components)).toEqual(before);
    expect(drawn(store.state.currentDocument).projectedSource?.shapes[0]).toMatchObject({
        value: 'Continue',
        fontSize: 32
    });
});

function withRetainedValue() {
    const { source, target } = variantLibrary();
    const button = target.shapes.button;
    if (button.type === 'instance') {
        button.overrides.retired = 'Old';
    }
    const { store } = createTestStore();
    store.actions.addDocument(source);
    store.actions.addDocument(target);
    store.actions.openDocument(target.id);

    return { store, sourceId: source.id, targetId: target.id };
}

it('pastes into a document whose own component lacks a retained property, dropping that value', () => {
    const { store, sourceId } = withRetainedValue();
    store.actions.unselectShapes();
    store.actions.selectShape('button');
    const clipboard = store.actions.copySelection()!;
    store.actions.openDocument(sourceId);
    expect(store.actions.pasteShapes(clipboard)).toBe('pasted');
    const document = store.state.currentDocument;
    expect(instance(document, document.shapesIds.at(-1)).overrides).toEqual({
        label: 'Continue'
    });
});

it('rejects made-up property IDs on library instances outside paste', () => {
    const { store } = withRetainedValue();
    const document = store.state.currentDocument;
    const add = (overrides: Record<string, string>) => ({
        documentId: document.id,
        operations: [
            {
                op: 'addShape' as const,
                key: 'copy',
                shape: {
                    type: 'instance' as const,
                    componentId: 'family',
                    position: { x: 0, y: 0 },
                    overrides
                }
            }
        ]
    });
    expect(store.actions.checkOperations(add({ 'made-up': 'Hello' })).valid).toBe(false);
    // An ID an instance here already keeps a value for may be written again.
    expect(store.actions.checkOperations(add({ retired: 'Again' })).valid).toBe(true);
    expect(
        store.actions.applyOperations({
            ...add({ 'made-up': 'Hello' }),
            by: { kind: 'person' },
            retainOverrides: true
        }).applied
    ).toBe(true);
});

it('discards only the values kept for properties the source no longer exposes', () => {
    const { store } = withRetainedValue();
    const document = store.state.currentDocument;
    expect(inspector(document).hasRetainedValues).toBe(true);
    store.actions.discardRetainedOverrides({ instanceIds: ['button'] });
    expect(instance(document).overrides).toEqual({ label: 'Continue' });
    expect(inspector(document).hasRetainedValues).toBe(false);
    expect(inspector(document).propertyProblems).toEqual([]);
});
