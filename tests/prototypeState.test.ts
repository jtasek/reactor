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
import { readPreview, type PreviewNode } from 'src/shared/previewProtocol';
import { stateEquals, visibilityStates } from 'src/app/prototypeState';
import type { Shape } from 'src/app/types';
import { createTestStore } from './support/store';
import { createCopies, DOCUMENT_ID, edit, settle, shownDocument } from './support/collaboration';

function fixture() {
    const document = createDocument(buildInspectorTypography(newId));
    document.prototypeBooleans.flag = { id: 'flag', name: 'showHelp', initial: false };
    const instances = Object.values(document.shapes).filter((shape) => shape.type === 'instance');
    const help = instances.find((shape) => shape.name === 'Inspector help')!;
    const comparison = instances.find((shape) => shape.name === 'Inspector comparison')!;
    const button = instances.find((shape) => shape.name === 'About these styles')!;
    help.prototypeVisibleWhen = stateEquals('flag', true);
    comparison.prototypeVisibleWhen = stateEquals('flag', true);
    button.interactions = { activate: { type: 'state', change: 'toggle', stateId: 'flag' } };

    return { document, help, comparison, button };
}

const follows = (node: PreviewNode, key = 'state:flag') =>
    JSON.stringify(node.visibility?.condition ?? null).includes(`"stateId":"${key}"`);
const followsFlag = (shape: Shape) =>
    shape.type === 'instance' && visibilityStates(shape).includes('flag');

it('projects one boolean shared by several instances and persists stable references', () => {
    const { document, help, comparison } = fixture();
    const before = JSON.stringify(document);
    const drawing = readPreview(projectPreview(document, {}));
    expect(drawing.states).toEqual({ 'state:flag': false });
    expect(drawing.screens[0].nodes.filter((node) => follows(node))).toHaveLength(2);
    expect(
        drawing.screens[0].nodes.some(
            (node) =>
                node.control?.changeState?.key === 'state:flag' &&
                node.control.changeState.change === 'toggle'
        )
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
    expect(warnings.join(' ')).toContain('Uses a state value that no longer exists');
    expect(warnings.join(' ')).toContain('The state it changes was deleted');
    expect(drawing.screens[0].nodes.some((node) => node.control?.changeState)).toBe(false);
    expect(followsFlag(help)).toBe(true);
});

it('rejects invalid boolean records and untrusted projection references', () => {
    expect(() =>
        readEntity('prototypeBooleans', { id: 'flag', name: ' ', initial: false })
    ).toThrow();
    expect(() =>
        readEntity('prototypeBooleans', { id: 'flag', name: 'x', initial: 'false' })
    ).toThrow();
    expect(() => readInteractions({ activate: { type: 'toggleState', stateId: 1 } })).toThrow();
    expect(() =>
        readInteractions({ activate: { type: 'state', change: 'flip', stateId: 'flag' } })
    ).toThrow();
    const { document } = fixture();
    const drawing = projectPreview(document, {});
    delete drawing.states!['state:flag'];
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
    expect(Object.values(shownDocument(b).shapes).some(followsFlag)).toBe(true);
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
    expect(store.state.currentDocument.shapes[help.id]).not.toHaveProperty('prototypeVisibleWhen');
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
    expect(clones.some(followsFlag)).toBe(true);
    expect(
        clones.some(
            (shape) =>
                shape.type === 'instance' &&
                shape.interactions?.activate?.type === 'state' &&
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
                    startsHidden: 'state:flag:true'
                }
            ]
        },
        { ...source, id: 'third', controls: [] }
    ];
    expect([...reachableScreens(graph, 'first')]).toEqual(['first', 'second', 'third']);
    graph[0].controls[0].hidden = true;
    expect([...reachableScreens(graph, 'first')]).toEqual(['first', 'second']);
});

