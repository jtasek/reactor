import type { Component, Document, Shape } from './types';
import { json } from 'overmind';
import { shapeGeometry, shapeStyle } from './utils';

/** A stable fingerprint of the source content, including nested sources. */
export function componentFingerprint(
    document: Document,
    componentId: string,
    visiting = new Set<string>()
): string | null {
    const component = document.components[componentId];

    if (!component || visiting.has(componentId)) {
        return null;
    }
    const next = new Set(visiting).add(componentId);
    const members = component.shapesIds.map(
        (id) => component.sourceShapes?.[id] ?? document.shapes[id]
    );

    if (members.some((shape) => !shape)) {
        return null;
    }
    const payload = JSON.stringify({
        name: component.name,
        props: component.props,
        shapes: members.map((shape: Shape) => ({
            id: shape.id,
            geometry: shapeGeometry(shape),
            style: shapeStyle(shape),
            rotation: shape.rotation,
            visible: shape.visible,
            nested:
                shape.type === 'instance'
                    ? componentFingerprint(document, shape.componentId, next)
                    : undefined
        }))
    });
    let first = 2166136261;
    let second = 2166136261 ^ 0x9e3779b9;

    for (let index = 0; index < payload.length; index++) {
        first = Math.imul(first ^ payload.charCodeAt(index), 16777619);
        second = Math.imul(second ^ payload.charCodeAt(index), 16777619);
    }

    return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}

/** Copies a source and the nested sources it needs into portable records. */
export function librarySnapshot(
    document: Document,
    componentId: string,
    destination: Document,
    visiting = new Set<string>()
): Component[] | null {
    const component = document.components[componentId];
    const hash = componentFingerprint(document, componentId);

    if (!component || !hash || visiting.has(componentId)) {
        return null;
    }
    const next = new Set(visiting).add(componentId);
    const shapes = Object.fromEntries(
        component.shapesIds.flatMap((id) => {
            const shape = component.sourceShapes?.[id] ?? document.shapes[id];

            return shape ? [[id, structuredClone(json(shape))]] : [];
        })
    );

    if (Object.keys(shapes).length !== component.shapesIds.length) {
        return null;
    }

    const nested: Component[] = [];

    for (const shape of Object.values(shapes)) {
        if (shape.type !== 'instance') {
            continue;
        }
        const copies = librarySnapshot(document, shape.componentId, destination, next);

        if (!copies) {
            return null;
        }
        nested.push(...copies);
    }

    if (
        [componentId, ...nested.map((item) => item.id)].some((id) => {
            const existing = destination.components[id];

            return existing && (!existing.library || existing.library.documentId !== document.id);
        })
    ) {
        return null;
    }

    return [
        ...nested,
        {
            ...structuredClone(json(component)),
            sourceShapes: shapes,
            library: { documentId: document.id, hash },
            selected: false
        }
    ];
}
