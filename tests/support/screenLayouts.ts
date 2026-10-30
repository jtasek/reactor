import { createDocument, createShape } from 'src/app/factories';

export function screenLayoutsDocument(id = 'screen-layouts') {
    const body = createShape({
        type: 'rectangle',
        name: 'Default body',
        order: 'a0',
        position: { x: 120, y: 100 },
        size: { width: 80, height: 40 },
        parentFrameId: 'home',
        sizing: { width: { mode: 'fill' } }
    });
    const compact = createShape({
        type: 'rectangle',
        name: 'Compact body',
        order: 'a1',
        position: { x: 1020, y: 820 },
        size: { width: 60, height: 30 },
        parentFrameId: 'compact',
        sizing: { width: { mode: 'fill' } }
    });

    body.id = 'body';
    compact.id = 'compact-body';

    return createDocument({
        id,
        name: 'Screen layouts',
        frames: {
            home: {
                id: 'home',
                kind: 'screen',
                definitionOnly: true,
                name: 'Home',
                position: { x: 100, y: 80 },
                size: { width: 300, height: 250 },
                visible: true,
                locked: false,
                stack: { direction: 'column', gap: 10, padding: 10, align: 'start' }
            },
            compact: {
                id: 'compact',
                kind: 'frame',
                screenLayout: true,
                parentFrameId: 'home',
                name: 'Compact',
                position: { x: 1000, y: 800 },
                size: { width: 240, height: 200 },
                visible: true,
                locked: false,
                stack: { direction: 'column', gap: 5, padding: 20, align: 'start' }
            },
            desktop: {
                id: 'desktop',
                kind: 'view',
                screenId: 'home',
                name: 'Desktop',
                position: { x: 100, y: 80 },
                size: { width: 300, height: 250 },
                visible: true,
                locked: false
            },
            mobile: {
                id: 'mobile',
                kind: 'view',
                screenId: 'home',
                layoutId: 'compact',
                name: 'Mobile',
                position: { x: 500, y: 80 },
                size: { width: 240, height: 250 },
                visible: true,
                locked: false
            }
        },
        shapes: { body, [compact.id]: compact }
    });
}
