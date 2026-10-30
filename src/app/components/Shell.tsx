import { editorLoaded, subscribeToEditorHelpers } from '../editorHelpers';
import React, { FC, Suspense, lazy, useEffect, useLayoutEffect, useSyncExternalStore } from 'react';
import { useActions, useCurrentPage, useLoading } from '../hooks';
import { useClipboardDriver } from 'src/events/drivers/useClipboardDriver';
import { useKeyboardDriver } from 'src/events/drivers/useKeyboardDriver';
import { usePreventNativePinchZoom } from './usePreventNativePinchZoom';
import { Notification } from './Notification';

/** The editor page, with the commands and tools it registers; a second load reuses the first. */
const loadDesigner = () => import('../../pages/Designer');

const Designer = lazy(() => loadDesigner().then((module) => ({ default: module.Designer })));
const Account = lazy(() =>
    import('../../pages/Account').then((module) => ({ default: module.Account }))
);
const Documents = lazy(() =>
    import('../../pages/Documents').then((module) => ({ default: module.Documents }))
);
const Variables = lazy(() =>
    import('../../pages/Variables').then((module) => ({ default: module.VariablesPage }))
);

const Sharing = lazy(() =>
    import('../../pages/Sharing').then((module) => ({ default: module.Sharing }))
);
const Invitation = lazy(() =>
    import('../../pages/Invitation').then((module) => ({ default: module.Invitation }))
);

export const Shell: FC = () => {
    useKeyboardDriver();
    useClipboardDriver();
    usePreventNativePinchZoom();

    const ready = useSyncExternalStore(subscribeToEditorHelpers, editorLoaded);
    const { setEditorReady } = useActions();
    useLayoutEffect(() => {
        setEditorReady();
    }, [ready, setEditorReady]);

    const currentPage = useCurrentPage();
    const loading = useLoading();

    // The editor's code downloads while the documents load, rather than after them.
    useEffect(() => {
        if (currentPage === 'designer') {
            void loadDesigner();
        }
    }, [currentPage]);

    return (
        <>
            <Notification />
            {!loading && (
                <Suspense fallback={null}>
                    {currentPage === 'designer' && <Designer />}
                    {currentPage === 'documents' && <Documents />}
                    {currentPage === 'variables' && <Variables />}
                    {(currentPage === 'account' || currentPage === 'login') && (
                        <Account login={currentPage === 'login'} />
                    )}
                    {currentPage === 'sharing' && <Sharing />}
                    {currentPage === 'invitation' && <Invitation />}
                </Suspense>
            )}
        </>
    );
};
