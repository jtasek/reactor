import React, { FC } from 'react';

import { Inspector } from './Inspector';
import { useActions, useSelectedShapesIds, useSelectedShapesProperties } from 'src/app/hooks';
import { useSelectedVariables, useTextTemplateProblems, useVariables } from 'src/app/variableHooks';

const cannotShow = (names: string[]) => `Cannot show ${names.join(', ')}`;

export const InspectorContainer: FC = () => {
    const rows = useSelectedShapesProperties();
    const selectedShapesIds = useSelectedShapesIds();
    const variables = useVariables();
    const bound = useSelectedVariables();
    const problems = useTextTemplateProblems();
    const { bindProperty, setShapesProperty, unbindProperty } = useActions();

    return (
        <Inspector
            rows={rows}
            shapeIds={[...selectedShapesIds]}
            onChange={(shapeIds, key, value) => setShapesProperty({ shapeIds, key, value })}
            variables={variables}
            bound={bound}
            notes={problems.length > 0 ? { text: cannotShow(problems) } : {}}
            onBind={(shapeIds, key, variableId) => bindProperty({ shapeIds, key, variableId })}
            onUnbind={(shapeIds, key) => unbindProperty({ shapeIds, key })}
        />
    );
};
