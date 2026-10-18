import { createComponent, createShape } from 'src/app/factories';
import { applyInstanceOverrides } from 'src/app/componentProps';
import { json } from 'overmind';
import { resolveVariable } from 'src/app/variableResolver';
import { themeColors } from 'src/app/themeColors';
import { readEntity, readView } from 'src/app/services/documentStorage';
import { readClipboard, writeClipboard, pasteOperations } from 'src/app/clipboard';
import { readOperation } from 'src/ai/operations';
import { describeOperation } from 'src/ai/describe';
import { createTestStore } from './support/store';
import { createCopies, edit, settle, shownDocument } from './support/collaboration';

function setup() {
    const { store } = createTestStore();
    const document = store.state.currentDocument;
    const id = store.actions.createVariable({ name: 'Ink', type: 'color', value: '#112233' })!;
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 10, y: 20 },
        size: { width: 40, height: 30 }
    });
    const shape = document.shapes[document.shapesIds[0]];
    store.actions.bindProperty({ shapeIds: [shape.id], key: 'fill', variableId: id });
    return { store, document, id, shape };
}

it('projects Dark paint without changing durable colors, geometry or bindings', () => {
    const { store, document, id, shape } = setup();
    const before = json(shape);
    expect(themeColors(shape, document, 'dark').fill).toBe('#112233');
    store.actions.setVariableDarkValue({ variableId: id, value: '#ddeeff' });
    expect(themeColors(shape, document, 'dark')).toEqual({ ...before, fill: '#ddeeff' });
    expect(json(shape)).toEqual(before);
    expect(themeColors(shape, document, 'light')).toBe(shape);
    store.actions.setVariableValue({ variableId: id, value: '#445566' });
    expect(themeColors(shape, document, 'dark').fill).toBe('#ddeeff');
    store.actions.setVariableDarkValue({ variableId: id, value: null });
    expect(themeColors(shape, document, 'dark').fill).toBe('#445566');
});

it.each(['detach', 'delete', 'operation'] as const)(
    'preserves both resolved colors on alias %s',
    (mode) => {
        const { store, document, id } = setup();
        const alias = store.actions.createVariable({
            name: 'Alias',
            type: 'color',
            value: '#000000'
        })!;
        store.actions.setVariableAlias({ variableId: alias, sourceId: id });
        store.actions.setVariableDarkValue({ variableId: id, value: '#ddeeff' });
        expect(resolveVariable(document.variables[alias], document.variables, 'dark')).toBe(
            '#ddeeff'
        );
        if (mode === 'detach')
            store.actions.setVariableAlias({ variableId: alias, sourceId: null });
        if (mode === 'delete') store.actions.deleteVariable(id);
        if (mode === 'operation') {
            expect(
                store.actions.applyOperations({
                    documentId: document.id,
                    by: { kind: 'person' },
                    operations: [{ op: 'updateVariable', variable: alias, alias: null }]
                }).applied
            ).toBe(true);
        }
        expect(document.variables[alias].alias).toBeUndefined();
        expect(resolveVariable(document.variables[alias], document.variables)).toBe('#112233');
        expect(resolveVariable(document.variables[alias], document.variables, 'dark')).toBe(
            '#ddeeff'
        );
    }
);

it('validates mode values and preserves them through clipboard and operation readers', () => {
    const { store, document, id, shape } = setup();
    store.actions.setVariableDarkValue({ variableId: id, value: '#ddeeff' });
    const variable = json(document.variables[id]);
    expect(readEntity('variables', variable)).toEqual(variable);
    expect(() =>
        readEntity('variables', { ...variable, values: { default: '#112233', dark: 'invalid' } })
    ).toThrow();
    expect(() =>
        readEntity('variables', {
            ...variable,
            type: 'number',
            values: { default: 2, dark: '#ffffff' }
        })
    ).toThrow();
    const clipboard = readClipboard(writeClipboard([shape], [], document.variables))!;
    const destination = createTestStore().store;
    const target = destination.state.currentDocument;
    expect(
        destination.actions.applyOperations({
            documentId: target.id,
            by: { kind: 'person' },
            operations: pasteOperations(clipboard, target, null)
        }).applied
    ).toBe(true);
    const copied = Object.values(target.variables)[0];
    expect(resolveVariable(copied, target.variables, 'dark')).toBe('#ddeeff');
    expect(readOperation({ op: 'updateVariable', variable: id, darkValue: null })).toEqual({
        op: 'updateVariable',
        variable: id,
        darkValue: null
    });
});

it('keeps each collaborator’s theme local while sharing and undoing definitions', async () => {
    let id = '';
    const copies = await createCopies(2, (store) => {
        id = store.actions.createVariable({ name: 'Ink', type: 'color', value: '#112233' })!;
    });
    const [a, b] = copies;
    try {
        edit(a, (actions) => actions.setPreviewTheme('dark'));
        expect(b.inbox).toHaveLength(0);
        expect(b.store.state.previewTheme).toBe('light');
        edit(a, (actions) => actions.setVariableDarkValue({ variableId: id, value: '#ddeeff' }));
        settle(copies);
        const variable = shownDocument(b).variables[id];
        expect(resolveVariable(variable, shownDocument(b).variables, 'dark')).toBe('#ddeeff');
        a.collaboration.undo(shownDocument(a).id);
        settle(copies);
        expect(
            resolveVariable(shownDocument(b).variables[id], shownDocument(b).variables, 'dark')
        ).toBe('#112233');
        expect(a.store.state.previewTheme).toBe('dark');
    } finally {
        copies.forEach(({ collaboration }) => collaboration.dispose());
    }
});

