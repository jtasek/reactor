import { createTestStore } from './support/store';
import { createCopies, edit, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';
import { dataProblems } from 'src/app/data';
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
        `Record ${recordId}: Name is required.`
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
