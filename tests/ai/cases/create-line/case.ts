import { defineCase } from '../../expected';
export default defineCase({
    fixture: {},
    prompt: 'Add a line named Card from (10,30) to (90,30), stroke #112233.',
    reference: [
        [
            {
                op: 'addShape',
                key: 'card',
                shape: {
                    name: 'Card',
                    type: 'line',
                    start: { x: 10, y: 30 },
                    end: { x: 90, y: 30 },
                    stroke: '#112233'
                }
            }
        ]
    ],
    expected: {
        counts: { shapes: 1, variables: 0, groups: 0 },
        shapes: {
            Card: {
                type: 'line',
                start: { x: 10, y: 30 },
                end: { x: 90, y: 30 },
                stroke: '#112233'
            }
        }
    }
});
