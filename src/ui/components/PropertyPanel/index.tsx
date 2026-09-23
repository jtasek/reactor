import React, { FC } from 'react';

import { PropertyPanel } from './PropertyPanel';
import { sharedProperties } from 'src/app/properties';
import { useActions, useControls, useCurrentDocument } from 'src/app/hooks';

export const PropertyPanelContainer: FC = () => {
    const currentDocument = useCurrentDocument();
    const { propertyPanel } = useControls();
    const { setShapesProperty } = useActions();

    if (!propertyPanel.visible) {
        return null;
    }

    return (
        <PropertyPanel
            rows={sharedProperties(currentDocument.selectedShapes, currentDocument)}
            shapeIds={[...currentDocument.selectedShapesIds]}
            onChange={(shapeIds, key, value) => setShapesProperty({ shapeIds, key, value })}
        />
    );
};
