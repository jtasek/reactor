import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { IDBFactory } from 'fake-indexeddb';
import { registerEditor } from 'src/pages/registerEditor';
import { prototypeModes, prototypeSession } from 'src/app/modeEdits';
import { packageContents } from 'src/preview/standalonePackage';
import {
    migratePersistedState,
    serializePersistedState,
    SCHEMA_VERSION
} from 'src/app/services/documentStorage';
import { DocumentDatabase } from 'src/app/services/documentDatabase';
import { VIEW_KEY } from 'src/app/services/documentSync';
import {
    PREVIEW_PROTOCOL_VERSION,
    readPreview,
    readsPreviewVersion
} from 'src/shared/previewProtocol';
import { exportDesignSystemPackage, parseDesignSystemPackage } from 'src/app/designSystemPackages';
import {
    DTCG_SCHEMA,
    designTokenInterchangeProblems,
    exportDesignTokenInterchange,
    parseDesignTokenInterchange
} from 'src/app/designTokenInterchange';
import type { Document } from 'src/app/types';
import { createTestStore } from './support/store';
import { SAVED_FIXTURES } from './support/documentFixtures';
import {
    canvasProjection,
    canvasShapes,
    previewProjection,
    type Mark,
    type ParityStore
} from './support/projectionParity';
import { openPackage, snapshotPage } from './support/packageProjection';
import { previewImageAsset } from './support/previewImages';

/**
 * Files saved by one release open in every later one and look the same. Each format keeps
 * a folder per version under tests/compatibility, frozen once by `pnpm compat:freeze` and
 * never rewritten: documents as the editor keeps them (Yjs, on the device and the server)
 * and as older editors kept them in local storage, shared links as the server stores their
 * snapshots, and downloaded variable files. Beside each file is what a person saw, or what
 * it read as, when it was frozen.
 */
const ROOT = path.resolve('tests/compatibility');
const FREEZE = process.env.COMPAT_FREEZE === '1';
const DOCUMENTS = path.join(ROOT, 'documents');
const LINKS = path.join(ROOT, 'links');
const TOKENS = path.join(ROOT, 'tokens');
/** Variable files people download and import: each format, the version written today, and
 * whether a document's variables fit it. */
const TOKEN_FORMATS = [
    {
        name: 'reactor',
        version: '1',
        carries: (document: Document) => Object.keys(document.variables).length > 0,
        write: exportDesignSystemPackage,
        read: parseDesignSystemPackage
    },
    {
        name: 'dtcg',
        version: DTCG_SCHEMA.match(/schemas\/([^/]+)\//)![1],
        carries: (document: Document) =>
            Object.keys(document.variables).length > 0 &&
            designTokenInterchangeProblems(document).length === 0,
        write: exportDesignTokenInterchange,
        read: (text: string) => parseDesignTokenInterchange(text)
    }
];
/** The document id the server gives a shared snapshot in place of the editor's. */
const LINK_DOCUMENT = 'shared-link';

type ShapeLooks = Record<string, Mark[]>;
interface DocumentLooks {
    /** Each View's artwork on the canvas, by View id. */
    canvas: Record<string, ShapeLooks>;
    /** Canvas artwork outside any View. */
    outside: Mark[];
    /** Each View's start screen as Play opens it, by View id. */
    prototype: Record<string, ShapeLooks>;
}

const slug = (label: string) =>
    label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
const folderVersions = (folder: string) =>
    existsSync(folder)
        ? readdirSync(folder)
              .filter((name) => name.startsWith('v'))
              .map((name) => name.slice(1))
        : [];
const versions = (folder: string) =>
    folderVersions(folder)
        .map(Number)
        .filter(Number.isInteger)
        .sort((a, b) => a - b);
const filesIn = (folder: string, suffix: string) =>
    readdirSync(folder)
        .filter(
            (name) =>
                name.endsWith(suffix) &&
                !name.endsWith('.looks.json') &&
                !name.endsWith('.read.json')
        )
        .map((name) => name.slice(0, -suffix.length));
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8'));

/** Writes a frozen file once; an existing one is the record of a release and stays. */
function freeze(file: string, contents: string | Uint8Array) {
    if (!existsSync(file)) {
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, contents);
    }
}

