import { defineCase } from '../../expected';
export default defineCase({
    fixture: {},
    prompt: 'Create a text variable Person with value Ada and a text shape named Greeting at (0,0) with a template saying Hello followed by Person.',
    reference: [
        [
            { op: 'addVariable', key: 'person', name: 'Person', type: 'text', value: 'Ada' },
            {
                op: 'addShape',
                key: 'greeting',
                shape: {
                    type: 'text',
                    name: 'Greeting',
                    position: { x: 0, y: 0 },
                    value: 'Hello Ada',
                    template: 'Hello ${person}'
                }
            }
        ]
    ],
    expected: {
        templates: { Greeting: 'Person' },
        counts: { shapes: 1, variables: 1, groups: 0 },
        shapes: { Greeting: { type: 'text', value: 'Hello Ada' } },
        variables: { Person: { type: 'text', values: { default: 'Ada' } } }
    }
});
