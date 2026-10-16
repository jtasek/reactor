import { defineCase } from '../../expected';
export default defineCase({
    fixture: {},
    prompt: 'Add a rectangle named Card at (30,50), 160 wide and 80 high, filled #3366ff.',
    reference: [
        [
            {
                op: 'addShape',
                key: 'card',
                shape: {
                    name: 'Card',
                    type: 'rectangle',
                    position: { x: 30, y: 50 },
                    size: { width: 160, height: 80 },
                    fill: '#3366ff'
                }
            }
        ]
    ],
    expected: {
        counts: { shapes: 1, variables: 0, groups: 0 },
        shapes: {
            Card: {
                type: 'rectangle',
                position: { x: 30, y: 50 },
                size: { width: 160, height: 80 },
                fill: '#3366ff'
            }
        }
    }
});
