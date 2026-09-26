import type * as Yjs from 'yjs';
import type { Document } from '../types';
import {
    COLLECTIONS,
    RUNTIME_FIELDS,
    readDocumentFields,
    readEntity,
    withoutDanglingReferences,
    type Collection,
    type DocumentFields,
    type Exists,
    type SavedEntities
} from './documentStorage';

/** Changes other copies made to a document, in durable form; `null` removes an entity. */
export interface RemoteChanges {
    documentId: string;
    fields?: DocumentFields;
    entities: { [C in Collection]?: Record<string, SavedEntities[C] | null> };
}

interface Mutation {
    path: string;
    delimiter: string;
    hasChangedValue: boolean;
}

export interface CollaborationOptions {
    /** The store's document, whose changes are shared. */
    getDocument(documentId: string): Document | undefined;
    /** Applies changes that came from other copies, as one action. */
    applyRemoteChanges(changes: RemoteChanges): void;
    /** Reports every store mutation, to find the changes this copy makes. */
    addMutationListener(listener: (mutation: Mutation) => void): () => void;
    /** Sends this copy's changes to the other copies. */
    sendUpdate?(documentId: string, update: Uint8Array): void;
}

type YEntity = Yjs.Map<unknown>;

interface Changes {
    fields: boolean;
    entities: Map<Collection, Set<string>>;
    /** Shapes or components appeared, disappeared or became invalid, so references may change. */
    structure: boolean;
}

interface Binding {
    doc: Yjs.Doc;
    fields: Yjs.Map<unknown>;
    tables: Record<Collection, Yjs.Map<YEntity>>;
    local: Changes;
    remote: Changes;
    /** Entities left out of the store because they failed validation. */
    invalid: Record<Collection, Set<string>>;
}

const LOCAL = Symbol('local change');
const isLocalOnly = (field: string) =>
    RUNTIME_FIELDS.has(field) || field === 'camera' || field === 'shapesIds';
const REFERENCING = ['groups', 'layers', 'components', 'links'] as const;

const isCollection = (value: string): value is Collection =>
    COLLECTIONS.some((collection) => collection === value);

const noChanges = (): Changes => ({ fields: false, entities: new Map(), structure: false });

