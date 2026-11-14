import React, { Suspense, lazy } from 'react';
import { useAppState } from 'src/app/hooks';

const LoadedDocumentHistory = lazy(() =>
    import(/* webpackChunkName: "document-history" */ './DocumentHistory').then((module) => ({
        default: module.DocumentHistory
    }))
);

/** The current document's history on the server, loaded once it is asked for. */
export const DocumentHistory = () => {
    const documentId = useAppState((state) =>
        state.historyDocumentId === state.currentDocumentId ? state.historyDocumentId : null
    );

    return documentId ? (
        <Suspense fallback={null}>
            <LoadedDocumentHistory documentId={documentId} />
        </Suspense>
    ) : null;
};
