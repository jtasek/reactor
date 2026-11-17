import { json } from 'overmind';
import { dataProblems, dataRecords, MAX_RECORDS_PER_ENTITY, recordLabel } from 'src/app/data';
import type { AddEntity, Operation } from 'src/app/operations';
import { stageBatch } from 'src/app/operationBatches';
import { readOperation } from 'src/ai/operations';
import { describeOperation } from 'src/ai/describe';
import { documentContext } from 'src/ai/context';
import { previewProposal } from 'src/ai/preview';
import { projectPreview } from 'src/preview/project';
import type { PreviewNode } from 'src/shared/previewProtocol';
import type { Document } from 'src/app/types';
import { dataListFixture } from './support/dataList';
import {
    createCopies,
    DOCUMENT_ID,
    settle,
    sharedContent,
    shownDocument
} from './support/collaboration';

const AI = { kind: 'ai', model: 'test', requestId: 'request' } as const;

const plans: AddEntity = {
    op: 'addEntity',
    key: 'plans',
    name: 'Plans',
    fields: [{ key: 'title', name: 'Title', type: 'text', required: true }],
    labelField: 'title',
    records: [
        { key: 'basic', values: { title: 'Basic' } },
        { key: 'pro', values: { title: 'Pro' } }
    ]
};

const members: AddEntity = {
    op: 'addEntity',
    key: 'members',
    name: 'Members',
    fields: [
        { key: 'name', name: 'Name', type: 'text', required: true },
        { key: 'seats', name: 'Seats', type: 'number', required: false },
        { key: 'active', name: 'Active', type: 'boolean', required: true },
        { key: 'status', name: 'Status', type: 'choice', options: ['Trial', 'Paid'] },
        { key: 'plan', name: 'Plan', type: 'reference', targetEntity: 'plans' },
        { key: 'mentor', name: 'Mentor', type: 'reference', targetEntity: 'members' }
    ],
    labelField: 'name',
    records: [
        {
            key: 'lin',
            values: { name: 'Lin', seats: 3, active: true, status: 'Paid', plan: 'pro' }
        },
        {
            values: { name: 'Sam', active: false, status: 'Trial', plan: 'basic', mentor: 'lin' }
        }
    ]
};

const nodes = (items: PreviewNode[]): PreviewNode[] =>
    items.flatMap((item) => [
        item,
        ...nodes([...(item.children ?? []), ...Object.values(item.records ?? {})])
    ]);

let sequence = 0;
const newId = () => `new-${sequence++}`;

function stage(document: Document, operations: Operation[]) {
    const result = stageBatch(document, operations, newId);

    return result.valid ? result.staged : result;
}

const problem = (document: Document, operations: Operation[]) => {
    const result = stageBatch(document, operations, newId);

    return result.valid ? undefined : result.problem;
};

async function fixtureCopies() {
    const { document } = dataListFixture();

    return createCopies(2, (store) =>
        store.actions.addDocument({ ...json(document), id: DOCUMENT_ID })
    );
}

it('adds entities with every field type, their records and a list bound to them as one shared undo step', async () => {
    const copies = await fixtureCopies();
    const [a, b] = copies;
    const result = a.store.actions.applyOperations({
        documentId: DOCUMENT_ID,
        by: AI,
        operations: [
            plans,
            members,
            {
                op: 'updateShape',
                shape: 'name',
                changes: { dataList: { entityId: 'members', fields: { label: 'plan' }, gap: 12 } }
            }
        ]
    });
    if (!result.applied) throw new Error(result.problem);
    settle(copies);
    const document = shownDocument(b);
    const entity = Object.values(document.dataEntities).find(({ name }) => name === 'Members')!;
    const fields = Object.values(document.dataFields).filter(
        ({ entityId }) => entityId === entity.id
    );
    expect(fields.map(({ name, type }) => [name, type]).sort()).toEqual([
        ['Active', 'boolean'],
        ['Mentor', 'reference'],
        ['Name', 'text'],
        ['Plan', 'reference'],
        ['Seats', 'number'],
        ['Status', 'choice']
    ]);
    expect(entity.labelFieldId).toBe(fields.find(({ name }) => name === 'Name')!.id);
    const [lin, sam] = dataRecords(document, entity.id);
    const field = (name: string) => fields.find((each) => each.name === name)!.id;
    expect(recordLabel(document, lin.values[field('Plan')] as string)).toBe('Pro');
    expect(sam.values[field('Mentor')]).toBe(lin.id);
    expect(sam.values).not.toHaveProperty(field('Seats'));
    expect(result.ids).toMatchObject({ members: entity.id, lin: lin.id });
    expect(dataProblems(document)).toEqual([]);
    expect(document.shapes.name).toMatchObject({
        dataList: { entityId: entity.id, fields: { label: field('Plan') }, gap: 12 }
    });
    expect(sharedContent(a)).toEqual(sharedContent(b));

    // Renaming a field keeps its binding: lists name fields by ID.
    a.store.actions.openDocument(DOCUMENT_ID);
    a.store.actions.editData({
        documentId: DOCUMENT_ID,
        kind: 'updateField',
        id: field('Plan'),
        changes: { name: 'Subscription' }
    });
    settle(copies);
    const shown = nodes(projectPreview(shownDocument(b), {}).screens[0].nodes)
        .filter((node) => node.control?.role === 'input')
        .map((node) => node.control?.value);
    expect(shown).toEqual(['Pro', 'Basic']);

    a.collaboration.undo(DOCUMENT_ID);
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(Object.keys(shownDocument(b).dataEntities)).toEqual(['customers']);
    expect(shownDocument(b).shapes.name).toMatchObject({
        dataList: { entityId: 'customers', fields: { label: 'name' }, gap: 8 }
    });
});

