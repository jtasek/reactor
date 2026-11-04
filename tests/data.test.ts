import { createTestStore } from './support/store';
import { createCopies, edit, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';
import { dataLeftovers, dataProblems, dataRecords } from 'src/app/data';
import type { DataChange, DataEditResult } from 'src/app/dataEdits';
import {
    hydrateDocument,
    migratePersistedState,
    readEntity,
    serializePersistedState
} from 'src/app/services/documentStorage';

function applied(result: DataEditResult) {
    expect(result.applied).toBe(true);
    if (!result.applied) {
        throw new Error(result.problem);
    }

    return result.id!;
}

function setup(store = createTestStore().store) {
    const documentId = store.state.currentDocumentId;
    const change = (input: DataChange) => store.actions.editData({ ...input, documentId });
    const entityId = applied(change({ kind: 'addEntity', name: 'Customers' }));
    const fieldId = applied(
        change({ kind: 'addField', entityId, name: 'Name', type: 'text', required: true })
    );
    const recordId = applied(change({ kind: 'addRecord', entityId }));

    return { store, change, entityId, fieldId, recordId };
}

it('uses stable field IDs and preserves values across renames and schema changes', () => {
    const { store, change, entityId, fieldId, recordId } = setup();
    expect(dataProblems(store.state.currentDocument)).toContain(
        'Customers record 1: Name is required.'
    );
    applied(change({ kind: 'setValue', recordId, fieldId, value: 'Ada' }));
    applied(change({ kind: 'updateField', id: fieldId, changes: { name: 'Full name' } }));
    expect(store.state.currentDocument.dataRecords[recordId].values[fieldId]).toBe('Ada');
    expect(dataProblems(store.state.currentDocument)).toEqual([]);
    applied(change({ kind: 'updateField', id: fieldId, changes: { type: 'number' } }));
    expect(dataProblems(store.state.currentDocument)[0]).toContain('must be number');
    expect(store.state.currentDocument.dataRecords[recordId].values[fieldId]).toBe('Ada');
    expect(change({ kind: 'setValue', recordId, fieldId, value: Infinity }).applied).toBe(false);
    expect(change({ kind: 'addEntity', name: 'Customers' }).applied).toBe(false);
    expect(
        change({ kind: 'addField', entityId, name: 'Full name', type: 'text', required: false })
            .applied
    ).toBe(false);
});

it('validates optional typed values and cross-entity references before writing', () => {
    const { store, change, fieldId, recordId } = setup();
    applied(
        change({ kind: 'updateField', id: fieldId, changes: { type: 'number', required: false } })
    );
    expect(change({ kind: 'setValue', recordId, fieldId, value: '' }).applied).toBe(false);
    applied(change({ kind: 'setValue', recordId, fieldId, value: null }));
    const other = applied(change({ kind: 'addEntity', name: 'Orders' }));
    const otherField = applied(
        change({ kind: 'addField', entityId: other, name: 'Paid', type: 'boolean', required: true })
    );
    expect(change({ kind: 'setValue', recordId, fieldId: otherField, value: true }).applied).toBe(
        false
    );
    expect(store.state.currentDocument.dataRecords[recordId].values).toEqual({ [fieldId]: null });
});

it('round trips data, migrates old documents and rejects unsafe values', () => {
    const { store, change, fieldId, recordId } = setup();
    applied(change({ kind: 'setValue', recordId, fieldId, value: 'Ada' }));
    const saved = serializePersistedState(store.state);
    const migrated = migratePersistedState(JSON.parse(JSON.stringify(saved)))!;
    const restored = hydrateDocument(migrated.documents[store.state.currentDocumentId]);
    expect(restored.dataRecords[recordId].values[fieldId]).toBe('Ada');
    const old = JSON.parse(JSON.stringify(saved));
    old.version = 23;
    delete old.documents[restored.id].dataEntities;
    delete old.documents[restored.id].dataFields;
    delete old.documents[restored.id].dataRecords;
    expect(migratePersistedState(old)?.documents[restored.id].dataEntities).toEqual({});
    expect(() =>
        readEntity('dataRecords', { id: 'record', entityId: 'entity', values: { value: {} } })
    ).toThrow();
    expect(() =>
        readEntity('dataFields', {
            id: '__proto__',
            name: 'Bad',
            entityId: 'entity',
            type: 'text',
            required: false
        })
    ).toThrow();
});

it('refuses stale-document and locked edits', () => {
    const { store, change } = setup();
    expect(
        store.actions.editData({ kind: 'addEntity', name: 'Other', documentId: 'other' }).applied
    ).toBe(false);
    store.actions.setDocumentAccess({ [store.state.currentDocumentId]: { role: 'viewer' } });
    expect(change({ kind: 'addEntity', name: 'Blocked viewer' }).applied).toBe(false);
    store.actions.setDocumentAccess({ [store.state.currentDocumentId]: { role: 'editor' } });
    store.actions.lockDocument(store.state.currentDocumentId);
    expect(change({ kind: 'addEntity', name: 'Blocked' }).applied).toBe(false);
});

it('merges different cells and fields, and undoes only the local edit', async () => {
    let fixture: ReturnType<typeof setup>;
    const copies = await createCopies(2, (store) => {
        fixture = setup(store);
    });
    const [a, b] = copies;
    const { entityId, fieldId, recordId } = fixture!;
    const otherField = applied(
        a.store.actions.editData({
            kind: 'addField',
            entityId,
            name: 'Active',
            type: 'boolean',
            required: false,
            documentId: DOCUMENT_ID
        })
    );
    settle(copies);
    edit(a, (actions) => {
        applied(
            actions.editData({
                kind: 'setValue',
                recordId,
                fieldId,
                value: 'Ada',
                documentId: DOCUMENT_ID
            })
        );
    });
    edit(b, (actions) => {
        applied(
            actions.editData({
                kind: 'setValue',
                recordId,
                fieldId: otherField,
                value: false,
                documentId: DOCUMENT_ID
            })
        );
    });
    settle(copies);
    for (const copy of copies) {
        expect(shownDocument(copy).dataRecords[recordId].values).toEqual({
            [fieldId]: 'Ada',
            [otherField]: false
        });
    }
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).dataRecords[recordId].values).toEqual({ [otherField]: false });
    a.collaboration.redo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).dataRecords[recordId].values[fieldId]).toBe('Ada');
    copies.forEach((copy) => copy.collaboration.dispose());
});

