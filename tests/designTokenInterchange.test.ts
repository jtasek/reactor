import { json } from 'overmind';
import { createDocument } from 'src/app/factories';
import {
    parseDesignTokenInterchange,
    exportDesignTokenInterchange,
    DTCG_SCHEMA
} from 'src/app/designTokenInterchange';
import { planDesignSystemImport } from 'src/app/designSystemPackages';
import { resolveVariable } from 'src/app/variableResolver';
import { createTestStore } from './support/store';
import { createCopies, DOCUMENT_ID, shownDocument, settle } from './support/collaboration';

const EXTENSION = 'io.github.jtasek.reactor';
const color = { colorSpace: 'srgb', components: [0.2, 0.4, 1] };
const fixture = () => ({
    $schema: DTCG_SCHEMA,
    brand: { $type: 'color', ink: { $value: color }, foreground: { $value: '{brand.ink}' } },
    scale: {
        zero: { $type: 'number', $value: 0 },
        half: { $type: 'number', $value: -0.5 },
        alias: { $value: '{scale.zero}' }
    }
});
const parse = (input: unknown) =>
    parseDesignTokenInterchange(JSON.stringify(input), 'brand.tokens.json');
function setup() {
    const { store } = createTestStore();
    store.actions.addDocument({ id: store.state.currentDocumentId });
    return { store, document: store.state.currentDocument };
}
let counter = 0;
const newId = () => `dtcg-import-${counter++}`;

it('reads nested groups, inherited types, numbers including zero, and aliases without flattening', () => {
    const data = parse(fixture());
    const ink = data.variables.find((v) => v.name === 'brand/ink')!;
    const alias = data.variables.find((v) => v.name === 'brand/foreground')!;
    expect(ink.values.default).toBe('#3366ff');
    expect(alias.alias).toBe(ink.id);
    expect(alias.values.default).toBe('#3366ff');
    expect(data.variables.find((v) => v.name === 'scale/zero')?.values.default).toBe(0);
    expect(data.variables.find((v) => v.name === 'scale/half')?.values.default).toBe(-0.5);
    expect(data.dimensions).toEqual([]);
    expect(ink.source).toEqual({ packageId: 'dtcg:brand.tokens.json', tokenId: ink.id });
});

it('supports root tokens and whole-token JSON Pointer aliases', () => {
    const data = parse({
        tone: { $type: 'color', $root: { $value: color }, ink: { $value: '{tone.$root}' } },
        pointer: { $ref: '#/tone/$root/$value', $type: 'color' }
    });
    const root = data.variables.find((v) => v.name === 'tone')!;
    expect(data.variables.find((v) => v.name === 'tone/ink')?.alias).toBe(root.id);
    expect(data.variables.find((v) => v.name === 'pointer')?.alias).toBe(root.id);
});

it('uses the actual color components rather than an inconsistent hex fallback', () => {
    const data = parse({
        ink: { $type: 'color', $value: { ...color, components: [0.5, 0, 1], hex: '#ffffff' } }
    });
    expect(data.variables[0].values.default).toBe('#8000ff');
});

it('round trips colors, numbers, paths, aliases, retained fallbacks and stable source identity', () => {
    const document = createDocument({
        id: 'brand',
        name: 'Brand',
        variables: {
            ink: { id: 'ink', name: 'color', type: 'color', values: { default: '#3366ff' } },
            alias: {
                id: 'alias',
                name: 'color/foreground',
                type: 'color',
                alias: 'ink',
                values: { default: '#000000' }
            },
            zero: {
                id: 'zero',
                name: 'scale/zero',
                type: 'number',
                values: { default: 0 },
                source: { packageId: 'upstream', tokenId: 'zero' }
            }
        }
    });
    const text = exportDesignTokenInterchange(document);
    const output = JSON.parse(text);
    expect(output.color.$root.$type).toBe('color');
    expect(output.color.foreground.$value).toBe('{color.$root}');
    const data = parseDesignTokenInterchange(text);
    expect(data.variables.find((v) => v.id === 'alias')?.values.default).toBe('#000000');
    expect(data.variables.find((v) => v.id === 'alias')?.alias).toBe('ink');
    expect(data.variables.find((v) => v.id === 'zero')?.source).toEqual({
        packageId: 'upstream',
        tokenId: 'zero'
    });
    const restored = createDocument({
        id: data.id,
        name: data.name,
        variables: Object.fromEntries(data.variables.map((v) => [v.id, v]))
    });
    expect(exportDesignTokenInterchange(restored)).toBe(text);
    document.variables = Object.fromEntries(Object.entries(document.variables).reverse());
    expect(exportDesignTokenInterchange(document)).toBe(text);
});