it('refuses state bindings and actions that would make a control hide itself', () => {
    const { store } = createTestStore();
    const { document, help, button } = fixture();
    document.id = store.state.currentDocumentId;
    store.actions.addDocument(document);
    const actions = store.actions;
    // The button toggles `flag`, so it cannot follow `flag`.
    expect(
        actions.editInteractions({
            target: 'state',
            kind: 'bind',
            instanceId: button.id,
            stateId: 'flag'
        })
    ).toContain('hide itself');
    expect(store.state.currentDocument.shapes[button.id]).not.toHaveProperty(
        'prototypeVisibleWhen'
    );
    // A control following `flag` cannot be given an action toggling `flag`, directly or through
    // a target that follows it.
    actions.editInteractions({ target: 'state', kind: 'bind', instanceId: help.id, stateId: null });
    actions.editInteractions({
        target: 'instance',
        id: button.id,
        settings: { activate: { type: 'toggleVisibility', instanceId: help.id } }
    });
    actions.editInteractions({
        target: 'state',
        kind: 'add',
        name: 'other',
        initial: true
    });
    expect(
        actions.editInteractions({
            target: 'state',
            kind: 'bind',
            instanceId: help.id,
            stateId: 'flag'
        })
    ).toBeUndefined();
    const other = Object.values(store.state.currentDocument.prototypeBooleans).find(
        (item) => item.name === 'other'
    )!;
    actions.editInteractions({
        target: 'instance',
        id: button.id,
        settings: { activate: null }
    });
    expect(
        actions.editInteractions({
            target: 'state',
            kind: 'bind',
            instanceId: button.id,
            stateId: 'flag'
        })
    ).toBeUndefined();
    actions.editInteractions({
        target: 'instance',
        id: button.id,
        settings: { activate: { type: 'toggleVisibility', instanceId: help.id } }
    });
    actions.editInteractions({
        target: 'instance',
        id: button.id,
        settings: { activate: { type: 'state', change: 'toggle', stateId: 'flag' } }
    });
    expect(store.state.currentDocument.shapes[button.id]).toMatchObject({
        interactions: { activate: null }
    });
    actions.editInteractions({
        target: 'instance',
        id: button.id,
        settings: { activate: { type: 'state', change: 'toggle', stateId: other.id } }
    });
    expect(store.state.currentDocument.shapes[button.id]).toMatchObject({
        interactions: { activate: { type: 'state', change: 'toggle', stateId: other.id } }
    });
});

it('switches between a state and a fixed start in one undo step', async () => {
    let helpId = '';
    const [copy] = await createCopies(1, (store) => {
        const { document, help } = fixture();
        document.id = DOCUMENT_ID;
        helpId = help.id;
        store.actions.addDocument(document);
    });
    edit(copy, (actions) =>
        actions.editInteractions({
            target: 'state',
            kind: 'bind',
            instanceId: helpId,
            stateId: null,
            visible: true
        })
    );
    const shape = () => shownDocument(copy).shapes[helpId];
    expect(shape()).not.toHaveProperty('prototypeVisibleWhen');
    expect(shape()).not.toHaveProperty('prototypeVisible');
    copy.collaboration.undo(DOCUMENT_ID);
    expect(shape()).toMatchObject({
        prototypeVisibleWhen: stateEquals('flag', true),
        prototypeVisible: false
    });
    copy.collaboration.dispose();
});

