import React, { CSSProperties, FC, memo, useLayoutEffect, useRef } from 'react';
import { Active } from '../Active/Active';
import { Label } from '../Label';
import { Resizable } from '../Selectable/Resizable';
import { Selectable } from '../Selectable/Selectable';
import { getComponentByType } from 'src/tools/components';
import { rectToBox, shapeGeometryKey, getShapeBounds, boxCenter } from 'src/app/utils';
import {
    useActions,
    useMeasuringShape,
    useShape,
    useShapeLocked,
    useShapeVisible
} from 'src/app/hooks';

interface Props {
    shapeId: string;
    /** In a group selected as one, which draws the selection instead. */
    inSelectedGroup: boolean;
    /** In a group not double-clicked into, so the pointer does not highlight it alone. */
    inClosedGroup: boolean;
}

export const Shape = memo(({ shapeId, inSelectedGroup, inClosedGroup }: Props) => {
    const shape = useShape(shapeId);
    const visible = useShapeVisible(shapeId);
    const locked = useShapeLocked(shapeId);
    const { setShapeBounds, activateShape, deactivateShape } = useActions();
    const measuring = useMeasuringShape(shapeId);
    const measuredGeometry = useRef<string | null>(null);
    const groupRef = useRef<SVGGElement>(null);
    // The component of this shape's type, which takes this shape's fields.
    const Component = getComponentByType(shape.type) as FC<Omit<typeof shape, 'key'>>;
    const geometryKey = shapeGeometryKey(shape);

    // Measure the actual rendered geometry so the selection box, handles and
    // label match exactly. getBBox returns local (canvas) coordinates, so it is
    // unaffected by the camera pan/zoom transform on ancestor groups. Keyed on
    // the geometry only, so toggling `selected` during a marquee drag does not
    // trigger a costly reflow. Re-measure when a hidden shape is shown again, as
    // its geometry may have changed while it was not rendered. A gesture that
    // keeps bounds itself puts measuring off until it ends, and then only the
    // shapes it changed are measured.
    useLayoutEffect(() => {
        if (!visible) {
            measuredGeometry.current = null;

            return;
        }

        if (!measuring || measuredGeometry.current === geometryKey) {
            return;
        }

        const node = groupRef.current;

        if (!node) {
            return;
        }

        try {
            const bounds = rectToBox(node.getBBox());
            setShapeBounds({ id: shapeId, bounds });
            measuredGeometry.current = geometryKey;
        } catch {
            // getBBox throws for elements that are not yet renderable; ignore.
        }
    }, [geometryKey, shapeId, setShapeBounds, measuring, visible]);

    if (!Component) {
        console.error(`Component ${shape.type} not found`);
        return null;
    }

    // Hidden by its own flag or by a hidden group or layer.
    if (!visible) {
        return null;
    }

    // The selection overlays (box, resize handles, label) are only relevant for
    // a selected shape. Gating them here — rather than letting each overlay
    // early-return null — keeps unselected shapes from mounting Resizable, whose
    // usePointer() subscription would otherwise re-render every shape on every
    // pointer frame during a drag.
    // A rotation is applied as a group transform around the box center so the
    // shape and all of its overlays (selection box, handles, label) rotate
    // together while the stored geometry stays axis-aligned.
    const center = boxCenter(getShapeBounds(shape));
    const transform = shape.rotation
        ? `rotate(${shape.rotation} ${center.x} ${center.y})`
        : undefined;
    const { key, ...props } = shape;

    return (
        <g transform={transform}>
            <g
                ref={groupRef}
                opacity={shape.opacity}
                style={{ pointerEvents: 'all', '--shape-fill': shape.fill } as CSSProperties}
                onPointerEnter={() => activateShape(shapeId)}
                onPointerLeave={() => deactivateShape(shapeId)}
            >
                <Component key={key} {...props} />
            </g>
            {shape.active && !shape.selected && !inClosedGroup && (
                <Active key={`active-${shape.type}-${shape.id}`} shape={shape} />
            )}
            {shape.selected && !inSelectedGroup && (
                <>
                    <Selectable key={`selectable-${shape.type}-${shape.id}`} shape={shape} />
                    {/* Locked shapes stay selectable but cannot be resized or rotated. */}
                    {!locked && (
                        <Resizable key={`resizable-${shape.type}-${shape.id}`} shape={shape} />
                    )}
                    <Label key={`label-${shape.type}-${shape.id}`} shape={shape} />
                </>
            )}
        </g>
    );
});

Shape.displayName = 'Shape';
