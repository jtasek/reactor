import { defineDataCase } from '../../expected';

const names = [
    'Ada Park',
    'Bruno Silva',
    'Chen Wei',
    'Dana Levi',
    'Elif Kaya',
    'Farah Haddad',
    'Goran Petrov',
    'Hana Sato',
    'Ivan Novak',
    'Jade Martin',
    'Kofi Mensah',
    'Lena Weber',
    'Mateo Ruiz',
    'Nia Brown',
    'Omar Aziz',
    'Priya Nair',
    'Quinn Ryan',
    'Rosa Costa',
    'Sven Berg',
    'Tara Singh'
];
const plans = ['Free', 'Pro', 'Team'];

export default defineDataCase({
    fixture: {
        shapes: {
            title: { type: 'text', position: { x: 0, y: 0 }, value: 'Name', fontSize: 16 },
            detail: { type: 'text', position: { x: 0, y: 24 }, value: 'Detail', fontSize: 12 },
            row: {
                type: 'instance',
                name: 'Customer row',
                componentId: 'listRow',
                position: { x: 40, y: 120 },
                overrides: {}
            }
        },
        components: {
            listRow: {
                name: 'List row',
                shapesIds: ['title', 'detail'],
                sourceOnly: true,
                props: [
                    { id: 'heading', label: 'Heading', shapeId: 'title', key: 'text' },
                    { id: 'caption', label: 'Caption', shapeId: 'detail', key: 'text' }
                ]
            }
        }
    },
    prompt: 'Make a Customers entity with name, email, plan (Free, Pro or Team), number of seats and whether they are active, with 20 sample customers, and show them in the Customer row list with the name and email.',
    reference: [
        [
            {
                op: 'addEntity',
                key: 'customers',
                name: 'Customers',
                fields: [
                    { key: 'name', name: 'Name', type: 'text', required: true },
                    { key: 'email', name: 'Email', type: 'text', required: true },
                    { key: 'plan', name: 'Plan', type: 'choice', required: true, options: plans },
                    { key: 'seats', name: 'Seats', type: 'number', required: true },
                    { key: 'active', name: 'Active', type: 'boolean', required: true }
                ],
                labelField: 'name',
                records: names.map((name, index) => ({
                    values: {
                        name,
                        email: `${name.split(' ')[0].toLowerCase()}@example.com`,
                        plan: plans[index % 3],
                        seats: index % 3 === 0 ? 1 : 2 + index,
                        active: index % 4 !== 3
                    }
                }))
            },
            {
                op: 'updateShape',
                shape: 'row',
                changes: {
                    dataList: {
                        entityId: 'customers',
                        fields: { heading: 'name', caption: 'email' },
                        gap: 8
                    }
                }
            }
        ]
    ],
    expected: {
        entity: 'Customers',
        fieldTypes: {
            Name: 'text',
            Email: 'text',
            Plan: 'choice',
            Seats: 'number',
            Active: 'boolean'
        },
        records: 20,
        listComponent: 'listRow'
    }
});
