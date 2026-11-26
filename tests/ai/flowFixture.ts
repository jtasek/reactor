import type { Fixture } from './harness';

const page = (name: string, x: number) => ({
    kind: 'screen',
    name,
    position: { x, y: 0 },
    size: { width: 320, height: 480 }
});

/** Sign in, Details and Settings pages; Sign in holds a Continue button and a Help button. */
export const flowFixture: Fixture = {
    frames: {
        signIn: page('Sign in', 0),
        details: page('Details', 400),
        settings: page('Settings', 800)
    },
    shapes: {
        caption: { type: 'text', position: { x: 0, y: 600 }, value: 'Button', fontSize: 16 },
        next: {
            type: 'instance',
            name: 'Primary button',
            componentId: 'button',
            parentFrameId: 'signIn',
            position: { x: 24, y: 400 },
            overrides: { label: 'Continue' }
        },
        help: {
            type: 'instance',
            name: 'Secondary button',
            componentId: 'button',
            parentFrameId: 'signIn',
            position: { x: 24, y: 440 },
            overrides: { label: 'Help' }
        }
    },
    components: {
        button: {
            name: 'Button',
            shapesIds: ['caption'],
            sourceOnly: true,
            props: [{ id: 'label', label: 'Label', shapeId: 'caption', key: 'value' }],
            interaction: { role: 'button', props: { label: 'label' } }
        }
    }
};
