import { defineCase } from '../../expected';
export default defineCase({
    fixture: {
        variables: { person: { name: 'Person', type: 'text', value: 'Ada' } },
        shapes: {
            label: {
                type: 'text',
                position: { x: 0, y: 0 },
                value: 'Hi Ada',
                template: 'Hi ${person$Person}'
            }
        }
    },
    prompt: 'Delete Person, keeping the label saying Hi Ada.',
    reference: [[{ op: 'deleteVariable', variable: 'person' }]],
    expected: {
        counts: { shapes: 1, variables: 0, groups: 0 },
        shapes: { label: { type: 'text', value: 'Hi Ada' } }
    }
});
