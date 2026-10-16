import { defineCase } from '../../expected';
export default defineCase({
    fixture: {
        shapes: {
            a: {
                type: 'rectangle',
                position: { x: 0, y: 0 },
                size: { width: 20, height: 20 },
                fill: '#3366ff'
            },
            b: {
                type: 'rectangle',
                position: { x: 0, y: 40 },
                size: { width: 20, height: 40 },
                fill: '#3366ff'
            },
            c: {
                type: 'rectangle',
                position: { x: 0, y: 120 },
                size: { width: 20, height: 20 },
                fill: '#3366ff'
            }
        }
    },
    prompt: 'Make equal vertical edge gaps between a, b, c, keeping a and c fixed and the heights unchanged.',
    reference: [[{ op: 'updateShape', shape: 'b', changes: { position: { x: 0, y: 50 } } }]],
    expected: {
        counts: { shapes: 3, variables: 0, groups: 0 },
        document: {
            shapes: {
                a: {
                    type: 'rectangle',
                    position: { x: 0, y: 0 },
                    size: { width: 20, height: 20 },
                    fill: '#3366ff'
                },
                b: {
                    type: 'rectangle',
                    position: { x: 0, y: 50 },
                    size: { width: 20, height: 40 },
                    fill: '#3366ff'
                },
                c: {
                    type: 'rectangle',
                    position: { x: 0, y: 120 },
                    size: { width: 20, height: 20 },
                    fill: '#3366ff'
                }
            }
        }
    }
});
