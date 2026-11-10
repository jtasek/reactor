import type { Document, Shape } from './types';
import { untracked } from './untracked';

/*
 * A shape's `selected` flag says whether that shape is drawn selected, so each
 * shape re-renders only when its own flag changes. `document.shapeSelection`
 * lists the selected shapes, so what reads the selection as a whole depends on
 * those shapes only, not on every shape of the document. Both are written only
 * through the functions here, which keep them in step.
 */

/** Selects or unselects the shapes `ids` names; ids of missing shapes are skipped. */
export function setShapesSelected(document: Document, ids: Iterable<string>, selected: boolean) {
    // Read without tracking; every write below goes through the store.
    const plain = untracked(document);
    const listed = new Set(plain.shapeSelection);
    const changed: string[] = [];

    for (const id of ids) {
        const shape = plain.shapes[id];

        if (!shape) {
            continue;
        }
        if (shape.selected !== selected) {
            document.shapes[id].selected = selected;
        }
        if (listed.has(id) !== selected) {
            changed.push(id);
            listed[selected ? 'add' : 'delete'](id);
        }
    }

    if (changed.length === 0) {
        return;
    }
    if (selected) {
        document.shapeSelection.push(...changed);
    } else {
        const removed = new Set(changed);

        document.shapeSelection = plain.shapeSelection.filter((id) => !removed.has(id));
    }
}

/** Selects or unselects one shape. */
export const setShapeSelected = (document: Document, id: string, selected: boolean) =>
    setShapesSelected(document, [id], selected);

/** Selects exactly the shapes `ids` names, unselecting the others. */
export function selectOnlyShapes(document: Document, ids: Iterable<string>) {
    const keep = new Set(ids);

    setShapesSelected(
        document,
        untracked(document).shapeSelection.filter((id) => !keep.has(id)),
        false
    );
    setShapesSelected(document, keep, true);
}

/** Puts a new shape in the document, listing it when it comes selected. */
export function putShape(document: Document, shape: Shape) {
    document.shapes[shape.id] = shape;
    if (shape.selected) {
        document.shapeSelection.push(shape.id);
    }
}

/** Drops ids of shapes the document no longer has from its list of selected ones. */
export function forgetMissingShapes(document: Document) {
    const plain = untracked(document);

    if (plain.shapeSelection.some((id) => !Object.hasOwn(plain.shapes, id))) {
        document.shapeSelection = plain.shapeSelection.filter((id) =>
            Object.hasOwn(plain.shapes, id)
        );
    }
}

/** The ids of the selected shapes, in the order the document holds them. */
export function listedSelectedShapesIds(document: Document): string[] {
    const listed = document.shapeSelection.filter((id) => document.shapes[id]?.selected);

    if (listed.length < 2) {
        return listed;
    }

    // Untracked: the order of the shapes' keys changes only as shapes come and go,
    // and a selected one going is already read above.
    const position = new Map(Object.keys(untracked(document.shapes)).map((id, i) => [id, i]));

    return listed.sort((a, b) => (position.get(a) ?? 0) - (position.get(b) ?? 0));
}
