import React, { memo } from 'react';
import {
    useShapesIds,
    useShapesInClosedGroupsIds,
    useShapesInSelectedGroupsIds
} from 'src/app/hooks';
import { Shape } from '../Shape/Shape';
import { GroupSelections } from '../GroupSelection';

export const Shapes = memo(() => {
    const shapesIds = useShapesIds();
    const grouped = new Set(useShapesInSelectedGroupsIds());
    const closed = new Set(useShapesInClosedGroupsIds());

    return (
        <>
            <g id="shapes">
                {shapesIds.map((shapeId: string) => (
                    <Shape
                        key={shapeId}
                        shapeId={shapeId}
                        inSelectedGroup={grouped.has(shapeId)}
                        inClosedGroup={closed.has(shapeId)}
                    />
                ))}
            </g>
            <GroupSelections />
        </>
    );
});

Shapes.displayName = 'Shapes';
