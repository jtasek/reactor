import type { AddShape, Operation, UpdateShape } from 'src/app/operations';
import type { Component } from 'src/app/types';
import { createComponent, createShape } from 'src/app/factories';
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
        [
            'a parent shape the document lacks',
            [
                rectangle(),
                {
                    ...rectangle(40),
                    shape: { ...rectangle(40).shape, parentShapeId: 'missing' }
                }
            ]
        ],
        [
            'a parent shape made later in the batch',
            [
                {
                    ...rectangle(),
                    shape: { ...rectangle().shape, parentShapeId: 'rectangle at 40' }
                },
                rectangle(40)
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

    it('resolves parent shapes from existing IDs and earlier batch keys', () => {
        const { document, apply } = setup();

        apply([rectangle()]);
        const [existing] = document().shapesIds;
        const result = apply([
            rectangle(40),
            { ...rectangle(80), shape: { ...rectangle(80).shape, parentShapeId: existing } },
            {
                ...rectangle(120),
                shape: { ...rectangle(120).shape, parentShapeId: 'rectangle at 40' }
            }
        ]);

        expect(result.applied).toBe(true);
        if (!result.applied) {
            return;
        }
        expect(document().shapes[result.ids['rectangle at 80']].parentShapeId).toBe(existing);
        expect(document().shapes[result.ids['rectangle at 120']].parentShapeId).toBe(
            result.ids['rectangle at 40']
        );
    });

    it('keeps imported component source parent references local to the component', () => {
        const { document, apply } = setup();
        const parent = createShape({ ...rectangle().shape, name: 'Parent', order: 'a0' });
        const child = createShape({
            ...rectangle(40).shape,
            name: 'Child',
            order: 'a1',
            parentShapeId: parent.id
        });
        const component = createComponent({
            shapesIds: [parent.id, child.id],
            sourceShapes: { [parent.id]: parent, [child.id]: child }
        });

        expect(apply([{ op: 'addComponent', component }])).toMatchObject({ applied: true });
        expect(document().components[component.id].sourceShapes?.[child.id].parentShapeId).toBe(
            parent.id
        );
        expect(document().shapesIds).toEqual([]);
    });

    it.each([false, true])(
        'refuses a group spanning layers (second layered: %s)',
        (layerSecond) => {
            const { store, document, apply, content } = setup();

            apply([rectangle(), rectangle(40)]);
            const [first, second] = document().shapesIds;

            store.actions.addLayer({ id: 'first-layer', shapesIds: [first] });
            if (layerSecond) {
                store.actions.addLayer({ id: 'second-layer', shapesIds: [second] });
            }
            const before = content();
            const result = apply([
                rectangle(80),
                { op: 'addGroup', name: 'Pair', rotation: 0, shapes: [first, second] }
            ]);

            expect(result).toMatchObject({
                applied: false,
                problem: expect.stringMatching(/^Operation 2:/)
            });
            expect(content()).toEqual(before);
        }
    );

    it('groups existing shapes on the same layer', () => {
        const { store, document, apply } = setup();

        apply([rectangle(), rectangle(40)]);
        const shapesIds = [...document().shapesIds];

        store.actions.addLayer({ id: 'layer', shapesIds });

        expect(
            apply([{ op: 'addGroup', name: 'Pair', rotation: 0, shapes: shapesIds }])
        ).toMatchObject({
            applied: true
        });
        expect(Object.values(document().groups)[0].shapesIds).toEqual(shapesIds);
        expect(document().layers.layer.shapesIds).toEqual(shapesIds);
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

    it('resolves an existing ID that a key of another kind repeats', () => {
        const { store, document, apply } = setup();
        const brand = store.actions.createVariable({
            name: 'Brand',
            type: 'color',
            value: '#3366ff'
        })!;

        expect(
            apply([
                { ...rectangle(), key: brand },
                {
                    ...rectangle(40),
                    shape: { ...rectangle(40).shape, bindings: { fill: brand } }
                }
            ])
        ).toMatchObject({ applied: true });
        expect(document().shapes[document().shapesIds[1]].fill).toBe('#3366ff');
    });

    describe('with a component', () => {
        const source = createShape({ ...rectangle().shape, name: 'Box', order: 'a0' });
        const component = (props: NonNullable<Component['props']>) =>
            createComponent({
                id: 'card',
                shapesIds: [source.id],
                sourceShapes: { [source.id]: source },
                props
            });
        const instance = (overrides: Record<string, string>): Operation => ({
            op: 'addShape',
            key: 'instance',
            shape: { type: 'instance', componentId: 'card', position: { x: 0, y: 0 }, overrides }
        });
        const label = { id: 'label', label: 'Label', shapeId: source.id, key: 'name' };

        it('takes an instance overriding its props', () => {
            const { apply } = setup();

            expect(
                apply([
                    { op: 'addComponent', component: component([label]) },
                    instance({ label: 'Hi' })
                ])
            ).toMatchObject({ applied: true });
        });

        it.each<[string, Operation[]]>([
            [
                'an override of a prop the component lacks',
                [{ op: 'addComponent', component: component([label]) }, instance({ other: 'Hi' })]
            ],
            [
                'a prop naming a shape outside the component',
                [{ op: 'addComponent', component: component([{ ...label, shapeId: 'missing' }]) }]
            ]
        ])('refuses %s', (_, operations) => {
            const { apply, content } = setup();
            const before = content();

            expect(apply(operations)).toMatchObject({ applied: false });
            expect(content()).toEqual(before);
        });
    });
});

describe('changing and deleting with operations', () => {
    /** A document with two rectangles and a text, the first rectangle filled by Brand. */
    function setupDocument() {
        const test = setup();
        const brand = test.store.actions.createVariable({
            name: 'Brand',
            type: 'color',
            value: '#3366ff'
        })!;

        test.apply([
            { ...rectangle(), shape: { ...rectangle().shape, bindings: { fill: brand } } },
            rectangle(40),
            {
                op: 'addShape',
                key: 'label',
                shape: { type: 'text', position: { x: 0, y: 20 }, value: 'Hi' }
            }
        ]);
        const [first, second, label] = test.document().shapesIds;

        return { ...test, brand, first, second, label };
    }

    it('changes only the fields given, and what a set property followed stops', () => {
        const { document, apply, brand, first, second } = setupDocument();

        expect(
            apply([
                { op: 'updateShape', shape: first, changes: { position: { x: 5, y: 6 } } },
                { op: 'updateShape', shape: second, changes: { fill: '#ff0000', opacity: 0.5 } }
            ])
        ).toMatchObject({ applied: true });
        expect(document().shapes[first]).toMatchObject({
            position: { x: 5, y: 6 },
            size: { width: 20, height: 10 },
            fill: '#3366ff',
            bindings: { fill: brand }
        });
        expect(document().shapes[second]).toMatchObject({ fill: '#ff0000', opacity: 0.5 });

        expect(
            apply([{ op: 'updateShape', shape: first, changes: { fill: '#00ff00' } }])
        ).toMatchObject({ applied: true });
        expect(document().shapes[first].fill).toBe('#00ff00');
        expect(document().shapes[first].bindings).toBeUndefined();
    });

    it('binds a changed shape, and writes a text over its template', () => {
        const { store, document, apply, brand, second, label } = setupDocument();

        store.actions.setShapesProperty({ shapeIds: [label], key: 'text', value: '${Brand}' });
        expect(document().shapes[label]).toMatchObject({ value: '#3366ff' });

        expect(
            apply([
                { op: 'updateShape', shape: second, changes: { bindings: { fill: brand } } },
                { op: 'updateShape', shape: label, changes: { value: 'Bye' } }
            ])
        ).toMatchObject({ applied: true });
        expect(document().shapes[second]).toMatchObject({
            fill: '#3366ff',
            bindings: { fill: brand }
        });
        expect(document().shapes[label]).toMatchObject({ value: 'Bye' });
        expect(document().shapes[label]).not.toHaveProperty('template');
    });

    it('changes a variable, which the shapes following it take, and the shapes changed with it', () => {
        const { document, apply, brand, first, second } = setupDocument();

        expect(
            apply([
                { op: 'updateVariable', variable: brand, name: 'Accent', value: '#ff6600' },
                { op: 'updateShape', shape: first, changes: { position: { x: 5, y: 6 } } },
                { op: 'updateShape', shape: second, changes: { bindings: { fill: brand } } }
            ])
        ).toMatchObject({ applied: true });
        expect(document().variables[brand]).toMatchObject({
            name: 'Accent',
            values: { default: '#ff6600' }
        });
        expect(document().shapes[first]).toMatchObject({
            fill: '#ff6600',
            position: { x: 5, y: 6 },
            bindings: { fill: brand }
        });
        expect(document().shapes[second]).toMatchObject({ fill: '#ff6600' });
    });

    it('deletes a variable, leaving its value where it was followed', () => {
        const { document, apply, brand, first } = setupDocument();

        expect(apply([{ op: 'deleteVariable', variable: brand }])).toMatchObject({
            applied: true
        });
        expect(document().variables).toEqual({});
        expect(document().shapes[first].fill).toBe('#3366ff');
        expect(document().shapes[first].bindings).toBeUndefined();
    });

    it('deletes shapes and the groups this empties, and ungroups keeping the shapes', () => {
        const { store, document, apply, first, second, label } = setupDocument();

        store.actions.addGroup({ id: 'pair', shapesIds: [first, second] });
        store.actions.addGroup({ id: 'labelled', shapesIds: [label] });

        expect(
            apply([
                { op: 'deleteGroup', group: 'pair' },
                { op: 'addGroup', name: 'Other', rotation: 0, shapes: [first, second] },
                { op: 'deleteShapes', shapes: [label] }
            ])
        ).toMatchObject({ applied: true });
        expect(document().shapesIds).toEqual([first, second]);
        expect(Object.values(document().groups)).toEqual([
            expect.objectContaining({ name: 'Other', shapesIds: [first, second] })
        ]);
    });

    it.each<[string, (ids: ReturnType<typeof setupDocument>) => Operation[]]>([
        [
            'a change to a key rather than an ID',
            () => [
                rectangle(80),
                { op: 'updateShape', shape: 'rectangle at 80', changes: { name: 'Box' } }
            ]
        ],
        [
            'a change to a locked shape',
            ({ store, first }) => {
                store.actions.lockShape(first);

                return [{ op: 'deleteShapes', shapes: [first] }];
            }
        ],
        [
            'a shape changed twice',
            ({ first }) => [
                { op: 'updateShape', shape: first, changes: { name: 'Box' } },
                { op: 'deleteShapes', shapes: [first] }
            ]
        ],
        [
            'a reference to a record the batch deletes',
            ({ brand, first, second }) => [
                { op: 'addGroup', name: 'Pair', rotation: 0, shapes: [first, second] },
                { op: 'deleteShapes', shapes: [second] },
                { op: 'deleteVariable', variable: brand }
            ]
        ],
        [
            'a binding to a variable the batch deletes',
            ({ brand, second }) => [
                { op: 'updateShape', shape: second, changes: { bindings: { fill: brand } } },
                { op: 'deleteVariable', variable: brand }
            ]
        ],
        [
            'a change of type',
            ({ first }) => [
                {
                    op: 'updateShape',
                    shape: first,
                    changes: { type: 'circle' } as UpdateShape['changes']
                }
            ]
        ],
        [
            'a field the shape lacks',
            ({ first }) => [{ op: 'updateShape', shape: first, changes: { radius: 4 } }]
        ],
        [
            'a value the readers refuse',
            ({ first }) => [{ op: 'updateShape', shape: first, changes: { fill: 'red' } }]
        ],
        [
            'an update changing nothing',
            ({ first }) => [{ op: 'updateShape', shape: first, changes: {} }]
        ],
        [
            'a variable renamed to a name taken',
            ({ store, brand }) => {
                store.actions.createVariable({ name: 'Other', type: 'color', value: '#000000' });

                return [{ op: 'updateVariable', variable: brand, name: 'Other' }];
            }
        ],
        [
            'a variable given a value of another type',
            ({ brand }) => [{ op: 'updateVariable', variable: brand, value: 4 }]
        ],
        ['a group the document lacks', () => [{ op: 'deleteGroup', group: 'missing' }]]
    ])('changes nothing for %s, and says why', (_, operations) => {
        const test = setupDocument();
        const batch = operations(test);
        const before = test.content();

        expect(test.apply(batch)).toMatchObject({
            applied: false,
            problem: expect.stringMatching(/^Operation \d+:/)
        });
        expect(test.content()).toEqual(before);
    });

    it('keeps a shape of a component with instances', () => {
        const { store, document, apply, first } = setupDocument();

        store.actions.addComponent({ id: 'card', name: 'Card', shapesIds: [first] });
        expect(
            apply([
                {
                    op: 'addShape',
                    key: 'instance',
                    shape: {
                        type: 'instance',
                        componentId: 'card',
                        position: { x: 0, y: 90 },
                        overrides: {}
                    }
                }
            ])
        ).toMatchObject({ applied: true });

        expect(apply([{ op: 'deleteShapes', shapes: [first] }])).toMatchObject({
            applied: false,
            problem: 'Operation 1: the component card has instances, so it keeps a shape.'
        });
        expect(document().shapes[first]).toBeDefined();
    });
});
