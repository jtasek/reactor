import { json } from 'overmind';
import type { Document, Shape } from 'src/app/types';
import { createComponent, createDocument, createShape } from 'src/app/factories';
import { componentFingerprint } from 'src/app/componentLibrary';
import { libraryUpdateAvailable } from 'src/app/computed/componentPanels';
import { resolveVariable } from 'src/app/variableResolver';
import { createTestStore } from './support/store';
import { createCopies, DOCUMENT_ID, edit, settle, shownDocument } from './support/collaboration';

function library(): Document {
    const swatch = {
        ...createShape({
            type: 'rectangle',
            name: 'Swatch',
            fill: '#112233',
            order: 'a0',
            position: { x: 0, y: 0 },
            size: { width: 40, height: 20 }
        }),
        id: 'swatch',
        bindings: { fill: 'surface' }
    } as Shape;
    return createDocument({
        id: 'library',
        name: 'Brand kit',
        dimensions: {
            theme: {
                id: 'theme',
                name: 'Theme',
                order: 0,
                defaultModeId: 'light',
                modes: {
                    light: { id: 'light', name: 'Light', order: 0 },
                    dark: { id: 'dark', name: 'Dark', order: 1 }
                }
            }
        },
        variables: {
            ink: {
                id: 'ink',
                name: 'Ink',
                type: 'color',
                dimensionId: 'theme',
                values: { default: '#112233', dark: '#eeeeee' }
            },
            surface: {
                id: 'surface',
                name: 'Surface',
                type: 'color',
                values: { default: '#112233' },
                alias: 'ink'
            },
            unused: { id: 'unused', name: 'Unused', type: 'number', values: { default: 1 } }
        },
        components: {
            badge: createComponent({
                id: 'badge',
                name: 'Badge',
                sourceOnly: true,
                shapesIds: ['swatch'],
                sourceShapes: { swatch }
            })
        }
    });
}

function consumer(variables: Document['variables'] = {}): Document {
    return createDocument({ id: 'consumer', name: 'App', variables });
}

function setup(target = consumer()) {
    const { store } = createTestStore();
    store.actions.addDocument(library());
    store.actions.addDocument(target);
    store.actions.openDocument(target.id);
    return store;
}

const member = (document: Document) => document.components.badge.sourceShapes!.swatch;

function drawn(document: Document, modes: Record<string, string>) {
    const id = member(document).bindings!.fill;
    return resolveVariable(document.variables[id], document.variables, modes);
}

it('brings the tokens a copied source uses, keeping the library identity and modes', () => {
    const store = setup();
    store.actions.importLibraryComponent({ documentId: 'library', componentId: 'badge' });
    const target = store.state.currentDocument;
    const variables = Object.values(json(target.variables));
    expect(variables.map((v) => v.name).sort()).toEqual(['Ink', 'Surface']);
    const ink = variables.find((v) => v.name === 'Ink')!;
    const surface = variables.find((v) => v.name === 'Surface')!;
    expect(surface).toMatchObject({
        alias: ink.id,
        source: { packageId: 'library', tokenId: 'surface' }
    });
    const [theme] = Object.values(json(target.dimensions));
    expect(theme).toMatchObject({ name: 'Theme', source: { packageId: 'library' } });
    expect(member(target).bindings).toEqual({ fill: surface.id });
    expect(drawn(target, { [theme.id]: 'dark' })).toBe('#eeeeee');
    expect(drawn(target, {})).toBe('#112233');
});

it('reuses a local definition with the same name instead of adding a second one', () => {
    const store = setup(
        consumer({
            local: {
                id: 'local',
                name: 'Surface',
                type: 'color',
                values: { default: '#ff0000' }
            }
        })
    );
    store.actions.importLibraryComponent({ documentId: 'library', componentId: 'badge' });
    const target = store.state.currentDocument;
    expect(Object.values(target.variables).filter((v) => v.name === 'Surface')).toHaveLength(1);
    expect(member(target).bindings).toEqual({ fill: 'local' });
    expect(target.variables.local.values.default).toBe('#ff0000');
});

it('refuses the copy without writes when a token cannot be brought', () => {
    const store = setup(
        consumer({
            local: { id: 'local', name: 'Surface', type: 'number', values: { default: 3 } }
        })
    );
    store.actions.importLibraryComponent({ documentId: 'library', componentId: 'badge' });
    const target = store.state.currentDocument;
    expect(target.components.badge).toBeUndefined();
    expect(Object.keys(target.variables)).toEqual(['local']);
    expect(store.state.notifications.at(-1)?.message ?? '').toMatch(/tokens cannot be brought/);
});

