import { editorHelpers } from 'src/app/editorHelpers';
import type { Operation } from 'src/app/operations';
import { copyDocument } from 'src/app/services/documentStorage';
import type { Document } from 'src/app/types';

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

    writeBatch(draft, result.staged);

    return { valid: true as const, document: draft };
}
