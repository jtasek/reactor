import { json } from 'overmind';
import { createDocument } from 'src/app/factories';
import { previewFixture } from './preview';

export function automaticLayoutsPrototype(compatible = true) {
    const document = previewFixture();
    const input = document.shapes.name;
    const button = document.shapes.next;
    if (input.type !== 'instance' || button.type !== 'instance') {
        throw new Error('Expected prototype instances');
    }
    document.frames.home.definitionOnly = true;
    document.frames.home.responsiveLayouts = [{ minWidth: 640, layoutId: 'wide' }];
    document.frames.wide = {
        id: 'wide',
        kind: 'frame',
        screenLayout: true,
        parentFrameId: 'home',
        name: 'Wide',
        position: { x: 1000, y: 0 },
        size: { width: 800, height: 480 },
        visible: true,
        locked: false
    };
    document.frames.view = {
        id: 'view',
        kind: 'view',
        screenId: 'home',
        name: 'Mobile',
        layoutMode: 'auto',
        position: { x: 0, y: 0 },
        size: { width: 320, height: 480 },
        visible: true,
        locked: false
    };
    input.interaction = {
        role: 'input',
        controlId: 'person-name',
        props: { label: 'label', value: 'label' }
    };
    document.components.input.props!.push({
        id: 'other-value',
        shapeId: 'field',
        key: 'text',
        label: 'Other value'
    });

    return createDocument({
        ...json(document),
        shapes: {
            ...json(document.shapes),
            'wide-name': {
                ...json(input),
                id: 'wide-name',
                name: 'Wide input',
                parentFrameId: 'wide',
                order: 'a5',
                position: { x: 1048, y: 40 },
                interaction: {
                    ...input.interaction,
                    props: { label: 'label', value: compatible ? 'label' : 'other-value' }
                }
            },
            'wide-next': {
                ...json(button),
                id: 'wide-next',
                name: 'Wide continue',
                parentFrameId: 'wide',
                order: 'a6',
                position: { x: 1048, y: 100 }
            }
        }
    });
}
