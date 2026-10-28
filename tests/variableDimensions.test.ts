import * as Y from 'yjs';
import { legacyTheme, variableContext } from 'src/app/variableModes';
import { createComponent, createShape } from 'src/app/factories';
import { applyInstanceOverrides } from 'src/app/componentProps';
import { json } from 'overmind';
import { resolveVariable } from 'src/app/variableResolver';
import { themeColors } from 'src/app/themeColors';
import {
    readDocumentFields,
    readEntity,
    readView,
    migratePersistedState,
    serializePersistedState
} from 'src/app/services/documentStorage';
import { readClipboard, writeClipboard, pasteOperations } from 'src/app/clipboard';
import { readOperation } from 'src/ai/operations';
import { describeOperation } from 'src/ai/describe';
import { createTestStore } from './support/store';
import type { VariableDimension } from 'src/app/types';
import { createCopies, edit, settle, shownDocument } from './support/collaboration';

const alternativeMode = (dimension: VariableDimension) =>
    Object.keys(dimension.modes).find((modeId) => modeId !== dimension.defaultModeId)!;

function setup() {
    const { store } = createTestStore();
    store.actions.addDocument({
        id: store.state.currentDocumentId,
        dimensions: { theme: legacyTheme() }
    });
    const document = store.state.currentDocument;
    const id = store.actions.createVariable({ name: 'Ink', type: 'color', value: '#112233' })!;
    store.actions.setVariableDimension({ variableId: id, dimensionId: 'theme' });
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
    expect(themeColors(shape, document, { theme: 'dark' }).fill).toBe('#112233');
    store.actions.setVariableModeValue({ modeId: 'dark', variableId: id, value: '#ddeeff' });
    expect(themeColors(shape, document, { theme: 'dark' })).toEqual({ ...before, fill: '#ddeeff' });
    expect(json(shape)).toEqual(before);
    expect(themeColors(shape, document, {})).toBe(shape);
    store.actions.setVariableValue({ variableId: id, value: '#445566' });
    expect(themeColors(shape, document, { theme: 'dark' }).fill).toBe('#ddeeff');
    store.actions.setVariableModeValue({ modeId: 'dark', variableId: id, value: null });
    expect(themeColors(shape, document, { theme: 'dark' }).fill).toBe('#445566');
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
        store.actions.setVariableModeValue({ modeId: 'dark', variableId: id, value: '#ddeeff' });
        expect(
            resolveVariable(document.variables[alias], document.variables, { theme: 'dark' })
        ).toBe('#ddeeff');
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
        expect(
            resolveVariable(document.variables[alias], document.variables, { theme: 'dark' })
        ).toBe('#ddeeff');
    }
);

it('validates mode values and preserves them through clipboard and operation readers', () => {
    const { store, document, id, shape } = setup();
    store.actions.setVariableModeValue({ modeId: 'dark', variableId: id, value: '#ddeeff' });
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
    const clipboard = readClipboard(writeClipboard([shape], [], document.variables, document))!;
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
    expect(resolveVariable(copied, target.variables, { theme: 'dark' })).toBe('#ddeeff');
    expect(readOperation({ op: 'updateVariable', variable: id, darkValue: null })).toEqual({
        op: 'updateVariable',
        variable: id,
        darkValue: null
    });
});

