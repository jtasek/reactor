import type { AiCase } from '../../harness';

export default {
    fixture: {
        variables: { brand: { name: 'Brand', type: 'color', value: '#3366ff' } },
        shapes: {
            button: {
                type: 'rectangle',
                position: { x: 40, y: 80 },
                size: { width: 120, height: 40 },
                fill: '#3366ff',
                bindings: { fill: 'brand' }
            },
            label: { type: 'text', position: { x: 70, y: 92 }, value: 'Sign in' },
            footer: {
                type: 'rectangle',
                position: { x: 0, y: 400 },
                size: { width: 300, height: 40 }
            }
        }
    },
    prompt: 'Change the brand color to #ff6600, label the button Sign up, and remove the footer.',
    check(document) {
        const { button, label, footer } = document.shapes;

        return [
            ...(document.variables.brand?.values.default === '#ff6600'
                ? []
                : ['Brand is not #ff6600.']),
            ...(button?.type === 'rectangle' &&
            button.fill === '#ff6600' &&
            button.bindings?.fill === 'brand'
                ? []
                : ['The button does not follow Brand.']),
            ...(label?.type === 'text' && label.value === 'Sign up' ? [] : ['No Sign up label.']),
            ...(footer ? ['The footer is still there.'] : [])
        ];
    }
} satisfies AiCase;
