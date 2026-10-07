import React, { FC } from 'react';

import { useControls, useCurrentDocument } from 'src/app/hooks';
import { getPropValue } from 'src/app/utils';
import { DocumentInfo } from './DocumentInfo';

export const ConnectedDocumentInfo: FC = () => {
    const { documentInfo } = useControls();
    const document = useCurrentDocument();

    if (!documentInfo.visible || !document) {
        return null;
    }

    const fields = Object.entries(document).map(([name, value]) => ({
        name,
        value: getPropValue(value)
    }));

    return <DocumentInfo fields={fields} />;
};