it.each<[string, Operation[], string]>([
    [
        'a missing required value',
        [{ ...plans, records: [{ values: {} }] }],
        'Operation 1: Record 1 of Plans: Title is required.'
    ],
    [
        'a value of another type',
        [plans, { ...members, records: [{ values: { name: 'Lin', active: 'yes' } }] }],
        'Active must be boolean.'
    ],
    [
        'a choice outside its options',
        [
            plans,
            { ...members, records: [{ values: { name: 'Lin', active: true, status: 'Gold' } }] }
        ],
        'Status must be one of its options.'
    ],
    [
        'a reference to a record of another entity',
        [plans, { ...members, records: [{ values: { name: 'Lin', active: true, plan: 'ada' } }] }],
        'Plan refers to a record that no longer exists.'
    ],
    [
        'a reference to a record a later operation adds',
        [
            { ...members, fields: members.fields.slice(0, 3), records: undefined },
            {
                ...plans,
                fields: [
                    ...plans.fields,
                    { key: 'owner', name: 'Owner', type: 'reference', targetEntity: 'members' }
                ],
                records: [{ values: { title: 'Basic', owner: 'lin' } }]
            },
            {
                op: 'addRecords',
                entity: 'members',
                records: [{ key: 'lin', values: { name: 'Lin', active: true } }]
            }
        ],
        'lin is a record a later operation adds.'
    ],
    [
        'an unknown field',
        [{ ...plans, records: [{ values: { title: 'Basic', price: 4 } }] }],
        'price is not a field of Plans.'
    ],
    [
        'a reference field to an entity added later',
        [members, plans],
        'plans is not one of the batch’s earlier entities.'.replace('’', "'")
    ],
    [
        'a taken entity name',
        [{ ...plans, name: 'Customers' }],
        'the entity name Customers is taken.'
    ],
    [
        'a repeated field name',
        [{ ...plans, fields: [...plans.fields, { key: 'other', name: 'Title', type: 'text' }] }],
        'the field name Title is taken.'
    ],
    [
        'a choice without options',
        [{ ...plans, fields: [...plans.fields, { key: 'tier', name: 'Tier', type: 'choice' }] }],
        'the choice field Tier needs options.'
    ],
    [
        'a label field that is not text',
        [
            {
                ...plans,
                fields: [...plans.fields, { key: 'price', name: 'Price', type: 'number' }],
                labelField: 'price'
            }
        ],
        'records are named by a text field.'
    ],
    [
        'a key a shape of the batch uses',
        [
            plans,
            {
                op: 'addShape',
                key: 'plans',
                shape: { type: 'text', name: 'T', position: { x: 0, y: 0 }, value: 'T' } as never
            }
        ],
        'the key plans is taken.'
    ],
    [
        'a list mapping a text prop to a number field',
        [
            {
                ...plans,
                fields: [...plans.fields, { key: 'price', name: 'Price', type: 'number' }]
            },
            {
                op: 'updateShape',
                shape: 'name',
                changes: { dataList: { entityId: 'plans', fields: { label: 'price' }, gap: 8 } }
            }
        ],
        'Data mapping label refers to a missing or incompatible field or property.'
    ],
    [
        'a list over a missing entity',
        [
            {
                op: 'updateShape',
                shape: 'name',
                changes: { dataList: { entityId: 'nothing', fields: {}, gap: 8 } }
            }
        ],
        'nothing is not an entity of the document.'
    ]
])('refuses %s, naming the operation and record', (_, operations, expected) => {
    const { document } = dataListFixture();

    expect(problem(document, operations)).toContain(expected);
});

