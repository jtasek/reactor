import React, { FC, useLayoutEffect, useRef } from 'react';
import { Label } from '../Label';
import { Resizable } from '../Selectable/Resizable';
import { Selectable } from '../Selectable/Selectable';
import { getComponentByType } from 'src/tools/components';
import { rectToBox, shapeGeometryKey } from 'src/app/utils';
import { useActions, useAppState, useShape } from 'src/app/hooks';

interface Props {
    shapeId: string;
}

export const Shape: FC<Props> = ({ shapeId }) => {
    const shape = useShape(shapeId);
    const { setShapeBounds } = useActions();
    // A move is a pure translation: `moveSelectedShapes` already shifts the
    // cached bounds analytically, so re-measuring via getBBox every frame is
    // wasted work that forces a synchronous layout reflow. Skip measurement
    // while the Move tool is dragging; the effect re-runs once the drag ends.
    const measuring = useAppState(
        (state) => !(state.tools.activeToolsIds[0] === 'move' && state.events.pointer.dragging)
    );
    const groupRef = useRef<SVGGElement>(null);
    const Component = getComponentByType(shape.type);
    const geometryKey = shapeGeometryKey(shape);

    // Measure the actual rendered geometry so the selection box, handles and
    // label match exactly. getBBox returns local (canvas) coordinates, so it is
    // unaffected by the camera pan/zoom transform on ancestor groups. Keyed on
    // the geometry only, so toggling `selected` during a marquee drag does not
    // trigger a costly reflow.
    useLayoutEffect(() => {
        if (!measuring) {
            return;
        }

        const node = groupRef.current;

        if (!node) {
            return;
        }

        try {
            const bounds = rectToBox(node.getBBox());
            setShapeBounds({ id: shapeId, bounds });
        } catch {
            // getBBox throws for elements that are not yet renderable; ignore.
        }
    }, [geometryKey, shapeId, setShapeBounds, measuring]);

    if (!Component) {
        console.error(`Component ${shape.type} not found`);
        return null;
    }

    return (
        <>
            <g ref={groupRef}>
                <Component {...shape} />
            </g>
            <Selectable key={`selectable-${shape.type}-${shape.id}`} shape={shape} />
            <Resizable key={`resizable-${shape.type}-${shape.id}`} shape={shape} />
            <Label key={`label-${shape.type}-${shape.id}`} shape={shape} />
        </>
    );
};
