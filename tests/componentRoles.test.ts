import { json } from 'overmind';
import { createTestStore } from './support/store';
import { resolveComponentRole } from 'src/app/componentRoles';
import {
    SCHEMA_VERSION,
    readEntity,
    restoreDocuments,
    serializePersistedState,
    migratePersistedState
} from 'src/app/services/documentStorage';
import { componentFingerprint, librarySnapshot } from 'src/app/componentLibrary';
import { readClipboard } from 'src/app/clipboard';
import { createCopies, edit, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';
import type { InstanceShape } from 'src/app/types';

type Store = ReturnType<typeof createTestStore>['store'];
function setup(store: Store) {
    store.actions.addShape({ type: 'text', position: { x: 100, y: 100 }, value: 'Save' });
    const sourceId = store.state.currentDocument.shapesIds[0];
    store.actions.addComponent({
        id: 'action',
        name: 'Action',
        shapesIds: [sourceId],
        sourceOnly: true
    });
    store.actions.exposeComponentProp({
        componentId: 'action',
        shapeId: sourceId,
        key: 'text',
        label: 'Caption'
    });
    store.actions.addShape({
        type: 'instance',
        componentId: 'action',
        position: { x: 200, y: 200 },
        overrides: {}
    });

    return {
        sourceId,
        instanceId: store.state.currentDocument.shapesIds.at(-1)!,
        propId: store.state.currentDocument.components.action.props![0].id
    };
}
const fixture = () => {
    const { store } = createTestStore();
    const ids = setup(store);
    const document = store.state.currentDocument;
    const instance = () => document.shapes[ids.instanceId] as InstanceShape;
    const resolve = () => resolveComponentRole(document, document.components.action, instance());
    const sourceRole = () =>
        store.actions.editRole({
            target: 'component',
            id: 'action',
            settings: { role: 'button', props: { label: ids.propId } }
        });

    return { store, document, ...ids, instance, resolve, sourceRole };
};

it('does not infer roles, inherits source mappings, and resolves existing literal and variable overrides', () => {
    const { store, document, propId, instanceId, resolve, sourceRole } = fixture();
    expect(resolve()).toEqual({ role: 'none', props: {}, problems: [] });
    sourceRole();
    expect(resolve()).toEqual({ role: 'button', props: { label: 'Save' }, problems: [] });
    store.actions.setInstanceOverride({ instanceIds: [instanceId], propId, value: 'Continue' });
    expect(resolve().props.label).toBe('Continue');
    const variableId = store.actions.createVariable({
        name: 'caption',
        type: 'text',
        value: 'Send'
    })!;
    store.actions.bindInstanceOverride({ instanceIds: [instanceId], propId, variableId });
    expect(resolve().props.label).toBe('Send');
    store.actions.setVariableValue({ variableId, value: 'Publish' });
    expect(resolve().props.label).toBe('Publish');
    expect(document.components.action.interaction?.props.label).toBe(propId);
});

it('customizes or removes an instance role and restores inheritance without changing visual overrides', () => {
    const { store, document, propId, instanceId, resolve, sourceRole, instance } = fixture();
    sourceRole();
    store.actions.setInstanceOverride({ instanceIds: [instanceId], propId, value: 'Continue' });
    store.actions.editRole({
        target: 'instance',
        id: instanceId,
        settings: { role: 'text', props: { content: propId } }
    });
    expect(resolve()).toEqual({ role: 'text', props: { content: 'Continue' }, problems: [] });
    expect(document.components.action.interaction?.role).toBe('button');
    store.actions.editRole({
        target: 'instance',
        id: instanceId,
        settings: { role: 'none', props: {} }
    });
    expect(resolve().role).toBe('none');
    store.actions.editRole({ target: 'instance', id: instanceId, settings: null });
    expect(resolve().props.label).toBe('Continue');
    expect(instance().interaction).toBeUndefined();
    expect(instance().overrides[propId]).toBe('Continue');
});

it('reports required, missing and incompatible role links without deleting durable settings', () => {
    const { store, document, propId, sourceId, resolve, sourceRole } = fixture();
    store.actions.editRole({
        target: 'component',
        id: 'action',
        settings: { role: 'button', props: {} }
    });
    expect(resolve().problems).toEqual(['Link label to an exposed text property.']);
    // Invalid new links are rejected; merged stale links are retained by durable readers.
    store.actions.editRole({
        target: 'component',
        id: 'action',
        settings: { role: 'button', props: { disabled: propId } }
    });
    expect(document.components.action.interaction?.props).toEqual({});
    sourceRole();
    store.actions.removeComponentProp({ componentId: 'action', propId });
    expect(resolve().problems[0]).toContain('missing or incompatible');
    expect(document.components.action.interaction?.props.label).toBe(propId);
    expect(
        readEntity('components', json(document.components.action)).interaction?.props.label
    ).toBe(propId);
    store.actions.exposeComponentProp({
        componentId: 'action',
        shapeId: sourceId,
        key: 'text',
        label: 'New caption'
    });
    const next = document.components.action.props![0].id;
    store.actions.editRole({
        target: 'component',
        id: 'action',
        settings: { role: 'button', props: { label: next } }
    });
    expect(resolve().problems).toEqual([]);
});

it('protects locked documents, imported sources and inherited instance locks', () => {
    const { store, document, instanceId, propId, sourceRole, instance } = fixture();
    store.actions.updateDocument({ id: document.id, locked: true });
    sourceRole();
    expect(document.components.action.interaction).toBeUndefined();
    store.actions.updateDocument({ id: document.id, locked: false });
    const frame = store.actions.editFrame({
        kind: 'add',
        position: { x: 0, y: 0 },
        size: { width: 300, height: 300 }
    })!;
    store.actions.editFrame({ kind: 'reparentShapes', ids: [instanceId], parentFrameId: frame });
    store.actions.editFrame({ kind: 'toggle', id: frame, flag: 'locked' });
    store.actions.editRole({
        target: 'instance',
        id: instanceId,
        settings: { role: 'button', props: { label: propId } }
    });
    expect(instance().interaction).toBeUndefined();
    store.actions.setDocumentAccess({ [document.id]: { role: 'viewer' } });
    sourceRole();
    expect(document.components.action.interaction).toBeUndefined();
});

it('keeps role settings through v10 persistence, v9 migration, clipboard and cloning', () => {
    const { store, document, instanceId, propId, sourceRole } = fixture();
    sourceRole();
    store.actions.editRole({
        target: 'instance',
        id: instanceId,
        settings: { role: 'text', props: { content: propId } }
    });
    const saved = serializePersistedState(store.state);
    expect(saved.version).toBe(SCHEMA_VERSION);
    const restored = restoreDocuments(saved)[document.id];
    expect(restored.components.action.interaction).toEqual(document.components.action.interaction);
    expect((restored.shapes[instanceId] as InstanceShape).interaction).toEqual({
        role: 'text',
        props: { content: propId }
    });
    expect(migratePersistedState({ ...saved, version: 9 })?.version).toBe(SCHEMA_VERSION);
    const clipboard = store.actions.copySelection()!;
    const copied = readClipboard(clipboard);
    expect(copied.components?.[0].interaction?.role).toBe('button');
    expect(copied.shapes[0]).toMatchObject({
        interaction: { role: 'text', props: { content: propId } }
    });
    store.actions.cloneShapes([instanceId]);
    expect(document.shapes[document.shapesIds.at(-1)!]).toMatchObject({
        interaction: { role: 'text', props: { content: propId } }
    });
    store.actions.newDocument();
    expect(store.actions.pasteShapes(clipboard)).toBe('pasted');
    const pasted = store.state.currentDocument;
    expect(
        resolveComponentRole(
            pasted,
            pasted.components.action,
            pasted.shapes[pasted.shapesIds[0]] as InstanceShape
        )
    ).toEqual({ role: 'text', props: { content: 'Save' }, problems: [] });
});

it('sets and resets instance roles through atomic operations', () => {
    const { store, document, instanceId, propId, sourceRole, resolve } = fixture();
    sourceRole();
    const change = (interaction: InstanceShape['interaction'] | null) =>
        store.actions.applyOperations({
            documentId: document.id,
            by: { kind: 'person' },
            operations: [{ op: 'updateShape', shape: instanceId, changes: { interaction } }]
        });
    expect(change({ role: 'text', props: { content: propId } }).applied).toBe(true);
    expect(resolve().role).toBe('text');
    expect(change(null).applied).toBe(true);
    expect(resolve().role).toBe('button');
});

it('includes roles in stable library fingerprints and portable source records', () => {
    const { document, propId, sourceRole } = fixture();
    const before = componentFingerprint(document, 'action');
    sourceRole();
    expect(componentFingerprint(document, 'action')).not.toBe(before);
    expect(librarySnapshot(document, 'action', { components: {} })?.[0].interaction).toEqual({
        role: 'button',
        props: { label: propId }
    });
});

it('keeps imported source roles read-only while allowing local instance customization', () => {
    const { store, document, propId, sourceRole } = fixture();
    sourceRole();
    const documentId = document.id;
    store.actions.newDocument();
    store.actions.importLibraryComponent({ documentId, componentId: 'action' });
    const imported = store.state.currentDocument.components.action;
    store.actions.editRole({ target: 'component', id: 'action', settings: null });
    expect(imported.interaction?.role).toBe('button');
    store.actions.addShape({
        type: 'instance',
        componentId: 'action',
        position: { x: 0, y: 0 },
        overrides: {}
    });
    const id = store.state.currentDocument.shapesIds.at(-1)!;
    store.actions.editRole({
        target: 'instance',
        id,
        settings: { role: 'text', props: { content: propId } }
    });
    expect(
        resolveComponentRole(
            store.state.currentDocument,
            imported,
            store.state.currentDocument.shapes[id] as InstanceShape
        )
    ).toEqual({ role: 'text', props: { content: 'Save' }, problems: [] });
});

it('hashes semantic property maps by content rather than insertion order', () => {
    const { store, document, sourceId, propId } = fixture();
    store.actions.exposeComponentProp({
        componentId: 'action',
        shapeId: sourceId,
        key: 'visible',
        label: 'Visible'
    });
    const booleanProp = document.components.action.props!.find(
        (prop) => prop.key === 'visible'
    )!.id;
    store.actions.editRole({
        target: 'component',
        id: 'action',
        settings: { role: 'button', props: { label: propId, disabled: booleanProp } }
    });
    const before = componentFingerprint(document, 'action');
    store.actions.editRole({
        target: 'component',
        id: 'action',
        settings: { role: 'button', props: { disabled: booleanProp, label: propId } }
    });
    expect(componentFingerprint(document, 'action')).toBe(before);
});

it('rejects malformed role operation batches without applying earlier valid records', () => {
    const { store, document, instanceId } = fixture();
    const count = document.shapesIds.length;
    const result = store.actions.applyOperations({
        documentId: document.id,
        by: { kind: 'person' },
        operations: [
            {
                op: 'addShape',
                key: 'rectangle',
                shape: {
                    type: 'rectangle',
                    position: { x: 0, y: 0 },
                    size: { width: 20, height: 20 }
                }
            },
            {
                op: 'updateShape',
                shape: instanceId,
                changes: { interaction: { role: 'button', props: { label: '' } } }
            }
        ]
    });
    expect(result.applied).toBe(false);
    expect(document.shapesIds).toHaveLength(count);
});

it.each([
    { role: 'link', props: {} },
    { role: ['button'], props: {} },
    { role: 'button', props: { label: 1 } }
])('rejects malformed role metadata %j', (interaction) => {
    const { document, instance } = fixture();
    expect(() =>
        readEntity('components', { ...json(document.components.action), interaction })
    ).toThrow();
    expect(() => readEntity('shapes', { ...json(instance()), interaction })).toThrow();
});

it('converges through production collaboration and undoes role edits without undoing another copy’s visual value', async () => {
    const copies = await createCopies(2, setup);
    const [a, b] = copies;
    const document = shownDocument(a);
    const propId = document.components.action.props![0].id;
    const instanceId = document.shapesIds.at(-1)!;
    edit(a, (actions) =>
        actions.editRole({
            target: 'component',
            id: 'action',
            settings: { role: 'button', props: { label: propId } }
        })
    );
    edit(b, (actions) =>
        actions.setInstanceOverride({ instanceIds: [instanceId], propId, value: 'Continue' })
    );
    settle(copies);
    const resolve = (copy: typeof a) =>
        resolveComponentRole(
            shownDocument(copy),
            shownDocument(copy).components.action,
            shownDocument(copy).shapes[instanceId] as InstanceShape
        );
    expect(resolve(a)).toEqual({ role: 'button', props: { label: 'Continue' }, problems: [] });
    expect(resolve(a)).toEqual(resolve(b));
    const durable = json(document.components);
    resolve(a);
    a.collaboration.flush();
    expect(b.inbox).toHaveLength(0);
    expect(json(document.components)).toEqual(durable);
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(resolve(b).role).toBe('none');
    expect((shownDocument(b).shapes[instanceId] as InstanceShape).overrides[propId]).toBe(
        'Continue'
    );
});