it.each(['toggle', 'set'] as const)(
    'pastes a %s action into another document, reusing state by name',
    async (change) => {
        let text = '';
        const [copy] = await createCopies(1, (store) => {
            const { document, help, button } = fixture();
            button.interactions = {
                activate:
                    change === 'set'
                        ? { type: 'state', change, stateId: 'flag', value: false }
                        : { type: 'state', change, stateId: 'flag' }
            };
            document.id = 'source';
            store.actions.addDocument(document);
            store.actions.openDocument('source');
            store.actions.unselectShapes();
            store.actions.selectShape(help.id);
            store.actions.selectShape(button.id);
            text = store.actions.copySelection()!;
            store.actions.addDocument(createDocument({ id: DOCUMENT_ID }));
            store.actions.openDocument(DOCUMENT_ID);
        });
        const { store } = copy;
        expect(store.state.currentDocumentId).toBe(DOCUMENT_ID);
        const references = () =>
            store.state.currentDocument.selectedShapesIds.map((id) => {
                const shape = store.state.currentDocument.shapes[id];

                return shape.type === 'instance'
                    ? (visibilityStates(shape)[0] ??
                          (shape.interactions?.activate?.type === 'state'
                              ? shape.interactions.activate.stateId
                              : undefined))
                    : undefined;
            });
        edit(copy, (actions) => expect(actions.pasteShapes(text)).toBe('pasted'));
        expect(Object.values(shownDocument(copy).prototypeBooleans)).toEqual([
            { id: 'flag', name: 'showHelp', initial: false }
        ]);
        expect(references()).toEqual(['flag', 'flag']);
        copy.collaboration.undo(DOCUMENT_ID);
        expect(shownDocument(copy).prototypeBooleans).toEqual({});
        expect(shownDocument(copy).shapesIds).toEqual([]);
        edit(copy, (actions) =>
            actions.editInteractions({
                target: 'state',
                kind: 'add',
                name: 'showHelp',
                initial: true
            })
        );
        const existing = Object.values(shownDocument(copy).prototypeBooleans)[0];
        edit(copy, (actions) => expect(actions.pasteShapes(text)).toBe('pasted'));
        expect(Object.keys(shownDocument(copy).prototypeBooleans)).toEqual([existing.id]);
        expect(references()).toEqual([existing.id, existing.id]);
        copy.collaboration.dispose();
    }
);

it('keeps disclosure semantics and Inspect diagnostics for named state', () => {
    const { document, help, button } = fixture();
    button.interactions = { activate: { type: 'toggleVisibility', instanceId: help.id } };
    const drawing = readPreview(projectPreview(document, {}));
    const control = drawing.screens[0].nodes
        .flatMap(function all(node): (typeof drawing.screens)[0]['nodes'] {
            return [node, ...(node.children ?? []).flatMap(all)];
        })
        .find((node) => node.control?.changeState)!.control!;
    expect(control.changeState).toEqual({ key: 'state:flag', change: 'toggle' });
    expect(control.toggleVisibility).toBeDefined();
    delete document.prototypeBooleans.flag;
    button.interactions = { activate: { type: 'state', change: 'toggle', stateId: 'flag' } };
    const warnings: string[] = [];
    const diagnostics: { message: string }[] = [];
    projectPreview(document, {}, warnings, undefined, {}, diagnostics as never);
    expect(diagnostics.map((item) => item.message).join(' ')).toContain(
        'Uses a state value that no longer exists'
    );
    expect(diagnostics.map((item) => item.message).join(' ')).toContain(
        'The state it changes was deleted'
    );
});

it('persists explicit false actions and inverse visibility without changing missing-state fallback', () => {
    const { document, help, button } = fixture();
    help.prototypeVisibleWhen = stateEquals('flag', false);
    button.interactions = {
        activate: { type: 'state', change: 'set', stateId: 'flag', value: false }
    };
    const drawing = readPreview(projectPreview(document, {}));
    expect(
        drawing.screens[0].nodes.some(
            (node) =>
                JSON.stringify(node.visibility?.condition) ===
                JSON.stringify(stateEquals('state:flag', false))
        )
    ).toBe(true);
    expect(
        drawing.screens[0].nodes.some(
            (node) =>
                node.control?.changeState?.change === 'set' &&
                node.control.changeState.value === false
        )
    ).toBe(true);
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    const restored = restoreDocuments(migratePersistedState(saved)!)[document.id];
    expect(readPreview(projectPreview(restored, {}))).toEqual(drawing);
    delete document.prototypeBooleans.flag;
    const fallback = projectPreview(document, {});
    const node = fallback.screens[0].nodes.find((node) => node.visibility?.key.includes(help.id));
    expect(node!.visibility).toMatchObject({ initial: false });
    expect(node!.visibility?.condition).toBeUndefined();
    expect(fallback.screens[0].nodes.some((node) => node.control?.changeState)).toBe(false);
});

