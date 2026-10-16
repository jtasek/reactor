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
    prompt: 'Delete Brand, keeping the card the same color.',
    reference: [[{ op: 'deleteVariable', variable: 'brand' }]],
    expected: {
        unbound: ['card'],
        counts: { shapes: 1, variables: 0, groups: 0 },
        shapes: { card: { fill: '#3366ff' } }
    }
});
