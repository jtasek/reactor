import React, { FC, lazy, Suspense } from 'react';

const LoadedVariables = lazy(() =>
    import(/* webpackChunkName: "variables" */ './Variables').then((module) => ({
        default: module.Variables
    }))
);

/** The variables panel, loaded the first time the Variables control is turned on. */
export const Variables: FC = () => (
    <Suspense fallback={null}>
        <LoadedVariables />
    </Suspense>
);
