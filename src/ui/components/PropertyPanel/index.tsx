import React, { FC } from 'react';

import { PropertyPanel } from './PropertyPanel';
import { useControls, useCurrentDocument } from 'src/app/hooks';

export const PropertyPanelContainer: FC = () => {
  const { selectedShapes } = useCurrentDocument();
  const { propertyPanel } = useControls();

  if (!propertyPanel.visible) {
    return null;
  }

  return <PropertyPanel shapes={selectedShapes} />;
};
