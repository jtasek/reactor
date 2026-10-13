import React, { FC } from 'react';
import { DocumentList } from './DocumentList';
import { useActions, useCurrentDocumentId, useDocuments, useDocumentsIds } from 'src/app/hooks';
import { tagKey } from 'src/app/tagTones';

export const DocumentListContainer: FC = () => {
    const byId = useDocuments();
    const documents = useDocumentsIds().map((id) => ({
        id,
        name: byId[id].name,
        modified: byId[id].modified,
        tags: [...byId[id].tags],
        tagTones: { ...byId[id].tagTones }
    }));
    const currentDocumentId = useCurrentDocumentId();
    const { newDocument, updateDocument } = useActions();
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

    return (
        <DocumentList
            documents={documents}
            currentDocumentId={currentDocumentId}
            onCreate={() => newDocument()}
            onTagTone={setTagTone}
        />
    );
};
