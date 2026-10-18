import { json } from 'overmind';
import { createDocument } from 'src/app/factories';
import {
    exportDesignSystemPackage,
    parseDesignSystemPackage,
    planDesignSystemImport,
    readDesignSystemPackage
} from 'src/app/designSystemPackages';
import {
    readEntity,
    serializePersistedState,
    migratePersistedState
} from 'src/app/services/documentStorage';
import { resolveVariable } from 'src/app/variableResolver';
import { createTestStore } from './support/store';
import { createCopies, DOCUMENT_ID, settle, shownDocument } from './support/collaboration';
import type { Document } from 'src/app/types';
import type { ImportChoice } from 'src/app/designSystemPackages';

function source() {
    return createDocument({
        id: 'source',
        name: 'Brand',
        dimensions: {
            appearance: {
                id: 'appearance',
                name: 'Appearance',
                order: 0,
                defaultModeId: 'day',
                modes: {
                    day: { id: 'day', name: 'Day', order: 0 },
                    night: { id: 'night', name: 'Night', order: 1 }
                }
            }
        },
        variables: {
            ink: {
                id: 'ink',
                name: 'Ink',
                type: 'color',
                dimensionId: 'appearance',
                values: { default: '#112233', night: '#ddeeff' }
            },
            alias: {
                id: 'alias',
                name: 'Foreground',
                type: 'color',
                values: { default: '#000000' },
                alias: 'ink'
            },
            count: { id: 'count', name: 'Count', type: 'number', values: { default: 0 } },
            enabled: {
                id: 'enabled',
                name: 'Enabled',
                type: 'boolean',
                values: { default: false }
            },
            label: {
                id: 'label',
                name: 'Label',
                type: 'text',
                values: { default: '${count$Count} items' }
            }
        }
    });
}
const pack = (document = source()) => parseDesignSystemPackage(exportDesignSystemPackage(document));
function setup() {
    const { store } = createTestStore();
    store.actions.addDocument({ id: store.state.currentDocumentId });
    return { store, document: store.state.currentDocument };
}
let nextId = 0;
const newId = () => `import-${nextId++}`;
function apply(
    store: ReturnType<typeof setup>['store'],
    document: Document,
    choice: ImportChoice = 'reuse',
    data = pack()
) {
    const operations = planDesignSystemImport(json(document), data, choice, newId);
    return operations.length
        ? store.actions.applyOperations({
              documentId: document.id,
              by: { kind: 'person' },
              operations
          })
        : { applied: true };
}

it('exports deterministic definitions only, with all four types, dependencies and optional dimensions', () => {
    const doc = source();
    const text = exportDesignSystemPackage(doc);
    doc.variables = Object.fromEntries(Object.entries(doc.variables).reverse());
    expect(exportDesignSystemPackage(doc)).toBe(text);
    expect(Object.keys(JSON.parse(text)).sort()).toEqual([
        'dimensions',
        'format',
        'id',
        'name',
        'variables',
        'version'
    ]);
    const data = parseDesignSystemPackage(text);
    expect(data.variables.find((v) => v.id === 'count')?.values.default).toBe(0);
    expect(data.variables.find((v) => v.id === 'enabled')?.values.default).toBe(false);
    expect(data.variables.find((v) => v.id === 'ink')?.source).toEqual({
        packageId: 'source',
        tokenId: 'ink'
    });
    expect(pack(createDocument({ name: 'Plain' })).dimensions).toEqual([]);
});