it('offers an update when a used token changes and replaces only what came from the library', () => {
    const store = setup();
    store.actions.importLibraryComponent({ documentId: 'library', componentId: 'badge' });
    const before = componentFingerprint(store.state.documents.library, 'badge');
    store.actions.openDocument('library');
    store.actions.applyOperations({
        documentId: 'library',
        by: { kind: 'person' },
        operations: [{ op: 'updateVariable', variable: 'unused', value: 5 }]
    });
    expect(componentFingerprint(store.state.documents.library, 'badge')).toBe(before);
    store.actions.applyOperations({
        documentId: 'library',
        by: { kind: 'person' },
        operations: [
            {
                op: 'updateVariable',
                variable: 'ink',
                name: 'Ink renamed',
                value: '#334455',
                modeValues: { dark: '#cccccc' }
            }
        ]
    });
    store.actions.openDocument('consumer');
    expect(libraryUpdateAvailable(store.state, 'badge')).toBe(true);
    store.actions.updateLibraryComponent('badge');
    const target = store.state.currentDocument;
    const ink = Object.values(target.variables).find((v) => v.source?.tokenId === 'ink')!;
    expect(ink).toMatchObject({
        name: 'Ink renamed',
        values: { default: '#334455', dark: '#cccccc' }
    });
    expect(Object.keys(target.variables)).toHaveLength(2);
    expect(libraryUpdateAvailable(store.state, 'badge')).toBe(false);
});

it('fingerprints tokens the same whatever order their fields were written in', () => {
    const document = library();
    const before = componentFingerprint(document, 'badge');
    document.variables.ink = {
        values: { dark: '#eeeeee', default: '#112233' },
        dimensionId: 'theme',
        type: 'color',
        name: 'Ink',
        id: 'ink'
    };
    const { modes, ...theme } = document.dimensions.theme;
    document.dimensions.theme = { modes: { dark: modes.dark, light: modes.light }, ...theme };
    expect(componentFingerprint(document, 'badge')).toBe(before);
});

it('keeps a component without tokens fingerprinted as before', () => {
    const plain = library();
    delete plain.components.badge.sourceShapes!.swatch.bindings;
    const { variables, dimensions, ...rest } = plain;
    expect(componentFingerprint(plain, 'badge')).toBe(
        componentFingerprint({ ...rest, variables: {}, dimensions: {} } as Document, 'badge')
    );
    expect(Object.keys(variables)).toHaveLength(3);
    expect(Object.keys(dimensions)).toHaveLength(1);
});

it('shares a copy and its tokens as one undo step', async () => {
    const copies = await createCopies(
        2,
        (store) => {
            store.actions.addDocument(library());
            store.actions.addDocument({ ...consumer(), id: DOCUMENT_ID });
            store.actions.openDocument(DOCUMENT_ID);
        },
        60_000
    );
    const [a, b] = copies;
    edit(a, (actions) =>
        actions.importLibraryComponent({ documentId: 'library', componentId: 'badge' })
    );
    settle(copies);
    expect(Object.keys(shownDocument(b).variables)).toHaveLength(2);
    expect(shownDocument(b).components.badge).toBeDefined();
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(Object.keys(shownDocument(b).variables)).toHaveLength(0);
    expect(shownDocument(b).components.badge).toBeUndefined();
});

it('follows a same-named local dimension by mode name, and refuses one without the modes', () => {
    const local = (modes: Record<string, { id: string; name: string; order: number }>) =>
        createDocument({
            id: 'consumer',
            name: 'App',
            dimensions: {
                mine: { id: 'mine', name: 'Theme', order: 0, defaultModeId: 'day', modes }
            }
        });
    const store = setup(
        local({
            day: { id: 'day', name: 'Light', order: 0 },
            night: { id: 'night', name: 'Dark', order: 1 }
        })
    );
    store.actions.importLibraryComponent({ documentId: 'library', componentId: 'badge' });
    const target = store.state.currentDocument;
    expect(Object.keys(target.dimensions)).toEqual(['mine']);
    const ink = Object.values(target.variables).find((v) => v.name === 'Ink')!;
    expect(ink).toMatchObject({ dimensionId: 'mine', values: { night: '#eeeeee' } });
    expect(drawn(target, { mine: 'night' })).toBe('#eeeeee');

    const refused = setup(local({ day: { id: 'day', name: 'Light', order: 0 } }));
    refused.actions.importLibraryComponent({ documentId: 'library', componentId: 'badge' });
    expect(refused.state.currentDocument.components.badge).toBeUndefined();
    expect(refused.state.notifications.at(-1)?.message).toBe(
        'Its tokens cannot be brought here. Theme has no Dark mode here. Import separately instead.'
    );
});
