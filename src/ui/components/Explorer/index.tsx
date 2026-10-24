import React, { FC, lazy, Suspense } from 'react';

const LoadedExplorer = lazy(() =>
    import(/* webpackChunkName: "explorer" */ './Explorer').then((module) => ({
        default: module.Explorer
    }))
);

/** Explorer loads when its panel opens, keeping the editor file within its budget. */
export const Explorer: FC = () => (
    <Suspense fallback={null}>
        <LoadedExplorer />
    </Suspense>
);