it('rejects malformed set actions and visibility conditions', () => {
    expect(() =>
        readInteractions({ activate: { type: 'setState', stateId: 'flag', value: 'false' } })
    ).toThrow();
    expect(() =>
        readInteractions({ activate: { type: 'state', change: 'set', stateId: 'flag', value: {} } })
    ).toThrow();
    const { document, help } = fixture();
    expect(() => readEntity('shapes', { ...help, prototypeVisibleWhen: 0 })).toThrow();
    expect(() =>
        readEntity('shapes', {
            ...help,
            prototypeVisibleWhen: { kind: 'isSet', operand: { kind: 'field', fieldId: 'x' } }
        })
    ).toThrow();
    const drawing = projectPreview(document, {});
    const control = drawing.screens[0].nodes.find((node) => node.control?.changeState)!.control!;
    control.changeState = { key: 'missing', change: 'set', value: false };
    expect(() => readPreview(drawing)).toThrow('Unavailable prototype state');
    control.changeState = { key: 'state:flag', change: 'set', value: 'yes' };
    expect(() => readPreview(drawing)).toThrow('Unavailable prototype state');
});

it.each(['toggleState', 'toggleVisibility'] as const)(
    'rejects a set action combined with %s',
    (action) => {
        const { document } = fixture();
        const drawing = projectPreview(document, {});
        const control = drawing.screens[0].nodes.find((node) => node.control?.changeState)!
            .control! as Record<string, unknown>;
        delete control.changeState;
        control[action] = 'state:flag';
        control.setState = { key: 'state:flag', value: false };

        expect(() => readPreview(drawing)).toThrow('Conflicting state actions');
    }
);

it('Flow distinguishes set-false actions from actions that can reveal a true condition', () => {
    const { store } = createTestStore();
    const { document, help, button } = fixture();
    document.id = store.state.currentDocumentId;
    help.prototypeVisibleWhen = stateEquals('flag', false);
    button.interactions = {
        activate: { type: 'state', change: 'set', stateId: 'flag', value: false }
    };
    store.actions.addDocument(document);
    const source = projectFlow(store.state.currentDocument)[0];
    const setter = source.controls.find((control) => control.sets)!;
    const graph = [
        {
            ...source,
            id: 'first',
            controls: [
                { ...setter, screenId: 'first' },
                {
                    ...setter,
                    key: 'next',
                    sets: undefined,
                    screenId: 'first',
                    target: 'second',
                    startsHidden: 'state:flag:true'
                }
            ]
        },
        { ...source, id: 'second', controls: [] }
    ];
    expect([...reachableScreens(graph, 'first')]).toEqual(['first']);
    graph[0].controls[0].sets!.value = true;
    expect([...reachableScreens(graph, 'first')]).toEqual(['first', 'second']);
});

it('shares an inverse visibility binding and restores it with one-step undo', async () => {
    const copies = await createCopies(2, (store) => {
        const { document } = fixture();
        document.id = DOCUMENT_ID;
        store.actions.addDocument(document);
    });
    const [a, b] = copies;
    const target = Object.values(shownDocument(a).shapes).find(
        (shape) => shape.type === 'instance' && shape.name === 'Inspector help'
    )!;
    edit(a, (actions) =>
        actions.editInteractions({
            target: 'state',
            kind: 'bind',
            instanceId: target.id,
            stateId: 'flag',
            when: false
        })
    );
    settle(copies);
    expect(shownDocument(b).shapes[target.id]).toHaveProperty(
        'prototypeVisibleWhen',
        stateEquals('flag', false)
    );
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).shapes[target.id]).toHaveProperty(
        'prototypeVisibleWhen',
        stateEquals('flag', true)
    );
    copies.forEach((copy) => copy.collaboration.dispose());
});

