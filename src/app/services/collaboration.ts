import { json } from 'overmind';
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

/** A view of an entity or of the document's fields, and which of its fields the store lacks. */
export interface ViewChange<T> {
    view: T;
    changed: string[];
}

/** Each collection's entities that change, by id; `null` removes an entity. */
export type EntityChanges = {
    [C in Collection]: Record<string, ViewChange<SavedEntities[C]> | null>;
};

/** Changes that bring the store in line with the shared document. */
export interface RemoteChanges {
    documentId: string;
    fields?: ViewChange<DocumentFields>;
    entities: EntityChanges;
}

interface Mutation {
    path: string;
    delimiter: string;
    hasChangedValue: boolean;
}

export interface CollaborationOptions {
    /** The store's document, whose changes are shared. */
    getDocument(documentId: string): Document | undefined;
    /** Applies changes from the shared document, as one action. */
    applyRemoteChanges(changes: RemoteChanges): void;
    /** Reports every store mutation, to find the changes this copy makes. */
    addMutationListener(listener: (mutation: Mutation) => void): () => void;
    /** Sends this copy's changes to the other copies. */
    sendUpdate?(documentId: string, update: Uint8Array): void;
}

type YEntity = Yjs.Map<unknown>;
type Views = { [C in Collection]: Map<string, SavedEntities[C]> };
type Reads = { [C in Collection]: Map<string, SavedEntities[C] | null> };

interface Changes {
    fields: boolean;
    entities: Map<Collection, Set<string>>;
    /** Shapes and components that appeared, disappeared or changed validity. */
    referenced: Set<string>;
}

interface Binding {
    doc: Yjs.Doc;
    fields: Yjs.Map<unknown>;
    tables: Record<Collection, Yjs.Map<unknown>>;
    /** Store changes not yet written to the shared document. */
    local: Changes;
    /** Shared changes not yet applied to the store. */
    remote: Changes;
    /**
     * What the store holds of each shared entity and of the document's fields, in
     * durable form: writes send only what differs from it, and reads apply only what
     * differs from it.
     */
    views: Views;
    fieldsView?: DocumentFields;
    /** Entities left out of the store because they failed validation. */
    invalid: Record<Collection, Set<string>>;
    /** The store's documents were replaced, so the shared document is applied again. */
    replaced: boolean;
}

const LOCAL = Symbol('local change');
const MEMBERS = 'shapesIds';
const isLocalOnly = (field: string) =>
    RUNTIME_FIELDS.has(field) || field === 'camera' || field === 'shapesIds';
/** Collections whose shared form can differ from what this copy wrote, as by members it hides. */
const REFERRING = new Set<Collection>(['groups', 'layers', 'components', 'links']);
/** Collections other entities refer to. */
const REFERABLE = new Set<Collection>(['shapes', 'components']);