function looksOf(store: ParityStore): DocumentLooks {
    const canvas = canvasProjection(store);

    return {
        canvas: Object.fromEntries(
            [...canvas].map(([viewId, shapes]) => [viewId, Object.fromEntries(shapes)])
        ),
        outside: canvasShapes(store, 0, 0),
        prototype: Object.fromEntries(
            [...canvas.keys()].map((viewId) => [
                viewId,
                Object.fromEntries(previewProjection(store, viewId, {}, 'prototype').shapes)
            ])
        )
    };
}

/** A browser whose local storage holds this save, from before documents moved to IndexedDB. */
async function openLocalSave(saved: string) {
    registerEditor();
    const { store, effects } = createTestStore({ reactor: saved }, { autoSave: true });
    await store.onInitialize();

    return Object.assign(store, { collaboration: effects.collaboration });
}

/** A browser whose document database holds this Yjs state, as the editor and server keep it. */
async function openYjs(documentId: string, state: Uint8Array) {
    registerEditor();
    const indexedDB = new IDBFactory();
    const database = await DocumentDatabase.open(indexedDB);
    await database.create(documentId, state);
    database.close();
    const { store } = createTestStore(
        { [VIEW_KEY]: JSON.stringify({ currentDocumentId: documentId }) },
        { indexedDB, autoSave: true }
    );
    await store.onInitialize();

    return store;
}

const savedState = (store: ParityStore) =>
    serializePersistedState({
        currentDocumentId: store.state.currentDocumentId,
        documents: store.state.documents
    });

/** A document's shared content; the camera is each device's own and never shared. */
const shared = (store: ParityStore) =>
    Object.values(savedState(store).documents).map((document) => ({
        ...document,
        camera: undefined
    }));

/** The snapshot the server stores for a link shared from the View Play starts on. */
async function linkSnapshot(store: ParityStore, viewId: string) {
    store.actions.editFrame({ kind: 'select', id: viewId });
    const { state } = store;
    const session = prototypeSession(
        state.currentDocument,
        prototypeModes(state),
        null,
        state.config.viewportPresets[0].size
    );
    const asset = await previewImageAsset();
    vi.stubGlobal('createImageBitmap', async () => ({ close() {} }));
    try {
        const { application } = await packageContents(
            state.currentDocument,
            session,
            {},
            [],
            state.config.accessibility,
            { read: async () => asset },
            new AbortController().signal
        );

        return JSON.stringify({
            version: PREVIEW_PROTOCOL_VERSION,
            application: { ...readPreview(application), documentId: LINK_DOCUMENT }
        });
    } finally {
        vi.unstubAllGlobals();
    }
}

/** Each screen as today's runtime draws a stored snapshot, by screen id. */
async function playedLooks(snapshot: string) {
    const page = await openPackage(snapshotPage(snapshot));
    try {
        expect(page.status).toBeNull();

        return Object.fromEntries(
            page.application.screens.map(({ id }) => [id, Object.fromEntries(page.show(id))])
        );
    } finally {
        page.close();
    }
}

afterEach(() => vi.unstubAllGlobals());

describe.runIf(FREEZE)('freezing this release', () => {
    const documents = path.join(DOCUMENTS, `v${SCHEMA_VERSION}`);
    const links = path.join(LINKS, `v${PREVIEW_PROTOCOL_VERSION}`);

    test.each(SAVED_FIXTURES)('%s', async (label, build) => {
        const name = slug(label);
        const document: Document = build();
        const store = await openLocalSave(
            JSON.stringify(
                serializePersistedState({
                    currentDocumentId: document.id,
                    documents: { [document.id]: document }
                })
            )
        );
        const saved = savedState(store);
        const yjsState = store.collaboration.state(document.id);
        const views = Object.values(store.state.currentDocument.frames).filter(
            (frame) => frame.kind === 'view'
        );

        freeze(path.join(documents, `${name}.json`), json(saved));
        freeze(path.join(documents, `${name}.yjs`), yjsState);
        freeze(path.join(documents, `${name}.looks.json`), json(looksOf(store)));
        if (views.length) {
            const snapshot = await linkSnapshot(store, views[0].id);
            freeze(path.join(links, `${name}.json`), `${snapshot}\n`);
            freeze(path.join(links, `${name}.looks.json`), json(await playedLooks(snapshot)));
        }
        for (const format of TOKEN_FORMATS) {
            const file = path.join(TOKENS, format.name, `v${format.version}`, `${name}.json`);
            if (format.carries(store.state.currentDocument)) {
                const exported = format.write(store.state.currentDocument);
                freeze(file, exported);
                freeze(file.replace(/\.json$/, '.read.json'), json(format.read(exported)));
            }
        }
    });
});

