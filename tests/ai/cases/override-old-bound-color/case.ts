import { defineCase } from '../../expected';
export default defineCase({
    fixture: {
        variables: { brand: { name: 'Brand', type: 'color', value: '#3366ff' } },
        shapes: {
            card: {
                type: 'rectangle',
                position: { x: 10, y: 20 },
                size: { width: 100, height: 40 },
                fill: '#3366ff',
                bindings: { fill: 'brand' }
            }
        }
    },
    prompt: 'Change Brand to #ff6600 but keep card explicitly #3366ff, no longer following Brand.',
    reference: [
        [
            { op: 'updateVariable', variable: 'brand', value: '#ff6600' },
            { op: 'updateShape', shape: 'card', changes: { fill: '#3366ff' } }
        ]
    ],
    expected: {
        unbound: ['card'],
        counts: { shapes: 1, variables: 1, groups: 0 },
        document: {
            variables: { brand: { values: { default: '#ff6600' } } },
            shapes: { card: { fill: '#3366ff' } }
        }
    }
});
