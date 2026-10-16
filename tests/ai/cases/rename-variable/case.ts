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
    prompt: 'Rename Brand to Primary without changing its color or the card binding.',
    reference: [[{ op: 'updateVariable', variable: 'brand', name: 'Primary' }]],
    expected: {
        counts: { shapes: 1, variables: 1, groups: 0 },
        document: {
            variables: { brand: { name: 'Primary', values: { default: '#3366ff' } } },
            shapes: { card: { fill: '#3366ff', bindings: { fill: 'brand' } } }
        }
    }
});
