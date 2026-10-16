import { defineCase } from '../../expected';
export default defineCase({
    fixture: {
        shapes: {
            source: { type: 'text', position: { x: 0, y: 0 }, value: 'Save', fontSize: 16 },
            first: {
                type: 'instance',
                componentId: 'button',
                position: { x: 100, y: 100 },
                overrides: {}
            }
        },
        components: {
            button: {
                name: 'Button',
                shapesIds: ['source'],
                sourceOnly: true,
                props: [{ id: 'caption', label: 'Caption', shapeId: 'source', key: 'value' }]
            }
        }
    },
    prompt: 'Add another Button instance named Second at (200,100), with no overrides.',
    reference: [
        [
            {
                op: 'addShape',
                key: 'second',
                shape: {
                    type: 'instance',
                    name: 'Second',
                    componentId: 'button',
                    position: { x: 200, y: 100 },
                    overrides: {}
                }
            }
        ]
    ],
    expected: {
        counts: { shapes: 3, variables: 0, groups: 0, components: 1 },
        shapes: {
            Second: {
                type: 'instance',
                componentId: 'button',
                position: { x: 200, y: 100 },
                overrides: {}
            },
            source: { type: 'text', position: { x: 0, y: 0 }, value: 'Save', fontSize: 16 },
            first: {
                type: 'instance',
                componentId: 'button',
                position: { x: 100, y: 100 },
                overrides: {}
            }
        }
    }
});
