import type { Document, InstanceShape, Shape } from './types';
import { instanceBox, type ComponentSource } from './componentSource';
import { instanceMember } from './componentProps';
import { translateShape } from './geometry';
import { boxCenter, getShapeBounds, rotatePoint } from './utils';

/** Calculates detached members without changing the instance or its source. */
export function detachedMembers(
    document: Document,
    instance: InstanceShape,
    source: ComponentSource
): Shape[] {
    const component = document.components[instance.componentId];
    const center = boxCenter(instanceBox(instance, source));
    const offset = {
        x: instance.position.x - source.box.topLeft.x,
        y: instance.position.y - source.box.topLeft.y
    };

    return source.shapes.map((member) => {
        const copy = { ...instanceMember(member, instance, component, document) };
        translateShape(copy, offset);
        const from = boxCenter(getShapeBounds(copy));
        const to = rotatePoint(from, center, instance.rotation ?? 0);
        translateShape(copy, { x: to.x - from.x, y: to.y - from.y });
        copy.rotation = (copy.rotation ?? 0) + (instance.rotation ?? 0);

        return copy;
    });
}
