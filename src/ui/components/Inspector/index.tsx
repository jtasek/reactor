import React, { FC } from 'react';

import { Inspector } from './Inspector';
import { useActions, useSelectedShapesIds, useSelectedShapesProperties } from 'src/app/hooks';

export const InspectorContainer: FC = () => {
    const rows = useSelectedShapesProperties();
    const selectedShapesIds = useSelectedShapesIds();
    const { setShapesProperty } = useActions();

    return (
        <Inspector
            rows={rows}
            shapeIds={[...selectedShapesIds]}
            onChange={(shapeIds, key, value) => setShapesProperty({ shapeIds, key, value })}
        />
    );
};
