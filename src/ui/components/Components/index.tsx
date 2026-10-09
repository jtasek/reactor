import React, { FC, lazy, Suspense } from 'react';

const LoadedComponents = lazy(() =>
    import(/* webpackChunkName: "components" */ './Components').then((module) => ({
        default: module.Components
    }))
);

export const Components: FC = () => (
    <Suspense fallback={null}>
        <LoadedComponents />
    </Suspense>
);
