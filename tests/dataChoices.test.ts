import { createTestStore } from './support/store';
import { dataListFixture } from './support/dataList';
import { dataProblems, fieldChoices, MAX_RECORDS_PER_ENTITY, recordLabel } from 'src/app/data';
import type { DataChange, DataEditResult } from 'src/app/dataEdits';
import {
    hydrateDocument,
    migratePersistedState,
    readEntity,
    serializePersistedState
} from 'src/app/services/documentStorage';
import { projectPreview } from 'src/preview/project';
import { saveRecord, sessionDocument } from 'src/preview/recordForms';
import type { PreviewNode } from 'src/shared/previewProtocol';

function applied(result: DataEditResult) {
    if (!result.applied) {
        throw new Error(result.problem);
    }

    return result.id!;
}

function setup() {
    const { store } = createTestStore();
    const documentId = store.state.currentDocumentId;
    const change = (input: DataChange) => store.actions.editData({ ...input, documentId });
    const customers = applied(change({ kind: 'addEntity', name: 'Customers' }));
    const name = applied(
        change({
            kind: 'addField',
            entityId: customers,
            name: 'Name',
            type: 'text',
            required: true
        })
    );
    const ada = applied(change({ kind: 'addRecord', entityId: customers }));
    applied(change({ kind: 'setValue', recordId: ada, fieldId: name, value: 'Ada' }));
    const orders = applied(change({ kind: 'addEntity', name: 'Orders' }));
    const status = applied(
        change({
            kind: 'addField',
            entityId: orders,
            name: 'Status',
            type: 'choice',
            required: true,
            options: ['Open', 'Shipped']
        })
    );
    const customer = applied(
        change({
            kind: 'addField',
            entityId: orders,
            name: 'Customer',
            type: 'reference',
            required: false,
            targetEntityId: customers
        })
    );
    const order = applied(change({ kind: 'addRecord', entityId: orders }));

    return { store, change, customers, name, ada, orders, status, customer, order };
}

it('accepts only listed options and records of the referenced entity', () => {
    const { store, change, customers, ada, status, customer, order } = setup();
    const document = () => store.state.currentDocument;
    expect(change({ kind: 'setValue', recordId: order, fieldId: status, value: 'Lost' })).toEqual({
        applied: false,
        problem: 'Status must be one of its options.'
    });
    expect(change({ kind: 'setValue', recordId: order, fieldId: status, value: 1 }).applied).toBe(
        false
    );
    applied(change({ kind: 'setValue', recordId: order, fieldId: status, value: 'Shipped' }));
    expect(
        change({ kind: 'setValue', recordId: order, fieldId: customer, value: order }).applied
    ).toBe(false);
    applied(change({ kind: 'setValue', recordId: order, fieldId: customer, value: ada }));
    applied(change({ kind: 'setValue', recordId: order, fieldId: customer, value: null }));
    applied(change({ kind: 'setValue', recordId: order, fieldId: customer, value: ada }));
    expect(dataProblems(document())).toEqual([]);
    expect(fieldChoices(document(), document().dataFields[customer])).toEqual([
        { value: ada, label: 'Ada' }
    ]);

    // Schema edits never rewrite values; they are reported instead.
    applied(change({ kind: 'updateField', id: status, changes: { options: ['Open', 'Sent'] } }));
    expect(document().dataRecords[order].values[status]).toBe('Shipped');
    expect(dataProblems(document())).toEqual([
        'Orders record 1: Status must be one of its options.'
    ]);
    applied(change({ kind: 'deleteRecord', id: ada }));
    expect(dataProblems(document())).toContain(
        'Orders record 1: Customer refers to a record that no longer exists.'
    );
    applied(change({ kind: 'deleteEntity', id: customers }));
    expect(dataProblems(document())).toContain('Orders: Customer refers to a deleted entity.');
    expect(document().dataFields[customer].targetEntityId).toBe(customers);
});

