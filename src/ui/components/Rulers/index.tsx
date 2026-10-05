import React, { FC, lazy, Suspense } from 'react';
import { useControls } from 'src/app/hooks';

const LoadedRulers = lazy(() =>
    import(/* webpackChunkName: "guides" */ './Rulers').then((module) => ({
        default: module.Rulers
    }))
);

/** The rulers, loaded the first time the Rulers control is turned on. */
export const Rulers: FC = () => {
    const { rulers } = useControls();

    if (!rulers.visible) {
        return null;
    }

    return (
        <Suspense fallback={null}>
            <LoadedRulers />
        </Suspense>
    );
};