it('reads local theme preferences and ignores unknown themes', () => {
    expect(readView({ previewTheme: 'dark' })?.previewTheme).toBe('dark');
    expect(readView({ previewTheme: 'unknown' })?.previewTheme).toBeUndefined();
});

it('lets literal instance colors override themed sources and resolves variable overrides in context', () => {
    const { store, document, id, shape } = setup();
    store.actions.setVariableDarkValue({ variableId: id, value: '#ddeeff' });
    const component = createComponent({
        shapesIds: [shape.id],
        props: [{ id: 'color', shapeId: shape.id, key: 'fill', label: 'Color' }]
    });
    const instance = createShape({
        type: 'instance',
        name: 'Instance',
        order: 'a1',
        componentId: component.id,
        position: { x: 0, y: 0 },
        overrides: { color: '#ff0000' }
    });
    if (instance.type !== 'instance') throw new Error('Expected instance');
    const painted = themeColors(shape, document, 'dark');
    expect(applyInstanceOverrides(painted, instance, component, document, 'dark').fill).toBe(
        '#ff0000'
    );
    instance.overrides.color = { variableId: id };
    expect(applyInstanceOverrides(painted, instance, component, document, 'dark').fill).toBe(
        '#ddeeff'
    );
    expect(applyInstanceOverrides(shape, instance, component, document).fill).toBe('#112233');
});

it('updates and clears Dark values atomically while preserving them on rename', () => {
    const { store, document, id } = setup();
    const apply = (operations: import('src/app/operations').Operation[]) =>
        store.actions.applyOperations({
            documentId: document.id,
            by: { kind: 'person' },
            operations
        });
    expect(apply([{ op: 'updateVariable', variable: id, darkValue: '#ddeeff' }]).applied).toBe(
        true
    );
    expect(apply([{ op: 'updateVariable', variable: id, name: 'Renamed' }]).applied).toBe(true);
    expect(resolveVariable(document.variables[id], document.variables, 'dark')).toBe('#ddeeff');
    expect(
        apply([{ op: 'updateVariable', variable: id, name: 'Invalid', darkValue: 'red' }]).applied
    ).toBe(false);
    expect(document.variables[id].name).toBe('Renamed');
    expect(apply([{ op: 'updateVariable', variable: id, darkValue: null }]).applied).toBe(true);
    expect(resolveVariable(document.variables[id], document.variables, 'dark')).toBe('#112233');
    const number = store.actions.createVariable({ name: 'Number', type: 'number', value: 2 })!;
    expect(apply([{ op: 'updateVariable', variable: number, darkValue: null }]).applied).toBe(
        false
    );
});

it('uses Dark fallback for broken aliases and leaves stale or detached bindings alone', () => {
    const { store, document, id, shape } = setup();
    store.actions.setVariableDarkValue({ variableId: id, value: '#ddeeff' });
    const broken = { ...json(document.variables[id]), alias: 'missing' };
    expect(resolveVariable(broken, document.variables, 'dark')).toBe('#ddeeff');
    const stale = { ...json(shape), fill: '#ff0000' };
    expect(themeColors(stale, document, 'dark').fill).toBe('#ff0000');
    const detached = { ...json(shape), bindings: {} };
    expect(themeColors(detached, document, 'dark').fill).toBe('#112233');
});

it('paints bound text colors while leaving template content and geometry at default', () => {
    const { store, document, id } = setup();
    store.actions.addShape({
        type: 'text',
        position: { x: 40, y: 50 },
        value: 'Caption',
        fontSize: 20
    });
    const text = Object.values(document.shapes).find((shape) => shape.type === 'text')!;
    store.actions.bindProperty({ shapeIds: [text.id], key: 'fontColor', variableId: id });
    store.actions.setVariableDarkValue({ variableId: id, value: '#ddeeff' });
    expect(themeColors(text, document, 'dark')).toEqual({ ...json(text), fontColor: '#ddeeff' });
});

it('stops following a source when an operation sets a Dark value alone', () => {
    const { store, document, id } = setup();
    store.actions.setVariableDarkValue({ variableId: id, value: '#ddeeff' });
    const alias = store.actions.createVariable({ name: 'Alias', type: 'color', value: '#000000' })!;
    store.actions.setVariableAlias({ variableId: alias, sourceId: id });
    const operations = [{ op: 'updateVariable' as const, variable: alias, darkValue: '#abcdef' }];
    expect(describeOperation(operations[0], document)).toBe(
        'Change color variable “Alias”; Dark: #abcdef; stops following its source'
    );
    expect(
        store.actions.applyOperations({
            documentId: document.id,
            by: { kind: 'person' },
            operations
        }).applied
    ).toBe(true);
    expect(document.variables[alias].alias).toBeUndefined();
    expect(resolveVariable(document.variables[alias], document.variables)).toBe('#112233');
    expect(resolveVariable(document.variables[alias], document.variables, 'dark')).toBe('#abcdef');
});
