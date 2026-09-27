import type { ActionWithParam, HashTable } from '../types';
import type { RemoteChanges } from '../services/collaboration';
import { inDrawingOrder } from '../drawOrder';
import {
    RUNTIME_FIELDS,
    hydrateDocumentFields,
    hydrateLink,
    hydrateMember,
    hydrateRuler,
    hydrateShape
} from '../services/documentStorage';

const DOCUMENT_FIELDS = [
    'author',
    'created',
    'createdBy',
    'description',
    'grid',
    'locked',
    'modified',
    'modifiedBy',
    'name',
    'tags'
];

const same = (a: unknown, b: unknown) =>
    a instanceof Date && b instanceof Date
        ? a.getTime() === b.getTime()
        : JSON.stringify(a) === JSON.stringify(b);

/** Gives `target` the values `next` has for `keys`, removing the ones it lacks; returns what changed. */
function assign(target: object, next: object, keys: Iterable<string>): Set<string> {
    const changed = new Set<string>();

    for (const key of keys) {
        const value: unknown = Reflect.get(next, key);

        if (
            value === undefined ? !Reflect.has(target, key) : same(Reflect.get(target, key), value)
        ) {
            continue;
        }

        if (value === undefined) {
            Reflect.deleteProperty(target, key);
        } else {
            Reflect.set(target, key, value);
        }

        changed.add(key);
    }

    return changed;
}

const durableKeys = (a: object, b: object) =>
    new Set([...Object.keys(a), ...Object.keys(b)].filter((key) => !RUNTIME_FIELDS.has(key)));

/** Brings a table in line with the views; returns whether any draw order changed. */
function applyViews<V extends object, E extends object>(
    table: HashTable<E>,
    views: Record<string, V | null> | undefined,
    hydrate: (view: V) => E
): boolean {
    let reordered = false;

    for (const [id, view] of Object.entries(views ?? {})) {
        const current = Object.hasOwn(table, id) ? table[id] : undefined;

        if (view === null) {
            if (current !== undefined) {
                delete table[id];
                reordered = true;
            }

            continue;
        }

        const next = hydrate(view);

        if (current === undefined) {
            table[id] = next;
            reordered = true;
            continue;
        }

        reordered = assign(current, next, durableKeys(current, next)).has('order') || reordered;
    }

    return reordered;
}

/**
 * Applies normalized changes from the shared document. Runtime state such as the
 * selection and the camera stays this copy's own.
 */
export const applyRemoteChanges: ActionWithParam<RemoteChanges> = (
    { state },
    { documentId, fields, entities }
) => {
    const document = state.documents[documentId];

    if (!document) {
        return;
    }

    if (fields) {
        assign(document, hydrateDocumentFields(fields), DOCUMENT_FIELDS);
    }

    const reordered = applyViews(document.shapes, entities.shapes, hydrateShape);

    applyViews(document.groups, entities.groups, hydrateMember);
    applyViews(document.layers, entities.layers, hydrateMember);
    applyViews(document.components, entities.components, hydrateMember);
    applyViews(document.links, entities.links, hydrateLink);
    applyViews(document.rulers, entities.rulers, hydrateRuler);

    if (reordered) {
        document.shapesIds = inDrawingOrder(document.shapes);
    }
};
