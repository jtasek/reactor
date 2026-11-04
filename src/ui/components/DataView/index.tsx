import React, { lazy, Suspense } from 'react';
import { useControls } from 'src/app/hooks';

const DataView = lazy(() => import(/* webpackChunkName: "data-editor" */ './DataView'));

export const ConnectedDataView = () => {
    const { dataView } = useControls();
    if (!dataView.visible) {
        return null;
    }

    return (
        <Suspense fallback={<p>Loading data…</p>}>
            <DataView />
        </Suspense>
    );
};
