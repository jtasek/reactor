import React, { lazy, Suspense } from 'react';
import { useControls } from 'src/app/hooks';

const ActiveCommandLine = lazy(
    () => import(/* webpackChunkName: "command-palette" */ './ActiveCommandLine')
);

export const ConnectedCommandLine = () => {
    const { commandLine } = useControls();

    if (!commandLine.visible) {
        return null;
    }

    return (
        <Suspense fallback={null}>
            <ActiveCommandLine />
        </Suspense>
    );
};

export default ConnectedCommandLine;