it('settles concurrent visibility choices on one whole condition', async () => {
    const copies = await createCopies(2, (store) => {
        const { document } = fixture();
        document.id = DOCUMENT_ID;
        store.actions.addDocument(document);
    });
    const [a, b] = copies;
    const help = Object.values(shownDocument(a).shapes).find(
        (shape) => shape.type === 'instance' && shape.name === 'Inspector help'
    )!;
    // One person picks Shown while another picks Show when: False.
    edit(a, (actions) =>
        actions.editInteractions({
            target: 'state',
            kind: 'bind',
            instanceId: help.id,
            stateId: null,
            visible: true
        })
    );
    edit(b, (actions) =>
        actions.editInteractions({
            target: 'state',
            kind: 'bind',
            instanceId: help.id,
            stateId: 'flag',
            when: false
        })
    );
    settle(copies);
    const [left, right] = copies.map((copy) => shownDocument(copy).shapes[help.id]);
    const visibility = (shape: Shape) =>
        shape.type === 'instance' && [shape.prototypeVisibleWhen, shape.prototypeVisible];
    expect(visibility(left)).toEqual(visibility(right));
    // The condition is one value, so a merge never pairs a state with a stray comparison.
    expect([undefined, JSON.stringify(stateEquals('flag', false))]).toContain(
        left.type === 'instance' && left.prototypeVisibleWhen
            ? JSON.stringify(left.prototypeVisibleWhen)
            : undefined
    );
    copies.forEach((copy) => copy.collaboration.dispose());
});

it('reads documents and shared links from before typed state', () => {
    const { document, help } = fixture();
    const legacy = { ...help, prototypeVisibilityStateId: 'flag', prototypeVisibilityWhen: false };
    delete (legacy as Partial<typeof help>).prototypeVisibleWhen;
    const read = readEntity('shapes', legacy);
    expect(read.type === 'instance' && read.prototypeVisibleWhen).toEqual(
        stateEquals('flag', false)
    );
    expect(
        readEntity('shapes', { ...legacy, prototypeVisibilityStateId: undefined })
    ).not.toHaveProperty('prototypeVisibleWhen');
    expect(readInteractions({ activate: { type: 'toggleState', stateId: 'flag' } })).toEqual({
        activate: { type: 'state', change: 'toggle', stateId: 'flag' }
    });
    expect(
        readInteractions({ activate: { type: 'setState', stateId: 'flag', value: true } })
    ).toEqual({ activate: { type: 'state', change: 'set', stateId: 'flag', value: true } });
    // A snapshot saved by the previous player, as a shared link holds it.
    const drawing = readPreview(projectPreview(document, {}));
    const old = JSON.parse(JSON.stringify(drawing)) as Record<string, unknown> & typeof drawing;
    (old as Record<string, unknown>).booleans = old.states;
    delete old.states;
    const visit = (node: Record<string, unknown>) => {
        const visibility = node.visibility as Record<string, unknown> | undefined;
        if (visibility?.condition) {
            const condition = visibility.condition as ReturnType<typeof stateEquals> & {
                left: { stateId: string };
                right: { value: boolean };
            };
            visibility.stateKey = condition.left.stateId;
            visibility.when = condition.right.value;
            delete visibility.condition;
        }
        const control = node.control as Record<string, unknown> | undefined;
        if (control?.changeState) {
            control.toggleState = (control.changeState as { key: string }).key;
            delete control.changeState;
        }
        (node.children as Record<string, unknown>[] | undefined)?.forEach(visit);
    };
    old.screens.forEach((screen) => screen.nodes.forEach((node) => visit(node as never)));
    expect(readPreview(old)).toEqual(drawing);
});
