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
    prompt: 'Create number variable Radius with value 12 and make card corner radius follow it.',
    reference: [
        [
            { op: 'addVariable', key: 'radius', name: 'Radius', type: 'number', value: 12 },
            { op: 'updateShape', shape: 'card', changes: { bindings: { cornerRadius: 'radius' } } }
        ]
    ],
    expected: {
        bindings: { card: { cornerRadius: 'Radius' } },
        counts: { shapes: 1, variables: 1, groups: 0 },
        shapes: { card: { cornerRadius: 12 } },
        variables: { Radius: { type: 'number', values: { default: 12 } } }
    }
});
