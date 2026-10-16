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
    prompt: 'Delete first, keeping the Button component and its source.',
    reference: [[{ op: 'deleteShapes', shapes: ['first'] }]],
    expected: {
        counts: { shapes: 1, variables: 0, groups: 0, components: 1 },
        document: {
            shapes: {
                source: { type: 'text', position: { x: 0, y: 0 }, value: 'Save', fontSize: 16 }
            },
            components: { button: { shapesIds: ['source'] } }
        }
    }
});