it('retains alias identity when replacing a renamed token from a Reactor DTCG export', () => {
    const original = createDocument({
        id: 'upstream',
        name: 'Brand',
        variables: {
            ink: { id: 'ink', name: 'Ink', type: 'color', values: { default: '#112233' } }
        }
    });
    const { store, document } = setup();
    const imported = parseDesignTokenInterchange(exportDesignTokenInterchange(original));
    store.actions.applyOperations({
        documentId: document.id,
        by: { kind: 'person' },
        operations: planDesignSystemImport(json(document), imported, 'reuse', newId)
    });
    const local = Object.values(document.variables)[0];
    original.variables.ink.name = 'Renamed';
    original.variables.ink.values.default = '#aabbcc';
    const updated = parseDesignTokenInterchange(exportDesignTokenInterchange(original));
    expect(
        store.actions.applyOperations({
            documentId: document.id,
            by: { kind: 'person' },
            operations: planDesignSystemImport(json(document), updated, 'replace', newId)
        }).applied
    ).toBe(true);
    expect(document.variables[local.id].name).toBe('Renamed');
    expect(document.variables[local.id].values.default).toBe('#aabbcc');
});

it.each([
    ['null type', { a: { $type: null, $value: '{b}' }, b: { $type: 'number', $value: 1 } }, 'null'],
    [
        'dimension with units',
        { space: { $type: 'dimension', $value: { value: 8, unit: 'px' } } },
        'dimension'
    ],
    ['text', { label: { $type: 'string', $value: 'Hi' } }, 'string'],
    ['boolean', { enabled: { $type: 'boolean', $value: false } }, 'boolean'],
    ['transparent color', { ink: { $type: 'color', $value: { ...color, alpha: 0.5 } } }, 'opaque'],
    [
        'wide gamut',
        { ink: { $type: 'color', $value: { ...color, colorSpace: 'display-p3' } } },
        'sRGB'
    ],
    ['legacy hex', { ink: { $type: 'color', $value: '#ff0000' } }, 'alias'],
    [
        'component references',
        { ink: { $type: 'color', $value: { ...color, components: ['{red}', 0, 1] } } },
        'components'
    ],
    ['missing alias', { ink: { $type: 'color', $value: '{missing}' } }, 'Missing token'],
    ['cycle', { a: { $value: '{b}' }, b: { $value: '{a}' } }, 'Circular'],
    [
        'mixed alias types',
        { a: { $type: 'color', $value: color }, b: { $type: 'number', $value: '{a}' } },
        'types differ'
    ],
    [
        'property-level pointers',
        { a: { $type: 'number', $ref: '#/ink/$value/components/0' } },
        'Property-level'
    ],
    [
        'remote references',
        { a: { $type: 'number', $ref: 'https://example.com/tokens.json#/a/$value' } },
        'local'
    ],
    ['group inheritance', { colors: { $extends: '{other}' } }, '$extends'],
    ['unknown extension', { $extensions: { 'another.vendor': {} } }, 'another.vendor'],
    [
        'unsupported metadata',
        { a: { $type: 'number', $value: 1, $description: 'Meaning' } },
        '$description'
    ],
    [
        'unknown schema',
        { $schema: 'https://example.com/future-schema', a: { $type: 'number', $value: 1 } },
        'schema'
    ],
    ['slash collision', { 'a/b': { $type: 'number', $value: 1 } }, 'name'],
    ['prototype alias', { a: { $type: 'number', $value: '{toString}' } }, 'Missing token']
])('rejects unsupported %s without changing a document', (_, input, problem) => {
    const { document } = setup();
    const before = JSON.stringify(document);
    expect(() => parse(input)).toThrow(problem);
    expect(JSON.stringify(document)).toBe(before);
});

it('refuses to drop unsupported native definitions during export', () => {
    const text = createDocument({
        variables: {
            text: { id: 'text', name: 'Label', type: 'text', values: { default: 'Hello' } }
        }
    });
    expect(() => exportDesignTokenInterchange(text)).toThrow('native');
    const data = parse(fixture());
    const document = createDocument({
        variables: Object.fromEntries(data.variables.map((v) => [v.id, v]))
    });
    document.dimensions.custom = {
        id: 'custom',
        name: 'Custom',
        order: 0,
        defaultModeId: 'base',
        modes: { base: { id: 'base', name: 'Base', order: 0 } }
    };
    expect(() => exportDesignTokenInterchange(document)).toThrow('dimensions and modes');
});

