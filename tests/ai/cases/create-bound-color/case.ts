import { defineCase } from '../../expected';
export default defineCase({
    fixture: {
        shapes: {
            card: {
                type: 'rectangle',
                position: { x: 10, y: 20 },
                size: { width: 100, height: 40 },
                fill: '#3366ff'
            }
        }
    },
    prompt: 'Create a color variable Accent with value #ff6600, and make card follow it for fill.',
    reference: [
        [
            { op: 'addVariable', key: 'accent', name: 'Accent', type: 'color', value: '#ff6600' },
            { op: 'updateShape', shape: 'card', changes: { bindings: { fill: 'accent' } } }
        ]
    ],
    expected: {
        bindings: { card: { fill: 'Accent' } },
        counts: { shapes: 1, variables: 1, groups: 0 },
        shapes: { card: { fill: '#ff6600' } },
        variables: { Accent: { type: 'color', values: { default: '#ff6600' } } }
    }
});
