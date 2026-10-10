import type { Action, ActionWithParam, Box, Document, Shape } from '../types';
import { getBoundingBox, mapPointBetweenBoxes } from '../utils';
import { isRecord, same, type EntityChanges, type RemoteChanges } from '../services/collaboration';
import { inDrawingOrder } from '../drawOrder';
import {
    COLLECTIONS,
    hydrateDocumentFields,
    hydrateEntity,
    type Collection
} from '../services/documentStorage';

/** A copy for the store to own, so its later edits never reach the shared document's views. */
const copyForStore = <T>(value: T): T =>
    typeof value === 'object' && value !== null ? structuredClone(value) : value;

/** Gives `target` the `changed` fields of `next`, removing the ones `next` lacks. */
function assign(target: object, next: object, changed: string[]) {
    for (const key of changed) {
        const value: unknown = Reflect.get(next, key);

        if (value === undefined) {
            Reflect.deleteProperty(target, key);
            continue;
        }

        Reflect.set(target, key, copyForStore(value));
    }
}

/**
 * Gives `base` the values that `next` changes from `previous`, down to the fields
 * of objects as the shared document merges them.
 */
function rebase(base: object, previous: object, next: object, keys: Iterable<string>) {
    for (const key of keys) {
        const value: unknown = Reflect.get(next, key);
        const before: unknown = Reflect.get(previous, key);
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

        Reflect.set(base, key, copyForStore(value));
    }
}

/**
 * Moves and scales measured bounds as the geometry they were measured from
 * changed, since they are this copy's own and other copies never change them.
 * A side the geometry had no extent along takes the new geometry's.
 */
function followBox(box: Box, from: Box, to: Box): Box {
    const start = mapPointBetweenBoxes(box.topLeft, from, to);
    const end = mapPointBetweenBoxes(box.bottomRight, from, to);
    const topLeft = {
        x: from.width > 0 ? start.x : to.topLeft.x,
        y: from.height > 0 ? start.y : to.topLeft.y
    };
    const bottomRight = {
        x: from.width > 0 ? end.x : to.bottomRight.x,
        y: from.height > 0 ? end.y : to.bottomRight.y
    };

    return {
        topLeft,
        bottomRight,
        width: bottomRight.x - topLeft.x,
        height: bottomRight.y - topLeft.y
    };
}

/**
 * Gives what a gesture restores if canceled other copies' changes, so canceling
 * undoes only the gesture's own changes, even where they override another copy's.
 */
function rebaseGesture(
    snapshots: Record<string, Shape>,
    { entities, unwritten = {} }: RemoteChanges
) {
    for (const id of Object.keys(snapshots)) {
        const change = Object.hasOwn(unwritten, id) ? unwritten[id] : entities.shapes[id];

        if (change === null) {
            delete snapshots[id];
            continue;
        }

        if (change?.previous) {
            const snapshot = snapshots[id];
            const before = getBoundingBox(snapshot);

            rebase(
                snapshot,
                hydrateEntity('shapes', change.previous),
                hydrateEntity('shapes', change.view),
                change.changed
            );

            if (snapshot.bounds) {
                snapshot.bounds = followBox(snapshot.bounds, before, getBoundingBox(snapshot));
            }
        }
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
            table[id] = copyForStore(next);
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
export const applyRemoteChanges: ActionWithParam<RemoteChanges> = ({ state }, changes) => {
    const { documentId, fields, entities } = changes;
    const document = state.documents[documentId];

    if (!document) {
        return;
    }

    const { gesture } = state.events.pointer;

    if ('shapes' in gesture && documentId === state.currentDocumentId) {
        rebaseGesture(gesture.shapes, changes);
    }

    // A group drag restores the group's rotation if canceled, as another copy left it.
    if ('frame' in gesture && documentId === state.currentDocumentId) {
        const change = entities.groups[gesture.groupId];

        if (change?.changed.includes('rotation')) {
            gesture.frame.rotation = hydrateEntity('groups', change.view).rotation ?? 0;
        }
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

/** Holds this copy's changes while a control is held, as a drag does, so its result is shared once. */
export const holdSharing: Action = ({ effects }) => {
    effects.collaboration.pause();
};

/** Shares what was held since `holdSharing`, unless a gesture or a held key still holds it. */
export const releaseSharing: Action = ({ state, effects }) => {
    const { keyboard, pointer } = state.events;

    if (!pointer.dragging && !keyboard.repeating) {
        effects.collaboration.resume();
    }
};
