import { defineCase } from '../../expected';
export default defineCase({
    fixture: {},
    prompt: 'Add text named Card at (20,30) saying Welcome, font size 24, font color #112233.',
    reference: [
        [
            {
                op: 'addShape',
                key: 'card',
                shape: {
                    name: 'Card',
                    type: 'text',
                    position: { x: 20, y: 30 },
                    value: 'Welcome',
                    fontSize: 24,
                    fontColor: '#112233'
                }
            }
        ]
    ],
    expected: {
        counts: { shapes: 1, variables: 0, groups: 0 },
        shapes: {
            Card: {
                type: 'text',
                position: { x: 20, y: 30 },
                value: 'Welcome',
                fontSize: 24,
                fontColor: '#112233'
            }
        }
    }
});