it('deletes an entity and its contents as one reversible edit', async () => {
    let fixture: ReturnType<typeof setup>;
    const copies = await createCopies(2, (store) => {
        fixture = setup(store);
    });
    const [a, b] = copies;
    applied(
        a.store.actions.editData({
            kind: 'deleteEntity',
            id: fixture!.entityId,
            documentId: DOCUMENT_ID
        })
    );
    settle(copies);
    expect(shownDocument(b).dataRecords).toEqual({});
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).dataEntities[fixture!.entityId].name).toBe('Customers');
    expect(shownDocument(b).dataFields[fixture!.fieldId].name).toBe('Name');
    expect(shownDocument(b).dataRecords[fixture!.recordId]).toBeDefined();
    copies.forEach((copy) => copy.collaboration.dispose());
});

it('keeps records in the order they were added', () => {
    const { store, change, entityId, recordId } = setup();
    const added = [recordId];
    for (let index = 0; index < 5; index++) {
        added.push(applied(change({ kind: 'addRecord', entityId })));
    }
    applied(change({ kind: 'deleteRecord', id: added[2] }));
    added.splice(2, 1);
    added.push(applied(change({ kind: 'addRecord', entityId })));
    expect(dataRecords(store.state.currentDocument, entityId).map(({ id }) => id)).toEqual(added);
});

it('removes what concurrent deletes leave behind, as one reversible edit', async () => {
    let fixture: ReturnType<typeof setup>;
    const copies = await createCopies(2, (store) => {
        fixture = setup(store);
    });
    const [a, b] = copies;
    const { entityId, fieldId, recordId } = fixture!;
    const other = applied(
        a.store.actions.editData({ kind: 'addEntity', name: 'Orders', documentId: DOCUMENT_ID })
    );
    settle(copies);
    // b's new IDs must differ from a's: every refused add still draws one.
    for (let index = 0; index < 20; index++) {
        b.store.actions.editData({ kind: 'addEntity', name: 'Orders', documentId: DOCUMENT_ID });
    }
    edit(a, (actions) => {
        applied(actions.editData({ kind: 'deleteField', id: fieldId, documentId: DOCUMENT_ID }));
        applied(actions.editData({ kind: 'deleteEntity', id: other, documentId: DOCUMENT_ID }));
    });
    edit(b, (actions) => {
        applied(
            actions.editData({
                kind: 'setValue',
                recordId,
                fieldId,
                value: 'Ada',
                documentId: DOCUMENT_ID
            })
        );
        applied(actions.editData({ kind: 'addRecord', entityId: other, documentId: DOCUMENT_ID }));
        applied(
            actions.editData({
                kind: 'addField',
                entityId: other,
                name: 'Total',
                type: 'number',
                required: false,
                documentId: DOCUMENT_ID
            })
        );
    });
    settle(copies);
    const before = dataLeftovers(shownDocument(a));
    expect([before.fields.length, before.records.length, before.values.length]).toEqual([1, 1, 1]);
    expect(dataProblems(shownDocument(a))).toEqual([
        'Left over from deleted entities or fields: 1 fields, 1 records, 1 values.'
    ]);
    edit(a, (actions) => {
        applied(actions.editData({ kind: 'removeLeftovers', documentId: DOCUMENT_ID }));
    });
    settle(copies);
    for (const copy of copies) {
        expect(dataProblems(shownDocument(copy))).toEqual([]);
        expect(shownDocument(copy).dataRecords[recordId].values).toEqual({});
        expect(shownDocument(copy).dataEntities[entityId]).toBeDefined();
    }
    expect(
        a.store.actions.editData({ kind: 'removeLeftovers', documentId: DOCUMENT_ID }).applied
    ).toBe(false);
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(dataProblems(shownDocument(b))).toHaveLength(1);
    copies.forEach((copy) => copy.collaboration.dispose());
});