it('remaps aliases and templates, preserves modes, and round trips through persistence', () => {
    const { store, document } = setup();
    expect(apply(store, document).applied).toBe(true);
    const variables = Object.values(document.variables);
    const ink = variables.find((v) => v.name === 'Ink')!;
    const alias = variables.find((v) => v.name === 'Foreground')!;
    const label = variables.find((v) => v.name === 'Label')!;
    expect(alias.alias).toBe(ink.id);
    expect(resolveVariable(label, document.variables)).toBe('0 items');
    expect(ink.type).toBe('color');
    if (ink.type !== 'color') throw new Error('Expected a color');
    expect(resolveVariable(alias, document.variables, { [ink.dimensionId!]: 'night' })).toBe(
        '#ddeeff'
    );
    expect(readEntity('variables', json(ink))).toEqual(json(ink));
    const persisted = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    expect(
        migratePersistedState(persisted)?.documents[document.id].variables[ink.id].source
    ).toEqual(ink.source);
    const reexported = pack(document);
    expect(reexported.variables.find((v) => v.id === ink.id)?.source).toEqual({
        packageId: 'source',
        tokenId: 'ink'
    });
});

it('updates renamed tokens by identity, keeps bindings and preserves identity through local edits', () => {
    const { store, document } = setup();
    apply(store, document);
    const ink = Object.values(document.variables).find((v) => v.name === 'Ink')!;
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 0, y: 0 },
        size: { width: 20, height: 20 }
    });
    const shape = document.shapes[document.shapesIds[0]];
    store.actions.bindProperty({ shapeIds: [shape.id], key: 'fill', variableId: ink.id });
    store.actions.setVariableValue({ variableId: ink.id, value: '#556677' });
    expect(document.variables[ink.id].source).toEqual({ packageId: 'source', tokenId: 'ink' });
    const updated = source();
    updated.variables.ink.name = 'Brand/Ink';
    updated.variables.ink.values.default = '#aabbcc';
    expect(apply(store, document, 'replace', pack(updated)).applied).toBe(true);
    expect(document.variables[ink.id].name).toBe('Brand/Ink');
    expect(shape.fill).toBe('#aabbcc');
    expect(shape.bindings?.fill).toBe(ink.id);
    expect(Object.keys(document.variables)).toHaveLength(5);
});

it.each(['reuse', 'replace', 'separate'] as const)(
    'offers explicit %s for a name match',
    (choice) => {
        const { store, document } = setup();
        const local = store.actions.createVariable({
            name: 'Ink',
            type: 'color',
            value: '#ffffff'
        })!;
        const before = json(document.variables);
        const operations = planDesignSystemImport(json(document), pack(), choice, newId);
        expect(json(document.variables)).toEqual(before);
        expect(
            store.actions.applyOperations({
                documentId: document.id,
                by: { kind: 'person' },
                operations
            }).applied
        ).toBe(true);
        expect(document.variables[local].values.default).toBe(
            choice === 'replace' ? '#112233' : '#ffffff'
        );
        const alias = Object.values(document.variables).find((v) => v.name === 'Foreground')!;
        expect(alias.alias === local).toBe(choice !== 'separate');
        if (choice === 'separate')
            expect(Object.values(document.variables).some((v) => v.name === 'Ink 2')).toBe(true);
    }
);

it('reuses an already imported package without creating another undo step', () => {
    const { store, document } = setup();
    apply(store, document);
    expect(planDesignSystemImport(json(document), pack(), 'reuse', newId)).toEqual([]);
});

it.each(['missing', 'cycle', 'mode', 'version', 'duplicate'])(
    'rejects %s before any mutation',
    (issue) => {
        const { document } = setup();
        const data = pack();
        if (issue === 'missing') data.variables = data.variables.filter((v) => v.id !== 'ink');
        if (issue === 'cycle') data.variables.find((v) => v.id === 'ink')!.alias = 'alias';
        if (issue === 'mode') data.dimensions[0].modes = { day: data.dimensions[0].modes.day };
        if (issue === 'version') Reflect.set(data, 'version', 2);
        if (issue === 'duplicate') data.variables.push(data.variables[0]);
        const before = JSON.stringify(document);
        expect(() => readDesignSystemPackage(data)).toThrow();
        expect(JSON.stringify(document)).toBe(before);
    }
);

it('rejects type conflicts, leaving the document intact', () => {
    const { store, document } = setup();
    store.actions.createVariable({ name: 'Ink', type: 'number', value: 4 });
    expect(() => planDesignSystemImport(json(document), pack(), 'replace', newId)).toThrow(
        'different type'
    );
    expect(apply(store, document, 'separate').applied).toBe(true);
});

