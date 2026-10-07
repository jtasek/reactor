import React, { FC, useRef } from 'react';

import { useCurrentDocument, useGestureInProgress } from 'src/app/hooks';
import { getPropValue } from 'src/app/utils';
import { DocumentField, DocumentInfo } from './DocumentInfo';

export const ConnectedDocumentInfo: FC = () => {
    const document = useCurrentDocument();
    const gestureInProgress = useGestureInProgress();
    const held = useRef<DocumentField[]>([]);

    if (!document) {
        return null;
    }

    // Read only between gestures, so a drag does not render the panel at every move.
    if (!gestureInProgress) {
        held.current = Object.entries(document).map(([name, value]) => ({
            name,
            value: getPropValue(value)
        }));
    }

    return <DocumentInfo fields={held.current} />;
};
