import { defineCase } from '../../expected';
export default defineCase({
    fixture: {
        shapes: {
            card: {
                type: 'rectangle',
                position: { x: 10, y: 20 },
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
    },
    prompt: 'Delete card and leave untouched unchanged.',
    reference: [[{ op: 'deleteShapes', shapes: ['card'] }]],
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
