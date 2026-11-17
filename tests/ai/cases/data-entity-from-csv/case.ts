import { defineDataCase } from '../../expected';

const rows = [
    ['00017', 'Oak chair', 89, 'yes', 'Chairs', '2024-03-02'],
    ['00023', 'Walnut chair', 119, 'yes', 'Chairs', '2024-05-14'],
    ['00031', 'Folding chair', 39.9, 'no', 'Chairs', '2023-11-20'],
    ['00042', 'Bar stool', 129.5, 'no', 'Chairs', '2024-01-08'],
    ['00056', 'Desk chair', 249, 'yes', 'Chairs', '2024-07-30'],
    ['00061', 'Dining table', 699, 'yes', 'Tables', '2023-09-12'],
    ['00078', 'Coffee table', 289, 'yes', 'Tables', '2024-02-19'],
    ['00084', 'Side table', 99, 'no', 'Tables', '2024-04-04'],
    ['00093', 'Standing desk', 549, 'yes', 'Tables', '2024-06-21'],
    ['00105', 'Console table', 329, 'yes', 'Tables', '2023-12-01'],
    ['00112', 'Floor lamp', 159, 'yes', 'Lamps', '2024-03-27'],
    ['00128', 'Desk lamp', 49, 'yes', 'Lamps', '2024-08-15'],
    ['00134', 'Pendant lamp', 189, 'no', 'Lamps', '2023-10-10'],
    ['00147', 'Wall lamp', 79, 'yes', 'Lamps', '2024-05-05'],
    ['00152', 'Table lamp', 69, 'yes', 'Lamps', '2024-01-29'],
    ['00166', 'Bookshelf', 379, 'yes', 'Storage', '2023-08-18'],
    ['00171', 'Sideboard', 899, 'no', 'Storage', '2024-02-02'],
    ['00189', 'Shoe rack', 59, 'yes', 'Storage', '2024-06-06'],
    ['00194', 'Wardrobe', 1199, 'yes', 'Storage', '2023-07-25'],
    ['00203', 'Storage bench', 219, 'no', 'Storage', '2024-09-09']
] as const;

const csv = ['sku,name,price,in_stock,category,released', ...rows.map((row) => row.join(','))].join(
    '\n'
);

export default defineDataCase({
    fixture: {
        shapes: {
            title: { type: 'text', position: { x: 0, y: 0 }, value: 'Name', fontSize: 16 },
            detail: { type: 'text', position: { x: 0, y: 24 }, value: 'Detail', fontSize: 12 }
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
    prompt: `Turn this into a Products entity and add a List row list of them at (40, 120) showing the name and category.\n\n${csv}`,
    reference: [
        [
            {
                op: 'addEntity',
                key: 'products',
                name: 'Products',
                fields: [
                    { key: 'sku', name: 'SKU', type: 'text', required: true },
                    { key: 'name', name: 'Name', type: 'text', required: true },
                    { key: 'price', name: 'Price', type: 'number', required: true },
                    { key: 'inStock', name: 'In stock', type: 'boolean', required: true },
                    {
                        key: 'category',
                        name: 'Category',
                        type: 'choice',
                        required: true,
                        options: ['Chairs', 'Tables', 'Lamps', 'Storage']
                    },
                    { key: 'released', name: 'Released', type: 'text', required: true }
                ],
                labelField: 'name',
                records: rows.map(([sku, name, price, inStock, category, released]) => ({
                    values: { sku, name, price, inStock: inStock === 'yes', category, released }
                }))
            },
            {
                op: 'addShape',
                key: 'list',
                shape: {
                    type: 'instance',
                    name: 'Products list',
                    componentId: 'listRow',
                    position: { x: 40, y: 120 },
                    overrides: {},
                    dataList: {
                        entityId: 'products',
                        fields: { heading: 'name', caption: 'category' },
                        gap: 8
                    }
                }
            }
        ]
    ],
    expected: {
        entity: 'Products',
        fieldTypes: {
            SKU: 'text',
            Name: 'text',
            Price: 'number',
            'In stock': 'boolean',
            Category: 'choice',
            Released: 'text'
        },
        records: 20,
        listComponent: 'listRow',
        values: [
            { SKU: '00042', Price: 129.5, 'In stock': false },
            { Name: 'Wardrobe', Category: 'Storage', Released: '2023-07-25' }
        ]
    }
});
