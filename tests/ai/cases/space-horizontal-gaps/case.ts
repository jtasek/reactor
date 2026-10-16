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
                position: { x: 40, y: 0 },
                size: { width: 40, height: 20 },
                fill: '#3366ff'
            },
            c: {
                type: 'rectangle',
                position: { x: 120, y: 0 },
                size: { width: 20, height: 20 },
                fill: '#3366ff'
            }
        }
    },
    prompt: 'Make equal horizontal edge gaps between a, b, c, keeping a and c fixed and the widths unchanged.',
    reference: [[{ op: 'updateShape', shape: 'b', changes: { position: { x: 50, y: 0 } } }]],
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
                    position: { x: 50, y: 0 },
                    size: { width: 40, height: 20 },
                    fill: '#3366ff'
                },
                c: {
                    type: 'rectangle',
                    position: { x: 120, y: 0 },
                    size: { width: 20, height: 20 },
                    fill: '#3366ff'
                }
            }
        }
    }
});
