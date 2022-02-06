import React, { FC } from 'react';

import { useAppState } from 'src/app/hooks';
import { DocumentInfo } from './DocumentInfo';

export const ConnectedDocumentInfo: FC = () => {
  const state = useAppState();

  if (!state.ui.documentInfo.visible) {
    return null;
  }

  return <DocumentInfo document={state.currentDocument} />;
};
