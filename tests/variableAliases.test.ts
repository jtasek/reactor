import { json } from 'overmind';
import { documentContext } from 'src/ai/context';
import { readOperation } from 'src/ai/operations';
import { describeOperation } from 'src/ai/describe';
import type { Operation } from 'src/app/operations';
import type { Variable } from 'src/app/types';
import { readClipboard, writeClipboard, pasteOperations } from 'src/app/clipboard';
import { resolveVariable, variableProblems } from 'src/app/variableResolver';
import {
    readEntity,
    serializePersistedState,
    migratePersistedState
} from 'src/app/services/documentStorage';
import { createTestStore } from './support/store';
import {
    createCopies,
    edit,
    settle,
    shownDocument,
    expectConsistent
} from './support/collaboration';

function setup() {
    const { store } = createTestStore();
    const document = store.state.currentDocument;
    const create = (name: string, type: Variable['type'] = 'number', value: unknown = 12) =>
        store.actions.createVariable({ name, type, value })!;
    const alias = (variableId: string, sourceId: string | null) =>
        store.actions.setVariableAlias({ variableId, sourceId });
    const value = (id: string) => resolveVariable(document.variables[id], document.variables);
    const apply = (operations: Operation[]) =>
        store.actions.applyOperations({
            documentId: document.id,
            by: { kind: 'person' },
            operations
        });
    return { store, document, create, alias, value, apply };
}

it.each([
    ['number', 42],
    ['text', 'hello'],
    ['color', '#3366ff'],
    ['boolean', false]
] as const)('follows %s sources by ID through rename and chained aliases', (type, literal) => {
    const { store, document, create, alias, value } = setup();
    const source = create('Source', type, literal);
    const middle = create('Middle', type, literal);
    const leaf = create('Leaf', type, literal);
    expect(alias(middle, source)).toBeUndefined();
    expect(alias(leaf, middle)).toBeUndefined();
    store.actions.renameVariable({ variableId: source, name: 'Renamed' });
    expect(value(leaf)).toBe(literal);
    expect(readEntity('variables', json(document.variables[leaf])).alias).toBe(middle);
});

it('updates bound shapes, detaches to the resolved value, and preserves values on source deletion', () => {
    const { store, document, create, alias, value } = setup();
    const source = create('Source');
    const leaf = create('Leaf');
    alias(leaf, source);
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 0, y: 0 },
        size: { width: 20, height: 10 }
    });
    const shape = document.shapes[document.shapesIds[0]];
    store.actions.bindProperty({ shapeIds: [shape.id], key: 'opacity', variableId: leaf });
    store.actions.setVariableValue({ variableId: source, value: 40 });
    expect(shape.opacity).toBe(0.4);
    alias(leaf, null);
    store.actions.setVariableValue({ variableId: source, value: 50 });
    expect(value(leaf)).toBe(40);
    alias(leaf, source);
    store.actions.deleteVariable(source);
    expect(value(leaf)).toBe(50);
    expect(document.variables[leaf].alias).toBeUndefined();
    expect(shape.opacity).toBe(0.5);
});

it('detaches text without turning literal template syntax into a new reference', () => {
    const { create, alias, value, store } = setup();
    const source = create('Source', 'text', '\\${Name}');
    const leaf = create('Leaf', 'text', '');
    alias(leaf, source);
    alias(leaf, null);
    create('Name', 'text', 'changed');
    expect(value(leaf)).toBe('${Name}');
    alias(leaf, source);
    store.actions.deleteVariable(source);
    expect(value(leaf)).toBe('${Name}');
});

it('rejects missing, incompatible, cyclic and mixed template/alias references without changing data', () => {
    const { create, alias, document } = setup();
    const a = create('A');
    const b = create('B');
    const text = create('Text', 'text', '${Other}');
    const other = create('Other', 'text', '');
    expect(alias(a, 'missing')).toContain('Missing');
    expect(alias(a, text)).toContain('number');
    expect(alias(a, a)).toContain('Circular');
    alias(a, b);
    expect(alias(b, a)).toContain('Circular');
    expect(alias(other, text)).toBeTruthy();
    expect(document.variables[b].alias).toBeUndefined();
    expect(document.variables[other].alias).toBeUndefined();
});

it('uses retained fallbacks and diagnostics for invalid merged alias graphs', () => {
    const a: Variable = { id: 'a', name: 'A', type: 'number', values: { default: 3 }, alias: 'b' };
    const b: Variable = { id: 'b', name: 'B', type: 'number', values: { default: 4 }, alias: 'a' };
    expect(resolveVariable(a, { a, b })).toBe(3);
    expect(variableProblems(a, { a, b })[0]).toContain('Circular');
    expect(resolveVariable(a, { a })).toBe(3);
    expect(variableProblems(a, { a })[0]).toContain('Missing');
});

