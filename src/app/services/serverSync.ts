import * as Yjs from 'yjs';
import * as Hocuspocus from '@hocuspocus/provider';
import type { Api, ServerRecord, SyncStatus, Transport } from './api';
import type { Collaboration } from './collaboration';

export interface ServerEvents {
    /** The documents this copy holds. */
    documentIds(): string[];
    documentName(documentId: string): string;
    /** A document on the server this copy lacks, with its whole state; false when it cannot be read. */
    opened(documentId: string, update: Uint8Array): boolean;
    /** A document this copy holds was deleted on the server. */
    deleted(documentId: string): void;
    /** A change the server sent to a document this copy holds. */
    received(documentId: string, update: Uint8Array): void;
    /** `status` may have changed. */
    changed(): void;
}

export interface ServerSyncOptions {
    collaboration: Pick<Collaboration, 'receive' | 'state'>;
    api: Api;
    transport: Transport;
    events: ServerEvents;
    record: { load(): ServerRecord; save(record: ServerRecord): void };
}

interface Link {
    doc: Yjs.Doc;
    provider: Hocuspocus.HocuspocusProvider;
    /** Whether this copy holds the document, rather than waiting for its state. */
    held: boolean;
    /** Ends the wait for the document to sync, as when it is closed first. */
    settle(): void;
}

/** How long to wait before trying an unreachable server again, at first and at most. */
const RETRY_FIRST = 1000;
const RETRY_MOST = 30_000;

/** Changes this copy passes to the server, which the link must not pass back. */
const OUTGOING = Symbol('outgoing');

/**
 * Syncs the documents this copy holds with the server; loaded only when signed
 * in, as is the Hocuspocus provider. Each document syncs over one shared socket
 * through a Yjs document of its own that mirrors the shared one, so changes from
 * the server reach the store through `Collaboration.receive`, merged with this
 * copy's as any other copy's are. The server's document list decides which
 * documents exist: documents made here are created on it, those deleted here are
 * deleted on it, and those it lacks after holding them were deleted elsewhere. A
 * document made or deleted while the server cannot be reached is sent later.
 */
export class ServerSync {
    private readonly links = new Map<string, Link>();
    private readonly creations = new Map<string, Promise<void>>();
    /** Documents deleted on this device that the server may still hold. */
    private readonly deletions = new Set<string>();
    /**
     * Documents the server refused or closed, and when to try each again, so one
     * it keeps refusing is asked again ever more rarely rather than at once.
     */
    private readonly refused = new Map<string, number>();
    private socket?: Hocuspocus.HocuspocusProviderWebsocket;
    private connected = false;
    private reachable = true;
    private workspaceId?: string;
    private refreshing?: Promise<void>;
    private refreshAgain = false;
    private retryTimer?: ReturnType<typeof setTimeout>;
    private retryDelay = RETRY_FIRST;

    constructor(private readonly options: ServerSyncOptions) {}

    get status(): SyncStatus {
        const { Disconnected, Connecting } = Hocuspocus.WebSocketStatus;

        if (!this.reachable || this.socket?.status === Disconnected) {
            return 'offline';
        }

        const unsynced = [...this.links.values()].some(({ provider }) => provider.unsyncedChanges);

        return this.refreshing ||
            unsynced ||
            this.creations.size > 0 ||
            this.deletions.size > 0 ||
            this.socket?.status === Connecting
            ? 'syncing'
            : 'synced';
    }

    /**
     * Follows the server's document list: opens the documents this copy lacks,
     * removes those deleted there, and sends what this copy made or deleted.
     * Resolves once the documents it opens have arrived.
     */
    refresh(): Promise<void> {
        if (this.refreshing) {
            this.refreshAgain = true;

            return this.refreshing;
        }

        clearTimeout(this.retryTimer);
        this.retryTimer = undefined;
        this.refreshing = this.follow().finally(() => {
            this.refreshing = undefined;
            this.options.events.changed();

            const held = new Set(this.options.events.documentIds());

            [...this.refused.keys()]
                .filter((documentId) => !held.has(documentId))
                .forEach((documentId) => this.refused.delete(documentId));

            if (!this.reachable || this.refused.size > 0) {
                this.retryLater();
            } else {
                this.retryDelay = RETRY_FIRST;
            }

            if (this.refreshAgain) {
                this.refreshAgain = false;
                void this.refresh();
            }
        });
        this.options.events.changed();

        return this.refreshing;
    }

