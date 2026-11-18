import React, { FC, lazy, Suspense } from 'react';
import { useAiEdit, useAiEditView } from 'src/app/aiHooks';

const LoadedEditWithWords = lazy(() =>
    import(/* webpackChunkName: "ai" */ './EditWithWords').then((module) => ({
        default: module.EditWithWords
    }))
);
const LoadedCanvasBar = lazy(() =>
    import(/* webpackChunkName: "ai" */ './CanvasBar').then((module) => ({
        default: module.CanvasBar
    }))
);

/** The Edit with words chat, whose code and the AI client load the first time it opens. */
export const EditWithWords: FC = () => {
    const documentId = useAiEdit();
    const view = useAiEditView();

    if (documentId === undefined || view !== 'panel') {
        return null;
    }

    return (
        <Suspense fallback={null}>
            <LoadedEditWithWords key={documentId} documentId={documentId} />
        </Suspense>
    );
};

/** The same chat as one bar over the canvas, opened from the selection. */
export const AiCanvasBar: FC = () => {
    const documentId = useAiEdit();
    const view = useAiEditView();

    if (documentId === undefined || view !== 'bar') {
        return null;
    }

    return (
        <Suspense fallback={null}>
            <LoadedCanvasBar key={documentId} documentId={documentId} />
        </Suspense>
    );
};
