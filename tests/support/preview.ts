import { createComponent, createDocument, createShape } from 'src/app/factories';
import type { ShapeInput, Shape, Frame } from 'src/app/types';

const shape = (id: string, input: ShapeInput & Pick<Shape, 'name' | 'order'>): Shape => ({
    ...createShape(input),
    id,
    selected: false
});

/** A two-screen prototype with explicit component props and ordinary canvas artwork. */
export function previewFixture() {
    const frame = (id: string, name: string, x: number): Frame => ({
        id,
        name,
        kind: 'screen',
        position: { x, y: 0 },
        size: { width: 320, height: 480 },
        visible: true,
        locked: false
    });
    const caption = shape('caption', {
        type: 'text',
        name: 'Caption',
        order: 'a0',
        value: 'Continue',
        position: { x: 0, y: 24 }
    });
    const field = shape('field', {
        type: 'text',
        name: 'Field label',
        order: 'a1',
        value: 'Your name',
        position: { x: 0, y: 24 }
    });
    const button = createComponent({
        id: 'button',
        name: 'Button',
        sourceOnly: true,
        shapesIds: [caption.id],
        props: [{ id: 'label', shapeId: caption.id, key: 'text', label: 'Label' }],
        interaction: { role: 'button', props: { label: 'label' }, navigateTo: 'details' }
    });
    const input = createComponent({
        id: 'input',
        name: 'Input',
        sourceOnly: true,
        shapesIds: [field.id],
        props: [{ id: 'label', shapeId: field.id, key: 'text', label: 'Label' }],
        interaction: { role: 'input', props: { label: 'label' } }
    });
    const next = shape('next', {
        type: 'instance',
        name: 'Continue button',
        order: 'a2',
        componentId: button.id,
        position: { x: 24, y: 100 },
        parentFrameId: 'home',
        overrides: {}
    });
    const name = shape('name', {
        type: 'instance',
        name: 'Name field',
        order: 'a3',
        componentId: input.id,
        position: { x: 24, y: 40 },
        parentFrameId: 'home',
        overrides: {}
    });
    const title = shape('title', {
        type: 'text',
        name: 'Details title',
        order: 'a4',
        value: 'Hello from details',
        position: { x: 424, y: 48 },
        parentFrameId: 'details'
    });

    return createDocument({
        id: 'preview-document',
        name: 'Prototype',
        frames: { home: frame('home', 'Home', 0), details: frame('details', 'Details', 400) },
        components: { button, input },
        shapes: { caption, field, next, name, title }
    });
}
