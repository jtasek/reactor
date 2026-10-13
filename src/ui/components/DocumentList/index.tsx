import React, { FC } from 'react';
import { DocumentList } from './DocumentList';
import { useActions, useCurrentDocumentId, useDocuments, useDocumentsIds } from 'src/app/hooks';

export const DocumentListContainer: FC = () => {
    const byId = useDocuments();
    const documents = useDocumentsIds().map((id) => ({
        id,
        name: byId[id].name,
        modified: byId[id].modified,
        tags: [...byId[id].tags]
    }));
    const currentDocumentId = useCurrentDocumentId();
    const { newDocument } = useActions();

    return (
        <DocumentList
            documents={documents}
            currentDocumentId={currentDocumentId}
            onCreate={() => newDocument()}
        />
    );
};
