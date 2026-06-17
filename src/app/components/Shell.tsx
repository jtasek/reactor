import React, { FC, Suspense, lazy } from 'react';
import { useCurrentPage } from '../hooks';
import { useKeyboardDriver } from 'src/events/drivers/useKeyboardDriver';
import { usePreventNativePinchZoom } from './usePreventNativePinchZoom';

const Designer = lazy(() =>
    import('../../pages/Designer').then((module) => ({ default: module.Designer }))
);
const Documents = lazy(() =>
    import('../../pages/Documents').then((module) => ({ default: module.Documents }))
);

export const Shell: FC = () => {
    useKeyboardDriver();
    usePreventNativePinchZoom();

    const currentPage = useCurrentPage();

    return (
        <Suspense fallback={null}>
            {currentPage === 'designer' && <Designer />}
            {currentPage === 'documents' && <Documents />}
        </Suspense>
    );
};
