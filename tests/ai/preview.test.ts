import { readOperation } from 'src/ai/operations';
import { previewProposal } from 'src/ai/preview';
import type { Operation } from 'src/app/operations';
import { createTestStore } from '../support/store';
import { operations as screenOperations } from './cases/create-responsive-screen/case';

describe('visual proposal drafts', () => {
    it('stages responsive screens without changing the document or allocating real IDs', () => {
        const { store } = createTestStore();
        const document = store.state.currentDocument;
        const before = JSON.stringify(document.frames);
        const result = previewProposal(document, screenOperations.map(readOperation));

        expect(result.valid).toBe(true);
        expect(JSON.stringify(document.frames)).toBe(before);
        expect(document.shapesIds).toHaveLength(0);

        if (!result.valid) {
            throw new Error(result.problem);
        }

        expect(Object.values(result.document.frames).some((frame) => frame.kind === 'view')).toBe(
            true
        );
        expect(result.document.shapesIds.length).toBeGreaterThan(0);
        result.document.shapes[result.document.shapesIds[0]].name = 'Draft only';
        expect(document.shapesIds).toHaveLength(0);
    });

    it('reflects current values and refuses a proposal after its target is deleted', () => {
        const { store } = createTestStore();
        const document = store.state.currentDocument;
        store.actions.addShape({
            type: 'rectangle',
            name: 'Original',
            position: { x: 0, y: 0 },
            size: { width: 40, height: 20 }
        });
        const id = document.shapesIds[0];
        const operations: Operation[] = [
            { op: 'updateShape', shape: id, changes: { name: 'Proposed' } }
        ];
        const result = previewProposal(document, operations);

        expect(result.valid).toBe(true);
        expect(document.shapes[id].name).toBe('Original');

        if (!result.valid) {
            throw new Error(result.problem);
        }

        expect(result.document.shapes[id].name).toBe('Proposed');
        store.actions.applyOperations({
            documentId: document.id,
            by: { kind: 'person' },
            operations: [{ op: 'deleteShapes', shapes: [id] }]
        });
        expect(previewProposal(document, operations).valid).toBe(false);
    });
});
