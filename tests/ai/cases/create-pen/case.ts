import { defineCase } from '../../expected';
export default defineCase({
    fixture: {},
    prompt: 'Add an open pen path named Card through (0,0), (20,40), (40,0), stroke #112233.',
    reference: [
        [
            {
                op: 'addShape',
                key: 'card',
                shape: {
                    name: 'Card',
                    type: 'pen',
                    points: [
                        { x: 0, y: 0 },
                        { x: 20, y: 40 },
                        { x: 40, y: 0 }
                    ],
                    stroke: '#112233'
                }
            }
        ]
    ],
    expected: {
        counts: { shapes: 1, variables: 0, groups: 0 },
        shapes: {
            Card: {
                type: 'pen',
                points: [
                    { x: 0, y: 0 },
                    { x: 20, y: 40 },
                    { x: 40, y: 0 }
                ],
                stroke: '#112233'
            }
        }
    }
});
