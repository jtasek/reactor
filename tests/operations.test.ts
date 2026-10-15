import type { AddShape, Operation } from 'src/app/operations';
import { COLLECTIONS, readEntity } from 'src/app/services/documentStorage';
import { createTestStore } from './support/store';

const rectangle = (x = 0): AddShape => ({
    op: 'addShape',
    key: `rectangle at ${x}`,
    shape: { type: 'rectangle', position: { x, y: 0 }, size: { width: 20, height: 10 } }
});

function setup() {
    const { store } = createTestStore();
    const document = () => store.state.currentDocument;
    const apply = (operations: Operation[]) =>
        store.actions.applyOperations({
            documentId: document().id,
            by: { kind: 'person' },
            operations
        });
    const content = () => ({
        shapesIds: [...document().shapesIds],
        ...Object.fromEntries(
            COLLECTIONS.map((collection) => [
                collection,
                Object.values(document()[collection]).map((entity) =>
                    readEntity(collection, entity)
                )
            ])
        )
    });

    return { store, document, apply, content };
}

describe('applying operations', () => {
    it('adds records whose references name keys made earlier in the batch', () => {
        const { document, apply } = setup();

        const result = apply([
            { op: 'addVariable', key: 'brand', name: 'Brand', type: 'color', value: '#3366ff' },
            {
                op: 'addVariable',
                key: 'greeting',
                name: 'Greeting',
                type: 'text',
                value: 'Hi ${name$Name}'
            },
            { op: 'addVariable', key: 'name', name: 'Name', type: 'text', value: 'Ada' },
            {
                op: 'addShape',
                key: 'box',
                shape: {
                    type: 'rectangle',
                    position: { x: 0, y: 0 },
                    size: { width: 20, height: 10 },
                    bindings: { fill: 'brand' }
                }
            },
            {
                op: 'addShape',
                key: 'label',
                shape: {
                    type: 'text',
                    position: { x: 0, y: 20 },
                    value: '',
                    template: '${greeting$Greeting}!'
                }
            },
            { op: 'addGroup', name: 'Card', rotation: 0, shapes: ['box', 'label'] }
        ]);

        expect(result.applied).toBe(true);
        if (!result.applied) {
            return;
        }
        const { brand, box, label } = result.ids;
        const [group] = Object.values(document().groups);

        expect(document().shapesIds).toEqual([box, label]);
        expect(document().shapes[box]).toMatchObject({
            name: 'rectangle-1',
            fill: '#3366ff',
            bindings: { fill: brand },
            selected: false
        });
        expect(document().shapes[label]).toMatchObject({ type: 'text', value: 'Hi Ada!' });
        expect(group).toMatchObject({ name: 'Card', shapesIds: [box, label] });
    });

    it.each<[string, Operation[]]>([
        ['an empty batch', []],
        [
            'a reference to an ID the document lacks',
            [{ op: 'addGroup', name: 'Pair', rotation: 0, shapes: ['missing', 'gone'] }]
        ],
        [
            'a reference to a key made later in the batch',
            [
                { op: 'addGroup', name: 'Pair', rotation: 0, shapes: ['rectangle at 0', 'other'] },
                rectangle(),
                { ...rectangle(40), key: 'other' }
            ]
        ],
        ['a key made twice', [rectangle(), rectangle()]],
        [
            'a record the readers refuse',
            [
                rectangle(),
                {
                    op: 'addShape',
                    key: 'red',
                    shape: { type: 'circle', position: { x: 0, y: 0 }, radius: 5, fill: 'red' }
                }
            ]
        ],
        [
            'a binding to a variable of another type',
            [
                { op: 'addVariable', key: 'size', name: 'Size', type: 'number', value: 4 },
                {
                    op: 'addShape',
                    key: 'box',
                    shape: {
                        type: 'circle',
                        position: { x: 0, y: 0 },
                        radius: 5,
                        bindings: { fill: 'size' }
                    }
                }
            ]
        ]
    ])('changes nothing for %s, and says why', (_, operations) => {
        const { apply, content } = setup();

        apply([rectangle(100)]);
        const before = content();
        const result = apply(operations);

        expect(result).toMatchObject({ applied: false, problem: expect.any(String) });
        expect(content()).toEqual(before);
    });

    it('names the operation that failed', () => {
        const { apply } = setup();

        expect(
            apply([
                rectangle(),
                { op: 'addVariable', key: 'brand', name: 'a}', type: 'color', value: '#000000' }
            ])
        ).toMatchObject({ problem: expect.stringMatching(/^Operation 2:/) });
    });

    it('refuses a variable whose name the document has', () => {
        const { store, apply } = setup();

        store.actions.createVariable({ name: 'Brand', type: 'color', value: '#000000' });

        expect(
            apply([
                { op: 'addVariable', key: 'brand', name: 'Brand', type: 'color', value: '#ffffff' }
            ])
        ).toMatchObject({ applied: false });
    });

    it('refuses to put a shape in a second group', () => {
        const { store, document, apply } = setup();

        apply([rectangle(), rectangle(40)]);
        const [first, second] = document().shapesIds;

        store.actions.addGroup({ id: 'group', shapesIds: [first, second] });

        expect(
            apply([
                rectangle(80),
                { op: 'addGroup', name: 'Other', rotation: 0, shapes: [first, 'rectangle at 80'] }
            ])
        ).toMatchObject({ applied: false });
    });
});
