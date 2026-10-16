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
    prompt: 'Change the Button source text to Send, keeping its instance.',
    reference: [[{ op: 'updateShape', shape: 'source', changes: { value: 'Send' } }]],
    expected: {
        counts: { shapes: 2, variables: 0, groups: 0, components: 1 },
        document: {
            shapes: {
                source: { type: 'text', position: { x: 0, y: 0 }, value: 'Send', fontSize: 16 },
                first: {
                    type: 'instance',
                    componentId: 'button',
                    position: { x: 100, y: 100 },
                    overrides: {}
                }
            }
        }
    }
});