describe.skipIf(FREEZE)('compatibility', () => {
    test('this release has frozen files for its document format and link protocol', () => {
        expect(
            versions(DOCUMENTS),
            `Run pnpm compat:freeze to keep documents of format ${SCHEMA_VERSION}`
        ).toContain(SCHEMA_VERSION);
        expect(
            versions(LINKS),
            `Run pnpm compat:freeze to keep links of protocol ${PREVIEW_PROTOCOL_VERSION}`
        ).toContain(PREVIEW_PROTOCOL_VERSION);
        for (const format of TOKEN_FORMATS) {
            expect(
                folderVersions(path.join(TOKENS, format.name)),
                `Run pnpm compat:freeze to keep ${format.name} files of version ${format.version}`
            ).toContain(format.version);
        }
        const frozen = filesIn(path.join(DOCUMENTS, `v${SCHEMA_VERSION}`), '.json');
        expect(
            SAVED_FIXTURES.map(([label]) => slug(label)).filter((name) => !frozen.includes(name)),
            'Run pnpm compat:freeze to keep the fixtures added since this format was frozen'
        ).toEqual([]);
    });

    describe.each(versions(DOCUMENTS))('documents of format %i', (version) => {
        const folder = path.join(DOCUMENTS, `v${version}`);

        describe.each(filesIn(folder, '.json'))('%s', (name) => {
            const saved = readFileSync(path.join(folder, `${name}.json`), 'utf8');
            const looks = readJson<DocumentLooks>(path.join(folder, `${name}.looks.json`));

            test('a local storage save opens without repairs and looks the same', async () => {
                const onRepair = vi.fn();
                expect(migratePersistedState(JSON.parse(saved), onRepair)).not.toBeNull();
                expect(onRepair).not.toHaveBeenCalled();
                const store = await openLocalSave(saved);
                const reading = savedState(store);
                if (version === SCHEMA_VERSION) {
                    // Without a new format version, this release must write what it read.
                    expect(reading).toEqual(JSON.parse(saved));
                }
                expect(looksOf(store)).toEqual(looks);
            });

            test('its Yjs state opens as the same document and looks the same', async () => {
                const { currentDocumentId } = JSON.parse(saved);
                const state = new Uint8Array(readFileSync(path.join(folder, `${name}.yjs`)));
                const fromYjs = await openYjs(currentDocumentId, state);
                expect(fromYjs.state.currentDocumentId).toBe(currentDocumentId);
                expect(fromYjs.state.outdatedDocuments).toEqual({});
                const fromSave = await openLocalSave(saved);
                expect(shared(fromYjs)).toEqual(shared(fromSave));
                expect(looksOf(fromYjs)).toEqual(looks);
            });
        });
    });

    describe.each(versions(LINKS))('links of protocol %i', (version) => {
        const folder = path.join(LINKS, `v${version}`);

        describe.each(filesIn(folder, '.json'))('%s', (name) => {
            const snapshot = readFileSync(path.join(folder, `${name}.json`), 'utf8').trim();

            test('the server still serves it and the runtime draws it the same', async () => {
                expect(
                    readsPreviewVersion(JSON.parse(snapshot).version),
                    `Links shared at protocol ${version} must still open`
                ).toBe(true);
                expect(await playedLooks(snapshot)).toEqual(
                    readJson(path.join(folder, `${name}.looks.json`))
                );
            });
        });
    });

    describe.each(TOKEN_FORMATS)('$name variable files', (format) => {
        const folder = path.join(TOKENS, format.name);

        describe.each(folderVersions(folder))('version %s', (version) => {
            test.each(filesIn(path.join(folder, `v${version}`), '.json'))('%s', (name) => {
                const file = path.join(folder, `v${version}`, `${name}.json`);
                expect(format.read(readFileSync(file, 'utf8'))).toEqual(
                    readJson(file.replace(/\.json$/, '.read.json'))
                );
            });
        });
    });
});