it('checks the final operation graph atomically and resolves earlier keys', () => {
    const { create, apply, document, value } = setup();
    const a = create('A');
    const b = create('B');
    expect(
        apply([
            { op: 'updateVariable', variable: a, alias: b },
            { op: 'updateVariable', variable: b, alias: a }
        ]).applied
    ).toBe(false);
    expect(document.variables[a].alias).toBeUndefined();
    const result = apply([
        { op: 'addVariable', key: 'base', name: 'Base', type: 'number', value: 80 },
        { op: 'addVariable', key: 'leaf', name: 'Leaf', type: 'number', value: 0, alias: 'base' }
    ]);
    expect(result.applied).toBe(true);
    if (!result.applied) return;
    expect(value(result.ids.leaf)).toBe(80);
    expect(
        apply([{ op: 'updateVariable', variable: result.ids.leaf, name: 'Renamed' }]).applied
    ).toBe(true);
    expect(value(result.ids.leaf)).toBe(80);
    expect(apply([{ op: 'updateVariable', variable: result.ids.leaf, alias: null }]).applied).toBe(
        true
    );
    expect(document.variables[result.ids.leaf]).toMatchObject({ values: { default: 80 } });
    expect(document.variables[result.ids.leaf].alias).toBeUndefined();
});

it('copies dependencies before aliases and remaps their IDs on paste', () => {
    const { store, document, create, alias } = setup();
    const source = create('Source', 'color', '#3366ff');
    const leaf = create('Leaf', 'color', '#000000');
    alias(leaf, source);
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 0, y: 0 },
        size: { width: 20, height: 10 }
    });
    const shape = document.shapes[document.shapesIds[0]];
    store.actions.bindProperty({ shapeIds: [shape.id], key: 'fill', variableId: leaf });
    const copied = readClipboard(writeClipboard([shape], [], document.variables));
    expect(copied.variables).toHaveLength(2);
    const destination = setup();
    destination.create('Existing');
    const result = destination.apply(pasteOperations(copied, destination.document, null));
    expect(result.applied).toBe(true);
    const pastedLeaf = Object.values(destination.document.variables).find(
        (v) => v.name === 'Leaf'
    )!;
    const pastedSource = Object.values(destination.document.variables).find(
        (v) => v.name === 'Source'
    )!;
    expect(pastedLeaf.alias).toBe(pastedSource.id);
    expect(pastedSource.id).not.toBe(source);
    expect(destination.value(pastedLeaf.id)).toBe('#3366ff');
});

it('pastes variables whose copied aliases loop with their fallback values', () => {
    const { store, document, create } = setup();
    const first = create('First', 'number', 30);
    const second = create('Second', 'number', 80);
    const follower = create('Follower', 'number', 10);
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 0, y: 0 },
        size: { width: 20, height: 10 }
    });
    const shape = document.shapes[document.shapesIds[0]];
    store.actions.bindProperty({ shapeIds: [shape.id], key: 'opacity', variableId: follower });
    // Copies merging at once can leave a cycle, which no local edit can make.
    const variables = structuredClone(json(document.variables));
    variables[first].alias = second;
    variables[second].alias = first;
    variables[follower].alias = first;
    const copied = readClipboard(writeClipboard([json(shape)], [], variables));
    expect(copied.shapes).toHaveLength(1);
    const destination = setup();
    expect(destination.apply(pasteOperations(copied, destination.document, null)).applied).toBe(
        true
    );
    const pasted = Object.values(destination.document.variables);
    expect(pasted.filter((variable) => variable.alias !== undefined)).toHaveLength(2);
    pasted.forEach((variable) =>
        expect(variableProblems(variable, destination.document.variables)).toEqual([])
    );
});

it('shares alias edits and restores their definitions with undo', async () => {
    let source = '',
        leaf = '';
    const copies = await createCopies(2, (store) => {
        source = store.actions.createVariable({ name: 'Source', type: 'number', value: 42 })!;
        leaf = store.actions.createVariable({ name: 'Leaf', type: 'number', value: 0 })!;
    });
    const [a] = copies;
    edit(a, (actions) => {
        actions.setVariableAlias({ variableId: leaf, sourceId: source });
    });
    settle(copies);
    copies.forEach(expectConsistent);
    expect(shownDocument(a).variables[leaf].alias).toBe(source);
    a.collaboration.undo(shownDocument(a).id);
    settle(copies);
    copies.forEach(expectConsistent);
    expect(shownDocument(a).variables[leaf].alias).toBeUndefined();
    copies.forEach((copy) => copy.collaboration.dispose());
});

