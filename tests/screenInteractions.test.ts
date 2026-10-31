import * as Y from 'yjs';
import { json } from 'overmind';
import { effectiveActivation, inheritedActivation } from 'src/app/screenInteractions';
import { resolveComponentRole } from 'src/app/componentRoles';
import { componentFingerprint, librarySnapshot } from 'src/app/componentLibrary';
import { readClipboard } from 'src/app/clipboard';
import { projectPreview } from 'src/preview/project';
import { readPreview } from 'src/preview/protocol';
import {
    readEntity,
    readInteractions,
    serializePersistedState,
    restoreDocuments,
    migratePersistedState
} from 'src/app/services/documentStorage';
import type { InstanceShape, InteractionSettings } from 'src/app/types';
import { previewFixture } from './support/preview';
import { automaticLayoutsPrototype } from './support/automaticScreenLayouts';
import { responsiveVariantsDocument } from './support/responsiveVariants';
import { createTestStore } from './support/store';
import { createCopies, edit, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';

const navigate = (screenId: string): InteractionSettings => ({
    activate: { type: 'navigate', screenId }
});

function setup(store: ReturnType<typeof createTestStore>['store']) {
    const document = previewFixture();
    document.id = store.state.currentDocumentId;
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    store.actions.addDocument(restoreDocuments(migratePersistedState(saved)!)[document.id]);
}

function fixture() {
    const { store } = createTestStore();
    setup(store);
    const document = store.state.currentDocument;
    const instance = () => document.shapes.next as InstanceShape;
    const resolve = () => effectiveActivation(document.components.button, instance());
    const change = (target: 'component' | 'instance', settings: InteractionSettings) =>
        store.actions.editInteractions({
            target,
            id: target === 'component' ? 'button' : 'next',
            settings
        });

    return { store, document, instance, resolve, change };
}

it('adapts legacy Button navigation, including old instance role overrides without navigation', () => {
    const document = previewFixture();
    const instance = () => document.shapes.next as InstanceShape;
    delete document.components.button.interactions;
    delete instance().interactions;
    const resolve = () => effectiveActivation(document.components.button, instance());
    expect(resolve()).toEqual(navigate('details').activate);
    instance().interaction = { role: 'button', props: { label: 'label' } };
    expect(resolve()).toBeNull();
    instance().interaction!.navigateTo = 'home';
    expect(resolve()).toEqual(navigate('home').activate);
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    const restored = restoreDocuments(migratePersistedState({ ...saved, version: 22 })!)[
        document.id
    ];
    expect(
        effectiveActivation(restored.components.button, restored.shapes.next as InstanceShape)
    ).toEqual(navigate('home').activate);
});

it('inherits, customizes and removes actions independently of roles and instance values', () => {
    const { store, document, instance, resolve, change } = fixture();
    change('component', navigate('details'));
    store.actions.editRole({
        target: 'instance',
        id: 'next',
        settings: { role: 'text', props: { content: 'label' } }
    });
    expect(inheritedActivation(instance())).toBe(true);
    expect(resolve()).toEqual(navigate('details').activate);
    change('instance', navigate('home'));
    change('component', { activate: null });
    expect(resolve()).toEqual(navigate('home').activate);
    store.actions.setInstanceOverride({ instanceIds: ['next'], propId: 'label', value: 'Open' });
    store.actions.editRole({ target: 'instance', id: 'next', settings: null });
    expect(resolve()).toEqual(navigate('home').activate);
    change('instance', {});
    expect(resolve()).toBeNull();
    change('component', navigate('details'));
    expect(resolve()).toEqual(navigate('details').activate);
    change('instance', { activate: null });
    expect(resolve()).toBeNull();
    expect(resolveComponentRole(document, document.components.button, instance()).role).toBe(
        'button'
    );
    expect(instance().overrides.label).toBe('Open');
});

it('keeps legacy navigation when a role changes and gives an untyped actionable component an accessible button', () => {
    const { store, document, resolve } = fixture();
    store.actions.editRole({ target: 'component', id: 'button', settings: null });
    expect(document.components.button.interaction).toBeUndefined();
    expect(resolve()).toEqual(navigate('details').activate);
    const output = projectPreview(document, {});
    const control = output.screens[0].nodes.find((node) => node.key === 'home/next')!.control;
    expect(control).toMatchObject({
        role: 'button',
        label: 'Continue button',
        navigateTo: 'details'
    });
});

it('retains screen IDs across renames and diagnoses deleted targets without changing the authored action', () => {
    const { store, document, change, resolve } = fixture();
    change('instance', navigate('details'));
    store.actions.editFrame({ kind: 'update', id: 'details', changes: { name: 'Receipt' } });
    expect(
        projectPreview(document, {}).screens.find((screen) => screen.id === 'details')!.name
    ).toBe('Receipt');
    store.actions.editFrame({ kind: 'delete', id: 'details' });
    const warnings: string[] = [];
    const output = projectPreview(document, {}, warnings);
    expect(
        output.screens[0].nodes.find((node) => node.key === 'home/next')!.control?.navigateTo
    ).toBeUndefined();
    expect(warnings.join()).toContain('unavailable screen');
    expect(resolve()).toEqual(navigate('details').activate);
    change('instance', navigate('missing'));
    expect(resolve()).toEqual(navigate('details').activate);
});

it('stores actions durably, copies and clones them, and strips document-local destinations from libraries', () => {
    const { store, document, change, instance } = fixture();
    change('component', navigate('home'));
    change('instance', navigate('details'));
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    const restored = restoreDocuments(migratePersistedState(saved)!)[document.id];
    expect(
        effectiveActivation(restored.components.button, restored.shapes.next as InstanceShape)
    ).toEqual(navigate('details').activate);
    store.actions.selectShape('next');
    const copied = readClipboard(store.actions.copySelection()!)!;
    expect(copied.shapes[0]).toMatchObject({ interactions: navigate('details') });
    store.actions.cloneShapes(['next']);
    const clone = document.shapes[document.selectedShapesIds[0]] as InstanceShape;
    expect(clone.id).not.toBe(instance().id);
    expect(clone.interactions).toEqual(navigate('details'));
    const before = componentFingerprint(document, 'button');
    change('component', navigate('details'));
    expect(componentFingerprint(document, 'button')).toBe(before);
    const imported = librarySnapshot(document, 'button', { components: {} })![0];
    expect(effectiveActivation(imported)).toBeNull();
    expect(effectiveActivation(document.components.button)).toEqual(navigate('details').activate);
});

it('applies action changes atomically and refuses invalid actions without earlier partial edits', () => {
    const { store, document, instance } = fixture();
    const apply = (interactions: InteractionSettings) =>
        store.actions.applyOperations({
            documentId: document.id,
            by: { kind: 'person' },
            operations: [
                { op: 'updateShape', shape: 'caption', changes: { value: 'Updated' } },
                { op: 'updateShape', shape: 'next', changes: { interactions } }
            ]
        });
    expect(apply(navigate('')).applied).toBe(false);
    expect(document.shapes.caption).toMatchObject({ value: 'Continue' });
    expect(apply(navigate('home')).applied).toBe(true);
    expect(instance().interactions).toEqual(navigate('home'));
    expect(apply({}).applied).toBe(true);
    expect(inheritedActivation(instance())).toBe(true);
});

it.each([
    null,
    [],
    { hover: null },
    { activate: { type: 'script', screenId: 'home' } },
    { activate: { type: 'navigate', screenId: '' } }
])('rejects malformed durable interaction metadata %j', (interactions) => {
    const document = previewFixture();
    expect(() => readInteractions(interactions)).toThrow();
    expect(() =>
        readEntity('components', { ...json(document.components.button), interactions })
    ).toThrow();
    expect(() => readEntity('shapes', { ...json(document.shapes.next), interactions })).toThrow();
});

it('honors document, source and instance editing guards', () => {
    const { store, document, change, instance } = fixture();
    store.actions.lockDocument(document.id);
    change('component', navigate('home'));
    expect(document.components.button.interactions).toEqual(navigate('details'));
    store.actions.unlockDocument(document.id);
    store.actions.lockComponent('button');
    change('component', navigate('home'));
    expect(document.components.button.interactions).toEqual(navigate('details'));
    store.actions.lockShape('next');
    change('instance', navigate('home'));
    expect(instance().interactions).toEqual({});
});

it('preserves family actions and explicit choices across responsive visual variants', () => {
    const document = responsiveVariantsDocument();
    const instance = document.shapes.button as InstanceShape;
    document.components.family.interactions = navigate('screen');
    document.components.wide.interactions = { activate: null };
    instance.interactions = {};
    for (const width of [360, 900]) {
        const output = projectPreview(document, {}, [], {
            modes: {},
            screenId: 'screen',
            viewport: { width, height: 480 }
        });
        expect(JSON.stringify(output)).toContain('"navigateTo":"screen"');
    }
    instance.variantId = 'wide';
    instance.interactions = { activate: null };
    expect(effectiveActivation(document.components.family, instance)).toBeNull();
});

it('uses the same authored actions in automatically selected layouts and retains input identity', () => {
    const document = automaticLayoutsPrototype();
    document.components.button.interactions = navigate('details');
    for (const width of [320, 800]) {
        const output = readPreview({
            ...projectPreview(document, {}, [], {
                modes: {},
                screenId: 'home',
                layoutMode: 'auto',
                viewport: { width, height: 480 }
            }),
            images: {}
        });
        const nodes = output.screens.find((screen) => screen.id === 'home')!.nodes;
        expect(nodes.find((node) => node.control?.role === 'button')!.control?.navigateTo).toBe(
            'details'
        );
        expect(nodes.find((node) => node.control?.role === 'input')!.control?.stateKey).toContain(
            'person-name'
        );
    }
});

it('converges action and visual edits and undoes only the local action change', async () => {
    const copies = await createCopies(2, setup);
    const [a, b] = copies;
    edit(a, (actions) =>
        actions.editInteractions({ target: 'instance', id: 'next', settings: navigate('home') })
    );
    edit(b, (actions) =>
        actions.setInstanceOverride({ instanceIds: ['next'], propId: 'label', value: 'Open' })
    );
    settle(copies);
    const resolve = (copy: typeof a) =>
        effectiveActivation(
            shownDocument(copy).components.button,
            shownDocument(copy).shapes.next as InstanceShape
        );
    expect(resolve(a)).toEqual(navigate('home').activate);
    expect(resolve(b)).toEqual(resolve(a));
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(resolve(b)).toEqual(navigate('details').activate);
    expect((shownDocument(b).shapes.next as InstanceShape).overrides.label).toBe('Open');
});

it('accepts legacy navigation operations while keeping subsequent role changes independent', () => {
    const { store, document, resolve } = fixture();
    expect(
        store.actions.applyOperations({
            documentId: document.id,
            by: { kind: 'person' },
            operations: [
                {
                    op: 'updateShape',
                    shape: 'next',
                    changes: {
                        interaction: {
                            role: 'button',
                            props: { label: 'label' },
                            navigateTo: 'home'
                        }
                    }
                }
            ]
        }).applied
    ).toBe(true);
    expect(resolve()).toEqual(navigate('home').activate);
    expect(
        store.actions.applyOperations({
            documentId: document.id,
            by: { kind: 'person' },
            operations: [
                {
                    op: 'updateShape',
                    shape: 'next',
                    changes: {
                        interaction: { role: 'none', props: {} }
                    }
                }
            ]
        }).applied
    ).toBe(true);
    expect(resolve()).toEqual(navigate('home').activate);
});

it('does not replace an independent action when a role-only operation carries its unchanged legacy destination', () => {
    const { store, document, change, resolve } = fixture();
    store.actions.editRole({
        target: 'instance',
        id: 'next',
        settings: {
            role: 'button',
            props: { label: 'label' },
            navigateTo: 'details'
        }
    });
    change('instance', navigate('home'));
    expect(
        store.actions.applyOperations({
            documentId: document.id,
            by: { kind: 'person' },
            operations: [
                {
                    op: 'updateShape',
                    shape: 'next',
                    changes: {
                        interaction: { role: 'button', props: {}, navigateTo: 'details' }
                    }
                }
            ]
        }).applied
    ).toBe(true);
    expect(resolve()).toEqual(navigate('home').activate);
});

it('preserves a concurrent explicit action when the first role edit separates legacy navigation', async () => {
    const copies = await createCopies(2, (store) => {
        setup(store);
    });
    const [a, b] = copies;
    edit(a, (actions) => actions.editRole({ target: 'component', id: 'button', settings: null }));
    edit(b, (actions) =>
        actions.editInteractions({ target: 'component', id: 'button', settings: navigate('home') })
    );
    settle(copies);
    for (const copy of copies) {
        expect(effectiveActivation(shownDocument(copy).components.button)).toEqual(
            navigate('home').activate
        );
        expect(shownDocument(copy).components.button.interaction).toBeUndefined();
    }
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(effectiveActivation(shownDocument(b).components.button)).toEqual(
        navigate('home').activate
    );
    expect(shownDocument(b).components.button.interaction?.role).toBe('button');
});

it.each([false, true])(
    'preserves edits across independent legacy migrations before synchronization (reverse delivery: %s)',
    async (reverse) => {
        const [source] = await createCopies(1, setup);
        const legacy = new Y.Doc();
        Y.applyUpdate(legacy, source.collaboration.state(DOCUMENT_ID));
        for (const collection of ['components', 'shapes']) {
            legacy.getMap(collection).forEach((entity) => {
                if (entity instanceof Y.Map) {
                    entity.delete('interactions');
                }
            });
        }
        const update = Y.encodeStateAsUpdate(legacy);
        const copies = await createCopies(2);
        copies.forEach((copy) => copy.collaboration.receive(DOCUMENT_ID, update));
        const [a, b] = copies;
        expect(shownDocument(a).components.button.interactions).toEqual(navigate('details'));
        expect(shownDocument(b).components.button.interactions).toEqual(navigate('details'));
        edit(a, (actions) =>
            actions.editRole({ target: 'component', id: 'button', settings: null })
        );
        edit(b, (actions) =>
            actions.editInteractions({
                target: 'component',
                id: 'button',
                settings: navigate('home')
            })
        );
        settle(reverse ? [...copies].reverse() : copies);
        expect(effectiveActivation(shownDocument(a).components.button)).toEqual(
            navigate('home').activate
        );
        expect(effectiveActivation(shownDocument(b).components.button)).toEqual(
            navigate('home').activate
        );
        legacy.destroy();
    }
);

it('keeps an inherited action when an operation customizes the role with the source destination', () => {
    const { store, document, instance, resolve, change } = fixture();
    const customize = () =>
        store.actions.applyOperations({
            documentId: document.id,
            by: { kind: 'person' },
            operations: [
                {
                    op: 'updateShape',
                    shape: 'next',
                    changes: {
                        interaction: {
                            role: 'button',
                            props: { label: 'label' },
                            navigateTo: 'details'
                        }
                    }
                }
            ]
        }).applied;
    expect(customize()).toBe(true);
    expect(inheritedActivation(instance())).toBe(true);
    change('component', navigate('home'));
    expect(resolve()).toEqual(navigate('home').activate);
    // The source's role still carries its old destination; echoing it changes nothing.
    expect(document.components.button.interaction?.navigateTo).toBe('details');
    store.actions.editRole({ target: 'instance', id: 'next', settings: null });
    expect(customize()).toBe(true);
    expect(resolve()).toEqual(navigate('home').activate);
});

it('keeps variant actions with the family', () => {
    const { store } = createTestStore();
    const document = store.state.currentDocument;
    store.actions.addShape({
        type: 'rectangle',
        name: 'Artwork',
        position: { x: 0, y: 0 },
        size: { width: 40, height: 20 }
    });
    store.actions.addComponent({
        id: 'family',
        name: 'Family',
        shapesIds: [document.shapesIds.at(-1)!]
    });
    const variantId = store.actions.createComponentVariant('family')!;
    store.actions.editInteractions({
        target: 'component',
        id: variantId,
        settings: { activate: null }
    });
    expect(document.components[variantId].interactions).toEqual({});
    store.actions.editInteractions({
        target: 'component',
        id: 'family',
        settings: { activate: null }
    });
    expect(document.components.family.interactions).toEqual({ activate: null });
});