const touch = (changes: Changes, collection: Collection, id: string) => {
    const ids = changes.entities.get(collection) ?? new Set<string>();

    ids.add(id);
    changes.entities.set(collection, ids);
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Makes `target` hold exactly `values`, writing only the fields that differ. */
function writeFields(target: Yjs.Map<unknown>, values: object) {
    const entries = Object.entries(values).filter(([, value]) => value !== undefined);
    const keys = new Set(entries.map(([key]) => key));

    for (const key of [...target.keys()].filter((key) => !keys.has(key))) {
        target.delete(key);
    }

    for (const [key, value] of entries.filter(([key, value]) => !same(target.get(key), value))) {
        target.set(key, value);
    }
}

function validEntity<C extends Collection>(collection: C, value: unknown): SavedEntities[C] | null {
    try {
        return readEntity(collection, value);
    } catch {
        return null;
    }
}

function validFields(value: unknown): DocumentFields | undefined {
    try {
        return readDocumentFields(value);
    } catch {
        return undefined;
    }
}

/**
 * Shares documents between copies of the editor through Yjs, which it loads on
 * `initialize`. The store stays the app's state: this copy's changes are written to
 * the Yjs document after each action, and changes from other copies reach the store
 * through `applyRemoteChanges`. Every copy shows the same merged content: entities
 * that fail validation are left out, and references to missing shapes and
 * components are dropped as deleting them would.
 */
export class Collaboration {
    private yjs?: typeof Yjs;
    private options?: CollaborationOptions;
    private stopListening?: () => void;
    private readonly bindings = new Map<string, Binding>();
    private applyingRemote = false;
    private flushQueued = false;

    async initialize(options: CollaborationOptions): Promise<void> {
        this.yjs = await import('yjs');
        this.options = options;
        this.stopListening = options.addMutationListener((mutation) => this.record(mutation));
    }

    /**
     * Starts sharing a document. With `update`, a state saved or sent by another
     * copy, the store's document is brought in line with it; without, the store's
     * document is the starting state.
     */
    open(documentId: string, update?: Uint8Array): void {
        const { yjs } = this.ready();

        this.close(documentId);

        const doc = new yjs.Doc();
        const binding: Binding = {
            doc,
            fields: doc.getMap('document'),
            tables: {
                shapes: doc.getMap('shapes'),
                groups: doc.getMap('groups'),
                layers: doc.getMap('layers'),
                components: doc.getMap('components'),
                links: doc.getMap('links'),
                rulers: doc.getMap('rulers')
            },
            local: noChanges(),
            remote: noChanges(),
            invalid: {
                shapes: new Set(),
                groups: new Set(),
                layers: new Set(),
                components: new Set(),
                links: new Set(),
                rulers: new Set()
            }
        };

        this.bindings.set(documentId, binding);

        if (update) {
            yjs.applyUpdate(doc, update);
            this.observe(documentId, binding);
            this.everything(documentId, binding, binding.remote);
            this.applyRemote(documentId, binding);

            return;
        }

        this.observe(documentId, binding);
        this.everything(documentId, binding, binding.local);
        this.flush();
    }

    /** Applies an update another copy sent. */
    receive(documentId: string, update: Uint8Array): void {
        const binding = this.bindings.get(documentId);

        if (!binding) {
            return;
        }

        this.flush();
        this.ready().yjs.applyUpdate(binding.doc, update);
    }

    /** The document's whole state, to start another copy or to save. */
    state(documentId: string): Uint8Array {
        const binding = this.bindings.get(documentId);

        if (!binding) {
            throw new Error(`Document ${documentId} is not shared`);
        }

        return this.ready().yjs.encodeStateAsUpdate(binding.doc);
    }

    close(documentId: string): void {
        this.bindings.get(documentId)?.doc.destroy();
        this.bindings.delete(documentId);
    }

    dispose(): void {
        this.stopListening?.();
        [...this.bindings.keys()].forEach((documentId) => this.close(documentId));
    }

    /** Writes this copy's pending changes, one Yjs transaction per document. */
    flush(): void {
        this.flushQueued = false;

        for (const [documentId, binding] of this.bindings) {
            const { local } = binding;

            if (!local.fields && local.entities.size === 0) {
                continue;
            }

            binding.local = noChanges();

            const document = this.ready().options.getDocument(documentId);

            if (document) {
                binding.doc.transact(() => this.write(binding, document, local), LOCAL);
            }
        }
    }

    private ready() {
        const { yjs, options } = this;

        if (!yjs || !options) {
            throw new Error('Collaboration is not initialized');
        }

        return { yjs, options };
    }

    private record({ path, delimiter, hasChangedValue }: Mutation) {
        if (this.applyingRemote || !hasChangedValue) {
            return;
        }

        const [root, documentId, field, entityId, entityField] = path.split(delimiter);

        if (root !== 'documents') {
            return;
        }

        if (documentId === undefined) {
            this.bindings.forEach((binding, id) => this.everything(id, binding, binding.local));
            this.queueFlush();

            return;
        }

        const binding = this.bindings.get(documentId);

        if (binding && this.localChange(documentId, binding, field, entityId, entityField)) {
            this.queueFlush();
        }
    }

    private queueFlush() {
        if (!this.flushQueued) {
            this.flushQueued = true;
            queueMicrotask(() => this.flush());
        }
    }

    /** Notes a store change to share; without a field, the whole document changed. */
    private localChange(
        documentId: string,
        binding: Binding,
        field?: string,
        entityId?: string,
        entityField?: string
    ): boolean {
        if (field === undefined) {
            this.everything(documentId, binding, binding.local);

            return true;
        }

        if (!isCollection(field)) {
            if (isLocalOnly(field)) {
                return false;
            }

            binding.local.fields = true;

            return true;
        }

        if (entityId === undefined) {
            this.idsOf(documentId, binding, field).forEach((id) => touch(binding.local, field, id));

            return true;
        }

        if (entityField !== undefined && isLocalOnly(entityField)) {
            return false;
        }

        touch(binding.local, field, entityId);

        return true;
    }

    /** Ids of a collection's entities in the store or in the Yjs document. */
    private idsOf(documentId: string, binding: Binding, collection: Collection): Set<string> {
        const document = this.ready().options.getDocument(documentId);

        return new Set([
            ...binding.tables[collection].keys(),
            ...Object.keys(document?.[collection] ?? {})
        ]);
    }

    private everything(documentId: string, binding: Binding, changes: Changes) {
        changes.fields = true;
        changes.structure = true;

        for (const collection of COLLECTIONS) {
            this.idsOf(documentId, binding, collection).forEach((id) =>
                touch(changes, collection, id)
            );
        }
    }

    private write(binding: Binding, document: Document, local: Changes) {
        if (local.fields) {
            writeFields(binding.fields, readDocumentFields(document));
        }

        for (const [collection, ids] of local.entities) {
            const table = binding.tables[collection];
            const entities: Record<string, unknown> = document[collection];

            for (const id of ids) {
                const entity = entities[id];

                if (entity === undefined) {
                    table.delete(id);
                    continue;
                }

                writeFields(this.entityOf(table, id), readEntity(collection, entity));
            }
        }
    }

    private entityOf(table: Yjs.Map<YEntity>, id: string): YEntity {
        const existing = table.get(id);

        if (existing) {
            return existing;
        }

        const { yjs } = this.ready();
        const created = new yjs.Map<unknown>();

        table.set(id, created);

        return created;
    }

    private observe(documentId: string, binding: Binding) {
        binding.fields.observe((_event, transaction) => {
            binding.remote.fields ||= transaction.origin !== LOCAL;
        });

        for (const collection of COLLECTIONS) {
            const table = binding.tables[collection];

            table.observeDeep((events, transaction) => {
                if (transaction.origin === LOCAL) {
                    return;
                }

                for (const event of events) {
                    const own = event.target === table;
                    const ids = own ? [...event.changes.keys.keys()] : [String(event.path[0])];

                    ids.forEach((id) => touch(binding.remote, collection, id));
                    binding.remote.structure ||=
                        own && (collection === 'shapes' || collection === 'components');
                }
            });
        }

        binding.doc.on('afterTransaction', (transaction) => {
            if (transaction.origin !== LOCAL) {
                this.applyRemote(documentId, binding);
            }
        });
        binding.doc.on('update', (update: Uint8Array, origin: unknown) => {
            if (origin === LOCAL) {
                this.ready().options.sendUpdate?.(documentId, update);
            }
        });
    }

    private applyRemote(documentId: string, binding: Binding) {
        const { remote } = binding;

        if (!remote.fields && remote.entities.size === 0) {
            return;
        }

        binding.remote = noChanges();

        const changes: RemoteChanges = {
            documentId,
            fields: remote.fields ? validFields(binding.fields.toJSON()) : undefined,
            entities: this.views(binding, remote)
        };

        this.applyingRemote = true;

        try {
            this.ready().options.applyRemoteChanges(changes);
        } finally {
            this.applyingRemote = false;
        }
    }

    /** The store's view of the changed entities, and of every reference if shapes changed. */
    private views(binding: Binding, remote: Changes): RemoteChanges['entities'] {
        const reads: { [C in Collection]: Map<string, SavedEntities[C] | null> } = {
            shapes: new Map(),
            groups: new Map(),
            layers: new Map(),
            components: new Map(),
            links: new Map(),
            rulers: new Map()
        };
        let { structure } = remote;
        const read = <C extends Collection>(collection: C, id: string) => {
            if (reads[collection].has(id)) {
                return;
            }

            const entity = binding.tables[collection].get(id);
            const saved = entity === undefined ? null : validEntity(collection, entity.toJSON());
            const invalid = binding.invalid[collection];
            const wasInvalid = invalid.has(id);

            if (entity !== undefined && saved === null) {
                invalid.add(id);
            } else {
                invalid.delete(id);
            }

            structure ||= invalid.has(id) !== wasInvalid;
            reads[collection].set(id, saved);
        };

        remote.entities.forEach((ids, collection) => ids.forEach((id) => read(collection, id)));

        if (structure) {
            REFERENCING.forEach((collection) =>
                binding.tables[collection].forEach((_, id) => read(collection, id))
            );
            binding.tables.shapes.forEach((shape, id) => {
                if (shape.get('parentShapeId') !== undefined) {
                    read('shapes', id);
                }
            });
        }

        const exists: Exists = (collection, id) =>
            binding.tables[collection].has(id) && !binding.invalid[collection].has(id);
        const viewsOf = <C extends Collection>(collection: C) =>
            Object.fromEntries(
                [...reads[collection]].map(([id, entity]) => [
                    id,
                    entity && withoutDanglingReferences(collection, entity, exists)
                ])
            );

        return {
            shapes: viewsOf('shapes'),
            groups: viewsOf('groups'),
            layers: viewsOf('layers'),
            components: viewsOf('components'),
            links: viewsOf('links'),
            rulers: viewsOf('rulers')
        };
    }
}

export const collaboration = new Collaboration();
