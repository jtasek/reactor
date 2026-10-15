import type { AiCase } from '../../harness';

export default {
    fixture: {},
    prompt: 'Add a color variable named Primary with the main color of this screenshot.',
    image: 'screenshot.png',
    check(document) {
        const primary = Object.values(document.variables).find(({ name }) => name === 'Primary');

        return primary?.type === 'color' && primary.values.default === '#1e88e5'
            ? []
            : ['No Primary color variable of #1e88e5.'];
    }
} satisfies AiCase;
