import React, { lazy, Suspense } from 'react';
import { useControls } from 'src/app/hooks';

const LoadedStats = lazy(() =>
    import(/* webpackChunkName: "stats" */ './Stats').then((module) => ({
        default: module.Stats
    }))
);

export const Stats = ({ horizontal = false }) => {
    const { stats } = useControls();
    if (!stats.visible) {
        return null;
    }

    return (
        <Suspense fallback={<p>Loading data…</p>}>
            <LoadedStats horizontal={horizontal} />
        </Suspense>
    );
};
