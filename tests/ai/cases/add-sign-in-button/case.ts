import type { AiCase } from '../../harness';
import { findShapes, groupNamed } from '../../checks';

export default {
    fixture: {
        variables: { brand: { name: 'Brand', type: 'color', value: '#3366ff' } },
        shapes: {
            title: { type: 'text', position: { x: 40, y: 40 }, value: 'Welcome back', fontSize: 24 }
        }
    },
    prompt: 'Add a Sign in button below the title, in the brand color.',
    check(document) {
        const group = groupNamed(document, /sign in/i);
        const [button] = findShapes(document, group, 'rectangle');
        const [label] = findShapes(document, group, 'text');

        return [
            ...(group ? [] : ['No Sign in group.']),
            ...(button?.type === 'rectangle' && button.fill === '#3366ff'
                ? []
                : ['The button is not in the brand color.']),
            ...(button?.bindings?.fill === 'brand' ? [] : ['The button does not follow Brand.']),
            ...(label?.type === 'text' && label.value === 'Sign in' ? [] : ['No Sign in label.']),
            ...(button && 'position' in button && button.position.y > 40
                ? []
                : ['The button is not below the title.'])
        ];
    }
} satisfies AiCase;
