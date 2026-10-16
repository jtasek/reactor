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
            locked: {
                type: 'rectangle',
                position: { x: 500, y: 500 },
                size: { width: 100, height: 40 },
                fill: '#3366ff',
                locked: true
            }
        }
    },
    prompt: 'Move card 10 pixels right. Leave the locked shape unchanged.',
    reference: [
        [
            { op: 'updateShape', shape: 'locked', changes: { position: { x: 510, y: 500 } } },
            { op: 'updateShape', shape: 'card', changes: { position: { x: 20, y: 20 } } }
        ],
        [{ op: 'updateShape', shape: 'card', changes: { position: { x: 20, y: 20 } } }]
    ],
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
                locked: {
                    type: 'rectangle',
                    position: { x: 500, y: 500 },
                    size: { width: 100, height: 40 },
                    fill: '#3366ff',
                    locked: true
                }
            }
        }
    }
});
