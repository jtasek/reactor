import { defineCase } from '../../expected';
export default defineCase({
    fixture: {
        shapes: {
            a: {
                type: 'rectangle',
                position: { x: 10, y: 20 },
                size: { width: 100, height: 40 },
                fill: '#3366ff'
            },
            b: {
                type: 'rectangle',
                position: { x: 200, y: 20 },
                size: { width: 100, height: 40 },
                fill: '#3366ff'
            },
            untouched: {
                type: 'rectangle',
                position: { x: 500, y: 500 },
                size: { width: 100, height: 40 },
                fill: '#3366ff'
            }
        },
        groups: { pair: { name: 'Pair', shapes: ['a', 'b'] } }
    },
    prompt: 'Delete both shapes in Pair. Leave untouched unchanged.',
    reference: [[{ op: 'deleteShapes', shapes: ['a', 'b'] }]],
    expected: {
        counts: { shapes: 1, variables: 0, groups: 0 },
        shapes: {
            untouched: {
                type: 'rectangle',
                position: { x: 500, y: 500 },
                size: { width: 100, height: 40 },
                fill: '#3366ff'
            }
        }
    }
});
