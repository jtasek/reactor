import { defineCase } from '../../expected';
export default defineCase({
    fixture: {},
    prompt: 'Add a circle named Card centered at (80,60), radius 25, filled #ff6600.',
    reference: [
        [
            {
                op: 'addShape',
                key: 'card',
                shape: {
                    name: 'Card',
                    type: 'circle',
                    position: { x: 80, y: 60 },
                    radius: 25,
                    fill: '#ff6600'
                }
            }
        ]
    ],
    expected: {
        counts: { shapes: 1, variables: 0, groups: 0 },
        shapes: {
            Card: { type: 'circle', position: { x: 80, y: 60 }, radius: 25, fill: '#ff6600' }
        }
    }
});
