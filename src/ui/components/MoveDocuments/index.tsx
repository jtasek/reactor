import React, { Suspense, lazy, useSyncExternalStore } from 'react';
import { useAppState } from 'src/app/hooks';
import { subscribeToTerms, termsSettled } from 'src/app/termsCheck';

const LoadedMoveDocuments = lazy(() =>
    import(/* webpackChunkName: "document-history" */ './MoveDocuments').then((module) => ({
        default: module.MoveDocuments
    }))
);

/**
 * Once signed in, offers to move this browser's signed-out documents into the
 * account; on the pages signing in returns to, the Documents page and the editor.
 * It waits for the terms check, so it never covers the terms dialog.
 * Its code shares the document history's chunk, as neither is needed to start.
 */
export const MoveDocuments = () => {
    const owner = useAppState((state) =>
        state.account.kind === 'signedIn' && !state.loading ? state.account.id : null
    );
    const settled = useSyncExternalStore(subscribeToTerms, termsSettled);

    return owner && settled === owner ? (
        <Suspense fallback={null}>
            <LoadedMoveDocuments owner={owner} />
        </Suspense>
    ) : null;
};
