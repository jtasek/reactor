import type { Box, Document, InstanceShape, Shape } from './types';
import { drawnBox } from './membership';
import { getShapeBounds, rectToBox, shapeGeometryKey } from './utils';
import { variableValue } from './variables';
import { inDrawingOrder } from './drawOrder';

export interface ComponentSource {
    /** Bounds in the source's canvas coordinates. */
    box: Box;
    /** Source members in drawing order. */
    shapes: Shape[];
    /** Changes when any geometry or appearance within the source changes. */
    key: string;
}

const MAX_COMPONENT_DEPTH = 16;

/** Reads a source independently of its own visibility, layer and group. */
export function componentSource(
    document: Document,
    componentId: string,
    ancestors: ReadonlySet<string> = new Set()
): ComponentSource | null {
    const component = document.components[componentId];

    if (!component || ancestors.has(componentId) || ancestors.size >= MAX_COMPONENT_DEPTH) {
        return null;
    }

    const next = new Set(ancestors).add(componentId);
    const members = new Set(component.shapesIds);
    const ordered = (
        component.sourceShapes ? inDrawingOrder(component.sourceShapes) : document.shapesIds
    ).filter((id) => members.has(id));
    const shapes = ordered
        .map((id) => component.sourceShapes?.[id] ?? document.shapes[id])
        .filter((shape) => Boolean(shape));
    const boxes: Box[] = [];
    const keys: string[] = [];

    for (const shape of shapes) {
        // Keep hidden members in the frame: an instance may expose them through an override.
        const geometryKey = `${shape.id}:${shapeGeometryKey(shape)}:${JSON.stringify(getShapeBounds(shape))}:${shape.visible}`;
        if (shape.type === 'instance') {
            const nested = componentSource(document, shape.componentId, next);

            if (!nested) {
                continue;
            }
            const box = rectToBox({
                x: shape.position.x,
                y: shape.position.y,
                width: nested.box.width,
                height: nested.box.height
            });
            boxes.push(drawnBox({ ...shape, bounds: box }));
            const variables = Object.values(shape.overrides).flatMap((override) => {
                if (typeof override !== 'object') {
                    return [];
                }
                const variable = document.variables[override.variableId];

                return variable ? [variableValue(variable, document.variables)] : [];
            });
            keys.push(`${geometryKey}:${JSON.stringify(variables)}:${nested.key}`);

            continue;
        }

        boxes.push(drawnBox({ ...shape, bounds: getShapeBounds(shape) }));
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
export function instanceBox(instance: InstanceShape, source: ComponentSource): Box {
    return rectToBox({
        x: instance.position.x,
        y: instance.position.y,
        width: source.box.width,
        height: source.box.height
    });
}
