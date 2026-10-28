import type { Document, InstanceShape, Shape } from './types';
import { instanceBox, instanceComponent, type ComponentSource } from './componentSource';
import { applyInstanceOverrides } from './componentProps';
import { resolveModes } from './inheritedModes';
import { themeColors } from './themeColors';
import { translateShape } from './geometry';
import { boxCenter, getShapeBounds, rotatePoint } from './utils';

/** Calculates detached members without changing the instance or its source. */
export function detachedMembers(
    document: Document,
    instance: InstanceShape,
    source: ComponentSource
): Shape[] {
    const component = instanceComponent(document, instance);
    const context = resolveModes(document, {
        frameId: instance.parentFrameId,
        instances: [instance]
    }).modes;
    const center = boxCenter(instanceBox(instance, source));
    const offset = {
        x: instance.position.x - source.box.topLeft.x,
        y: instance.position.y - source.box.topLeft.y
    };

    return source.shapes.map((member) => {
        const copy = {
            ...applyInstanceOverrides(
                themeColors(member, document, context),
                instance,
                component,
                document,
                context
            )
        };

        if (copy.type === 'instance') {
            copy.modeOverrides = { ...instance.modeOverrides, ...copy.modeOverrides };
        }

        translateShape(copy, offset);
        const from = boxCenter(getShapeBounds(copy));
        const to = rotatePoint(from, center, instance.rotation ?? 0);
        translateShape(copy, { x: to.x - from.x, y: to.y - from.y });
        copy.rotation = (copy.rotation ?? 0) + (instance.rotation ?? 0);

        return copy;
    });
}
