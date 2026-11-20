import { createComponent, createDocument, createShape } from 'src/app/factories';
import type { Frame, Shape, ShapeInput } from 'src/app/types';

const shape = (id: string, input: ShapeInput & Pick<Shape, 'name' | 'order'>): Shape => ({
    ...createShape(input),
    id,
    selected: false
});

/**
 * A sign-in page in Light and Dark, with sizes chosen by width. Muted text passes in Light
 * and fails in Dark; the Help button is named after its layer; Tab reaches Sign in before
 * Email, which is above it; no one color for the hint reads in both themes.
 */
export function accessibilityFixture(withView = false) {
    const page: Frame = {
        id: 'home',
        name: 'Sign in',
        kind: 'screen',
        position: { x: 0, y: 0 },
        size: { width: 400, height: 320 },
        visible: true,
        locked: false
    };
    const caption = shape('caption', {
        type: 'text',
        name: 'Caption',
        order: 'a0',
        value: 'Sign in',
        fontSize: 16,
        fontColor: '#ffffff',
        position: { x: 12, y: 24 }
    });
    const backing = shape('backing', {
        type: 'rectangle',
        name: 'Backing',
        order: 'Zz',
        position: { x: 0, y: 0 },
        size: { width: 120, height: 36 },
        fill: '#1a4fd6'
    });
    const field = shape('field', {
        type: 'text',
        name: 'Field label',
        order: 'a1',
        value: 'Email',
        fontSize: 16,
        position: { x: 0, y: 24 }
    });
    const button = createComponent({
        id: 'button',
        name: 'Button',
        sourceOnly: true,
        shapesIds: [backing.id, caption.id],
        props: [{ id: 'label', shapeId: caption.id, key: 'text', label: 'Label' }],
        interaction: { role: 'button', props: { label: 'label' }, navigateTo: 'home' }
    });
    const plain = createComponent({
        id: 'plain',
        name: 'Plain button',
        sourceOnly: true,
        shapesIds: [],
        interaction: { role: 'none', props: {} },
        interactions: { activate: { type: 'navigate', screenId: 'home' } }
    });
    const helpText = shape('help-text', {
        type: 'text',
        name: 'Help text',
        order: 'a2',
        value: 'Help',
        fontSize: 16,
        fontColor: '#595959',
        bindings: { fontColor: 'muted' },
        position: { x: 0, y: 20 }
    });
    plain.shapesIds = [helpText.id];
    const input = createComponent({
        id: 'input',
        name: 'Input',
        sourceOnly: true,
        shapesIds: [field.id],
        props: [{ id: 'label', shapeId: field.id, key: 'text', label: 'Label' }],
        interaction: { role: 'input', props: { label: 'label' } }
    });
    const background = shape('background', {
        type: 'rectangle',
        name: 'Background',
        order: 'b0',
        parentFrameId: 'home',
        position: { x: 0, y: 0 },
        size: { width: 400, height: 320 },
        fill: '#ffffff',
        bindings: { fill: 'surface' }
    });
    const title = shape('title', {
        type: 'text',
        name: 'Title',
        order: 'b1',
        parentFrameId: 'home',
        value: 'Welcome back',
        fontSize: 16,
        fontColor: '#595959',
        bindings: { fontColor: 'muted' },
        position: { x: 24, y: 40 }
    });
    const submit = shape('submit', {
        type: 'instance',
        name: 'Sign in button',
        order: 'b2',
        parentFrameId: 'home',
        componentId: button.id,
        position: { x: 24, y: 200 },
        overrides: {}
    });
    const email = shape('email', {
        type: 'instance',
        name: 'Email field',
        order: 'b3',
        parentFrameId: 'home',
        componentId: input.id,
        position: { x: 24, y: 120 },
        overrides: {}
    });
    const helpButton = shape('help', {
        type: 'instance',
        name: 'Rectangle 7',
        order: 'b4',
        parentFrameId: 'home',
        componentId: plain.id,
        position: { x: 200, y: 260 },
        overrides: {}
    });
    const hint = shape('hint', {
        type: 'text',
        name: 'Hint',
        order: 'b5',
        parentFrameId: 'home',
        value: 'We never share it',
        fontSize: 14,
        fontColor: '#bbbbbb',
        position: { x: 24, y: 300 }
    });

    const view: Frame = {
        id: 'view',
        kind: 'view',
        screenId: 'home',
        name: 'Sign in',
        position: { x: 0, y: 600 },
        size: { width: 400, height: 320 },
        visible: true,
        locked: false
    };

    return createDocument({
        id: 'accessibility-document',
        name: 'Accessibility',
        dimensions: {
            theme: {
                id: 'theme',
                name: 'Theme',
                order: 0,
                defaultModeId: 'light',
                modes: {
                    light: { id: 'light', name: 'Light', order: 0 },
                    dark: { id: 'dark', name: 'Dark', order: 1 }
                }
            },
            sizes: {
                id: 'sizes',
                name: 'Sizes',
                order: 1,
                defaultModeId: 'small',
                selection: 'width',
                modes: {
                    small: { id: 'small', name: 'Small', order: 0, minWidth: 0 },
                    large: { id: 'large', name: 'Large', order: 1, minWidth: 700 }
                }
            }
        },
        variables: {
            surface: {
                id: 'surface',
                name: 'Surface',
                type: 'color',
                dimensionId: 'theme',
                values: { default: '#ffffff', dark: '#1e1e1e' }
            },
            muted: {
                id: 'muted',
                name: 'Muted text',
                type: 'color',
                dimensionId: 'theme',
                values: { default: '#595959', dark: '#4a4a4a' }
            }
        },
        frames: withView ? { home: { ...page, definitionOnly: true }, view } : { home: page },
        components: { button, plain, input },
        shapes: {
            caption,
            backing,
            field,
            background,
            title,
            submit,
            email,
            help: helpButton,
            'help-text': helpText,
            hint
        }
    });
}