    /** Creates a document this copy made on the server, then syncs it. */
    created(documentId: string): void {
        void this.create(documentId);
    }

    /** Deletes a document this copy deleted from the server. */
    deleted(documentId: string): void {
        this.unlink(documentId);

        if (!this.creations.has(documentId) && !this.record().known.includes(documentId)) {
            return;
        }

        this.deletions.add(documentId);
        this.change(({ known, deleting }) => ({
            known,
            deleting: [...new Set([...deleting, documentId])]
        }));
        void this.sendDeletion(documentId);
    }

    /** Stops syncing a document another copy on this device deleted. */
    forget(documentId: string): void {
        this.unlink(documentId);
    }

    /** Passes a change to the server: this copy's own, or another copy's on this device. */
    send(documentId: string, update: Uint8Array): void {
        const link = this.links.get(documentId);

        if (link?.held) {
            Yjs.applyUpdate(link.doc, update, OUTGOING);
        }
    }

    dispose(): void {
        clearTimeout(this.retryTimer);
        [...this.links.keys()].forEach((documentId) => this.unlink(documentId));
        this.socket?.destroy();
    }

    /**
     * Refreshes again after a while, waiting longer each time the server still
     * cannot be reached or refuses a document, as while it restarts: its documents
     * close before its socket does, so nothing else would reconnect them.
     */
    private retryLater() {
        if (this.retryTimer || this.refreshing) {
            return;
        }

        this.retryTimer = setTimeout(() => void this.refresh(), this.retryDelay);
        this.retryDelay = Math.min(this.retryDelay * 2, RETRY_MOST);
    }

    private record(): ServerRecord {
        return this.options.record.load();
    }

    /** Changes the record as the device holds it now, as other copies change it too. */
    private change(update: (record: ServerRecord) => ServerRecord) {
        this.options.record.save(update(this.record()));
    }

    private async follow() {
        const { api, events } = this.options;
        let listed: Set<string>;

        try {
            const workspaces = await api.workspaces();
            const lists = await Promise.all(workspaces.map(({ id }) => api.documents(id)));

            listed = new Set(lists.flat().map(({ id }) => id));
            this.workspaceId = workspaces.find(({ kind }) => kind === 'personal')?.id;
            this.reachable = true;
        } catch {
            this.reachable = false;

            return;
        }

        const { known, deleting } = this.record();

        deleting.forEach((documentId) => this.deletions.add(documentId));
        await Promise.all(deleting.map((documentId) => this.sendDeletion(documentId)));

        const held = new Set(events.documentIds());
        const gone = [...held].filter((id) => !listed.has(id) && known.includes(id));

        this.change((record) => ({
            known: [
                ...new Set([
                    ...record.known.filter((id) => !gone.includes(id)),
                    ...[...held].filter((id) => listed.has(id))
                ])
            ],
            deleting: record.deleting
        }));
        gone.forEach((documentId) => {
            this.unlink(documentId);
            events.deleted(documentId);
        });

        const deletedHere = new Set(this.record().deleting);

        await Promise.all([
            ...[...held]
                .filter((id) => !gone.includes(id))
                .map((id) => (listed.has(id) ? this.link(id, true) : this.create(id))),
            ...[...listed]
                .filter((id) => !held.has(id) && !deletedHere.has(id))
                .map((id) => this.link(id, false))
        ]);
    }

    private create(documentId: string): Promise<void> {
        const workspaceId = this.workspaceId;
        const pending = this.creations.get(documentId);

        if (pending) {
            return pending;
        }

        // Before the first refresh, which creates what this copy holds.
        if (!workspaceId) {
            return Promise.resolve();
        }

        const creation = this.options.api
            .createDocument(workspaceId, {
                id: documentId,
                name: this.options.events.documentName(documentId)
            })
            .then(
                (created) => {
                    this.reachable = true;

                    if (!created) {
                        console.warn(`Document ${documentId} is kept only in this browser`);

                        return;
                    }

                    this.change(({ known, deleting }) => ({
                        known: [...new Set([...known, documentId])],
                        deleting
                    }));

                    if (this.options.events.documentIds().includes(documentId)) {
                        return this.link(documentId, true);
                    }
                },
                () => {
                    this.reachable = false;
                    this.retryLater();
                }
            )
            .finally(() => {
                this.creations.delete(documentId);
                this.options.events.changed();
            });

        this.creations.set(documentId, creation);
        this.options.events.changed();

        return creation;
    }