it('limits bytes, nesting and token counts', () => {
    expect(() => parseDesignTokenInterchange(' '.repeat(1024 * 1024 + 1))).toThrow('1 MiB');
    let nested: unknown = { $type: 'number', $value: 1 };
    for (let i = 0; i < 34; i++) nested = { group: nested };
    expect(() => parse(nested)).toThrow('deeply');
    expect(() =>
        parse(
            Object.fromEntries(
                Array.from({ length: 1001 }, (_, i) => [
                    `token${i}`,
                    { $type: 'number', $value: i }
                ])
            )
        )
    ).toThrow('1000');
});

it('applies an interchange import as one shared undo step', async () => {
    const copies = await createCopies(2, (store) => store.actions.addDocument({ id: DOCUMENT_ID }));
    const first = copies[0];
    const document = shownDocument(first);
    const data = parse(fixture());
    const result = first.store.actions.applyOperations({
        documentId: document.id,
        by: { kind: 'person' },
        operations: planDesignSystemImport(json(document), data, 'reuse', newId)
    });
    expect(result.applied).toBe(true);
    settle(copies);
    const peer = shownDocument(copies[1]);
    const alias = Object.values(peer.variables).find((v) => v.name === 'brand/foreground')!;
    expect(resolveVariable(alias, peer.variables)).toBe('#3366ff');
    first.collaboration.undo(document.id);
    settle(copies);
    expect(Object.keys(peer.variables)).toHaveLength(0);
    first.collaboration.redo(document.id);
    settle(copies);
    expect(Object.keys(peer.variables)).toHaveLength(5);
    copies.forEach((copy) => copy.collaboration.dispose());
});

it('validates the Reactor extension instead of trusting token metadata', () => {
    expect(() => parse({ $extensions: { [EXTENSION]: { version: 2 } } })).toThrow(
        'extension version'
    );
    expect(() =>
        parse({
            a: {
                $type: 'number',
                $value: 1,
                $extensions: {
                    [EXTENSION]: { id: 'bad$id', source: { packageId: 'test', tokenId: 'a' } }
                }
            }
        })
    ).toThrow('ID');
});

it('decodes URI fragments before JSON Pointer escapes without confusing literal percent names', () => {
    const data = parse({
        'a b': { $type: 'number', $value: 1 },
        'a%20b': { $type: 'number', $value: 2 },
        'a~b': { $type: 'number', $value: 3 },
        space: { $ref: '#/a%20b/$value' },
        percent: { $ref: '#/a%2520b/$value' },
        tilde: { $ref: '#/a%7E0b/$value' },
        encodedSlash: { $ref: '#%2Fa%20b%2F%24value' }
    });
    const byId = Object.fromEntries(data.variables.map((variable) => [variable.id, variable]));
    expect(
        resolveVariable(data.variables.find((variable) => variable.name === 'encodedSlash')!, byId)
    ).toBe(1);
    expect(
        resolveVariable(data.variables.find((variable) => variable.name === 'space')!, byId)
    ).toBe(1);
    expect(
        resolveVariable(data.variables.find((variable) => variable.name === 'percent')!, byId)
    ).toBe(2);
    expect(
        resolveVariable(data.variables.find((variable) => variable.name === 'tilde')!, byId)
    ).toBe(3);
});

it.each([
    { $extensions: { [EXTENSION]: { version: 1, name: 'Brand' } } },
    { $extensions: { [EXTENSION]: { version: 1, id: null, name: 'Brand' } } },
    { $extensions: { [EXTENSION]: { version: 1, id: 'brand' } } },
    { a: { $type: 'number', $value: 1, $extensions: { [EXTENSION]: { id: null } } } }
])(
    'rejects incomplete or null Reactor identity metadata instead of silently assigning a new identity',
    (input) => {
        expect(() => parse(input)).toThrow();
    }
);

it('refuses an export deeper than the importer accepts and round trips the boundary', () => {
    const document = createDocument({
        variables: {
            deep: {
                id: 'deep',
                name: Array(32).fill('group').join('/'),
                type: 'number',
                values: { default: 0 }
            }
        }
    });
    expect(
        parseDesignTokenInterchange(exportDesignTokenInterchange(document)).variables[0].name
    ).toBe(document.variables.deep.name);
    document.variables.deep.name += '/too-deep';
    expect(() => exportDesignTokenInterchange(document)).toThrow('deep');
});

it.each(['#/a%ZZ/$value', '#/a%E0%A4/$value', '#/a~2b/$value'])(
    'rejects malformed URI or JSON Pointer escapes: %s',
    (reference) => {
        expect(() => parse({ alias: { $type: 'number', $ref: reference } })).toThrow('Invalid');
    }
);
