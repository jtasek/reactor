import { v4 as newId } from 'uuid';
import { projectFlow, reachableScreens } from 'src/app/flowProjection';
import { createDocument } from 'src/app/factories';
import { buildInspectorTypography } from 'src/templates/inspectorTypography';
import {
    readEntity,
    readInteractions,
    serializePersistedState,
    migratePersistedState,
    restoreDocuments
} from 'src/app/services/documentStorage';
import { projectPreview } from 'src/preview/project';
import { readPreview } from 'src/preview/protocol';
import { createTestStore } from './support/store';
import { createCopies, DOCUMENT_ID, edit, settle, shownDocument } from './support/collaboration';

function fixture() {
    const document = createDocument(buildInspectorTypography(newId));
    document.prototypeBooleans.flag = { id: 'flag', name: 'showHelp', initial: false };
    const instances = Object.values(document.shapes).filter((shape) => shape.type === 'instance');
    const help = instances.find((shape) => shape.name === 'Inspector help')!;
    const comparison = instances.find((shape) => shape.name === 'Inspector comparison')!;
    const button = instances.find((shape) => shape.name === 'About these styles')!;
    help.prototypeVisibilityStateId = 'flag';
    comparison.prototypeVisibilityStateId = 'flag';
    button.interactions = { activate: { type: 'toggleState', stateId: 'flag' } };

    return { document, help, comparison, button };
}

it('projects one boolean shared by several instances and persists stable references', () => {
    const { document, help, comparison } = fixture();
    const before = JSON.stringify(document);
    const drawing = readPreview(projectPreview(document, {}));
    expect(drawing.booleans).toEqual({ 'state:flag': false });
    expect(
        drawing.screens[0].nodes.filter((node) => node.visibility?.stateKey === 'state:flag')
    ).toHaveLength(2);
    expect(
        drawing.screens[0].nodes.some((node) => node.control?.toggleState === 'state:flag')
    ).toBe(true);
    expect(JSON.stringify(document)).toBe(before);
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    const restored = restoreDocuments(migratePersistedState(saved)!)[document.id];
    expect(restored.prototypeBooleans.flag.name).toBe('showHelp');
    expect(readPreview(projectPreview(restored, {}))).toEqual(drawing);
    expect(help.visible && comparison.visible).toBe(true);
});

it('diagnoses deleted state without dropping bindings or breaking Preview', () => {
    const { document, help } = fixture();
    delete document.prototypeBooleans.flag;
    const warnings: string[] = [];
    const drawing = readPreview(projectPreview(document, {}, warnings));
    expect(warnings.join(' ')).toContain('visibility state is missing');
    expect(warnings.join(' ')).toContain('prototype state is unavailable');
    expect(drawing.screens[0].nodes.some((node) => node.control?.toggleState)).toBe(false);
    expect(help.prototypeVisibilityStateId).toBe('flag');
});

it('rejects invalid boolean records and untrusted projection references', () => {
    expect(() =>
        readEntity('prototypeBooleans', { id: 'flag', name: ' ', initial: false })
    ).toThrow();
    expect(() =>
        readEntity('prototypeBooleans', { id: 'flag', name: 'x', initial: 'false' })
    ).toThrow();
    expect(() => readInteractions({ activate: { type: 'toggleState', stateId: 1 } })).toThrow();
    const { document } = fixture();
    const drawing = projectPreview(document, {});
    delete drawing.booleans!['state:flag'];
    expect(() => readPreview(drawing)).toThrow('Unavailable prototype state');
});

