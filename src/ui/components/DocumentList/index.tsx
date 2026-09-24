import React, { FC } from 'react';
import { DocumentList } from './DocumentList';
import { useActions, useCurrentDocumentId, useDocumentsIds } from 'src/app/hooks';

export const DocumentListContainer: FC = () => {
    const documentsIds = useDocumentsIds();
    const currentDocumentId = useCurrentDocumentId();
    const { newDocument } = useActions();

    return (
        <DocumentList
            documentsIds={documentsIds}
            currentDocumentId={currentDocumentId}
            onCreate={() => newDocument()}
        />
    );
};
