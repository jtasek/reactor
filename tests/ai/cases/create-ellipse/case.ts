import { defineCase } from '../../expected';
export default defineCase({
    fixture: {},
    prompt: 'Add an ellipse named Card centered at (100,70), horizontal radius 40 and vertical radius 20, filled #22aa88.',
    reference: [
        [
            {
                op: 'addShape',
                key: 'card',
                shape: {
                    name: 'Card',
                    type: 'ellipse',
                    position: { x: 100, y: 70 },
                    radius: { x: 40, y: 20 },
                    fill: '#22aa88'
                }
            }
        ]
    ],
    expected: {
        counts: { shapes: 1, variables: 0, groups: 0 },
        shapes: {
            Card: {
                type: 'ellipse',
                position: { x: 100, y: 70 },
                radius: { x: 40, y: 20 },
                fill: '#22aa88'
            }
        }
    }
});
