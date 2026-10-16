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
    prompt: 'Set card opacity to 40 percent. Leave everything else unchanged.',
    reference: [[{ op: 'updateShape', shape: 'card', changes: { opacity: 0.4 } }]],
    expected: {
        counts: { shapes: 2, variables: 0, groups: 0 },
        document: {
            shapes: {
                card: {
                    type: 'rectangle',
                    position: { x: 10, y: 20 },
                    size: { width: 100, height: 40 },
                    fill: '#3366ff',
                    opacity: 0.4
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
