import type { ActionWithParamAndResult } from '../types';
import type { Batch, BatchResult, OperationsCheck } from '../operations';
import { editorHelpers } from '../editorHelpers';
import { untracked } from '../untracked';

/**
 * Applies a batch of operations to a document, all or nothing, as one undo step
 * recorded as made by `batch.by`. Added shapes go on top, unselected.
 */
export const applyOperations: ActionWithParamAndResult<Batch, BatchResult> = (
    { state, effects },
    batch
) => {
    const document = state.documents[batch.documentId];

    if (!document) {
        return { applied: false, problem: `There is no document ${batch.documentId}.` };
    }

    const { stageBatch, writeBatch } = editorHelpers().operations;
    const result = stageBatch(untracked(document), batch.operations, effects.newId, {
        retainOverrides: batch.retainOverrides
    });

    if (!result.valid) {
        return { applied: false, problem: result.problem };
    }

    effects.collaboration.startBatch(batch.documentId, batch.by);
    writeBatch(document, result.staged);
    effects.collaboration.flush();

    return { applied: true, ids: result.staged.ids };
};

/** Whether a batch would apply to its document, without applying it; else the first problem. */
export const checkOperations: ActionWithParamAndResult<Omit<Batch, 'by'>, OperationsCheck> = (
    { state },
    { documentId, operations }
) => {
    const document = state.documents[documentId];
    let checked = 0;

    if (!document) {
        return { valid: false, problem: `There is no document ${documentId}.` };
    }

    const result = editorHelpers().operations.stageBatch(
        untracked(document),
        operations,
        () => `checked-${checked++}`
    );

    return result.valid ? { valid: true } : result;
};
