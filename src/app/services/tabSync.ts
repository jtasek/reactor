import { v4 as newId } from 'uuid';
import type { Collaboration } from './collaboration';

/** What tab sync uses of a BroadcastChannel. */
export interface Channel {
    postMessage(message: unknown): void;
    onmessage: ((event: MessageEvent) => void) | null;
    close(): void;
}

/** What to do when another copy creates or deletes a document. */
export interface DocumentEvents {
    /** Another copy created a document; `update` is its whole state. */
    created(documentId: string, update: Uint8Array): void;
    deleted(documentId: string): void;
}

type Message =
    | { type: 'update'; documentId: string; update: Uint8Array; to?: string }
    | { type: 'sync'; documentId: string; stateVector: Uint8Array; from: string; reply: boolean }
    | { type: 'document'; documentId: string; update: Uint8Array }
    | { type: 'deleted'; documentId: string };

/** Whether `data` is a message this build understands; other builds may send others. */
function isMessage(data: unknown): data is Message {
    if (typeof data !== 'object' || data === null) {
        return false;
    }

    const field = (name: string): unknown => Reflect.get(data, name);

    if (typeof field('documentId') !== 'string') {
        return false;
    }

    switch (field('type')) {
        case 'update':
            return (
                field('update') instanceof Uint8Array &&
                (field('to') === undefined || typeof field('to') === 'string')
            );
        case 'sync':
            return (
                field('stateVector') instanceof Uint8Array &&
                typeof field('from') === 'string' &&
                typeof field('reply') === 'boolean'
            );
        case 'document':
            return field('update') instanceof Uint8Array;
        case 'deleted':
            return true;
        default:
            return false;
    }
}

/**
 * Shares this copy's changes with the other copies of the editor open on this
 * device, and the documents it creates and deletes. A copy that missed messages, as
 * while frozen in the background or kept in the back/forward cache, catches up: it
 * sends what it has seen of each document, and the others send back what it lacks
 * and ask for what they lack in turn.
 */
export class TabSync {
    private readonly id = newId();

    constructor(
        private readonly collaboration: Pick<
            Collaboration,
            'receive' | 'documentIds' | 'stateVector' | 'missing' | 'state'
        >,
        private readonly channel: Channel,
        private readonly documents: DocumentEvents = { created: () => {}, deleted: () => {} }
    ) {
        channel.onmessage = ({ data }) => this.handle(data);
    }

    /** Shares a change this copy made. */
    send(documentId: string, update: Uint8Array): void {
        this.channel.postMessage({ type: 'update', documentId, update });
    }

    /** Shares a document this copy created, with its whole state. */
    sendDocument(documentId: string, update = this.collaboration.state(documentId)): void {
        this.channel.postMessage({ type: 'document', documentId, update });
    }

    /** Tells the other copies this copy deleted a document. */
    sendDeleted(documentId: string): void {
        this.channel.postMessage({ type: 'deleted', documentId });
    }

    /** Asks the other copies for what this copy lacks of each shared document. */
    catchUp(): void {
        this.collaboration.documentIds().forEach((documentId) => this.ask(documentId, true));
    }

    /**
     * Runs `shown`, by default catching up, whenever the page is shown again;
     * returns a function that stops.
     */
    listen(
        page: Pick<Window, 'addEventListener' | 'removeEventListener' | 'document'>,
        shown: () => void = () => this.catchUp()
    ) {
        const restored = (event: PageTransitionEvent) => {
            if (event.persisted) {
                shown();
            }
        };
        const visible = () => {
            if (page.document.visibilityState === 'visible') {
                shown();
            }
        };

        page.addEventListener('pageshow', restored);
        page.document.addEventListener('visibilitychange', visible);

        return () => {
            page.removeEventListener('pageshow', restored);
            page.document.removeEventListener('visibilitychange', visible);
        };
    }

    close(): void {
        this.channel.close();
    }

    private handle(data: unknown) {
        if (!isMessage(data)) {
            return;
        }

        const open = this.collaboration.documentIds().includes(data.documentId);

        if (data.type === 'document' && !open) {
            this.documents.created(data.documentId, data.update);

            return;
        }

        if (!open) {
            return;
        }

        switch (data.type) {
            case 'deleted':
                this.documents.deleted(data.documentId);

                return;
            case 'document':
                this.collaboration.receive(data.documentId, data.update);

                return;
            case 'update':
                if (data.to === undefined || data.to === this.id) {
                    this.collaboration.receive(data.documentId, data.update);
                }

                return;
            case 'sync':
                this.answer(data.documentId, data.stateVector, data.from, data.reply);
        }
    }

    private answer(documentId: string, stateVector: Uint8Array, to: string, reply: boolean) {
        this.channel.postMessage({
            type: 'update',
            documentId,
            update: this.collaboration.missing(documentId, stateVector),
            to
        });

        if (reply) {
            this.ask(documentId, false);
        }
    }

    private ask(documentId: string, reply: boolean) {
        this.channel.postMessage({
            type: 'sync',
            documentId,
            stateVector: this.collaboration.stateVector(documentId),
            from: this.id,
            reply
        });
    }
}

/** The channel open copies of the editor on this device share, signed out or in `name`'s account. */
export const openChannel = (name = 'reactor'): Channel => new BroadcastChannel(name);
