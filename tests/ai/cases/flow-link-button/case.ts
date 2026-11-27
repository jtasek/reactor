import { defineCase } from '../../expected';
import { flowFixture } from '../../flowFixture';

export default defineCase({
    fixture: flowFixture,
    prompt: 'Open Details when I click Continue.',
    reference: [
        [{ op: 'setAction', control: 'next', action: { type: 'navigate', screenId: 'details' } }]
    ],
    expected: {
        counts: { shapes: 3, variables: 0, groups: 0, components: 1 },
        document: {
            shapes: {
                next: { interactions: { activate: { type: 'navigate', screenId: 'details' } } },
                help: { name: 'Secondary button' }
            }
        }
    }
});
