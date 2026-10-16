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
    prompt: 'Change Person to Grace so the label follows it.',
    reference: [[{ op: 'updateVariable', variable: 'person', value: 'Grace' }]],
    expected: {
        counts: { shapes: 1, variables: 1, groups: 0 },
        document: {
            variables: { person: { values: { default: 'Grace' } } },
            shapes: { label: { value: 'Hi Grace', template: 'Hi ${person$Person}' } }
        }
    }
});
