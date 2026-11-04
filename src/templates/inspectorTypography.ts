import { createComponent, createShape } from 'src/app/factories';
import { orderAbove } from 'src/app/drawOrder';
import type { Component, Shape, ShapeInput } from 'src/app/types';
import type { StarterDocument } from './build';

/** Editable graph artwork, played by the ordinary prototype runtime. */
export function buildInspectorTypography(newId: () => string): StarterDocument {
    const screenId = newId();
    const viewId = newId();
    const shapes: Record<string, Shape> = {};
    const components: Record<string, Component> = {};
    const add = (input: ShapeInput & Pick<Shape, 'name'>) => {
        const id = newId();
        shapes[id] = {
            ...createShape({
                ...input,
                order: orderAbove(Object.values(shapes).at(-1)?.order ?? null)
            }),
            id,
            key: id,
            selected: false
        };

        return id;
    };
    const text = (
        value: string,
        x: number,
        y: number,
        fontSize = 14,
        fontWeight = 400,
        parentFrameId?: string
    ) =>
        add({
            type: 'text',
            name: value,
            value,
            position: { x, y },
            fontSize,
            fontWeight,
            fontColor: '#30343b',
            parentFrameId
        });
    const rect = (
        x: number,
        y: number,
        width: number,
        height: number,
        fill: string,
        parentFrameId?: string
    ) =>
        add({
            type: 'rectangle',
            name: 'Surface',
            position: { x, y },
            size: { width, height },
            fill,
            stroke: '#dde0e5',
            cornerRadius: 10,
            parentFrameId
        });
    const styles = [
        {
            name: 'Sentence · Medium',
            weight: 500,
            headings: ['Properties', 'Layout variables', 'Appearance']
        },
        {
            name: 'Sentence · Regular',
            weight: 400,
            headings: ['Properties', 'Layout variables', 'Appearance']
        },
        {
            name: 'Title · Semibold',
            weight: 600,
            headings: ['Properties', 'Layout Variables', 'Appearance']
        },
        {
            name: 'Uppercase · Semibold',
            weight: 600,
            headings: ['PROPERTIES', 'LAYOUT VARIABLES', 'APPEARANCE']
        }
    ];
    const variants = styles.map((style) => {
        const id = newId();
        const members = [rect(0, 0, 320, 430, '#f5f6f8'), text('Inspector', 110, 30, 18, 600)];
        style.headings.forEach((heading, index) => {
            const y = 74 + index * 116;
            members.push(
                text(heading, 18, y, 13, style.weight),
                rect(12, y + 12, 296, 68, '#ffffff')
            );
        });
        const label = text('Placeholder', 24, 110, 12);
        const value = text('What do you need?', 24, 138, 16);
        members.push(
            label,
            value,
            text('Width', 24, 232),
            text('240', 210, 232),
            text('Fill', 24, 348),
            rect(210, 332, 24, 24, '#6789e6')
        );
        components[id] = createComponent({
            id,
            name: style.name,
            sourceOnly: true,
            shapesIds: members,
            props: [{ id: 'placeholder', label: 'Placeholder', shapeId: value, key: 'text' }]
        });

        return id;
    });
    const family = components[variants[0]];
    family.variantIds = variants.slice(1);
    rect(0, 0, 420, 760, '#ffffff', screenId);
    text('Inspector typography', 24, 42, 24, 600, screenId);
    text('Choose a style to compare the headings.', 24, 72, 16, 400, screenId);
    const targetId = add({
        type: 'instance',
        name: 'Inspector comparison',
        componentId: family.id,
        position: { x: 50, y: 260 },
        overrides: {},
        parentFrameId: screenId
    });
    styles.forEach((style, index) => {
        const background = rect(0, 0, 180, 48, '#eef2fc');
        const label = text(style.name, 10, 29, 13, 500);
        const componentId = newId();
        components[componentId] = createComponent({
            id: componentId,
            name: `${style.name} button`,
            sourceOnly: true,
            shapesIds: [background, label],
            props: [{ id: 'label', label: 'Label', shapeId: label, key: 'text' }],
            interaction: { role: 'button', props: { label: 'label' } }
        });
        add({
            type: 'instance',
            name: style.name,
            componentId,
            position: { x: 24 + (index % 2) * 192, y: 106 + Math.floor(index / 2) * 60 },
            overrides: {},
            parentFrameId: screenId,
            interactions: {
                activate: {
                    type: 'changeVariant',
                    instanceId: targetId,
                    variantId: variants[index]
                }
            }
        });
    });
    text('Reset prototype restores the original style.', 24, 724, 14, 400, screenId);

    return {
        name: 'Inspector typography',
        shapes,
        shapesIds: Object.keys(shapes),
        components,
        frames: {
            [screenId]: {
                id: screenId,
                name: 'Typography comparison',
                kind: 'screen',
                definitionOnly: true,
                position: { x: 0, y: 0 },
                size: { width: 420, height: 760 },
                visible: true,
                locked: false
            },
            [viewId]: {
                id: viewId,
                name: 'Desktop',
                kind: 'view',
                screenId,
                position: { x: 0, y: 0 },
                size: { width: 420, height: 760 },
                visible: true,
                locked: false
            }
        },
        camera: { position: { x: 360, y: 60 }, scale: 0.75 }
    };
}
