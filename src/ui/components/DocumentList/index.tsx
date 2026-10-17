import React, { FC, useEffect } from 'react';
import { DocumentList } from './DocumentList';
import {
    useActions,
    useCurrentDocumentId,
    useDocuments,
    useDocumentsIds,
    useDocumentsLayout
} from 'src/app/hooks';
import { tagKey } from 'src/app/tagTones';

export const DocumentListContainer: FC = () => {
    const byId = useDocuments();
    const documents = useDocumentsIds().map((id) => ({
        id,
        name: byId[id].name,
        modified: byId[id].modified,
        deleted: byId[id].deleted,
        tags: [...byId[id].tags],
        tagTones: { ...byId[id].tagTones }
    }));
    const currentDocumentId = useCurrentDocumentId();
    const layout = useDocumentsLayout();
    const { newDocument, updateDocument, purgeDeletedDocuments, setDocumentsLayout } = useActions();
    // A tone is kept with every document that has the tag; it does not date them.
    const setTagTone = (tag: string, tone: string) =>
        documents
            .filter((document) => document.tags.some((name) => tagKey(name) === tagKey(tag)))
            .forEach((document) =>
                updateDocument({
                    id: document.id,
                    tagTones: { ...document.tagTones, [tagKey(tag)]: tone }
                })
            );

    useEffect(() => purgeDeletedDocuments(), [purgeDeletedDocuments]);

    return (
        <DocumentList
            documents={documents}
            currentDocumentId={currentDocumentId}
            layout={layout}
            onLayout={setDocumentsLayout}
            onCreate={() => newDocument()}
            onTagTone={setTagTone}
        />
    );
};
