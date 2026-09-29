import type { ActionWithParam, Document } from '../types';
import { isRecord, same, type EntityChanges, type RemoteChanges } from '../services/collaboration';
import { inDrawingOrder } from '../drawOrder';
import {
    COLLECTIONS,
    hydrateDocumentFields,
    hydrateEntity,
    type Collection
} from '../services/documentStorage';

/** A copy for the store to own, so its later edits never reach the shared document's views. */
const own = <T>(value: T): T =>
    typeof value === 'object' && value !== null ? structuredClone(value) : value;

/** Gives `target` the `changed` fields of `next`, removing the ones `next` lacks. */
function assign(target: object, next: object, changed: string[]) {
    for (const key of changed) {
        const value: unknown = Reflect.get(next, key);

        if (value === undefined) {
            Reflect.deleteProperty(target, key);
            continue;
        }

        Reflect.set(target, key, own(value));
    }
}

/**
 * Gives `base` the values that `next` changes from `current`, down to the fields of
 * objects as the shared document merges them, so values `current` got elsewhere
 * stay as `base` has them.
 */
function rebase(base: object, current: object, next: object, keys: Iterable<string>) {
    for (const key of keys) {
        const value: unknown = Reflect.get(next, key);
        const before: unknown = Reflect.get(current, key);
        const held: unknown = Reflect.get(base, key);

        if (isRecord(value) && isRecord(before) && isRecord(held)) {
            rebase(held, before, value, new Set([...Object.keys(before), ...Object.keys(value)]));
            continue;
        }

        if (same(value, before)) {
            continue;
        }

        if (value === undefined) {
            Reflect.deleteProperty(base, key);
            continue;
        }

        Reflect.set(base, key, own(value));
    }
}

/**
 * Brings what a gesture restores if canceled in line with other copies' changes, so
 * canceling undoes only the gesture's own changes. A change that loses to the
 * gesture's own value of the same field never reaches this copy, so canceling
 * restores the value from before the gesture instead.
 */
function rebaseGesture(
    snapshots: Record<string, object>,
    shapes: Record<string, object>,
    changes: EntityChanges['shapes']
) {
    for (const [id, change] of Object.entries(changes)) {
        if (!Object.hasOwn(snapshots, id)) {
            continue;
        }

        if (change === null || !Object.hasOwn(shapes, id)) {
            delete snapshots[id];
            continue;
        }

        rebase(snapshots[id], shapes[id], hydrateEntity('shapes', change.view), change.changed);
    }
}

/** Applies one collection's changes; returns whether an entity came, went or was reordered. */
function applyChanges<C extends Collection>(
    document: Document,
    collection: C,
    changes: EntityChanges[C]
): boolean {
    const table: Record<string, object> = document[collection];
    let reordered = false;

    for (const [id, change] of Object.entries(changes)) {
        const current = Object.hasOwn(table, id) ? table[id] : undefined;

        if (change === null) {
            if (current !== undefined) {
                delete table[id];
                reordered = true;
            }

            continue;
        }

        const next = hydrateEntity(collection, change.view);

        if (current === undefined) {
            table[id] = own(next);
            reordered = true;
            continue;
        }

        assign(current, next, change.changed);
        reordered ||= change.changed.includes('order');
    }

    return reordered;
}

/**
 * Applies changes from the shared document, setting only the fields that differ.
 * Runtime state such as the selection and the camera stays this copy's own.
 */
export const applyRemoteChanges: ActionWithParam<RemoteChanges> = (
    { state },
    { documentId, fields, entities }
) => {
    const document = state.documents[documentId];

    if (!document) {
        return;
    }

    const { gesture } = state.events.pointer;

    if ('shapes' in gesture && documentId === state.currentDocumentId) {
        rebaseGesture(gesture.shapes, document.shapes, entities.shapes);
    }

    if (fields) {
        assign(document, hydrateDocumentFields(fields.view), fields.changed);
    }

    for (const collection of COLLECTIONS) {
        const reordered = applyChanges(document, collection, entities[collection]);

        if (reordered && collection === 'shapes') {
            document.shapesIds = inDrawingOrder(document.shapes);
        }
    }
};
