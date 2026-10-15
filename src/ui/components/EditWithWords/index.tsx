import React, { FC, lazy, Suspense } from 'react';
import { useAiEdit } from 'src/app/aiHooks';

const LoadedEditWithWords = lazy(() =>
    import(/* webpackChunkName: "ai" */ './EditWithWords').then((module) => ({
        default: module.EditWithWords
    }))
);

/** The Edit with words chat, whose code and the AI client load the first time it opens. */
export const EditWithWords: FC = () => {
    const documentId = useAiEdit();

    if (documentId === undefined) {
        return null;
    }

    return (
        <Suspense fallback={null}>
            <LoadedEditWithWords key={documentId} documentId={documentId} />
        </Suspense>
    );
};
