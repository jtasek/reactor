import { createTestStore } from './support/store';
import { createCopies, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';
import { dataListFixture } from './support/dataList';
import { dataLeftovers, dataProblems, ruleProblems } from 'src/app/data';
import type { DataChange, DataEditResult } from 'src/app/dataEdits';
import { MAX_RULES_PER_ENTITY } from 'src/app/dataEdits';
import type { DataField } from 'src/app/dataTypes';
import {
    conditionFields,
    conditionProblems,
    evaluateCondition,
    MAX_CONDITION_DEPTH,
    type Condition
} from 'src/app/expressions';
import {
    hydrateDocument,
    migratePersistedState,
    readCondition,
    readEntity,
    serializePersistedState
} from 'src/app/services/documentStorage';
import { checkRecordDraft, saveRecord, sessionDocument } from 'src/preview/recordForms';

function applied(result: DataEditResult) {
    if (!result.applied) {
        throw new Error(result.problem);
    }

    return result.id!;
}

const field = (fieldId: string) => ({ kind: 'field', fieldId }) as const;
const value = (value: string | number | boolean | null) => ({ kind: 'value', value }) as const;

function setup(store = createTestStore().store) {
    const documentId = store.state.currentDocumentId;
    const change = (input: DataChange) => store.actions.editData({ ...input, documentId });
    const customers = applied(change({ kind: 'addEntity', name: 'Customers' }));
    const add = (name: string, type: DataField['type'], extra: Partial<DataField> = {}) =>
        applied(
            change({
                kind: 'addField',
                entityId: customers,
                name,
                type,
                required: false,
                ...extra
            })
        );
    const email = add('Email', 'text');
    const age = add('Age', 'number');
    const plan = add('Plan', 'choice', { options: ['Free', 'Pro'] });
    const seats = add('Seats', 'number');
    const ada = applied(change({ kind: 'addRecord', entityId: customers }));
    applied(change({ kind: 'setValue', recordId: ada, fieldId: email, value: 'ada@example.com' }));
    applied(change({ kind: 'setValue', recordId: ada, fieldId: age, value: 36 }));
    applied(change({ kind: 'setValue', recordId: ada, fieldId: plan, value: 'Pro' }));
    applied(change({ kind: 'setValue', recordId: ada, fieldId: seats, value: 5 }));

    return { store, change, customers, email, age, plan, seats, ada };
}

describe('conditions', () => {
    const fields: Record<string, DataField> = {
        name: { id: 'name', entityId: 'e', name: 'Name', type: 'text', required: false },
        age: { id: 'age', entityId: 'e', name: 'Age', type: 'number', required: false },
        plan: {
            id: 'plan',
            entityId: 'e',
            name: 'Plan',
            type: 'choice',
            required: false,
            options: ['Free', 'Pro']
        },
        owner: {
            id: 'owner',
            entityId: 'e',
            name: 'Owner',
            type: 'reference',
            required: false,
            targetEntityId: 'e'
        }
    };
    const scope = { field: (id: string) => fields[id] };
    const values: Record<string, string | number | boolean | null> = {
        name: '  Ada Lovelace ',
        age: 36,
        plan: 'Pro',
        owner: null
    };
    const run = (condition: Condition) =>
        evaluateCondition(condition, (operand) =>
            operand.kind === 'field' ? values[operand.fieldId] : true
        );

    it('evaluates comparisons, combinations and unset values', () => {
        expect(run({ kind: 'equals', left: field('name'), right: value('Ada Lovelace') })).toBe(
            true
        );
        expect(run({ kind: 'equals', left: field('name'), right: value('ada lovelace') })).toBe(
            false
        );
        expect(run({ kind: 'contains', left: field('name'), right: value('LOVE') })).toBe(true);
        expect(run({ kind: 'greater', left: field('age'), right: value(17) })).toBe(true);
        expect(run({ kind: 'less', left: field('age'), right: value(17) })).toBe(false);
        expect(run({ kind: 'isSet', operand: field('owner') })).toBe(false);
        // Any comparison with an unset value is false; notEquals is not equals.
        expect(run({ kind: 'equals', left: field('owner'), right: value('x') })).toBe(false);
        expect(run({ kind: 'notEquals', left: field('owner'), right: value('x') })).toBe(true);
        expect(run({ kind: 'greater', left: field('missing'), right: value(1) })).toBe(false);
        const adult: Condition = { kind: 'greater', left: field('age'), right: value(17) };
        const free: Condition = { kind: 'equals', left: field('plan'), right: value('Free') };
        expect(run({ kind: 'and', conditions: [adult, free] })).toBe(false);
        expect(run({ kind: 'or', conditions: [adult, free] })).toBe(true);
        expect(run({ kind: 'not', condition: free })).toBe(true);
        expect(run({ kind: 'isSet', operand: { kind: 'state', stateId: 'open' } })).toBe(true);
    });

    it('compares a reference only with a record of its entity, and lists the fields read', () => {
        const other: DataField = {
            id: 'other',
            entityId: 'e',
            name: 'Other',
            type: 'reference',
            required: false,
            targetEntityId: 'elsewhere'
        };
        const wider = { field: (id: string) => (id === 'other' ? other : fields[id]) };
        for (const right of [field('name'), field('other')]) {
            expect(
                conditionProblems({ kind: 'equals', left: field('owner'), right }, wider)
            ).toEqual(['Compares values of different types.']);
        }
        expect(
            conditionProblems(
                { kind: 'notEquals', left: field('owner'), right: value('record-1') },
                wider
            )
        ).toEqual([]);
        expect(
            conditionFields({
                kind: 'or',
                conditions: [
                    { kind: 'not', condition: { kind: 'isSet', operand: field('age') } },
                    { kind: 'less', left: field('age'), right: field('plan') },
                    { kind: 'isSet', operand: { kind: 'state', stateId: 'open' } }
                ]
            })
        ).toEqual(['age', 'age', 'plan']);
    });

    it('reports conditions that can never compare or use what is not there', () => {
        expect(
            conditionProblems(
                {
                    kind: 'and',
                    conditions: [
                        { kind: 'greater', left: field('age'), right: field('name') },
                        { kind: 'contains', left: field('owner'), right: value('a') },
                        { kind: 'equals', left: field('plan'), right: value('Gold') },
                        { kind: 'equals', left: field('age'), right: value('36') },
                        { kind: 'equals', left: field('age'), right: value(null) },
                        { kind: 'isSet', operand: field('gone') },
                        { kind: 'greater', left: field('gone'), right: value('x') },
                        { kind: 'isSet', operand: { kind: 'state', stateId: 'open' } }
                    ]
                },
                scope
            )
        ).toEqual([
            'Only numbers can be less or greater.',
            'Only text can contain text.',
            'Plan has no option "Gold".',
            'Compares values of different types.',
            'Use "is set" to check for a missing value.',
            'Uses a field that no longer exists.',
            'State values are not available here.'
        ]);
        expect(
            conditionProblems(
                {
                    kind: 'or',
                    conditions: [
                        { kind: 'greater', left: field('age'), right: value(17) },
                        { kind: 'equals', left: field('plan'), right: field('name') },
                        { kind: 'isSet', operand: { kind: 'state', stateId: 'open' } }
                    ]
                },
                { ...scope, state: (id) => (id === 'open' ? { name: 'Open' } : undefined) }
            )
        ).toEqual([]);
    });

    it('reads only typed, bounded trees', () => {
        const condition: Condition = {
            kind: 'not',
            condition: {
                kind: 'or',
                conditions: [
                    { kind: 'isSet', operand: { kind: 'state', stateId: 'open' } },
                    { kind: 'less', left: field('age'), right: value(3) }
                ]
            }
        };
        expect(readCondition(JSON.parse(JSON.stringify(condition)))).toEqual(condition);
        for (const bad of [
            'age > 3',
            { kind: 'matches', left: field('a'), right: value('x') },
            { kind: 'and', conditions: [] },
            { kind: 'isSet', operand: { kind: 'formula', text: '1' } },
            { kind: 'equals', left: field('__proto__'), right: value(1) },
            { kind: 'equals', left: field('a'), right: value('x'.repeat(1001)) },
            { kind: 'equals', left: field('a'), right: { kind: 'value', value: {} } }
        ]) {
            expect(() => readCondition(bad)).toThrow();
        }
        let deep: Condition = { kind: 'isSet', operand: field('a') };
        for (let depth = 1; depth < MAX_CONDITION_DEPTH; depth++) {
            deep = { kind: 'not', condition: deep };
        }
        expect(() => readCondition(deep)).not.toThrow();
        expect(() => readCondition({ kind: 'not', condition: deep })).toThrow('too large');
        const wide = {
            kind: 'and',
            conditions: Array.from({ length: 50 }, () => ({
                kind: 'isSet',
                operand: field('a')
            }))
        };
        expect(() => readCondition(wide)).toThrow('too large');
    });
});

it('adds, edits and deletes rules, refusing ones that cannot run', () => {
    const { store, change, customers, email, age, plan } = setup();
    const document = () => store.state.currentDocument;
    const adults = applied(
        change({
            kind: 'addRule',
            entityId: customers,
            rule: {
                check: { kind: 'greater', left: field(age), right: value(17) },
                message: 'Customers must be adults.',
                fieldId: age
            }
        })
    );
    expect(document().dataRules[adults]).toMatchObject({ entityId: customers, order: 0 });
    expect(
        change({
            kind: 'addRule',
            entityId: customers,
            rule: {
                check: { kind: 'equals', left: field(plan), right: value('Gold') },
                message: 'Gold only'
            }
        })
    ).toEqual({ applied: false, problem: 'Plan has no option "Gold".' });
    expect(
        change({
            kind: 'addRule',
            entityId: customers,
            rule: { check: { kind: 'isSet', operand: field(email) }, message: '  ' }
        }).applied
    ).toBe(false);
    expect(
        change({
            kind: 'addRule',
            entityId: customers,
            rule: {
                check: { kind: 'isSet', operand: { kind: 'state', stateId: 'x' } },
                message: 'State'
            }
        })
    ).toEqual({ applied: false, problem: 'State values are not available here.' });
    const other = applied(change({ kind: 'addEntity', name: 'Other' }));
    const otherField = applied(
        change({ kind: 'addField', entityId: other, name: 'X', type: 'text', required: false })
    );
    expect(
        change({
            kind: 'addRule',
            entityId: customers,
            rule: { check: { kind: 'isSet', operand: field(otherField) }, message: 'X' }
        }).applied
    ).toBe(false);
    expect(
        change({
            kind: 'addRule',
            entityId: customers,
            rule: {
                check: { kind: 'isSet', operand: field(email) },
                message: 'X',
                fieldId: otherField
            }
        }).applied
    ).toBe(false);
    applied(
        change({
            kind: 'updateRule',
            id: adults,
            rule: {
                when: { kind: 'isSet', operand: field(age) },
                check: { kind: 'greater', left: field(age), right: value(20) },
                message: 'Customers must be 21 or older.'
            }
        })
    );
    expect(document().dataRules[adults]).toMatchObject({
        message: 'Customers must be 21 or older.',
        order: 0
    });
    expect(document().dataRules[adults].fieldId).toBeUndefined();
    applied(change({ kind: 'deleteRule', id: adults }));
    expect(document().dataRules).toEqual({});
    expect(change({ kind: 'deleteRule', id: adults }).applied).toBe(false);
});

it(`allows up to ${MAX_RULES_PER_ENTITY} rules per entity`, () => {
    const { change, customers, email } = setup();
    for (let index = 0; index < MAX_RULES_PER_ENTITY; index++) {
        applied(
            change({
                kind: 'addRule',
                entityId: customers,
                rule: { check: { kind: 'isSet', operand: field(email) }, message: `${index}` }
            })
        );
    }
    expect(
        change({
            kind: 'addRule',
            entityId: customers,
            rule: { check: { kind: 'isSet', operand: field(email) }, message: 'One more' }
        })
    ).toEqual({ applied: false, problem: `An entity has up to ${MAX_RULES_PER_ENTITY} rules.` });
});

it('lists sample records that break a rule, and rules a schema edit stops', () => {
    const { store, change, customers, email, plan, seats, ada } = setup();
    const document = () => store.state.currentDocument;
    const pro = applied(
        change({
            kind: 'addRule',
            entityId: customers,
            rule: {
                when: { kind: 'equals', left: field(plan), right: value('Pro') },
                check: { kind: 'greater', left: field(seats), right: value(9) },
                message: 'Pro plans have at least 10 seats.',
                fieldId: seats
            }
        })
    );
    applied(
        change({
            kind: 'addRule',
            entityId: customers,
            rule: {
                check: { kind: 'contains', left: field(email), right: value('@') },
                message: 'Enter an email address.'
            }
        })
    );
    expect(dataProblems(document())).toEqual([
        'Customers record 1: Pro plans have at least 10 seats.'
    ]);
    applied(change({ kind: 'setValue', recordId: ada, fieldId: plan, value: 'Free' }));
    expect(dataProblems(document())).toEqual([]);

    // Deleting or retyping a field leaves the rule in place and reports it.
    applied(change({ kind: 'updateField', id: seats, changes: { type: 'text' } }));
    expect(ruleProblems(document(), document().dataRules[pro])).toEqual([
        'Only numbers can be less or greater.'
    ]);
    applied(change({ kind: 'deleteField', id: seats }));
    expect(document().dataRules[pro].check).toEqual({
        kind: 'greater',
        left: field(seats),
        right: value(9)
    });
    expect(dataProblems(document())).toEqual([
        `Customers: rule "Pro plans have at least 10 seats." can't run. Uses a field that no longer exists.`
    ]);
    applied(change({ kind: 'deleteEntity', id: customers }));
    expect(document().dataRules).toEqual({});
});

it('refuses to save a Prototype form that breaks a rule, showing the message where it belongs', () => {
    const { document } = dataListFixture();
    document.dataFields.age = {
        id: 'age',
        entityId: 'customers',
        name: 'Age',
        type: 'number',
        required: false
    };
    document.dataRules.adult = {
        id: 'adult',
        entityId: 'customers',
        when: { kind: 'isSet', operand: field('age') },
        check: { kind: 'greater', left: field('age'), right: value(17) },
        message: 'Customers must be adults.',
        fieldId: 'age',
        order: 0
    };
    document.dataRules.grace = {
        id: 'grace',
        entityId: 'customers',
        check: { kind: 'notEquals', left: field('name'), right: value('Grace') },
        message: 'Grace is already a customer.',
        order: 1
    };
    // A rule that can't run never blocks a form.
    document.dataRules.stale = {
        id: 'stale',
        entityId: 'customers',
        check: { kind: 'isSet', operand: field('deleted') },
        message: 'Stale',
        order: 2
    };
    const session = { documentId: document.id, records: {} };
    expect(saveRecord(document, session, 'ada', { name: 'Grace', age: '12' }).problems).toEqual({
        age: 'Customers must be adults.',
        record: 'Grace is already a customer.'
    });
    // A field's own problem comes before the rules.
    expect(checkRecordDraft(document, 'customers', { name: 'Ada', age: 'old' }).problems).toEqual({
        age: 'Age must be number.'
    });
    expect(saveRecord(document, session, 'ada', { name: 'Ada', age: '' }).problems).toEqual({});
    const saved = saveRecord(document, session, 'ada', { name: 'Ada', age: '40' });
    expect(saved.problems).toEqual({});
    expect(sessionDocument(document, saved.session).dataRecords.ada.values.age).toBe(40);
});

it('round trips rules through the readers and leftovers', () => {
    const { store, change, customers, email } = setup();
    const id = applied(
        change({
            kind: 'addRule',
            entityId: customers,
            rule: {
                check: { kind: 'contains', left: field(email), right: value('@') },
                message: 'Enter an email address.',
                fieldId: email
            }
        })
    );
    const saved = serializePersistedState(store.state);
    const migrated = migratePersistedState(JSON.parse(JSON.stringify(saved)))!;
    const restored = hydrateDocument(migrated.documents[store.state.currentDocumentId]);
    expect(restored.dataRules[id]).toEqual(store.state.currentDocument.dataRules[id]);
    expect(() => readEntity('dataRules', { ...restored.dataRules[id], check: 'x' })).toThrow();

    // A document saved before rules existed reads with none.
    const older = JSON.parse(JSON.stringify(saved));
    delete older.documents[saved.currentDocumentId].dataRules;
    older.version = 32;
    expect(
        hydrateDocument(migratePersistedState(older)!.documents[saved.currentDocumentId]).dataRules
    ).toEqual({});

    // A rule left by a concurrent entity delete is a leftover.
    const leftover = { ...restored, dataEntities: {} };
    expect(customers in restored.dataEntities).toBe(true);
    expect(dataLeftovers(leftover).rules).toEqual([id]);
});

it('shares rule edits and undoes them', async () => {
    let fixture: ReturnType<typeof setup>;
    const copies = await createCopies(2, (store) => {
        fixture = setup(store);
    });
    const [a, b] = copies;
    const { customers, email } = fixture!;
    const id = applied(
        a.store.actions.editData({
            kind: 'addRule',
            entityId: customers,
            rule: { check: { kind: 'isSet', operand: field(email) }, message: 'Email is needed.' },
            documentId: DOCUMENT_ID
        })
    );
    settle(copies);
    expect(shownDocument(b).dataRules[id].message).toBe('Email is needed.');
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).dataRules[id]).toBeUndefined();
    copies.forEach((copy) => copy.collaboration.dispose());
});
