import React, { FC, Suspense, lazy, useEffect } from 'react';
import { useCurrentPage, useLoading } from '../hooks';
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

export const Shell: FC = () => {
    useKeyboardDriver();
    useClipboardDriver();
    usePreventNativePinchZoom();

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
                    {currentPage === 'account' && <Account />}
                </Suspense>
            )}
        </>
    );
};
