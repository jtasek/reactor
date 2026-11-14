import type { Connection, Document } from '@hocuspocus/server';

/** Who a sync connection belongs to, as the session named them when it opened. */
export interface PresenceUser {
    userId: string;
    name?: string;
}

/** The most selected shapes one copy shares; the editor sends no more either. */
const MAX_SELECTION = 500;

/** The longest shape id kept; the editor's are UUIDs. */
const MAX_ID = 100;

/** The most awareness client ids one connection may hold in a document. */
const MAX_CLIENTS = 4;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * What a copy may share of where it is in a document: its pointer in canvas
 * coordinates and the ids of the shapes it has selected. Anything else it sent is
 * dropped, and who it is comes from its session, so nobody can show up as another.
 */
export function readPresence(state: unknown, user: PresenceUser): Record<string, unknown> {
    const presence: Record<string, unknown> = {
        user: { id: user.userId, name: (user.name ?? '').slice(0, 100) }
    };

    if (!isRecord(state)) {
        return presence;
    }

    const { pointer, selection } = state;

    if (isRecord(pointer) && Number.isFinite(pointer.x) && Number.isFinite(pointer.y)) {
        presence.pointer = { x: pointer.x, y: pointer.y };
    }

    if (Array.isArray(selection)) {
        presence.selection = selection
            .filter((id): id is string => typeof id === 'string' && id.length <= MAX_ID)
            .slice(0, MAX_SELECTION);
    }

    return presence;
}

/**
 * Rewrites the awareness states a connection sends before they reach anyone: each
 * keeps only what `readPresence` allows, under the connection's own user. States for
 * client ids another connection holds, or beyond `MAX_CLIENTS` new ones, are dropped,
 * so a copy can neither move someone else's pointer nor flood the document.
 */
export function stampPresence({
    states,
    context,
    document,
    connection
}: {
    states: Map<number, Record<string, unknown>>;
    context: PresenceUser | undefined;
    document: Document;
    connection?: Connection<PresenceUser>;
}): void {
    const own = connection ? document.connections.get(connection)?.clients : undefined;
    let room = MAX_CLIENTS - (own?.size ?? 0);

    for (const [clientId, state] of states) {
        const heldElsewhere = [...document.connections].some(
            ([other, { clients }]) => other !== connection && clients.has(clientId)
        );
        const added = own !== undefined && !own.has(clientId);

        if (!context || !own || heldElsewhere || (added && room <= 0)) {
            states.delete(clientId);
        } else {
            room -= added ? 1 : 0;
            states.set(clientId, readPresence(state, context));
        }
    }
}
