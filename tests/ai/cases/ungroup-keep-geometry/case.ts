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
    prompt: 'Ungroup Pair without moving, resizing or deleting any shapes.',
    reference: [[{ op: 'deleteGroup', group: 'pair' }]],
    expected: {
        counts: { shapes: 3, variables: 0, groups: 0 },
        document: {
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
            }
        }
    }
});
