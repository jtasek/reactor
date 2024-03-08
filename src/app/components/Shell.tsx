import React, { FC } from 'react';
import { useCurrentPage } from '../hooks';
import { useKeyboardDriver } from 'src/events/drivers/useKeyboardDriver';
import { usePointerDriver } from 'src/events/drivers/usePointerDriver';
import { usePreventNativePinchZoom } from './usePreventNativePinchZoom';

import { Designer, Documents } from '../../pages';

export const Shell: FC = () => {
    usePreventNativePinchZoom();
    useKeyboardDriver();
    usePointerDriver();

    const currentPage = useCurrentPage();

    return (
        <>
            {currentPage === 'designer' && <Designer />}
            {currentPage === 'documents' && <Documents />}
        </>
    );
};
