import { createComponent, createDocument, createShape } from 'src/app/factories';
import type { Frame, Shape, ShapeInput } from 'src/app/types';
import { responsiveDocument } from './responsiveModes';

/** The hash of `PREVIEW_PNG`, so the downloaded package can read it. */
const IMAGE = 'asset:c414cd0e204de974f73753c7e28d7638e7b3691bb8b1a2bab6b25bb7fed7ce77';

/**
 * Every primitive with rotation, opacity and its own paint, nested rotated instances, a
 * wrapped text, a hidden shape, a nested frame that sets its own theme and a badge shown
 * once a prototype state turns on, on one screen shown by a wide and a narrow View.
 */
export function parityArtworkDocument() {
    const { dimensions, variables } = responsiveDocument();
    const shapes: Record<string, Shape> = {};
    let order = 0;
    const add = (id: string, input: ShapeInput & Partial<Pick<Shape, 'visible'>>) => {
        shapes[id] = {
            ...createShape({ name: id, order: `a${order++}`, ...input }),
            id,
            key: id,
            selected: false
        };
    };
    const frame = (id: string, fields: Partial<Frame>): Frame => ({
        id,
        name: id,
        kind: 'frame',
        position: { x: 0, y: 0 },
        size: { width: 400, height: 640 },
        visible: true,
        locked: false,
        ...fields
    });

    add('badge-back', {
        type: 'rectangle',
        position: { x: 2000, y: 0 },
        size: { width: 60, height: 24 },
        cornerRadius: 12,
        fill: '#ffeecc',
        stroke: '#cc8800'
    });
    add('badge-text', {
        type: 'text',
        position: { x: 2008, y: 17 },
        value: 'New',
        fontSize: 12,
        fontWeight: 700,
        rotation: 15,
        bindings: { fontColor: 'ink' },
        fontColor: '#112233'
    });
    add('card-back', {
        type: 'rectangle',
        position: { x: 2100, y: 0 },
        size: { width: 160, height: 90 },
        fill: '#ffffff',
        opacity: 0.9
    });
    add('card-badge', {
        type: 'instance',
        componentId: 'badge',
        position: { x: 2110, y: 10 },
        overrides: { label: 'Hot' },
        rotation: -20
    });

    add('rect', {
        type: 'rectangle',
        parentFrameId: 'art',
        position: { x: 20, y: 20 },
        size: { width: 120, height: 60 },
        cornerRadius: 8,
        rotation: 30,
        opacity: 0.5,
        fill: '#336699'
    });
    add('circle', {
        type: 'circle',
        parentFrameId: 'art',
        position: { x: 220, y: 60 },
        radius: 30,
        stroke: '#aa0000'
    });
    add('ellipse', {
        type: 'ellipse',
        parentFrameId: 'art',
        position: { x: 320, y: 60 },
        radius: { x: 40, y: 20 },
        rotation: 45,
        fill: '#00aa00'
    });
    add('line', {
        type: 'line',
        parentFrameId: 'art',
        start: { x: 20, y: 120 },
        end: { x: 380, y: 140 },
        rotation: 10
    });
    add('pen', {
        type: 'pen',
        parentFrameId: 'art',
        points: [
            { x: 20, y: 160 },
            { x: 60, y: 200 },
            { x: 100, y: 170 },
            { x: 140, y: 210 }
        ],
        stroke: '#5500aa',
        opacity: 0.7
    });
    add('wrapped', {
        type: 'text',
        parentFrameId: 'art',
        position: { x: 20, y: 250 },
        value: 'A long caption that wraps across several lines inside its width',
        fontSize: 18,
        wrapWidth: 200,
        fontWeight: 600,
        rotation: -5
    });
    add('picture', {
        type: 'image',
        parentFrameId: 'art',
        position: { x: 240, y: 200 },
        size: { width: 120, height: 80 },
        source: IMAGE,
        rotation: 90
    });
    add('hidden', {
        type: 'rectangle',
        parentFrameId: 'art',
        position: { x: 0, y: 0 },
        size: { width: 400, height: 640 },
        fill: '#ff0000',
        visible: false
    });
    add('card', {
        type: 'instance',
        parentFrameId: 'art',
        componentId: 'card',
        position: { x: 40, y: 340 },
        overrides: {},
        rotation: 10,
        opacity: 0.8,
        interactions: {
            activate: { type: 'state', change: 'set', stateId: 'open', value: true }
        }
    });
    add('dark-label', {
        type: 'text',
        parentFrameId: 'panel',
        position: { x: 40, y: 500 },
        value: 'Dark panel',
        fontSize: 16,
        fontColor: '#112233',
        bindings: { fontColor: 'ink', fontSize: 'font' }
    });
    add('dark-card', {
        type: 'instance',
        parentFrameId: 'panel',
        componentId: 'badge',
        position: { x: 200, y: 490 },
        overrides: {},
        prototypeVisibleWhen: {
            kind: 'equals',
            left: { kind: 'state', stateId: 'open' },
            right: { kind: 'value', value: true }
        }
    });

    return createDocument({
        id: 'parity-artwork',
        name: 'Parity artwork',
        dimensions,
        variables,
        prototypeBooleans: { open: { id: 'open', name: 'Card opened', initial: false } },
        frames: {
            art: frame('art', { kind: 'screen', definitionOnly: true }),
            panel: frame('panel', {
                parentFrameId: 'art',
                position: { x: 20, y: 460 },
                size: { width: 360, height: 120 },
                modeOverrides: { theme: 'dark' }
            }),
            wide: frame('wide', { kind: 'view', screenId: 'art', position: { x: 600, y: 0 } }),
            narrow: frame('narrow', {
                kind: 'view',
                screenId: 'art',
                position: { x: 1100, y: 0 },
                size: { width: 300, height: 640 },
                modeOverrides: { theme: 'dark' }
            })
        },
        components: {
            badge: createComponent({
                id: 'badge',
                name: 'Badge',
                sourceOnly: true,
                shapesIds: ['badge-back', 'badge-text'],
                props: [{ id: 'label', shapeId: 'badge-text', key: 'text', label: 'Label' }]
            }),
            card: createComponent({
                id: 'card',
                name: 'Card',
                sourceOnly: true,
                shapesIds: ['card-back', 'card-badge']
            })
        },
        shapes,
        shapesIds: Object.keys(shapes)
    });
}
