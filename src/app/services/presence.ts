import type { Context } from 'src/app';
import type { Point } from '../types';

/**
 * What this copy tells the others with a document open, through the sync
 * connection's awareness: where its pointer is on the canvas, in canvas
 * coordinates, and which shapes it has selected. A copy showing another document
 * shares neither. The server adds who it is, so nobody can claim another's name.
 */
export interface LocalPresence {
    pointer?: Point;
    selection?: string[];
}

/** Another person with the document open, as the server named them. */
export interface Peer {
    /** The copy's own id in the document's awareness, as one person may have several. */
    clientId: number;
    userId: string;
    name: string;
    color: string;
    pointer?: Point;
    selection: string[];
}

/** How often this copy shares its pointer at most, in milliseconds. */
export const PRESENCE_INTERVAL = 50;

/** The most selected shapes shared; the server keeps no more either. */
export const MAX_SHARED_SELECTION = 500;

/** Colors told apart from each other and from the editor's own selection blue. */
const PEER_COLORS = [
    '#d6336c',
    '#e8590c',
    '#2b8a3e',
    '#7048e8',
    '#c2255c',
    '#0c8599',
    '#9c36b5',
    '#a61e4d'
];

/** A person's color, the same on every copy and in every document. */
export function peerColor(userId: string): string {
    let hash = 0;

    for (let index = 0; index < userId.length; index++) {
        hash = (Math.imul(hash, 31) + userId.charCodeAt(index)) | 0;
    }

    return PEER_COLORS[Math.abs(hash) % PEER_COLORS.length];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const readPoint = (value: unknown): Point | undefined =>
    isRecord(value) && Number.isFinite(value.x) && Number.isFinite(value.y)
        ? { x: value.x as number, y: value.y as number }
        : undefined;

/**
 * The people other than `self` with a document open, read from its awareness
 * states. A state without the server's `user` came from no person and is left out,
 * as is one that shares nothing, from a copy showing another document.
 */
export function readPeers(states: Map<number, unknown>, ownClientId: number, self: string): Peer[] {
    const peers: Peer[] = [];

    states.forEach((state, clientId) => {
        if (clientId === ownClientId || !isRecord(state) || !isRecord(state.user)) {
            return;
        }

        const { id, name } = state.user;

        if (typeof id !== 'string' || id === self || typeof name !== 'string') {
            return;
        }

        const pointer = readPoint(state.pointer);
        const selection = Array.isArray(state.selection)
            ? state.selection
                  .filter((shapeId): shapeId is string => typeof shapeId === 'string')
                  .slice(0, MAX_SHARED_SELECTION)
            : [];

        if (!pointer && selection.length === 0) {
            return;
        }

        peers.push({
            clientId,
            userId: id,
            name: name.trim() || 'Someone',
            color: peerColor(id),
            pointer,
            selection
        });
    });

    return peers.sort((a, b) => a.name.localeCompare(b.name) || a.clientId - b.clientId);
}

const NOBODY: Peer[] = [];
const peersByDocument = new Map<string, Peer[]>();
const listeners = new Set<() => void>();

/** Who else has each document open; outside the store, so pointers moving re-render only presence. */
export const presence = {
    peers(documentId: string): Peer[] {
        return peersByDocument.get(documentId) ?? NOBODY;
    },
    set(documentId: string, peers: Peer[]) {
        if (peers.length === 0 && !peersByDocument.has(documentId)) {
            return;
        }

        if (peers.length === 0) {
            peersByDocument.delete(documentId);
        } else {
            peersByDocument.set(documentId, peers);
        }

        listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
        listeners.add(listener);

        return () => {
            listeners.delete(listener);
        };
    },
    clear() {
        peersByDocument.clear();
        listeners.forEach((listener) => listener());
    }
};

/** What `followPresence` shares through. */
export interface PresenceTarget {
    present(documentId: string | undefined, local: LocalPresence): void;
}

type Instance = Pick<Context, 'state' | 'addMutationListener'>;

/** What this copy shows of the current document: the pointer over the canvas and the selection. */
export function localPresence({ state }: Pick<Instance, 'state'>): LocalPresence {
    const document = state.documents[state.currentDocumentId];
    const { inside, current } = state.events.pointer;
    const local: LocalPresence = {};

    // Elsewhere, as on the Documents page, the canvas and its selection are not shown.
    if (state.currentPage !== 'designer') {
        return local;
    }

    if (inside && Number.isFinite(current.x) && Number.isFinite(current.y)) {
        local.pointer = { x: current.x, y: current.y };
    }

    if (document && document.shapeSelection.length > 0) {
        local.selection = document.shapeSelection.slice(0, MAX_SHARED_SELECTION);
    }

    return local;
}

const sharesPresence = (path: string[]) =>
    path[0] === 'currentDocumentId' ||
    path[0] === 'currentPage' ||
    (path[0] === 'events' &&
        path[1] === 'pointer' &&
        (path[2] === 'current' || path[2] === 'inside')) ||
    (path[0] === 'documents' && path[2] === 'shapeSelection');

/**
 * Shares this copy's pointer and selection as they change, at most every
 * `PRESENCE_INTERVAL` milliseconds, and once the page is hidden, no pointer.
 * Returns what stops it.
 */
export function followPresence(instance: Instance, target: PresenceTarget): () => void {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = 0;

    const share = () => {
        timer = undefined;
        last = Date.now();

        const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
        const local = localPresence(instance);

        if (hidden) {
            delete local.pointer;
        }

        target.present(instance.state.currentDocumentId, local);
    };

    const schedule = () => {
        if (timer === undefined) {
            timer = setTimeout(share, Math.max(0, last + PRESENCE_INTERVAL - Date.now()));
        }
    };

    const stop = instance.addMutationListener(({ path, delimiter }) => {
        if (sharesPresence(path.split(delimiter))) {
            schedule();
        }
    });
    const visibility = () => schedule();

    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', visibility);
    }

    share();

    return () => {
        clearTimeout(timer);
        stop();

        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', visibility);
        }
    };
}
