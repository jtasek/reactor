import React, { FC, Suspense, lazy } from 'react';
import { useCurrentPage, useLoading } from '../hooks';
import { useKeyboardDriver } from 'src/events/drivers/useKeyboardDriver';
import { usePreventNativePinchZoom } from './usePreventNativePinchZoom';
import { Notification } from './Notification';

const Designer = lazy(() =>
    import('../../pages/Designer').then((module) => ({ default: module.Designer }))
);
const Account = lazy(() =>
    import('../../pages/Account').then((module) => ({ default: module.Account }))
);
const Documents = lazy(() =>
    import('../../pages/Documents').then((module) => ({ default: module.Documents }))
);

export const Shell: FC = () => {
    useKeyboardDriver();
    usePreventNativePinchZoom();

    const currentPage = useCurrentPage();
    const loading = useLoading();

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
