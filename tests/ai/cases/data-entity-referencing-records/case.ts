import { defineDataCase } from '../../expected';

const customers = ['ada', 'grace', 'linus'];
const statuses = ['Placed', 'Shipped', 'Delivered'];

export default defineDataCase({
    fixture: {
        shapes: {
            title: { type: 'text', position: { x: 0, y: 0 }, value: 'Name', fontSize: 16 },
            detail: { type: 'text', position: { x: 0, y: 24 }, value: 'Detail', fontSize: 12 },
            row: {
                type: 'instance',
                name: 'Order row',
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
        },
        data: {
            entities: { people: { name: 'Customers', labelFieldId: 'fullName' } },
            fields: {
                fullName: { entityId: 'people', name: 'Name', type: 'text', required: true }
            },
            records: {
                ada: { entityId: 'people', order: 0, values: { fullName: 'Ada Lovelace' } },
                grace: { entityId: 'people', order: 1, values: { fullName: 'Grace Hopper' } },
                linus: { entityId: 'people', order: 2, values: { fullName: 'Linus Torvalds' } }
            }
        }
    },
    prompt: 'Add an Orders entity with 20 orders, each placed by one of the customers, with an order number, a total and a status of Placed, Shipped or Delivered. Show them in the Order row list with the order number and customer.',
    reference: [
        [
            {
                op: 'addEntity',
                key: 'orders',
                name: 'Orders',
                fields: [
                    { key: 'number', name: 'Order number', type: 'text', required: true },
                    {
                        key: 'customer',
                        name: 'Customer',
                        type: 'reference',
                        required: true,
                        targetEntity: 'people'
                    },
                    { key: 'total', name: 'Total', type: 'number', required: true },
                    {
                        key: 'status',
                        name: 'Status',
                        type: 'choice',
                        required: true,
                        options: statuses
                    }
                ],
                labelField: 'number',
                records: Array.from({ length: 20 }, (_, index) => ({
                    values: {
                        number: `#${1001 + index}`,
                        customer: customers[index % 3],
                        total: 25 + index * 7.5,
                        status: statuses[index % 3]
                    }
                }))
            },
            {
                op: 'updateShape',
                shape: 'row',
                changes: {
                    dataList: {
                        entityId: 'orders',
                        fields: { heading: 'number', caption: 'customer' },
                        gap: 8
                    }
                }
            }
        ]
    ],
    expected: {
        entity: 'Orders',
        fieldTypes: {
            'Order number': 'text',
            Customer: 'reference',
            Total: 'number',
            Status: 'choice'
        },
        records: 20,
        listComponent: 'listRow'
    }
});