it('shares an import, undoes it as one step and restores it with redo', async () => {
    const copies = await createCopies(2, (store) =>
        store.actions.addDocument({ id: DOCUMENT_ID, name: 'Target' })
    );
    const [first, second] = copies;
    const document = shownDocument(first);
    expect(apply(first.store, document).applied).toBe(true);
    settle(copies);
    expect(Object.keys(shownDocument(second).variables)).toHaveLength(5);
    first.collaboration.undo(document.id);
    settle(copies);
    expect(Object.keys(document.variables)).toHaveLength(0);
    expect(Object.keys(shownDocument(second).dimensions)).toHaveLength(0);
    first.collaboration.redo(document.id);
    settle(copies);
    expect(Object.keys(shownDocument(second).variables)).toHaveLength(5);
    copies.forEach((copy) => copy.collaboration.dispose());
});

it('exports independent copies without ambiguous source identities', () => {
    const { store, document } = setup();
    apply(store, document);
    apply(store, document, 'separate');
    const data = pack(document);
    expect(data.variables).toHaveLength(10);
    expect(data.dimensions).toHaveLength(2);
    expect(data.variables.find((v) => v.name === 'Ink 2')?.source?.packageId).toBe(document.id);
});

it('replaces mode definitions and values together when the default changes', () => {
    const { store, document } = setup();
    apply(store, document);
    const updated = source();
    updated.dimensions.appearance.defaultModeId = 'night';
    updated.variables.ink.values = { default: '#ddeeff', day: '#112233' };
    expect(apply(store, document, 'replace', pack(updated)).applied).toBe(true);
    const ink = Object.values(document.variables).find((v) => v.name === 'Ink')!;
    expect(ink.values).toEqual({ default: '#ddeeff', day: '#112233' });
    const dimension = Object.values(document.dimensions)[0];
    expect(dimension.defaultModeId).toBe('night');
});

it('does not change the meaning of unrelated variables when replacing a default mode', () => {
    const { store, document } = setup();
    apply(store, document);
    const dimension = Object.values(document.dimensions)[0];
    const local = store.actions.createVariable({ name: 'Local', type: 'color', value: '#ffffff' })!;
    store.actions.setVariableDimension({ variableId: local, dimensionId: dimension.id });
    const updated = source();
    updated.dimensions.appearance.defaultModeId = 'night';
    updated.variables.ink.values = { default: '#ddeeff', day: '#112233' };
    const before = JSON.stringify(document);
    expect(() => planDesignSystemImport(json(document), pack(updated), 'replace', newId)).toThrow(
        'every variable'
    );
    expect(JSON.stringify(document)).toBe(before);
});

it('retains identity when an imported alias is edited or detached', () => {
    const { store, document } = setup();
    apply(store, document);
    const alias = Object.values(document.variables).find((v) => v.name === 'Foreground')!;
    store.actions.setVariableAlias({ variableId: alias.id, sourceId: null });
    expect(document.variables[alias.id].source).toEqual({ packageId: 'source', tokenId: 'alias' });
});

it('rejects a cycle created through reused local definitions', () => {
    const { store, document } = setup();
    const local = store.actions.createVariable({ name: 'Count', type: 'text', value: '${Label}' })!;
    const data = pack(
        createDocument({
            id: 'texts',
            name: 'Texts',
            variables: {
                count: { id: 'count', name: 'Count', type: 'text', values: { default: 'one' } },
                label: {
                    id: 'label',
                    name: 'Label',
                    type: 'text',
                    values: { default: '${count$Count}' }
                }
            }
        })
    );
    expect(() => planDesignSystemImport(json(document), data, 'reuse', newId)).toThrow();
    expect(Object.keys(document.variables)).toEqual([local]);
});

