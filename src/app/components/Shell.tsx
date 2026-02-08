import React, { FC } from 'react';
import { Designer, Documents } from '../../pages';
import { useCurrentPage } from '../hooks';
import { useKeyboardDriver } from 'src/events/drivers/useKeyboardDriver';
import { usePreventNativePinchZoom } from './usePreventNativePinchZoom';

export const Shell: FC = () => {
    usePreventNativePinchZoom();
    useKeyboardDriver();

    const currentPage = useCurrentPage();

    return (
        <>
            {currentPage === 'designer' && <Designer />}
            {currentPage === 'documents' && <Documents />}
        </>
    );
};