    private async sendDeletion(documentId: string) {
        // A creation still on its way would bring the document back.
        await this.creations.get(documentId);

        try {
            await this.options.api.deleteDocument(documentId);
            this.reachable = true;
            this.deletions.delete(documentId);
            this.change(({ known, deleting }) => ({
                known: known.filter((id) => id !== documentId),
                deleting: deleting.filter((id) => id !== documentId)
            }));
        } catch {
            this.reachable = false;
            this.retryLater();
        }

        this.options.events.changed();
    }

    /**
     * Syncs a document: one this copy `held` from its whole state, or one it lacks
     * once the server has sent it. Resolves once it syncs or is refused.
     */
    private link(documentId: string, held: boolean): Promise<void> {
        if (this.links.has(documentId) || (this.refused.get(documentId) ?? 0) > Date.now()) {
            return Promise.resolve();
        }

        const { collaboration, events } = this.options;
        const doc = new Yjs.Doc();

        if (held) {
            Yjs.applyUpdate(doc, collaboration.state(documentId), OUTGOING);
        }

        return new Promise((settle) => {
            const provider = new Hocuspocus.HocuspocusProvider({
                websocketProvider: this.connect(),
                name: documentId,
                document: doc,
                awareness: null,
                onSynced: () => {
                    this.refused.delete(documentId);

                    if (!link.held) {
                        this.arrived(link, documentId);
                    }

                    settle();
                },
                onUnsyncedChanges: () => events.changed(),
                onClose: () => {
                    // The server closed this document alone, as when it was deleted.
                    if (
                        this.links.get(documentId) === link &&
                        this.socket?.status === Hocuspocus.WebSocketStatus.Connected
                    ) {
                        this.leave(documentId);
                    }
                },
                // It may have been deleted, or not be created yet.
                onAuthenticationFailed: () => this.leave(documentId)
            });
            const link: Link = { doc, provider, held, settle };

            doc.on('update', (update: Uint8Array, origin: unknown) => {
                if (origin !== OUTGOING && link.held) {
                    collaboration.receive(documentId, update);
                    events.received(documentId, update);
                }
            });
            this.links.set(documentId, link);
            provider.attach();
        });
    }

    /** Stops syncing a document the server refused or closed, and finds out why. */
    private leave(documentId: string) {
        this.unlink(documentId, true);
        this.refused.set(documentId, Date.now() + this.retryDelay);
        void this.refresh();
    }

    /** Opens a document the server sent, which this copy lacked. */
    private arrived(link: Link, documentId: string) {
        link.held = this.options.events.opened(documentId, Yjs.encodeStateAsUpdate(link.doc));

        if (!link.held) {
            this.unlink(documentId);

            return;
        }

        this.change(({ known, deleting }) => ({
            known: [...new Set([...known, documentId])],
            deleting
        }));
    }

    /**
     * Stops syncing a document. One the server `closed` is not told to close: it
     * would keep that message as the start of a new connection and close the next.
     */
    private unlink(documentId: string, closed = false) {
        const link = this.links.get(documentId);

        if (!link) {
            return;
        }

        this.links.delete(documentId);
        link.settle();

        if (closed) {
            this.socket?.configuration.providerMap.delete(documentId);
        }

        link.provider.destroy();
        link.doc.destroy();
        this.options.events.changed();
    }

    /** The socket documents share, opened with the first. */
    private connect(): Hocuspocus.HocuspocusProviderWebsocket {
        this.socket ??= new Hocuspocus.HocuspocusProviderWebsocket({
            ...this.options.transport,
            onStatus: () => this.options.events.changed(),
            onConnect: () => {
                // Once connected again, what changed meanwhile is picked up.
                if (this.connected) {
                    void this.refresh();
                }

                this.connected = true;
            }
        });

        return this.socket;
    }
}
