import type { AiCase } from '../../harness';
import { selectScreenLayout } from 'src/app/screenLayouts';

export const operations = [
    {
        op: 'addFrame',
        key: 'home',
        frame: {
            kind: 'screen',
            name: 'Home',
            position: { x: 0, y: 0 },
            size: { width: 320, height: 480 },
            responsiveLayouts: { wide: { minWidth: 600, layoutId: 'wide' } }
        }
    },
    {
        op: 'addFrame',
        key: 'wide',
        frame: {
            kind: 'frame',
            screenLayout: true,
            parentFrameId: 'home',
            name: 'Wide',
            position: { x: 0, y: 0 },
            size: { width: 800, height: 480 }
        }
    },
    {
        op: 'addShape',
        key: 'compact-heading',
        shape: {
            type: 'text',
            name: 'Compact heading',
            parentFrameId: 'home',
            position: { x: 24, y: 48 },
            value: 'Hello mobile'
        }
    },
    {
        op: 'addShape',
        key: 'wide-heading',
        shape: {
            type: 'text',
            name: 'Wide heading',
            parentFrameId: 'wide',
            position: { x: 24, y: 48 },
            value: 'Hello desktop'
        }
    },
    {
        op: 'addFrame',
        key: 'mobile',
        frame: {
            kind: 'view',
            screenId: 'home',
            name: 'Mobile',
            position: { x: 100, y: 100 },
            size: { width: 320, height: 480 },
            layoutMode: 'auto'
        }
    },
    {
        op: 'addFrame',
        key: 'desktop',
        frame: {
            kind: 'view',
            screenId: 'home',
            name: 'Desktop',
            position: { x: 520, y: 100 },
            size: { width: 800, height: 480 },
            layoutMode: 'auto'
        }
    }
];

const scenario: AiCase = {
    fixture: {},
    prompt: 'Create a Home screen with mobile artwork saying Hello mobile and a Wide alternate layout saying Hello desktop. Add Mobile and Desktop Screen views at widths 320 and 800. At widths of 600 and above choose Wide automatically; otherwise use the default screen artwork.',
    reference: [operations],
    check(document) {
        const frames = Object.values(document.frames);
        const screen = frames.find((frame) => frame.kind === 'screen' && frame.name === 'Home');
        const wide = frames.find((frame) => frame.screenLayout && frame.name === 'Wide');
        const views = frames.filter((frame) => frame.kind === 'view');

        if (!screen || !wide || wide.parentFrameId !== screen.id || views.length !== 2) {
            return ['Expected one Home screen, its Wide layout and exactly two views.'];
        }
        if (
            selectScreenLayout(document, screen.id, {
                size: { width: 800, height: 480 },
                layoutMode: 'auto'
            }) !== wide.id ||
            selectScreenLayout(document, screen.id, {
                size: { width: 320, height: 480 },
                layoutMode: 'auto'
            }) !== undefined
        ) {
            return ['Expected width selection to switch at 600px.'];
        }
        const text = Object.values(document.shapes).filter((shape) => shape.type === 'text');

        return text.some(
            (shape) => shape.value === 'Hello mobile' && shape.parentFrameId === screen.id
        ) &&
            text.some((shape) => shape.value === 'Hello desktop' && shape.parentFrameId === wide.id)
            ? []
            : ['Expected artwork in each source tree.'];
    }
};

export default scenario;
