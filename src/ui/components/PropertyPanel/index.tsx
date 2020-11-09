import React, { FC } from 'react';

import { PropertyPanel } from './PropertyPanel';
import { useState } from 'src/app/hooks';

export const PropertyPanelContainer: FC = () => {
  const { currentDocument, ui } = useState();

  if (!ui.propertyPanel.visible) {
    return null;
  }

  return <PropertyPanel shapes={currentDocument.selectedShapes} />;
};
