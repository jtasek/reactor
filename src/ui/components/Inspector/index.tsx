import React, { FC } from 'react';

import { Inspector } from './Inspector';
import {
    useActions,
    useControls,
    useSelectedShapesIds,
    useSelectedShapesProperties
} from 'src/app/hooks';

const SelectionInspector: FC = () => {
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

export const InspectorContainer: FC = () => {
    const { inspector } = useControls();

    return inspector.visible ? <SelectionInspector /> : null;
};
