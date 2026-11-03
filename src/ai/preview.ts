import { editorHelpers } from 'src/app/editorHelpers';
import { drawnBox } from 'src/app/membership';
import type { Operation } from 'src/app/operations';
import { copyDocument } from 'src/app/services/documentStorage';
import type { Box, Document } from 'src/app/types';
import { rectToBox } from 'src/app/utils';

/** What a proposal adds or changes, by ID, and where the items it deletes were. */
export interface ProposalChanges {
    ids: ReadonlySet<string>;
    removed: Box[];
}

function removedBox(document: Document, collection: 'shapes' | 'frames', id: string) {
    if (collection === 'frames') {
        const frame = document.frames[id];

        return frame ? rectToBox({ ...frame.position, ...frame.size }) : undefined;
    }

    const shape = document.shapes[id];

    try {
        return shape ? drawnBox(shape) : undefined;
    } catch {
        // A shape with no measurable box is simply not marked.
        return undefined;
    }
}

/** A disposable projection: no store, collaboration, persistence or undo effects. */
export function previewProposal(document: Document, operations: Operation[]) {
    const draft = copyDocument(document, document.id);
    const occupied = new Set([
        ...Object.keys(draft.frames),
        ...Object.keys(draft.shapes),
        ...Object.keys(draft.groups),
        ...Object.keys(draft.components),
        ...Object.keys(draft.variables),
        ...Object.keys(draft.dimensions)
    ]);
    let sequence = 0;
    const newId = () => {
        const id = `ai-preview-${sequence++}`;

        if (occupied.has(id)) {
            return newId();
        }

        occupied.add(id);

        return id;
    };
    const { stageBatch, writeBatch } = editorHelpers().operations;
    const result = stageBatch(draft, operations, newId);

    if (!result.valid) {
        return result;
    }

    const { staged } = result;
    const changes: ProposalChanges = {
        ids: new Set([
            ...staged.shapes.map(({ id }) => id),
            ...staged.updatedShapes.map(({ id }) => id),
            ...staged.frames.map(({ id }) => id),
            ...staged.updatedFrames.map(({ id }) => id),
            ...staged.groups.flatMap(({ shapesIds }) => shapesIds)
        ]),
        removed: [
            ...staged.deletedShapes.map((id) => removedBox(document, 'shapes', id)),
            ...staged.deletedFrames.map((id) => removedBox(document, 'frames', id))
        ].filter((box) => box !== undefined)
    };

    writeBatch(draft, staged);

    return { valid: true as const, document: draft, changes };
}
