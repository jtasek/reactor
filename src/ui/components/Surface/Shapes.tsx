import React, { memo } from 'react';
import { useShapesIds } from 'src/app/hooks';
import { Shape } from '../Shape/Shape';
import { GroupSelections } from '../GroupSelection';

export const Shapes = memo(() => {
    const shapesIds = useShapesIds();

    return (
        <>
            <g id="shapes">
                {shapesIds.map((shapeId: string) => (
                    <Shape key={shapeId} shapeId={shapeId} />
                ))}
            </g>
            <GroupSelections />
        </>
    );
});

Shapes.displayName = 'Shapes';
