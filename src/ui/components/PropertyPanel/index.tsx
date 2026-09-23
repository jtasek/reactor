import React, { FC } from 'react';

import { PropertyPanel } from './PropertyPanel';
import { useActions, useControls, useCurrentDocument } from 'src/app/hooks';

export const PropertyPanelContainer: FC = () => {
    const { selectedShapes, selectedShapesIds } = useCurrentDocument();
    const { propertyPanel } = useControls();
    const { setShapesProperty } = useActions();

    if (!propertyPanel.visible) {
        return null;
    }

    return (
        <PropertyPanel
            shapes={selectedShapes}
            onChange={(key, value) =>
                setShapesProperty({ shapeIds: [...selectedShapesIds], key, value })
            }
        />
    );
};
