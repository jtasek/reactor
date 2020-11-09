import React, { FC } from 'react';

import { useState } from 'src/app/hooks';
import { DocumentInfo } from './DocumentInfo';

export const ConnectedDocumentInfo: FC = () => {
  const state = useState();

  if (!state.ui.documentInfo.visible) {
    return null;
  }

  return <DocumentInfo document={state.currentDocument} />;
};
