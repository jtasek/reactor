import { createDocument, createShape } from 'src/app/factories';
import type { Frame } from 'src/app/types';

export function responsiveDocument(id = 'responsive') {
    const frame = (id: string, name: string, width: number, x = 100): Frame => ({
        id,
        name,
        kind: 'frame',
        position: { x, y: 100 },
        size: { width, height: 240 },
        visible: true,
        locked: false
    });
    const button = createShape({
        type: 'rectangle',
        name: 'Button',
        order: 'a0',
        parentFrameId: 'content',
        position: { x: 120, y: 120 },
        size: { width: 120, height: 32 },
        fill: '#112233',
        bindings: { width: 'width', fill: 'ink' }
    });
    button.id = 'button';
    const text = createShape({
        type: 'text',
        name: 'Label',
        order: 'a1',
        parentFrameId: 'content',
        position: { x: 120, y: 180 },
        value: 'Continue',
        fontSize: 16,
        bindings: { fontSize: 'font', fill: 'ink' }
    });
    text.id = 'label';

    return createDocument({
        id,
        name: 'Responsive modes',
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
            media: {
                id: 'media',
                name: 'MediaSize',
                order: 1,
                defaultModeId: 'sm',
                selection: 'width',
                modes: {
                    xs: { id: 'xs', name: 'xs', order: 0, minWidth: 0 },
                    sm: { id: 'sm', name: 'sm', order: 1, minWidth: 400 },
                    lg: { id: 'lg', name: 'lg', order: 2, minWidth: 600 }
                }
            }
        },
        variables: {
            width: {
                id: 'width',
                name: 'Button width',
                type: 'number',
                dimensionId: 'media',
                values: { default: 120, xs: 80, lg: 240 }
            },
            font: {
                id: 'font',
                name: 'Font size',
                type: 'number',
                dimensionId: 'media',
                values: { default: 16, xs: 14, lg: 20 }
            },
            ink: {
                id: 'ink',
                name: 'Ink',
                type: 'color',
                dimensionId: 'theme',
                values: { default: '#112233', dark: '#ddeeff' }
            }
        },
        frames: {
            screen: { ...frame('screen', 'Home', 800), kind: 'screen', definitionOnly: true },
            mobile: {
                ...frame('mobile', 'Mobile', 360),
                kind: 'view',
                screenId: 'screen',
                modeOverrides: { theme: 'dark' }
            },
            desktop: { ...frame('desktop', 'Desktop', 800, 500), kind: 'view', screenId: 'screen' },
            content: { ...frame('content', 'Content', 260), parentFrameId: 'screen' }
        },
        shapes: { button, label: text },
        shapesIds: ['button', 'label']
    });
}
