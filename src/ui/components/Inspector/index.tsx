import React, { FC } from 'react';

import { Inspector } from './Inspector';
import { sharedProperties } from 'src/app/properties';
import { useActions, useControls, useCurrentDocument } from 'src/app/hooks';

export const InspectorContainer: FC = () => {
    const currentDocument = useCurrentDocument();
    const { inspector } = useControls();
    const { setShapesProperty } = useActions();

    if (!inspector.visible) {
        return null;
    }

    return (
        <Inspector
            rows={sharedProperties(currentDocument.selectedShapes, currentDocument)}
            shapeIds={[...currentDocument.selectedShapesIds]}
            onChange={(shapeIds, key, value) => setShapesProperty({ shapeIds, key, value })}
        />
    );
};
