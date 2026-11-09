import type { Box, Component, Document, InstanceShape, Shape } from './types';
import { rotatedBounds } from './membership';
import { getShapeBounds, rectToBox, shapeGeometryKey } from './utils';
import { resolveVariable } from './variableResolver';
import { byDrawingOrder } from './drawOrder';

export interface ComponentSource {
    /** Local responsive decision, never persisted with an instance. */
    variant?: { componentId: string; explanation: string; problem?: string };

    /** Context of a local instance projection, also used when opening its source. */
    context?: {
        modes: import('./types').VariableContext;
        availableWidth?: number;
        widths?: import('./responsiveVariants').VariantWidths;
    };
    /** Bounds in the source's canvas coordinates. */
    box: Box;
    /** Source members in drawing order. */
    shapes: Shape[];
    /** Changes when any geometry or appearance within the source changes. */
    key: string;
}

export const instanceSource = (
    document: Pick<Document, 'components' | 'shapes' | 'variables'>,
    instance: InstanceShape,
    ancestors?: ReadonlySet<string>
) =>
    instance.projectedSource ??
    componentSource(document, instanceComponentId(document, instance), ancestors);

/** A missing or unlinked alternate falls back to the family's default source. */
export function instanceComponentId(
    document: Pick<Document, 'components'>,
    instance: Pick<InstanceShape, 'componentId' | 'variantId' | 'projectedSource'>
): string {
    const variant = instance.projectedSource?.variant?.componentId ?? instance.variantId;

    return variant &&
        document.components[variant] &&
        document.components[instance.componentId]?.variantIds?.includes(variant)
        ? variant
        : instance.componentId;
}

/** The component an instance draws: its selected alternate, or the family default. */
export const instanceComponent = (
    document: Pick<Document, 'components'>,
    instance: InstanceShape
) => document.components[instanceComponentId(document, instance)];

/**
 * A component's existing members in drawing order, from its library snapshot or the
 * document. Only members affect the order: reading the document-wide list would make
 * every instance depend on unrelated shapes moving in front or behind.
 */
export const sourceMembers = (
    component: Pick<Component, 'shapesIds' | 'sourceShapes'>,
    shapes: Record<string, Shape>
): Shape[] => {
    const sourceShapes = component.sourceShapes ?? shapes;

    return [...new Set(component.shapesIds)]
        .map((id) => sourceShapes[id])
        .filter((shape) => Boolean(shape))
        .sort(byDrawingOrder);
};

const MAX_COMPONENT_DEPTH = 16;

/** Reads a source independently of its own visibility, layer and group. */
export function componentSource(
    document: Pick<Document, 'components' | 'shapes' | 'variables'>,
    componentId: string,
    ancestors: ReadonlySet<string> = new Set()
): ComponentSource | null {
    const component = document.components[componentId];

    if (!component || ancestors.has(componentId) || ancestors.size >= MAX_COMPONENT_DEPTH) {
        return null;
    }

    const next = new Set(ancestors).add(componentId);
    const shapes = sourceMembers(component, document.shapes);
    const boxes: Box[] = [];
    const keys: string[] = [];

    for (const shape of shapes) {
        // Keep hidden members in the frame: an instance may expose them through an override.
        const bounds = getShapeBounds(shape);
        const geometryKey = `${shape.id}:${shapeGeometryKey(shape)}:${JSON.stringify(bounds)}:${shape.visible}`;
        if (shape.type === 'instance') {
            const nested = componentSource(document, instanceComponentId(document, shape), next);

            if (!nested) {
                continue;
            }
            const box = rectToBox({
                x: shape.position.x,
                y: shape.position.y,
                width: nested.box.width,
                height: nested.box.height
            });
            boxes.push(rotatedBounds(box, shape.rotation ?? 0));
            const variables = Object.values(shape.overrides).flatMap((override) => {
                if (typeof override !== 'object') {
                    return [];
                }
                const variable = document.variables[override.variableId];

                return variable ? [resolveVariable(variable, document.variables)] : [];
            });
            keys.push(`${geometryKey}:${JSON.stringify(variables)}:${nested.key}`);

            continue;
        }

        boxes.push(rotatedBounds(bounds, shape.rotation ?? 0));
        keys.push(
            `${geometryKey}:${shape.rotation}:${shape.opacity}:${shape.fill}:${shape.stroke}:${shape.fontColor}`
        );
    }

    if (boxes.length === 0) {
        return null;
    }

    const left = Math.min(...boxes.map((box) => box.topLeft.x));
    const top = Math.min(...boxes.map((box) => box.topLeft.y));
    const right = Math.max(...boxes.map((box) => box.bottomRight.x));
    const bottom = Math.max(...boxes.map((box) => box.bottomRight.y));

    return {
        box: rectToBox({ x: left, y: top, width: right - left, height: bottom - top }),
        shapes,
        key: keys.join('|')
    };
}

/** The instance's unrotated bounds at its independent position. */
export function instanceBox(
    instance: Pick<InstanceShape, 'position'>,
    source: ComponentSource
): Box {
    return rectToBox({
        x: instance.position.x,
        y: instance.position.y,
        width: source.box.width,
        height: source.box.height
    });
}
