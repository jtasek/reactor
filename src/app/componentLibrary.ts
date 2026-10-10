import type { Component, Document, Shape } from './types';
import { json } from 'overmind';
import { shapeGeometry, shapeStyle } from './utils';

function fingerprint(
    component: Component,
    members: Shape[],
    records: ReadonlyMap<string, { hash: string }>
): string {
    const payload = JSON.stringify({
        name: component.name,
        props: component.props,
        shapes: members.map((shape) => ({
            id: shape.id,
            order: shape.order,
            geometry: shapeGeometry(shape),
            style: shapeStyle(shape),
            rotation: shape.rotation,
            visible: shape.visible,
            nested: shape.type === 'instance' ? records.get(shape.componentId)?.hash : undefined
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

/** Collect dependencies before their parents, visiting shared sources only once. */
function libraryRecords(document: Document, componentId: string) {
    const records = new Map<string, { component: Component; members: Shape[]; hash: string }>();
    const visiting = new Set<string>();
    const collectComponentDependencies = (id: string): boolean => {
        if (records.has(id)) {
            return true;
        }
        const component = document.components[id];

        if (!component || visiting.has(id)) {
            return false;
        }
        visiting.add(id);
        const members: Shape[] = [];

        for (const memberId of component.shapesIds) {
            const shape = component.sourceShapes?.[memberId] ?? document.shapes[memberId];

            if (!shape) {
                return false;
            }
            if (shape.type === 'instance' && !collectComponentDependencies(shape.componentId)) {
                return false;
            }
            members.push(shape);
        }
        const hash = fingerprint(component, members, records);
        records.set(id, { component, members, hash });
        visiting.delete(id);

        return true;
    };

    if (!collectComponentDependencies(componentId)) {
        return null;
    }

    return records;
}

/** A stable fingerprint of the source content, including nested sources. */
export function componentFingerprint(document: Document, componentId: string): string | null {
    return libraryRecords(document, componentId)?.get(componentId)?.hash ?? null;
}

/** Copies a source and the nested sources it needs into portable records. */
export function librarySnapshot(
    document: Document,
    componentId: string,
    destination: Pick<Document, 'components'>
): Component[] | null {
    const records = libraryRecords(document, componentId);

    if (!records) {
        return null;
    }
    for (const id of records.keys()) {
        const existing = destination.components[id];

        if (existing && (!existing.library || existing.library.documentId !== document.id)) {
            return null;
        }
    }

    return [...records.values()].map(({ component, members, hash }) => ({
        ...structuredClone(json(component)),
        sourceShapes: Object.fromEntries(
            members.map((shape) => [shape.id, structuredClone(json(shape))])
        ),
        library: { documentId: document.id, hash },
        selected: false
    }));
}
