import { v4 as newId } from 'uuid';
import type { Collaboration } from './collaboration';

/** What tab sync uses of a BroadcastChannel. */
export interface Channel {
    postMessage(message: unknown): void;
    onmessage: ((event: MessageEvent) => void) | null;
    close(): void;
}

type Message =
    | { type: 'update'; documentId: string; update: Uint8Array; to?: string }
    | { type: 'sync'; documentId: string; stateVector: Uint8Array; from: string; reply: boolean };

/** Whether `data` is a message this build understands; other builds may send others. */
function isMessage(data: unknown): data is Message {
    if (typeof data !== 'object' || data === null) {
        return false;
    }

    const field = (name: string): unknown => Reflect.get(data, name);

    if (typeof field('documentId') !== 'string') {
        return false;
    }

    if (field('type') === 'update') {
        return (
            field('update') instanceof Uint8Array &&
            (field('to') === undefined || typeof field('to') === 'string')
        );
    }

    return (
        field('type') === 'sync' &&
        field('stateVector') instanceof Uint8Array &&
        typeof field('from') === 'string' &&
        typeof field('reply') === 'boolean'
    );
}

/**
 * Shares this copy's changes with the other copies of the editor open on this
 * device. A copy that missed messages, as while frozen in the background or kept in
 * the back/forward cache, catches up: it sends what it has seen of each document,
 * and the others send back what it lacks and ask for what they lack in turn.
 */
export class TabSync {
    private readonly id = newId();

    constructor(
        private readonly collaboration: Pick<
            Collaboration,
            'receive' | 'documentIds' | 'stateVector' | 'missing'
        >,
        private readonly channel: Channel
    ) {
        channel.onmessage = ({ data }) => this.handle(data);
    }

    /** Shares a change this copy made. */
    send(documentId: string, update: Uint8Array): void {
        this.channel.postMessage({ type: 'update', documentId, update });
    }

    /** Asks the other copies for what this copy lacks of each shared document. */
    catchUp(): void {
        this.collaboration.documentIds().forEach((documentId) => this.ask(documentId, true));
    }

    /** Catches up whenever the page is shown again; returns a function that stops. */
    listen(page: Pick<Window, 'addEventListener' | 'removeEventListener' | 'document'>) {
        const shown = (event: PageTransitionEvent) => {
            if (event.persisted) {
                this.catchUp();
            }
        };
        const visible = () => {
            if (page.document.visibilityState === 'visible') {
                this.catchUp();
            }
        };

        page.addEventListener('pageshow', shown);
        page.document.addEventListener('visibilitychange', visible);

        return () => {
            page.removeEventListener('pageshow', shown);
            page.document.removeEventListener('visibilitychange', visible);
        };
    }

    close(): void {
        this.channel.close();
    }

    private handle(data: unknown) {
        if (!isMessage(data) || !this.collaboration.documentIds().includes(data.documentId)) {
            return;
        }

        if (data.type === 'update') {
            if (data.to === undefined || data.to === this.id) {
                this.collaboration.receive(data.documentId, data.update);
            }

            return;
        }

        this.channel.postMessage({
            type: 'update',
            documentId: data.documentId,
            update: this.collaboration.missing(data.documentId, data.stateVector),
            to: data.from
        });

        if (data.reply) {
            this.ask(data.documentId, false);
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
