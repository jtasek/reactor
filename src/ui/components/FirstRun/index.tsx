import React, { Suspense, lazy, useEffect } from 'react';
import { useActions, useAppState } from 'src/app/hooks';
import { markStarted, takeOpenAfterSignIn, useStarted } from 'src/app/firstRun';
import { Guide } from './Guide';

const StartPanel = lazy(() => import(/* webpackChunkName: "starter-templates" */ './StartPanel'));

/**
 * The editor's first-run path: until the person has started a document on this device,
 * starter templates on an empty canvas; then a guide through editing, playing and sharing
 * the document started from one.
 */
export function FirstRun() {
    const { openDocument } = useActions();
    const started = useStarted();
    const { documentId, empty, drawing, signedIn, documentsIds } = useAppState((state) => ({
        documentId: state.currentDocumentId,
        empty:
            state.currentDocument.shapesIds.length === 0 &&
            state.currentDocument.framesIds.length === 0 &&
            state.currentDocument.componentsIds.length === 0,
        drawing: state.tools.activeToolsIds[0] !== 'select',
        signedIn: state.account.kind === 'signedIn',
        documentsIds: state.documentsIds
    }));

    // A document whose sharing asked to sign in opens again once it has moved into the account.
    useEffect(() => {
        if (!signedIn) {
            return;
        }

        const reopened = takeOpenAfterSignIn((id) => documentsIds.includes(id));

        if (reopened && reopened !== documentId) {
            openDocument(reopened);
        }
    }, [signedIn, documentsIds, documentId, openDocument]);

    // Drawing, or a document with content, starts without a template.
    useEffect(() => {
        if (!started && (!empty || drawing)) {
            markStarted();
        }
    }, [started, empty, drawing]);

    if (!started && empty && !drawing) {
        return (
            <Suspense fallback={null}>
                <StartPanel onBlank={markStarted} />
            </Suspense>
        );
    }

    return <Guide page="editor" />;
}
