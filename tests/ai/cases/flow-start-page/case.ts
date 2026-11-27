import { defineCase } from '../../expected';
import { flowFixture } from '../../flowFixture';

export default defineCase({
    fixture: flowFixture,
    prompt: 'Start the prototype on Settings.',
    reference: [[{ op: 'updateFrame', frame: 'settings', changes: { start: true } }]],
    expected: {
        counts: { shapes: 3, variables: 0, groups: 0, components: 1 },
        document: { frames: { settings: { start: true } } }
    }
});
