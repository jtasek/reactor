import React, { FC } from 'react';

import { Inspector } from './Inspector';
import { useActions, useSelectedShapesIds, useSelectedShapesProperties } from 'src/app/hooks';
import { useSelectedVariables, useVariables } from 'src/app/variableHooks';

export const InspectorContainer: FC = () => {
    const rows = useSelectedShapesProperties();
    const selectedShapesIds = useSelectedShapesIds();
    const variables = useVariables();
    const bound = useSelectedVariables();
    const { bindProperty, setShapesProperty, unbindProperty } = useActions();

    return (
        <Inspector
            rows={rows}
            shapeIds={[...selectedShapesIds]}
            onChange={(shapeIds, key, value) => setShapesProperty({ shapeIds, key, value })}
            variables={variables}
            bound={bound}
            onBind={(shapeIds, key, variableId) => bindProperty({ shapeIds, key, variableId })}
            onUnbind={(shapeIds, key) => unbindProperty({ shapeIds, key })}
        />
    );
};
