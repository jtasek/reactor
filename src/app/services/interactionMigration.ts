import type * as Yjs from 'yjs';
import { createInteractions } from '../factories';
import { orUndefined, readRoleSettings } from './documentStorage';

// Reserve the upper half of safe integer IDs, apart from Yjs's random 32-bit client IDs.
const MIGRATION_ID_BIT = 1n << 52n;
const FNV_OFFSET = 14695981039346656037n;
const FNV_PRIME = 1099511628211n;

function migrationClientId(identity: string): number {
    const hash = new TextEncoder()
        .encode(identity)
        .reduce((hash, byte) => BigInt.asUintN(64, (hash ^ BigInt(byte)) * FNV_PRIME), FNV_OFFSET);

    return Number(MIGRATION_ID_BIT | (hash & (MIGRATION_ID_BIT - 1n)));
}

/**
 * Peers must create the same shared map: independently allocated maps compete, dropping
 * edits made inside the losing map. Build deterministic migration items in a temporary
 * document, then merge them without changing the real client's identity or undo history.
 */
export function migrateInteractions(doc: Yjs.Doc, yjs: typeof Yjs, origin: symbol): boolean {
    const pending = (['components', 'shapes'] as const).flatMap((collection) =>
        [...doc.getMap(collection)].flatMap(([id, entity]) => {
            if (
                !(entity instanceof yjs.Map) ||
                entity.has('interactions') ||
                (collection === 'shapes' && entity.get('type') !== 'instance')
            ) {
                return [];
            }
            const raw = entity.toJSON();
            const role =
                raw.interaction === undefined
                    ? undefined
                    : orUndefined(() => readRoleSettings(raw.interaction));
            const settings = createInteractions(role);
            // The relative position identifies this particular entity, including after delete/recreate.
            const identity = JSON.stringify([
                'reactor-v23-interactions',
                doc.getMap('document').get('id'),
                yjs.createRelativePositionFromTypeIndex(entity, 0),
                settings
            ]);

            return [{ collection, id, settings, clientId: migrationClientId(identity) }];
        })
    );
    if (pending.length === 0) {
        return false;
    }
    const migration = new yjs.Doc();
    yjs.applyUpdate(migration, yjs.encodeStateAsUpdate(doc));
    const before = yjs.encodeStateVector(migration);
    for (const { collection, id, settings, clientId } of pending) {
        migration.clientID = clientId;
        const entity = migration.getMap(collection).get(id) as Yjs.Map<unknown>;
        const actions = new yjs.Map<unknown>();
        if (settings.activate !== undefined) {
            actions.set(
                'activate',
                settings.activate === null ? null : new yjs.Map(Object.entries(settings.activate))
            );
        }
        entity.set('interactions', actions);
    }
    yjs.applyUpdate(doc, yjs.encodeStateAsUpdate(migration, before), origin);
    migration.destroy();

    return true;
}
