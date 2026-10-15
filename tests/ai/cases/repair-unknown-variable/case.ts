import type { AiCase } from '../../harness';
import { findShapes, groupNamed } from '../../checks';

export default {
    fixture: {
        variables: { accent: { name: 'Accent', type: 'color', value: '#ff6600' } }
    },
    prompt: 'Make a card with a Plans heading, filled with the accent color, as one group.',
    check(document) {
        const group = groupNamed(document, /card/i);
        const [card] = findShapes(document, group, 'rectangle');
        const [heading] = findShapes(document, group, 'text');

        return [
            ...(group ? [] : ['No Card group.']),
            ...(card?.type === 'rectangle' &&
            card.fill === '#ff6600' &&
            card.bindings?.fill === 'accent'
                ? []
                : ['The card does not follow Accent.']),
            ...(heading?.type === 'text' && heading.value === 'Plans' ? [] : ['No Plans heading.'])
        ];
    }
} satisfies AiCase;
