import React, { FC } from 'react';

import { PropertyPanel } from './PropertyPanel';
import { useAppState } from 'src/app/hooks';

export const PropertyPanelContainer: FC = () => {
  const { currentDocument, ui } = useAppState();

  if (!ui.propertyPanel.visible) {
    return null;
  }

  return <PropertyPanel shapes={currentDocument.selectedShapes} />;
};