it('adds records to an entity the document has, after its last, and checks its rules', () => {
    const { document } = dataListFixture();
    document.dataRules.long = {
        id: 'long',
        entityId: 'customers',
        order: 0,
        message: 'Names have two letters or more.',
        check: {
            kind: 'notEquals',
            left: { kind: 'field', fieldId: 'name' },
            right: { kind: 'value', value: 'X' }
        }
    };
    const staged = stage(document, [
        { op: 'addRecords', entity: 'customers', records: [{ values: { name: 'Lin' } }] }
    ]);
    expect(staged).toMatchObject({
        dataRecords: [{ entityId: 'customers', order: 2, values: { name: 'Lin' } }]
    });
    expect(
        problem(document, [
            { op: 'addRecords', entity: 'customers', records: [{ values: { name: 'X' } }] }
        ])
    ).toBe('Operation 1: Record 1 of Customers: Names have two letters or more.');
});

it('refuses data in a locked document', () => {
    const { document } = dataListFixture();
    document.locked = true;

    expect(problem(document, [plans])).toBe('Operation 1: The document is locked.');
});

it('refuses records past the limit of an entity', () => {
    const { document } = dataListFixture();
    const records = Array.from({ length: MAX_RECORDS_PER_ENTITY - 1 }, (_, index) => ({
        values: { name: `Customer ${index}` }
    }));

    expect(problem(document, [{ op: 'addRecords', entity: 'customers', records }])).toContain(
        'Customers would have 1001 records; entities hold up to 1,000.'
    );
});

it('reads proposed data operations as untrusted input and describes them', () => {
    const { document } = dataListFixture();
    const read = readOperation({ ...members, extra: true });

    expect(read).toEqual({
        ...members,
        fields: members.fields.map((f) => ({ required: false, ...f }))
    });
    expect(() =>
        readOperation({ ...plans, fields: [{ key: 'a', name: 'A', type: 'date' }] })
    ).toThrow('date is not a type of field.');
    expect(() => readOperation({ ...plans, records: [{ values: { title: {} } }] })).toThrow(
        'The value of title is not text, a number or a boolean.'
    );
    expect(() =>
        readOperation({ op: 'updateShape', shape: 'name', changes: { dataList: { fields: {} } } })
    ).toThrow();
    expect(describeOperation(read, document)).toBe(
        'Add entity “Members” with Name (text), Seats (number), Active (boolean), Status (choice), Plan (reference), Mentor (reference) and 2 records'
    );
    expect(
        describeOperation(
            { op: 'addRecords', entity: 'customers', records: [{ values: {} }] },
            document
        )
    ).toBe('Add 1 record to “Customers”');
});

it('sends the data schema and record names as context', async () => {
    const [copy] = await fixtureCopies();

    expect(documentContext(shownDocument(copy)).data).toEqual({
        customers: {
            name: 'Customers',
            fields: { name: { name: 'Name', type: 'text', required: true } },
            recordCount: 2,
            records: { ada: 'Ada', grace: 'Grace' }
        }
    });
});

it('previews proposed records as text, the first five of each entity, and draws nothing for data alone', async () => {
    const [copy] = await fixtureCopies();
    const many = {
        ...members,
        records: [
            ...members.records!,
            ...Array.from({ length: 4 }, (_, index) => ({
                values: { name: `Guest ${index}`, active: false }
            }))
        ]
    };
    const preview = previewProposal(shownDocument(copy), [plans, many]);
    if (!preview.valid) throw new Error(preview.problem);

    expect(preview.changes.ids.size + preview.changes.removed.length).toBe(0);
    expect(preview.records).toEqual([
        { entity: 'Plans', fields: ['Title'], rows: [['Basic'], ['Pro']], total: 2 },
        {
            entity: 'Members',
            fields: ['Active', 'Mentor', 'Name', 'Plan', 'Seats', 'Status'],
            rows: [
                ['Yes', '', 'Lin', 'Pro', '3', 'Paid'],
                ['No', 'Lin', 'Sam', 'Basic', '', 'Trial'],
                ['No', '', 'Guest 0', '', '', ''],
                ['No', '', 'Guest 1', '', '', ''],
                ['No', '', 'Guest 2', '', '', '']
            ],
            total: 6
        }
    ]);
});

it('describes a list binding by its entity', () => {
    const { document } = dataListFixture();
    const bind = (
        dataList: { entityId: string; fields: Record<string, string>; gap: number } | null
    ) =>
        describeOperation({ op: 'updateShape', shape: 'name', changes: { dataList } }, document, [
            plans
        ]);

    expect(bind({ entityId: 'plans', fields: { label: 'title' }, gap: 8 })).toContain(
        'repeat over “Plans”'
    );
    expect(bind(null)).toContain('stop repeating over records');
});
