import { defineCase } from '../../expected';
export default defineCase({
    fixture: {
        shapes: { label: { type: 'text', position: { x: 30, y: 40 }, value: 'Next', fontSize: 14 } }
    },
    prompt: 'Change label to Continue, font size 18 and font color #223344.',
    reference: [
        [
            {
                op: 'updateShape',
                shape: 'label',
                changes: { value: 'Continue', fontSize: 18, fontColor: '#223344' }
            }
        ]
    ],
    expected: {
        counts: { shapes: 1, variables: 0, groups: 0 },
        document: {
            shapes: {
                label: {
                    type: 'text',
                    position: { x: 30, y: 40 },
                    value: 'Continue',
                    fontSize: 18,
                    fontColor: '#223344'
                }
            }
        }
    }
});