it('needs options for a new choice field and an existing entity for a reference', () => {
    const { change, orders, status } = setup();
    expect(
        change({
            kind: 'addField',
            entityId: orders,
            name: 'Priority',
            type: 'choice',
            required: false,
            options: []
        })
    ).toEqual({ applied: false, problem: 'Add at least one option.' });
    for (const options of [['A', 'A'], [' '], Array.from({ length: 101 }, (_, i) => `${i}`)]) {
        expect(change({ kind: 'updateField', id: status, changes: { options } }).applied).toBe(
            false
        );
    }
    expect(change({ kind: 'updateField', id: status, changes: { options: [] } })).toEqual({
        applied: false,
        problem: 'Add at least one option.'
    });
    expect(
        change({
            kind: 'addField',
            entityId: orders,
            name: 'Owner',
            type: 'reference',
            required: false,
            targetEntityId: 'missing'
        })
    ).toEqual({ applied: false, problem: 'Choose the entity this field refers to.' });
    expect(
        change({ kind: 'updateField', id: status, changes: { type: 'reference' } }).applied
    ).toBe(false);
});

it('keeps choice and reference settings when the type changes and back', () => {
    const { store, change, status, customer, customers } = setup();
    applied(change({ kind: 'updateField', id: status, changes: { type: 'text' } }));
    applied(change({ kind: 'updateField', id: customer, changes: { type: 'text' } }));
    applied(change({ kind: 'updateField', id: status, changes: { type: 'choice' } }));
    applied(change({ kind: 'updateField', id: customer, changes: { type: 'reference' } }));
    expect(store.state.currentDocument.dataFields[status].options).toEqual(['Open', 'Shipped']);
    expect(store.state.currentDocument.dataFields[customer].targetEntityId).toBe(customers);
});

it('names records by the chosen text field, else the first, else their row', () => {
    const { store, change, customers, name, ada } = setup();
    const document = () => store.state.currentDocument;
    const email = applied(
        change({
            kind: 'addField',
            entityId: customers,
            name: 'Email',
            type: 'text',
            required: false
        })
    );
    // Email sorts first and is blank, so the row number names the record.
    expect(recordLabel(document(), ada)).toBe('Customers 1');
    applied(change({ kind: 'setLabelField', entityId: customers, fieldId: name }));
    expect(recordLabel(document(), ada)).toBe('Ada');
    expect(change({ kind: 'setLabelField', entityId: customers, fieldId: 'missing' }).applied).toBe(
        false
    );
    applied(change({ kind: 'deleteField', id: name }));
    expect(document().dataEntities[customers].labelFieldId).toBeUndefined();
    applied(change({ kind: 'setValue', recordId: ada, fieldId: email, value: 'ada@example.com' }));
    expect(recordLabel(document(), ada)).toBe('ada@example.com');
});

it('round trips the new settings through the readers and marks the new format', () => {
    const { store, change, customers, name, status, customer } = setup();
    applied(change({ kind: 'setLabelField', entityId: customers, fieldId: name }));
    const saved = serializePersistedState(store.state);
    expect(saved.version).toBe(32);
    const migrated = migratePersistedState(JSON.parse(JSON.stringify(saved)))!;
    const restored = hydrateDocument(migrated.documents[store.state.currentDocumentId]);
    expect(restored.dataFields[status].options).toEqual(['Open', 'Shipped']);
    expect(restored.dataFields[customer].targetEntityId).toBe(customers);
    expect(restored.dataEntities[customers].labelFieldId).toBe(name);
    expect(() =>
        readEntity('dataFields', { ...restored.dataFields[status], type: 'date' })
    ).toThrow('Invalid field type');
    expect(() =>
        readEntity('dataFields', { ...restored.dataFields[status], options: 'Open' })
    ).toThrow();
});

