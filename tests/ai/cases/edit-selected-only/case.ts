import { defineCase } from '../../expected';
export default defineCase({
    selection: ['card'],
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
    prompt: 'Move the selected shape 10 pixels right; leave everything else unchanged.',
    reference: [[{ op: 'updateShape', shape: 'card', changes: { position: { x: 20, y: 20 } } }]],
    expected: {
        counts: { shapes: 2, variables: 0, groups: 0 },
        document: {
            shapes: {
                card: {
                    type: 'rectangle',
                    position: { x: 20, y: 20 },
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
