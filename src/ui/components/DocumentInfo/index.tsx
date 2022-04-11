import React, { FC } from 'react';

import { useControls, useCurrentDocument } from 'src/app/hooks';
import { DocumentInfo } from './DocumentInfo';

export const ConnectedDocumentInfo: FC = () => {
  const { documentInfo } = useControls();
  const document = useCurrentDocument();

  if (!documentInfo.visible) {
    return null;
  }

  return <DocumentInfo document={document} />;
};
