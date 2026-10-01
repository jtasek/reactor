import React, { memo } from 'react';
import { useShapesIds, useShapesInSelectedGroupsIds } from 'src/app/hooks';
import { Shape } from '../Shape/Shape';
import { GroupSelections } from '../GroupSelection';

export const Shapes = memo(() => {
    const shapesIds = useShapesIds();
    const grouped = new Set(useShapesInSelectedGroupsIds());

    return (
        <>
            <g id="shapes">
                {shapesIds.map((shapeId: string) => (
                    <Shape key={shapeId} shapeId={shapeId} inSelectedGroup={grouped.has(shapeId)} />
                ))}
            </g>
            <GroupSelections />
        </>
    );
});

Shapes.displayName = 'Shapes';