it(`refuses more than ${MAX_RECORDS_PER_ENTITY} records per entity and reports concurrent overflow`, async () => {
    const { store, orders, order } = setup();
    const saved = serializePersistedState(store.state);
    const records = saved.documents[saved.currentDocumentId].dataRecords;
    for (let index = 1; index < MAX_RECORDS_PER_ENTITY; index++) {
        records[`r${index}`] = { ...records[order], id: `r${index}`, order: index };
    }
    const full = createTestStore({ reactor: JSON.stringify(saved) }).store;
    await full.onInitialize();
    const documentId = full.state.currentDocumentId;
    expect(full.actions.editData({ kind: 'addRecord', entityId: orders, documentId })).toEqual({
        applied: false,
        problem: 'An entity holds up to 1,000 sample records.'
    });
    // Two copies adding at once can pass the limit; it is reported, never trimmed.
    const document = full.state.currentDocument;
    const extra = { ...records[order], id: 'extra', order: MAX_RECORDS_PER_ENTITY };
    expect(
        dataProblems({ ...document, dataRecords: { ...document.dataRecords, extra } })
    ).toContain('Orders has 1001 records; entities hold up to 1,000.');
});

const nodes = (items: PreviewNode[]): PreviewNode[] =>
    items.flatMap((item) => [
        item,
        ...nodes([...(item.children ?? []), ...Object.values(item.records ?? {})])
    ]);

it('shows a choice as its option and a reference as its record name in repeated lists', () => {
    const { document, instance } = dataListFixture();
    document.dataEntities.teams = { id: 'teams', name: 'Teams' };
    document.dataFields.team = {
        id: 'team',
        entityId: 'teams',
        name: 'Team',
        type: 'text',
        required: true
    };
    document.dataRecords.blue = {
        id: 'blue',
        entityId: 'teams',
        order: 0,
        values: { team: 'Blue' }
    };
    document.dataFields.member = {
        id: 'member',
        entityId: 'customers',
        name: 'Member of',
        type: 'reference',
        required: false,
        targetEntityId: 'teams'
    };
    document.dataRecords.ada.values.member = 'blue';
    document.dataRecords.grace.values.member = 'gone';
    instance.dataList!.fields = { label: 'member' };
    const warnings: string[] = [];
    const values = nodes(projectPreview(document, {}, warnings).screens[0].nodes)
        .filter((node) => node.control?.role === 'input')
        .map((node) => node.control?.value);
    expect(values).toEqual(['Blue', 'Your name']);
    expect(warnings.some((warning) => warning.includes('no longer exists'))).toBe(true);

    document.dataFields.member = {
        ...document.dataFields.member,
        type: 'choice',
        options: ['Blue', 'Red']
    };
    document.dataRecords.grace.values.member = 'Red';
    expect(
        nodes(projectPreview(document, {}).screens[0].nodes)
            .filter((node) => node.control?.role === 'input')
            .map((node) => node.control?.value)
    ).toEqual(['Your name', 'Red']);
});

it('saves choice and reference values from a Prototype record form', () => {
    const { document } = dataListFixture();
    document.dataFields.tier = {
        id: 'tier',
        entityId: 'customers',
        name: 'Tier',
        type: 'choice',
        required: true,
        options: ['Free', 'Pro']
    };
    document.dataFields.mentor = {
        id: 'mentor',
        entityId: 'customers',
        name: 'Mentor',
        type: 'reference',
        required: false,
        targetEntityId: 'customers'
    };
    const session = { documentId: document.id, records: {} };
    const bad = saveRecord(document, session, 'ada', { name: 'Ada', tier: 'Gold', mentor: 'x' });
    expect(bad.problems).toEqual({
        tier: 'Tier must be one of its options.',
        mentor: 'Mentor refers to a record that no longer exists.'
    });
    const good = saveRecord(document, session, 'ada', {
        name: 'Ada',
        tier: 'Pro',
        mentor: 'grace'
    });
    expect(good.problems).toEqual({});
    expect(sessionDocument(document, good.session).dataRecords.ada.values).toMatchObject({
        tier: 'Pro',
        mentor: 'grace'
    });
    expect(
        saveRecord(document, session, 'ada', { name: 'Ada', tier: 'Free', mentor: '' }).problems
    ).toEqual({});
});