it('rejects reuse when a matching dimension lacks imported modes', () => {
    const { store, document } = setup();
    store.actions.createDimension('Appearance');
    const before = JSON.stringify(document);
    expect(() => planDesignSystemImport(json(document), pack(), 'reuse', newId)).toThrow(
        'Unknown mode'
    );
    expect(JSON.stringify(document)).toBe(before);
    expect(apply(store, document, 'separate').applied).toBe(true);
});

it('rejects missing text dependencies and unsupported numeric modes', () => {
    const data = pack();
    data.variables = data.variables.filter((variable) => variable.id !== 'count');
    expect(() => readDesignSystemPackage(data)).toThrow('Count');
    const numeric = pack();
    const count = numeric.variables.find((variable) => variable.id === 'count')!;
    Reflect.set(count.values, 'night', 1);
    expect(() => readDesignSystemPackage(numeric)).toThrow('color modes');
});

it('replaces tokens whose names were exchanged upstream without breaking references', () => {
    const { store, document } = setup();
    apply(store, document);
    const ink = Object.values(document.variables).find((v) => v.source?.tokenId === 'ink')!;
    const alias = Object.values(document.variables).find((v) => v.source?.tokenId === 'alias')!;
    const updated = source();
    updated.variables.ink.name = 'Foreground';
    updated.variables.alias.name = 'Ink';
    expect(apply(store, document, 'replace', pack(updated)).applied).toBe(true);
    expect(document.variables[ink.id].name).toBe('Foreground');
    expect(document.variables[alias.id].name).toBe('Ink');
    expect(document.variables[alias.id].alias).toBe(ink.id);
});

it('replaces dimensions whose names were exchanged upstream', () => {
    const { store, document } = setup();
    const original = source();
    original.dimensions.brand = { ...original.dimensions.appearance, id: 'brand', name: 'Brand' };
    apply(store, document, 'reuse', pack(original));
    original.dimensions.appearance.name = 'Brand';
    original.dimensions.brand.name = 'Appearance';
    expect(apply(store, document, 'replace', pack(original)).applied).toBe(true);
    expect(
        Object.values(document.dimensions).find((d) => d.source?.tokenId === 'appearance')?.name
    ).toBe('Brand');
});

it('rejects missing dimensions and default modes whose IDs name inherited object properties', () => {
    const data = pack();
    const ink = data.variables.find((v) => v.id === 'ink')!;
    if (ink.type !== 'color') throw new Error('Expected a color');
    ink.dimensionId = 'toString';
    ink.values = { default: '#112233' };
    expect(() => readDesignSystemPackage(data)).toThrow('dimension');
    const modes = pack();
    modes.dimensions[0].defaultModeId = 'toString';
    expect(() => readDesignSystemPackage(modes)).toThrow('mode');
});

it('rejects missing dependencies in the stored fallback of text aliases', () => {
    const data = pack();
    data.variables.push({
        id: 'text-alias',
        name: 'Text alias',
        type: 'text',
        alias: 'label',
        values: { default: '${missing$Missing}' }
    });
    expect(() => readDesignSystemPackage(data)).toThrow('Missing');
});

it('rejects token IDs that cannot be represented in a template reference', () => {
    const data = pack();
    const count = data.variables.find((v) => v.id === 'count')!;
    count.id = 'count$invalid';
    const label = data.variables.find((v) => v.id === 'label')!;
    label.values.default = '${Count} items';
    expect(() => readDesignSystemPackage(data)).toThrow('ID');
});

it.each(['variable', 'dimension'] as const)(
    'still rejects a final %s name conflict without writes',
    (kind) => {
        const { store, document } = setup();
        apply(store, document);
        const updated = source();
        if (kind === 'variable') {
            store.actions.createVariable({ name: 'Taken', type: 'color', value: '#ffffff' });
            updated.variables.ink.name = 'Taken';
        } else {
            store.actions.createDimension('Taken');
            updated.dimensions.appearance.name = 'Taken';
        }
        const before = JSON.stringify(document);
        expect(() =>
            planDesignSystemImport(json(document), pack(updated), 'replace', newId)
        ).toThrow('taken');
        expect(JSON.stringify(document)).toBe(before);
    }
);