it('renames and deletes state with collaboration and one-step undo, retaining bindings', async () => {
    const copies = await createCopies(2, (store) => {
        const { document } = fixture();
        document.id = DOCUMENT_ID;
        store.actions.addDocument(document);
    });
    const [a, b] = copies;
    edit(a, (actions) =>
        actions.editInteractions({
            target: 'state',
            kind: 'update',
            id: 'flag',
            name: 'details',
            initial: true
        })
    );
    settle(copies);
    expect(shownDocument(b).prototypeBooleans.flag).toEqual({
        id: 'flag',
        name: 'details',
        initial: true
    });
    edit(a, (actions) => actions.editInteractions({ target: 'state', kind: 'delete', id: 'flag' }));
    settle(copies);
    expect(shownDocument(b).prototypeBooleans.flag).toBeUndefined();
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).prototypeBooleans.flag.name).toBe('details');
    expect(
        Object.values(shownDocument(b).shapes).some(
            (shape) => shape.type === 'instance' && shape.prototypeVisibilityStateId === 'flag'
        )
    ).toBe(true);
    copies.forEach((copy) => copy.collaboration.dispose());
});

it('guards duplicate names and locked bindings without creating partial changes', () => {
    const { store } = createTestStore();
    const { document, help } = fixture();
    document.id = store.state.currentDocumentId;
    store.actions.addDocument(document);
    const actions = store.actions;
    expect(
        actions.editInteractions({ target: 'state', kind: 'add', name: 'showHelp', initial: false })
    ).toContain('already exists');
    expect(Object.keys(store.state.currentDocument.prototypeBooleans)).toEqual(['flag']);
    actions.editInteractions({ target: 'state', kind: 'bind', instanceId: help.id, stateId: null });
    expect(store.state.currentDocument.shapes[help.id]).not.toHaveProperty(
        'prototypeVisibilityStateId'
    );
    actions.lockShape(help.id);
    expect(
        actions.editInteractions({
            target: 'state',
            kind: 'bind',
            instanceId: help.id,
            stateId: 'flag'
        })
    ).toContain('unlocked');
});

it('keeps named state references when instances are cloned', () => {
    const { store } = createTestStore();
    const { document, help, button } = fixture();
    document.id = store.state.currentDocumentId;
    store.actions.addDocument(document);
    const before = new Set(store.state.currentDocument.shapesIds);
    store.actions.cloneShapes([help.id, button.id]);
    const clones = Object.values(store.state.currentDocument.shapes).filter(
        (shape) => !before.has(shape.id)
    );
    expect(
        clones.some(
            (shape) => shape.type === 'instance' && shape.prototypeVisibilityStateId === 'flag'
        )
    ).toBe(true);
    expect(
        clones.some(
            (shape) =>
                shape.type === 'instance' &&
                shape.interactions?.activate?.type === 'toggleState' &&
                shape.interactions.activate.stateId === 'flag'
        )
    ).toBe(true);
    expect(Object.keys(store.state.currentDocument.prototypeBooleans)).toEqual(['flag']);
});

it('carries revealed named state across screens when computing Flow reachability', () => {
    const { document } = fixture();
    const { store } = createTestStore();
    document.id = store.state.currentDocumentId;
    store.actions.addDocument(document);
    const source = projectFlow(store.state.currentDocument)[0];
    const toggle = source.controls.find((control) => control.toggleStateId === 'flag')!;
    const graph = [
        {
            ...source,
            id: 'first',
            controls: [
                { ...toggle, screenId: 'first' },
                {
                    ...toggle,
                    key: 'next',
                    screenId: 'first',
                    toggleStateId: undefined,
                    target: 'second'
                }
            ]
        },
        {
            ...source,
            id: 'second',
            controls: [
                {
                    ...toggle,
                    key: 'hidden-next',
                    screenId: 'second',
                    toggleStateId: undefined,
                    target: 'third',
                    startsHidden: 'state:flag'
                }
            ]
        },
        { ...source, id: 'third', controls: [] }
    ];
    expect([...reachableScreens(graph, 'first')]).toEqual(['first', 'second', 'third']);
    graph[0].controls[0].hidden = true;
    expect([...reachableScreens(graph, 'first')]).toEqual(['first', 'second']);
});