it('keeps each collaborator’s theme local while sharing and undoing definitions', async () => {
    let id = '';
    const copies = await createCopies(2, (store) => {
        store.actions.addDocument({
            id: store.state.currentDocumentId,
            dimensions: { theme: legacyTheme() }
        });
        id = store.actions.createVariable({ name: 'Ink', type: 'color', value: '#112233' })!;
        store.actions.setVariableDimension({ variableId: id, dimensionId: 'theme' });
    });
    const [a, b] = copies;
    try {
        edit(a, (actions) => actions.setPreviewMode({ dimensionId: 'theme', modeId: 'dark' }));
        expect(b.inbox).toHaveLength(0);
        expect(
            variableContext(shownDocument(b), b.store.state.previewModes[shownDocument(b).id])
        ).toEqual({});
        edit(a, (actions) =>
            actions.setVariableModeValue({ modeId: 'dark', variableId: id, value: '#ddeeff' })
        );
        settle(copies);
        const variable = shownDocument(b).variables[id];
        expect(resolveVariable(variable, shownDocument(b).variables, { theme: 'dark' })).toBe(
            '#ddeeff'
        );
        a.collaboration.undo(shownDocument(a).id);
        settle(copies);
        expect(
            resolveVariable(shownDocument(b).variables[id], shownDocument(b).variables, {
                theme: 'dark'
            })
        ).toBe('#112233');
        expect(a.store.state.previewModes[shownDocument(a).id]).toEqual({ theme: 'dark' });
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
    store.actions.setVariableModeValue({ modeId: 'dark', variableId: id, value: '#ddeeff' });
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
    const painted = themeColors(shape, document, { theme: 'dark' });
    expect(
        applyInstanceOverrides(painted, instance, component, document, { theme: 'dark' }).fill
    ).toBe('#ff0000');
    instance.overrides.color = { variableId: id };
    expect(
        applyInstanceOverrides(painted, instance, component, document, { theme: 'dark' }).fill
    ).toBe('#ddeeff');
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
    expect(resolveVariable(document.variables[id], document.variables, { theme: 'dark' })).toBe(
        '#ddeeff'
    );
    expect(
        apply([{ op: 'updateVariable', variable: id, name: 'Invalid', darkValue: 'red' }]).applied
    ).toBe(false);
    expect(document.variables[id].name).toBe('Renamed');
    expect(apply([{ op: 'updateVariable', variable: id, darkValue: null }]).applied).toBe(true);
    expect(resolveVariable(document.variables[id], document.variables, { theme: 'dark' })).toBe(
        '#112233'
    );
    const number = store.actions.createVariable({ name: 'Number', type: 'number', value: 2 })!;
    expect(apply([{ op: 'updateVariable', variable: number, darkValue: null }]).applied).toBe(
        false
    );
});

it('uses Dark fallback for broken aliases and leaves stale or detached bindings alone', () => {
    const { store, document, id, shape } = setup();
    store.actions.setVariableModeValue({ modeId: 'dark', variableId: id, value: '#ddeeff' });
    const broken = { ...json(document.variables[id]), alias: 'missing' };
    expect(resolveVariable(broken, document.variables, { theme: 'dark' })).toBe('#ddeeff');
    const stale = { ...json(shape), fill: '#ff0000' };
    expect(themeColors(stale, document, { theme: 'dark' }).fill).toBe('#ff0000');
    const detached = { ...json(shape), bindings: {} };
    expect(themeColors(detached, document, { theme: 'dark' }).fill).toBe('#112233');
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
    store.actions.setVariableModeValue({ modeId: 'dark', variableId: id, value: '#ddeeff' });
    expect(themeColors(text, document, { theme: 'dark' })).toEqual({
        ...json(text),
        fontColor: '#ddeeff'
    });
});

it('stops following a source when an operation sets a Dark value alone', () => {
    const { store, document, id } = setup();
    store.actions.setVariableModeValue({ modeId: 'dark', variableId: id, value: '#ddeeff' });
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
    expect(resolveVariable(document.variables[alias], document.variables, { theme: 'dark' })).toBe(
        '#abcdef'
    );
});

it('keeps an equal Dark value when detaching an alias and later editing Light', () => {
    const { store, document, id } = setup();
    store.actions.setVariableModeValue({ modeId: 'dark', variableId: id, value: '#112233' });
    const alias = store.actions.createVariable({ name: 'Alias', type: 'color', value: '#000000' })!;
    store.actions.setVariableAlias({ variableId: alias, sourceId: id });
    store.actions.setVariableAlias({ variableId: alias, sourceId: null });
    store.actions.setVariableValue({ variableId: alias, value: '#445566' });
    expect(resolveVariable(document.variables[alias], document.variables)).toBe('#445566');
    expect(resolveVariable(document.variables[alias], document.variables, { theme: 'dark' })).toBe(
        '#112233'
    );
});

it('starts with base values only and lets each variable opt into independent custom dimensions', () => {
    const { store } = createTestStore();
    const document = store.state.currentDocument;
    expect(document.dimensions).toEqual({});
    expect(variableContext(document)).toEqual({});
    const id = store.actions.createVariable({ name: 'Ink', type: 'color', value: '#112233' })!;
    const appearance = store.actions.createDimension('Appearance')!;
    const brand = store.actions.createDimension('Brand')!;
    expect(document.variables[id]).not.toHaveProperty('dimensionId');
    store.actions.addDimensionMode({ dimensionId: appearance, name: 'Dim' });
    store.actions.addDimensionMode({ dimensionId: brand, name: 'Acme' });
    const dim = Object.values(document.dimensions[appearance].modes).find(
        (mode) => mode.name === 'Dim'
    )!;
    const acme = Object.values(document.dimensions[brand].modes).find(
        (mode) => mode.name === 'Acme'
    )!;
    store.actions.setVariableDimension({ variableId: id, dimensionId: appearance });
    store.actions.setVariableModeValue({ variableId: id, modeId: dim.id, value: '#ddeeff' });
    store.actions.setPreviewMode({ dimensionId: appearance, modeId: dim.id });
    store.actions.setPreviewMode({ dimensionId: brand, modeId: acme.id });
    expect(
        resolveVariable(
            document.variables[id],
            document.variables,
            variableContext(document, store.state.previewModes[document.id])
        )
    ).toBe('#ddeeff');
    store.actions.updateDimension({
        ...json(document.dimensions[appearance]),
        name: 'Contrast',
        modes: {
            ...json(document.dimensions[appearance].modes),
            [dim.id]: { ...dim, name: 'Low', order: -1 }
        },
        defaultModeId: dim.id
    });
    expect(variableContext(document)).not.toHaveProperty(appearance);
    expect(document.variables[id].values.default).toBe('#ddeeff');
    expect(
        resolveVariable(document.variables[id], document.variables, variableContext(document))
    ).toBe('#ddeeff');
    store.actions.deleteDimensionMode({ dimensionId: appearance, modeId: dim.id });
    expect(variableContext(document, store.state.previewModes[document.id])[appearance]).not.toBe(
        dim.id
    );
    expect(
        resolveVariable(document.variables[id], document.variables, variableContext(document))
    ).toBe('#112233');
    store.actions.deleteDimension(appearance);
    expect(document.variables[id]).not.toHaveProperty('dimensionId');
    expect(document.variables[id].values).toEqual({ default: '#112233' });
    expect(document.dimensions[brand]).toBeDefined();
});

it('shares custom dimension definitions and restores a deleted dimension and its values with undo', async () => {
    let dimensionId = '';
    let id = '';
    const copies = await createCopies(2, (store) => {
        dimensionId = store.actions.createDimension('Brand')!;
        id = store.actions.createVariable({ name: 'Ink', type: 'color', value: '#112233' })!;
        store.actions.setVariableDimension({ variableId: id, dimensionId });
        store.actions.addDimensionMode({ dimensionId, name: 'Alt' });
        const modeId = alternativeMode(store.state.currentDocument.dimensions[dimensionId]);
        store.actions.setVariableModeValue({ variableId: id, modeId, value: '#abcdef' });
    });
    const [a, b] = copies;
    try {
        const modeId = alternativeMode(shownDocument(a).dimensions[dimensionId]);
        edit(a, (actions) => actions.deleteDimension(dimensionId));
        settle(copies);
        expect(shownDocument(b).dimensions).toEqual({});
        expect(shownDocument(b).variables[id]).not.toHaveProperty('dimensionId');
        a.collaboration.undo(shownDocument(a).id);
        settle(copies);
        expect(shownDocument(b).dimensions[dimensionId]).toBeDefined();
        expect(
            resolveVariable(shownDocument(b).variables[id], shownDocument(b).variables, {
                [dimensionId]: modeId
            })
        ).toBe('#abcdef');
    } finally {
        copies.forEach(({ collaboration }) => collaboration.dispose());
    }
});

it('rejects unknown modes atomically and permits number variables to use dimensions', () => {
    const { store, document, id } = setup();
    const number = store.actions.createVariable({ name: 'Width', type: 'number', value: 50 })!;
    store.actions.setVariableDimension({ variableId: number, dimensionId: 'theme' });
    expect(document.variables[number]).toHaveProperty('dimensionId', 'theme');
    const result = store.actions.applyOperations({
        documentId: document.id,
        by: { kind: 'person' },
        operations: [
            {
                op: 'updateVariable',
                variable: id,
                name: 'Changed',
                modeValues: { missing: '#abcdef' }
            }
        ]
    });
    expect(result.applied).toBe(false);
    expect(document.variables[id].name).toBe('Ink');
});

it('migrates legacy Dark definitions without opting plain documents into dimensions', () => {
    const { store, document, id } = setup();
    store.actions.setVariableModeValue({ variableId: id, modeId: 'dark', value: '#ddeeff' });
    const saved = JSON.parse(JSON.stringify(serializePersistedState(store.state)));
    const raw = saved.documents[document.id];
    delete raw.dimensions;
    delete raw.variables[id].dimensionId;
    const migrated = migratePersistedState(saved)!;
    expect(migrated.documents[document.id].dimensions.theme.name).toBe('Theme');
    expect(migrated.documents[document.id].variables[id]).toMatchObject({
        dimensionId: 'theme',
        values: { default: '#112233', dark: '#ddeeff' }
    });
    delete raw.variables[id].values.dark;
    expect(migratePersistedState(saved)!.documents[document.id].dimensions).toEqual({});
});

it('migrates legacy shared documents before starting undo history', async () => {
    const [copy] = await createCopies(1);
    const documentId = shownDocument(copy).id;
    const old = new Y.Doc();
    for (const [key, value] of Object.entries(readDocumentFields(shownDocument(copy))))
        old.getMap('document').set(key, value);
    old.getMap('variables').set(
        'old-color',
        new Y.Map(
            Object.entries({
                id: 'old-color',
                name: 'Old color',
                type: 'color',
                values: { default: '#112233', dark: '#ddeeff' }
            })
        )
    );
    try {
        copy.collaboration.close(documentId);
        copy.collaboration.open(documentId, Y.encodeStateAsUpdate(old));
        const document = shownDocument(copy);
        expect(document.dimensions.theme).toEqual(legacyTheme());
        expect(document.variables['old-color']).toMatchObject({ dimensionId: 'theme' });
        expect(
            resolveVariable(document.variables['old-color'], document.variables, { theme: 'dark' })
        ).toBe('#ddeeff');
        copy.collaboration.undo(documentId);
        expect(document.dimensions.theme).toBeDefined();
        expect(readView({ previewTheme: 'dark' }).previewModes).toBeUndefined();
    } finally {
        old.destroy();
        copy.collaboration.dispose();
    }
});

it('keeps a variable whose dimension another copy deleted while its mode color changed', async () => {
    let dimensionId = '';
    let id = '';
    const copies = await createCopies(2, (store) => {
        dimensionId = store.actions.createDimension('Brand')!;
        store.actions.addDimensionMode({ dimensionId, name: 'Alt' });
        id = store.actions.createVariable({ name: 'Ink', type: 'color', value: '#112233' })!;
        store.actions.setVariableDimension({ variableId: id, dimensionId });
    });
    const [a, b] = copies;
    try {
        const modeId = alternativeMode(shownDocument(a).dimensions[dimensionId]);
        edit(a, (actions) => actions.deleteDimension(dimensionId));
        edit(b, (actions) =>
            actions.setVariableModeValue({ variableId: id, modeId, value: '#abcdef' })
        );
        settle(copies);
        copies.forEach((copy) =>
            expect(json(shownDocument(copy).variables[id])).toEqual({
                id,
                name: 'Ink',
                type: 'color',
                values: { default: '#112233' }
            })
        );
    } finally {
        copies.forEach(({ collaboration }) => collaboration.dispose());
    }
});

it('pastes into a document that edited its own Theme, keeping the modes it still has', () => {
    const source = createTestStore().store;
    source.actions.addDocument({
        id: source.state.currentDocumentId,
        dimensions: { theme: legacyTheme() }
    });
    const from = source.state.currentDocument;
    const id = source.actions.createVariable({ name: 'Brand', type: 'color', value: '#112233' })!;
    source.actions.setVariableDimension({ variableId: id, dimensionId: 'theme' });
    source.actions.setVariableModeValue({ variableId: id, modeId: 'dark', value: '#ddeeff' });
    source.actions.addShape({
        type: 'rectangle',
        position: { x: 0, y: 0 },
        size: { width: 10, height: 10 }
    });
    const copied = from.shapes[from.shapesIds[0]];
    source.actions.bindProperty({ shapeIds: [copied.id], key: 'fill', variableId: id });
    const text = writeClipboard([copied], [], from.variables, from);
    expect(Object.keys(readClipboard(text).dimensions ?? {})).toEqual(['theme']);
    expect(Object.keys(JSON.parse(writeClipboard([copied], [], {}, from)))).not.toContain(
        'dimensions'
    );

    const { store } = createTestStore();
    store.actions.addDocument({
        id: store.state.currentDocumentId,
        dimensions: { theme: legacyTheme() }
    });
    const target = store.state.currentDocument;
    const theme = json(target.dimensions.theme);
    store.actions.updateDimension({
        ...theme,
        modes: { ...theme.modes, dark: { ...theme.modes.dark, name: 'Night' } }
    });
    const result = store.actions.applyOperations({
        documentId: target.id,
        by: { kind: 'person' },
        operations: pasteOperations(readClipboard(text), target, null)
    });
    expect(result.applied).toBe(true);
    expect(target.dimensions.theme.modes.dark.name).toBe('Night');
    const pasted = Object.values(target.variables).find((variable) => variable.name === 'Brand')!;
    expect(resolveVariable(pasted, target.variables, { theme: 'dark' })).toBe('#ddeeff');
});

it('keeps the default mode’s colors as the base values shapes hold', () => {
    const { store, document, id, shape } = setup();
    store.actions.setVariableModeValue({ variableId: id, modeId: 'light', value: '#ff0000' });
    expect(document.variables[id].values).toEqual({ default: '#112233' });
    expect(
        store.actions.applyOperations({
            documentId: document.id,
            by: { kind: 'person' },
            operations: [{ op: 'updateVariable', variable: id, modeValues: { light: '#ff0000' } }]
        }).applied
    ).toBe(false);
    store.actions.setVariableModeValue({ variableId: id, modeId: 'dark', value: '#ddeeff' });
    store.actions.setPreviewMode({ dimensionId: 'theme', modeId: 'light' });
    expect(variableContext(document, store.state.previewModes[document.id])).toEqual({});

    store.actions.updateDimension({ ...json(document.dimensions.theme), defaultModeId: 'dark' });
    expect(document.variables[id].values).toEqual({ default: '#ddeeff', light: '#112233' });
    expect(shape.fill).toBe('#ddeeff');
    expect(shape.bindings?.fill).toBe(id);
    expect(themeColors(shape, document, variableContext(document)).fill).toBe('#ddeeff');
    expect(themeColors(shape, document, { theme: 'light' }).fill).toBe('#112233');

    store.actions.deleteDimensionMode({ dimensionId: 'theme', modeId: 'dark' });
    expect(document.dimensions.theme.defaultModeId).toBe('light');
    expect(document.variables[id].values).toEqual({ default: '#112233' });
    expect(shape.fill).toBe('#112233');
});

it('migrates Light/Dark colors that another copy sends', async () => {
    const copies = await createCopies(2);
    const [a] = copies;
    const documentId = shownDocument(a).id;
    const old = new Y.Doc();
    try {
        old.getMap('variables').set(
            'old-color',
            new Y.Map(
                Object.entries({
                    id: 'old-color',
                    name: 'Old color',
                    type: 'color',
                    values: { default: '#112233', dark: '#ddeeff' }
                })
            )
        );
        // The server passes the old copy's change on to every copy.
        copies.forEach((copy) =>
            copy.collaboration.receive(documentId, Y.encodeStateAsUpdate(old))
        );
        settle(copies);
        for (const copy of copies) {
            const document = shownDocument(copy);
            expect(document.dimensions.theme).toEqual(legacyTheme());
            expect(
                resolveVariable(document.variables['old-color'], document.variables, {
                    theme: 'dark'
                })
            ).toBe('#ddeeff');
        }
        a.collaboration.undo(documentId);
        expect(shownDocument(a).dimensions.theme).toBeDefined();
    } finally {
        old.destroy();
        copies.forEach(({ collaboration }) => collaboration.dispose());
    }
});
