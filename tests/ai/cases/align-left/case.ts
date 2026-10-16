import { defineCase } from '../../expected';
export default defineCase({
    fixture: {
        shapes: {
            a: {
                type: 'rectangle',
                position: { x: 10, y: 10 },
                size: { width: 40, height: 20 },
                fill: '#3366ff'
            },
            b: {
                type: 'rectangle',
                position: { x: 40, y: 50 },
                size: { width: 60, height: 20 },
                fill: '#3366ff'
            },
            c: {
                type: 'rectangle',
                position: { x: 80, y: 90 },
                size: { width: 80, height: 20 },
                fill: '#3366ff'
            }
        }
    },
    prompt: 'Align the left edges of a, b, c to x=10; keep y and sizes.',
    reference: [
        [
            { op: 'updateShape', shape: 'b', changes: { position: { x: 10, y: 50 } } },
            { op: 'updateShape', shape: 'c', changes: { position: { x: 10, y: 90 } } }
        ]
    ],
    expected: {
        counts: { shapes: 3, variables: 0, groups: 0 },
        document: {
            shapes: {
                a: {
                    type: 'rectangle',
                    position: { x: 10, y: 10 },
                    size: { width: 40, height: 20 },
                    fill: '#3366ff'
                },
                b: {
                    type: 'rectangle',
                    position: { x: 10, y: 50 },
                    size: { width: 60, height: 20 },
                    fill: '#3366ff'
                },
                c: {
                    type: 'rectangle',
                    position: { x: 10, y: 90 },
                    size: { width: 80, height: 20 },
                    fill: '#3366ff'
                }
            }
        }
    }
});