const isCollection = (value: string): value is Collection =>
    COLLECTIONS.some((collection) => collection === value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isEmpty = (value: object | undefined) => !value || Object.keys(value).length === 0;

const perCollection = <T>(create: (collection: Collection) => T) =>
    Object.fromEntries(COLLECTIONS.map((collection) => [collection, create(collection)])) as Record<
        Collection,
        T
    >;

const noChanges = (): Changes => ({ fields: false, entities: new Map(), referenced: new Set() });

const touch = (changes: Changes, collection: Collection, id: string) => {
    const ids = changes.entities.get(collection) ?? new Set<string>();

    ids.add(id);
    changes.entities.set(collection, ids);
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The fields that differ between two durable values. */
const changedFields = (previous: object, next: object) =>
    [...new Set([...Object.keys(previous), ...Object.keys(next)])].filter(
        (key) => !same(Reflect.get(previous, key), Reflect.get(next, key))
    );

/** What `read` returns, or null when it finds the value invalid. */
function valid<T>(read: () => T): T | null {
    try {
        return read();
    } catch {
        return null;
    }
}

/** Removes the members `previous` has and `next` lacks, wherever they are, and appends new ones. */
function writeMembers(members: Yjs.Array<unknown>, next: string[], previous: unknown[]) {
    const items = members.toArray();
    const known = new Set(previous);
    const kept = new Set<unknown>(next);

    for (let index = items.length - 1; index >= 0; index--) {
        if (known.has(items[index]) && !kept.has(items[index])) {
            members.delete(index);
        }
    }

    const present = new Set(items);
    const added = next.filter((id) => !known.has(id) && !present.has(id));

    if (added.length > 0) {
        members.push(added);
    }
}

/**
 * Shares documents between copies of the editor through Yjs, which it loads on
 * `initialize`. The store stays the app's state: this copy's changes are written to
 * the Yjs document once the task's actions end, and the shared document's changes
 * reach the store through `applyRemoteChanges`. Every copy shows the same merged
 * content: entities that fail validation are left out, and references to missing
 * shapes and components are dropped as deleting them would, without writing these
 * repairs back. Objects merge field by field and member lists member by member.
 */
export class Collaboration {
    private yjs?: typeof Yjs;
    private options?: CollaborationOptions;
    private stopListening?: () => void;
    private readonly bindings = new Map<string, Binding>();
    private applyingRemote = false;
    private flushQueued = false;
    private paused = false;

    async initialize(options: CollaborationOptions): Promise<void> {
        this.yjs = await import('yjs');
        this.options = options;
        this.stopListening = options.addMutationListener((mutation) => this.record(mutation));
    }

    /**
     * Starts sharing a document the store holds. With `update`, a state saved or
     * sent by another copy, the store's document is brought in line with it;
     * without, the store's document is the starting state. A document already
     * shared keeps its Yjs document, and `update` is merged into it.
     */
    open(documentId: string, update?: Uint8Array): void {
        const { yjs, options } = this.ready();

        if (!options.getDocument(documentId)) {
            throw new Error(`Document ${documentId} is not in the store`);
        }

        if (this.bindings.has(documentId)) {
            if (update) {
                this.receive(documentId, update);
            }

            return;
        }

        const doc = new yjs.Doc();
        const binding: Binding = {
            doc,
            fields: doc.getMap('document'),
            tables: perCollection((collection) => doc.getMap(collection)),
            local: noChanges(),
            remote: noChanges(),
            views: perCollection(() => new Map()),
            invalid: perCollection(() => new Set()),
            replaced: false
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
        this.write(documentId, binding);
    }

    /**
     * Applies an update another copy sent. This copy's pending changes are written
     * first, even when paused, so the update merges with them.
     */
    receive(documentId: string, update: Uint8Array): void {
        const binding = this.bindings.get(documentId);

        if (!binding) {
            return;
        }

        this.catchUp(documentId, binding);
        this.write(documentId, binding);
        this.ready().yjs.applyUpdate(binding.doc, update);
    }

    /** Ids of the documents shared here. */
    documentIds(): string[] {
        return [...this.bindings.keys()];
    }

    /** What this copy has seen of a document, so another copy can send what it lacks. */
    stateVector(documentId: string): Uint8Array {
        return this.ready().yjs.encodeStateVector(this.bindingOf(documentId).doc);
    }

    /**
     * What a copy that has seen `stateVector` lacks of a document. Changes held by
     * `pause` are left out until `resume`.
     */
    missing(documentId: string, stateVector: Uint8Array): Uint8Array {
        const binding = this.bindingOf(documentId);

        this.flush();

        return this.ready().yjs.encodeStateAsUpdate(binding.doc, stateVector);
    }

    /**
     * The document's whole state, to start another copy or to save. Changes held
     * by `pause` are left out until `resume`.
     */
    state(documentId: string): Uint8Array {
        const binding = this.bindingOf(documentId);

        this.flush();

        return this.ready().yjs.encodeStateAsUpdate(binding.doc);
    }

    /** Stops sharing a document, after writing its pending changes. */
    close(documentId: string): void {
        const binding = this.bindings.get(documentId);

        if (!binding) {
            return;
        }

        this.write(documentId, binding);
        binding.doc.destroy();
        this.bindings.delete(documentId);
    }

    dispose(): void {
        this.stopListening?.();
        [...this.bindings.keys()].forEach((documentId) => this.close(documentId));
    }

    /**
     * Holds this copy's changes, as during a drag, so its result is shared rather
     * than every step. An update received meanwhile still merges with them.
     */
    pause(): void {
        this.paused = true;
    }

    /** Shares the changes held since `pause`. */
    resume(): void {
        this.paused = false;
        this.queueFlush();
    }

    /** Writes this copy's pending changes, one Yjs transaction per document, unless paused. */
    flush(): void {
        this.flushQueued = false;

        for (const [documentId, binding] of this.bindings) {
            this.catchUp(documentId, binding);

            if (!this.paused) {
                this.write(documentId, binding);
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

    private bindingOf(documentId: string): Binding {
        const binding = this.bindings.get(documentId);

        if (!binding) {
            throw new Error(`Document ${documentId} is not shared`);
        }

        return binding;
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
            this.bindings.forEach((binding) => {
                binding.replaced = true;
                binding.local = noChanges();
            });
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

        if (entityField !== undefined && RUNTIME_FIELDS.has(entityField)) {
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

        for (const collection of COLLECTIONS) {
            this.idsOf(documentId, binding, collection).forEach((id) =>
                touch(changes, collection, id)
            );
        }
    }

    /** Applies the shared document again to a store document that was replaced, as by a save. */
    private catchUp(documentId: string, binding: Binding) {
        if (!binding.replaced) {
            return;
        }

        binding.replaced = false;
        binding.views = perCollection(() => new Map());
        binding.fieldsView = undefined;
        this.everything(documentId, binding, binding.remote);
        this.applyRemote(documentId, binding);
    }

    /** Writes the store's pending changes to the shared document, in one transaction. */
    private write(documentId: string, binding: Binding) {
        const { local } = binding;

        if (!local.fields && local.entities.size === 0) {
            return;
        }

        binding.local = noChanges();

        const document = this.ready().options.getDocument(documentId);

        if (!document) {
            return;
        }

        binding.doc.transact(() => {
            if (local.fields) {
                const fields = readDocumentFields(document);

                this.writeValues(binding.fields, fields, binding.fieldsView);
                binding.fieldsView = fields;
            }

            local.entities.forEach((ids, collection) =>
                ids.forEach((id) => this.writeEntity(binding, document, collection, id))
            );
        }, LOCAL);
    }

    private writeEntity<C extends Collection>(
        binding: Binding,
        document: Document,
        collection: C,
        id: string
    ) {
        const table = binding.tables[collection];
        const views = binding.views[collection];
        const entities: Record<string, unknown> = document[collection];
        const previous = views.get(id);

        if (!Object.hasOwn(entities, id)) {
            // Entities the store leaves out, as invalid or referring to a missing shape, stay shared.
            if (previous) {
                table.delete(id);
                views.delete(id);
            }

            return;
        }

        const values = readEntity(collection, json(entities[id]));

        this.writeValues(this.entityOf(table, id), values, previous);
        views.set(id, values);

        if (binding.invalid[collection].delete(id)) {
            binding.remote.referenced.add(id);
        }

        if (REFERRING.has(collection)) {
            touch(binding.remote, collection, id);
        }
    }

    private entityOf(table: Yjs.Map<unknown>, id: string): YEntity {
        const { yjs } = this.ready();
        const existing = table.get(id);

        if (existing instanceof yjs.Map) {
            return existing;
        }

        const created = new yjs.Map<unknown>();

        table.set(id, created);

        return created;
    }

    /**
     * Writes the fields of `values` that differ from `previous`, the last state this
     * copy knew: objects field by field and member lists by the members added and
     * removed, so other copies' edits to other parts survive, as do members this
     * copy does not show.
     */
    private writeValues(
        target: Yjs.Map<unknown>,
        values: object,
        previous: object = target.toJSON()
    ) {
        const { yjs } = this.ready();

        for (const key of new Set([...Object.keys(previous), ...Object.keys(values)])) {
            const value: unknown = Reflect.get(values, key);
            const before: unknown = Reflect.get(previous, key);

            if (same(before, value)) {
                continue;
            }

            if (value === undefined) {
                target.delete(key);
                continue;
            }

            const current = target.get(key);

            if (key === MEMBERS && Array.isArray(value) && current instanceof yjs.Array) {
                writeMembers(current, value, Array.isArray(before) ? before : current.toArray());
                continue;
            }

            if (isRecord(value) && current instanceof yjs.Map) {
                this.writeValues(current, value, isRecord(before) ? before : current.toJSON());
                continue;
            }

            target.set(key, this.shared(key, value));
        }
    }

    /** A value as the shared document holds it: objects as maps and member lists as arrays. */
    private shared(key: string, value: unknown): unknown {
        const { yjs } = this.ready();

        if (key === MEMBERS && Array.isArray(value)) {
            return yjs.Array.from(value);
        }

        if (isRecord(value)) {
            return new yjs.Map(
                Object.entries(value).map(([field, item]) => [field, this.shared(field, item)])
            );
        }

        return value;
    }

    private observe(documentId: string, binding: Binding) {
        binding.fields.observeDeep((_events, transaction) => {
            binding.remote.fields ||= transaction.origin !== LOCAL;
        });

        for (const collection of COLLECTIONS) {
            const table = binding.tables[collection];
            const referable = REFERABLE.has(collection);

            table.observeDeep((events, transaction) => {
                const local = transaction.origin === LOCAL;

                for (const event of events) {
                    if (event.target !== table) {
                        if (!local) {
                            touch(binding.remote, collection, String(event.path[0]));
                        }

                        continue;
                    }

                    for (const [id, { action }] of event.changes.keys) {
                        // Nothing refers to a shape this copy just added.
                        if (referable && (!local || action !== 'add')) {
                            binding.remote.referenced.add(id);
                        }

                        if (!local) {
                            touch(binding.remote, collection, id);
                        }
                    }
                }
            });
        }

        binding.doc.on('afterTransaction', () => this.applyRemote(documentId, binding));
        binding.doc.on('update', (update: Uint8Array, origin: unknown) => {
            if (origin === LOCAL) {
                this.ready().options.sendUpdate?.(documentId, update);
            }
        });
    }

    private applyRemote(documentId: string, binding: Binding) {
        const { remote } = binding;

        if (!remote.fields && remote.entities.size === 0 && remote.referenced.size === 0) {
            return;
        }

        const { options } = this.ready();
        const document = options.getDocument(documentId);

        if (!document) {
            return;
        }

        binding.remote = noChanges();

        const fields = remote.fields ? this.fieldsChange(documentId, binding, document) : undefined;
        const entities = this.entityChanges(binding, document, remote);

        if (!fields && Object.values(entities).every((changes) => isEmpty(changes))) {
            return;
        }

        this.applyingRemote = true;

        try {
            options.applyRemoteChanges({ documentId, fields, entities });
        } finally {
            this.applyingRemote = false;
        }
    }

    private fieldsChange(
        documentId: string,
        binding: Binding,
        document: Document
    ): ViewChange<DocumentFields> | undefined {
        const view = valid(() => readDocumentFields(binding.fields.toJSON()));

        if (!view || view.id !== documentId) {
            return undefined;
        }

        const changed = changedFields(binding.fieldsView ?? readDocumentFields(document), view);

        binding.fieldsView = view;

        return changed.length > 0 ? { view, changed } : undefined;
    }

    /** Changes for the entities read, and for every entity referring to one that came or went. */
    private entityChanges(binding: Binding, document: Document, remote: Changes): EntityChanges {
        const { yjs } = this.ready();
        const reads: Reads = perCollection(() => new Map());
        const referenced = new Set(remote.referenced);
        const read = <C extends Collection>(collection: C, id: string) => {
            if (reads[collection].has(id)) {
                return;
            }

            const entity = binding.tables[collection].get(id);
            const saved =
                entity instanceof yjs.Map
                    ? valid(() => readEntity(collection, entity.toJSON()))
                    : null;
            const view = saved?.id === id ? saved : null;
            const invalid = binding.invalid[collection];
            const wasInvalid = invalid.has(id);

            if (entity !== undefined && view === null) {
                invalid.add(id);
            } else {
                invalid.delete(id);
            }

            if (invalid.has(id) !== wasInvalid && REFERABLE.has(collection)) {
                referenced.add(id);
            }

            reads[collection].set(id, view);
        };

        remote.entities.forEach((ids, collection) => ids.forEach((id) => read(collection, id)));
        this.referrers(binding, referenced).forEach(([collection, id]) => read(collection, id));

        const exists: Exists = (collection, id) =>
            binding.tables[collection].has(id) && !binding.invalid[collection].has(id);

        return perCollection((collection) =>
            this.changesOf(binding, document, collection, reads[collection], exists)
        ) as EntityChanges;
    }

    /** Entities whose members, parent or link ends include one of `ids`. */
    private referrers(binding: Binding, ids: Set<string>): Array<[Collection, string]> {
        if (ids.size === 0) {
            return [];
        }

        const { yjs } = this.ready();
        const refers = (value: unknown) => typeof value === 'string' && ids.has(value);
        const members = (entity: YEntity) => {
            const list = entity.get(MEMBERS);

            if (list instanceof yjs.Array) {
                return list.toArray().some(refers);
            }

            return Array.isArray(list) && list.some(refers);
        };
        const tests: Partial<Record<Collection, (entity: YEntity) => boolean>> = {
            shapes: (entity) => refers(entity.get('parentShapeId')),
            groups: members,
            layers: members,
            components: (entity) => members(entity) || refers(entity.get('parentId')),
            links: (entity) => refers(entity.get('source')) || refers(entity.get('target'))
        };
        const found: Array<[Collection, string]> = [];

        for (const collection of COLLECTIONS) {
            const test = tests[collection];

            if (!test) {
                continue;
            }

            binding.tables[collection].forEach((entity, id) => {
                if (entity instanceof yjs.Map && test(entity)) {
                    found.push([collection, id]);
                }
            });
        }

        return found;
    }

    /** How the store's entities differ from their views, which then become what the store holds. */
    private changesOf<C extends Collection>(
        binding: Binding,
        document: Document,
        collection: C,
        reads: Reads[C],
        exists: Exists
    ): Record<string, ViewChange<SavedEntities[C]> | null> {
        const views = binding.views[collection];
        const stored: Record<string, unknown> = document[collection];
        const changes: Record<string, ViewChange<SavedEntities[C]> | null> = {};

        for (const [id, saved] of reads) {
            const view = saved && withoutDanglingReferences(collection, saved, exists);
            const inStore = Object.hasOwn(stored, id);

            if (!view) {
                views.delete(id);

                if (inStore) {
                    changes[id] = null;
                }

                continue;
            }

            const previous =
                views.get(id) ?? (inStore ? readEntity(collection, json(stored[id])) : undefined);
            const changed = previous ? changedFields(previous, view) : Object.keys(view);

            views.set(id, view);

            if (changed.length > 0) {
                changes[id] = { view, changed };
            }
        }

        return changes;
    }
}

export const collaboration = new Collaboration();
