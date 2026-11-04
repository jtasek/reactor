import { previewEdit } from 'src/ui/components/CommandLine/editPreview';
import { selectionOperations } from 'src/ui/components/CommandLine/selection';
import { createTestStore } from './support/store';

function setup() {
    const { store } = createTestStore();
    store.actions.addShape({
        type: 'rectangle',
        name: 'Card',
        position: { x: 10, y: 20 },
        size: { width: 80, height: 40 }
    });
    const id = store.state.currentDocument.shapesIds.at(-1)!;
    store.actions.selectShape(id);

    return { store, id, preview: (input: string) => previewEdit(input, store.state) };
}

it('previews a validated batch without changing document values or history', () => {
    const { store, id, preview } = setup();
    const before = JSON.stringify(store.state.currentDocument);
    expect(preview('w=120 h=60')).toMatchObject({
        items: [{ name: 'Card', changes: ['Width: 80 → 120', 'Height: 40 → 60'] }]
    });
    expect(JSON.stringify(store.state.currentDocument)).toBe(before);
    const result = store.actions.applyOperations({
        documentId: store.state.currentDocumentId,
        by: { kind: 'person' },
        operations: selectionOperations('w=120 h=60', store.state)
    });
    expect(result.applied).toBe(true);
    expect(store.state.currentDocument.shapes[id]).toMatchObject({
        size: { width: 120, height: 60 }
    });
});

it('reports invalid and locked edits without changing the selection', () => {
    const { store, id, preview } = setup();
    expect(preview('w=-1')?.problem).toContain('positive');
    store.actions.lockShape(id);
    expect(preview('w=120')?.problem).toContain('editable');
    expect(store.state.currentDocument.shapes[id]).toMatchObject({
        size: { width: 80, height: 40 }
    });
});

it('explains binding additions and removals, even when the value stays the same', () => {
    const { store, id, preview } = setup();
    const variableId = store.actions.createVariable({
        name: 'card width',
        type: 'number',
        value: 80
    })!;
    expect(preview('bind property=w variable="card width"')?.items[0].changes).toContain(
        'Width: Bind to card width'
    );
    store.actions.bindProperty({ shapeIds: [id], key: 'width', variableId });
    expect(preview('w=120')?.items[0].changes).toContain('Width: Remove binding to card width');
    expect(preview('unbind property=w')?.items[0].changes).toContain(
        'Width: Remove binding to card width'
    );
});

it('summarizes frame spacing and does not preview ordinary commands', () => {
    const { store, preview } = setup();
    const id = store.actions.editFrame({
        kind: 'add',
        position: { x: 0, y: 0 },
        size: { width: 300, height: 200 }
    })!;
    store.actions.editFrame({
        kind: 'update',
        id,
        changes: { stack: { direction: 'row', gap: 8, padding: 12, align: 'start' } }
    });
    expect(preview('gap=24 padding=16')?.items[0].changes).toEqual([
        'Gap: 8 → 24',
        'Padding: 12 → 16'
    ]);
    expect(preview('undo')).toBeUndefined();
});

it('ignores obsolete measured bounds when previewing changed geometry', () => {
    const { store, id, preview } = setup();
    store.actions.setShapeBounds({
        id,
        bounds: {
            topLeft: { x: 10, y: 20 },
            bottomRight: { x: 90, y: 60 },
            width: 80,
            height: 40
        }
    });
    expect(preview('w=120 h=60')?.items[0].changes).toContain('Width: 80 → 120');
    expect(store.state.currentDocument.shapes[id]).toMatchObject({
        size: { width: 80, height: 40 }
    });
});