it('converges after concurrent source deletion and alias creation', async () => {
    let source = '',
        leaf = '';
    const copies = await createCopies(2, (store) => {
        source = store.actions.createVariable({ name: 'Source', type: 'number', value: 42 })!;
        leaf = store.actions.createVariable({ name: 'Leaf', type: 'number', value: 7 })!;
    });
    const [a, b] = copies;
    edit(a, (actions) => {
        actions.setVariableAlias({ variableId: leaf, sourceId: source });
    });
    edit(b, (actions) => actions.deleteVariable(source));
    settle(copies);
    copies.forEach(expectConsistent);
    expect(shownDocument(a).variables[leaf].alias).toBeUndefined();
    expect(resolveVariable(shownDocument(a).variables[leaf], shownDocument(a).variables)).toBe(7);
    copies.forEach((copy) => copy.collaboration.dispose());
});

it('rejects forward, deleted and incompatible operation sources without partial writes', () => {
    const { create, apply, document } = setup();
    const source = create('Source');
    const text = create('Text', 'text', 'literal');
    const leaf = create('Leaf');
    const before = JSON.stringify(document.variables);
    const batches: Operation[][] = [
        [
            { op: 'addVariable', key: 'a', name: 'A', type: 'number', value: 0, alias: 'b' },
            { op: 'addVariable', key: 'b', name: 'B', type: 'number', value: 1 }
        ],
        [
            { op: 'updateVariable', variable: leaf, alias: source },
            { op: 'deleteVariable', variable: source }
        ],
        [{ op: 'updateVariable', variable: leaf, alias: text }],
        [{ op: 'updateVariable', variable: leaf, alias: 'missing' }]
    ];
    for (const batch of batches) {
        expect(apply(batch).applied).toBe(false);
        expect(JSON.stringify(document.variables)).toBe(before);
    }
});

it('bounds long alias chains and keeps false and zero fallbacks', () => {
    const variables: Record<string, Variable> = {};
    for (let index = 0; index < 20; index++) {
        const id = String(index);
        variables[id] = {
            id,
            name: id,
            type: 'number',
            values: { default: index },
            ...(index === 19 ? {} : { alias: String(index + 1) })
        };
    }
    expect(resolveVariable(variables['0'], variables)).toBe(0);
    expect(variableProblems(variables['0'], variables)[0]).toContain('too deep');
    const flag: Variable = {
        id: 'flag',
        name: 'Flag',
        type: 'boolean',
        values: { default: false },
        alias: 'missing'
    };
    expect(resolveVariable(flag, { flag })).toBe(false);
});

it('converges and reports a cycle introduced by concurrent alias changes', async () => {
    let first = '',
        second = '';
    const copies = await createCopies(2, (store) => {
        first = store.actions.createVariable({ name: 'First', type: 'number', value: 1 })!;
        second = store.actions.createVariable({ name: 'Second', type: 'number', value: 2 })!;
    });
    const [a, b] = copies;
    edit(a, (actions) => {
        actions.setVariableAlias({ variableId: first, sourceId: second });
    });
    edit(b, (actions) => {
        actions.setVariableAlias({ variableId: second, sourceId: first });
    });
    settle(copies);
    expect(json(shownDocument(a).variables)).toEqual(json(shownDocument(b).variables));
    for (const copy of copies) {
        const variables = shownDocument(copy).variables;
        expect(resolveVariable(variables[first], variables)).toBe(1);
        expect(variableProblems(variables[first], variables)[0]).toContain('Circular');
        copy.collaboration.dispose();
    }
});

it('round-trips alias definitions and repairs missing sources using their fallback', () => {
    const { create, alias, store, document } = setup();
    const source = create('Source');
    const leaf = create('Leaf');
    alias(leaf, source);
    const saved = serializePersistedState(store.state);
    expect(migratePersistedState(saved)?.documents[document.id].variables[leaf].alias).toBe(source);
    delete saved.documents[document.id].variables[source];
    const restored = migratePersistedState(saved)!;
    expect(restored.documents[document.id].variables[leaf].alias).toBeUndefined();
    expect(restored.documents[document.id].variables[leaf].values.default).toBe(12);
});

it('sends alias dependencies to either AI provider and preserves proposed alias changes', () => {
    const { store, document, create, alias } = setup();
    const source = create('Source', 'color', '#3366ff');
    const leaf = create('Leaf', 'color', '#000000');
    alias(leaf, source);
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 0, y: 0 },
        size: { width: 20, height: 10 },
        selected: true
    });
    store.actions.bindProperty({ shapeIds: document.shapesIds, key: 'fill', variableId: leaf });
    const context = documentContext(document);
    expect(context.variables[leaf].alias).toBe(source);
    expect(context.variables[source].value).toBe('#3366ff');
    const follow = { op: 'updateVariable', variable: leaf, alias: source } as const;
    const detach = { op: 'updateVariable', variable: leaf, alias: null } as const;
    expect(readOperation(follow)).toEqual(follow);
    expect(readOperation(detach)).toEqual(detach);
    expect(describeOperation(follow, document)).toContain('follow');
    expect(describeOperation(detach, document)).toContain('stops following');
});
